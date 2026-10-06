import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiProblem } from '~/shared/api/problem'
import type { Account, AuthResult } from '~/shared/api/types'
import type { AuthGateway } from '~/shared/auth/auth-gateway'
import { createRunExclusive } from '~/shared/auth/exclusive'
import { useSessionStore } from '~/shared/auth/session.store'
import type { TokenStorage } from '~/shared/auth/token-storage'

const staff: Account = {
  id: 'u1',
  type: 'STAFF',
  email: 'staff@example.com',
  firstNames: 'Ana',
  lastNames: 'Pérez',
  emailVerified: false,
  mustChangePassword: false,
  roles: [],
  permissions: ['orders.read'],
  createdAt: '2026-10-01T00:00:00.000Z',
} as Account

let counter = 0
function authResult(): AuthResult {
  counter += 1
  return {
    outcome: 'AUTHENTICATED',
    accessToken: `at-${counter}`,
    accessTokenExpiresIn: 900,
    refreshToken: `rt-${counter}`,
    refreshTokenExpiresIn: 604800,
    tokenType: 'Bearer',
    mustChangePassword: false,
  }
}

function memoryStorage(initial: string | null = null): TokenStorage & { value: string | null } {
  return {
    value: initial,
    read() {
      return this.value
    },
    write(token) {
      this.value = token
    },
    clear() {
      this.value = null
    },
  }
}

function fakeGateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    login: vi.fn(async () => authResult()),
    refresh: vi.fn(async () => authResult()),
    logout: vi.fn(async () => undefined),
    me: vi.fn(async () => staff),
    changePassword: vi.fn(async () => undefined),
    ...overrides,
  }
}

function setup(gateway: AuthGateway, storage = memoryStorage()) {
  const session = useSessionStore()
  // Sin Web Locks: se usa el respaldo que serializa dentro de la pestaña.
  session.init({ gateway, storage, runExclusive: createRunExclusive(undefined) })
  return { session, storage }
}

beforeEach(() => {
  setActivePinia(createPinia())
  counter = 0
  vi.useFakeTimers()
})

describe('sesión', () => {
  it('inicia sesión: token en memoria, refresh token guardado y permisos cargados', async () => {
    const { session, storage } = setup(fakeGateway())
    await session.login({ email: 'staff@example.com', password: 'x' })
    expect(session.isAuthenticated).toBe(true)
    expect(session.accessToken).toBe('at-1')
    expect(storage.value).toBe('rt-1')
    expect(session.can('orders.read')).toBe(true)
    expect(session.can('orders.manage')).toBe(false)
  })

  it('rechaza cuentas de cliente y cierra su sesión', async () => {
    const gateway = fakeGateway({
      me: vi.fn(async () => ({ ...staff, type: 'CUSTOMER', permissions: [] }) as Account),
    })
    const { session, storage } = setup(gateway)
    await expect(session.login({ email: 'c@example.com', password: 'x' })).rejects.toMatchObject({
      type: 'not-staff',
    })
    expect(session.isAuthenticated).toBe(false)
    expect(storage.value).toBeNull()
    expect(gateway.logout).toHaveBeenCalledWith('at-1', 'rt-1')
  })

  it('renueva una sola vez aunque lo pidan varias llamadas a la vez (API_SPEC §9.6)', async () => {
    const gateway = fakeGateway()
    const { session, storage } = setup(gateway, memoryStorage('rt-0'))
    const results = await Promise.all([session.refresh(), session.refresh(), session.refresh()])
    expect(results).toEqual([true, true, true])
    expect(gateway.refresh).toHaveBeenCalledTimes(1)
    expect(gateway.refresh).toHaveBeenCalledWith('rt-0')
    expect(storage.value).toBe('rt-1')
  })

  it('renovaciones seguidas usan siempre el refresh token más reciente', async () => {
    const gateway = fakeGateway()
    const { session } = setup(gateway, memoryStorage('rt-0'))
    await session.refresh()
    await session.refresh()
    expect(gateway.refresh).toHaveBeenNthCalledWith(2, 'rt-1')
  })

  it('un refresh token inválido cierra la sesión local', async () => {
    const gateway = fakeGateway({
      refresh: vi.fn(async () => {
        throw new ApiProblem({
          type: 'invalid-refresh-token',
          status: 401,
          title: 'Sesión vencida',
        })
      }),
    })
    const { session, storage } = setup(gateway, memoryStorage('rt-0'))
    expect(await session.refresh()).toBe(false)
    expect(storage.value).toBeNull()
    expect(session.status).toBe('anonymous')
  })

  it('restaura la sesión al abrir la app si hay refresh token', async () => {
    const { session } = setup(fakeGateway(), memoryStorage('rt-0'))
    await session.restore()
    expect(session.isAuthenticated).toBe(true)
    expect(session.account?.email).toBe('staff@example.com')
  })

  it('sin refresh token queda anónima sin llamar a la API', async () => {
    const gateway = fakeGateway()
    const { session } = setup(gateway)
    await session.restore()
    expect(session.status).toBe('anonymous')
    expect(gateway.refresh).not.toHaveBeenCalled()
  })

  it('un error de red al restaurar no borra el refresh token', async () => {
    const gateway = fakeGateway({
      refresh: vi.fn(async () => {
        throw new ApiProblem({ type: 'network-error', status: 0, title: 'Sin conexión' })
      }),
    })
    const { session, storage } = setup(gateway, memoryStorage('rt-0'))
    await session.restore()
    expect(session.status).toBe('anonymous')
    expect(storage.value).toBe('rt-0')
  })

  it('renueva antes del vencimiento del token de acceso', async () => {
    const gateway = fakeGateway()
    const { session } = setup(gateway)
    await session.login({ email: 'staff@example.com', password: 'x' })
    await vi.advanceTimersByTimeAsync((900 - 60) * 1000)
    expect(gateway.refresh).toHaveBeenCalledWith('rt-1')
    expect(session.accessToken).toBe('at-2')
  })

  it('con un TTL corto renueva a la mitad del TTL, no cada 5 segundos', async () => {
    const gateway = fakeGateway({
      login: vi.fn(async () => ({ ...authResult(), accessTokenExpiresIn: 60 })),
    })
    const { session } = setup(gateway)
    await session.login({ email: 'staff@example.com', password: 'x' })
    await vi.advanceTimersByTimeAsync(29_000)
    expect(gateway.refresh).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(gateway.refresh).toHaveBeenCalledTimes(1)
  })

  it('cierra sesión aunque la API falle', async () => {
    const gateway = fakeGateway({
      logout: vi.fn(async () => {
        throw new ApiProblem({ type: 'network-error', status: 0, title: '' })
      }),
    })
    const { session, storage } = setup(gateway)
    await session.login({ email: 'staff@example.com', password: 'x' })
    await session.logout()
    expect(session.isAuthenticated).toBe(false)
    expect(storage.value).toBeNull()
  })

  it('tras cambiar la contraseña vuelve a leer la cuenta', async () => {
    const me = vi
      .fn()
      .mockResolvedValueOnce({ ...staff, mustChangePassword: true })
      .mockResolvedValueOnce(staff)
    const { session } = setup(fakeGateway({ me }))
    await session.login({ email: 'staff@example.com', password: 'temporal' })
    expect(session.mustChangePassword).toBe(true)
    await session.changePassword({
      currentPassword: 'temporal',
      newPassword: 'una frase larga y nueva',
    })
    expect(session.mustChangePassword).toBe(false)
  })
})
