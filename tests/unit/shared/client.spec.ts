// @vitest-environment node
// happy-dom aplica CORS y descarta encabezados como Authorization; el cliente se prueba con el fetch de Node.
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createApiClient } from '~/shared/api/client'
import { ApiProblem } from '~/shared/api/problem'

const BASE = 'http://api.test'
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const problem = (status: number, type: string, extra: Record<string, unknown> = {}) =>
  HttpResponse.json(
    {
      type: `/problems/${type}`,
      title: type,
      status,
      detail: null,
      correlationId: 'c-1',
      ...extra,
    },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )

function client(
  token: { value: string | null },
  refresh = vi.fn(async () => false),
  expired = vi.fn(),
) {
  return {
    api: createApiClient({
      baseURL: BASE,
      getAccessToken: () => token.value,
      refreshSession: refresh,
      onSessionExpired: expired,
    }),
    refresh,
    expired,
  }
}

describe('cliente de la API', () => {
  it('envía el Bearer y serializa filtros', async () => {
    let seen: { auth: string | null; url: string } | null = null
    server.use(
      http.get(`${BASE}/v1/admin/orders`, ({ request }) => {
        seen = { auth: request.headers.get('authorization'), url: request.url }
        return HttpResponse.json({
          data: [],
          meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
        })
      }),
    )
    const { api } = client({ value: 'at-1' })
    await api('/v1/admin/orders', { query: { status: ['PAID', 'SHIPPED'], q: '' } })
    expect(seen!.auth).toBe('Bearer at-1')
    const params = new URL(seen!.url).searchParams
    expect(params.get('status')).toBe('PAID,SHIPPED')
    expect(params.has('q')).toBe(false)
  })

  it('ante 401 renueva y repite la solicitud una vez', async () => {
    const token = { value: 'viejo' as string | null }
    server.use(
      http.get(`${BASE}/v1/me`, ({ request }) =>
        request.headers.get('authorization') === 'Bearer nuevo'
          ? HttpResponse.json({ id: 'u1' })
          : problem(401, 'unauthenticated'),
      ),
    )
    const refresh = vi.fn(async () => {
      token.value = 'nuevo'
      return true
    })
    const { api, expired } = client(token, refresh)
    await expect(api('/v1/me')).resolves.toEqual({ id: 'u1' })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(expired).not.toHaveBeenCalled()
  })

  it('si no puede renovar, avisa que la sesión venció', async () => {
    server.use(http.get(`${BASE}/v1/me`, () => problem(401, 'unauthenticated')))
    const { api, expired } = client({ value: 'x' })
    await expect(api('/v1/me')).rejects.toMatchObject({ type: 'unauthenticated' })
    expect(expired).toHaveBeenCalledTimes(1)
  })

  it('las rutas públicas no renuevan', async () => {
    server.use(http.post(`${BASE}/v1/auth/login`, () => problem(401, 'invalid-credentials')))
    const { api, refresh } = client({ value: null })
    await expect(
      api('/v1/auth/login', { method: 'POST', body: {}, auth: false }),
    ).rejects.toMatchObject({
      type: 'invalid-credentials',
    })
    expect(refresh).not.toHaveBeenCalled()
  })

  it('convierte errores en ApiProblem con extensiones y Retry-After', async () => {
    server.use(
      http.post(`${BASE}/v1/admin/orders/o1/cancel`, () =>
        HttpResponse.json(
          {
            type: '/problems/rate-limit-exceeded',
            title: 'Demasiadas solicitudes',
            status: 429,
            correlationId: 'c',
          },
          {
            status: 429,
            headers: { 'Retry-After': '30', 'Content-Type': 'application/problem+json' },
          },
        ),
      ),
    )
    const { api } = client({ value: 'at' })
    const error = await api('/v1/admin/orders/o1/cancel', { method: 'POST', body: {} }).catch(
      (e) => e,
    )
    expect(error).toBeInstanceOf(ApiProblem)
    expect(error.retryAfter).toBe(30)
  })

  it('envía Idempotency-Key cuando se indica (API_SPEC §4)', async () => {
    let key: string | null = null
    server.use(
      http.post(`${BASE}/v1/admin/orders/o1/restocks`, ({ request }) => {
        key = request.headers.get('idempotency-key')
        return HttpResponse.json({ movements: [] }, { status: 201 })
      }),
    )
    const { api } = client({ value: 'at' })
    await api('/v1/admin/orders/o1/restocks', { method: 'POST', body: {}, idempotencyKey: 'k-1' })
    expect(key).toBe('k-1')
  })

  it('un fallo de red es network-error', async () => {
    server.use(http.get(`${BASE}/v1/me`, () => HttpResponse.error()))
    const { api } = client({ value: 'at' })
    await expect(api('/v1/me')).rejects.toMatchObject({ type: 'network-error' })
  })
})
