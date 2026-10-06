import type { Page, Route } from '@playwright/test'
import { API, json } from './mock-api'

/** Clientes, staff, roles y permisos en memoria con las formas de openapi/v1.json (API_SPEC §9). */
const NOW = '2026-10-05T12:00:00.000Z'
/** La cuenta de la sesión simulada en mock-api.ts. */
export const SELF_ID = '0192a3b4-0000-7000-8000-000000000001'
let seq = 0
const uuid = () => `0192a3b4-0000-7000-8000-${String(700000 + ++seq).padStart(12, '0')}`

function problem(
  route: Route,
  status: number,
  type: string,
  title: string,
  extra: Record<string, unknown> = {},
) {
  return route.fulfill({
    status,
    contentType: 'application/problem+json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({
      type: `/problems/${type}`,
      title,
      status,
      detail: null,
      correlationId: 'e2e',
      ...extra,
    }),
  })
}

export const PERMISSIONS = [
  ['catalog.read', 'Consultar el catálogo'],
  ['catalog.write', 'Editar el catálogo'],
  ['orders.read', 'Consultar pedidos'],
  ['orders.manage', 'Gestionar pedidos'],
  ['customers.read', 'Consultar clientes'],
  ['customers.manage', 'Gestionar clientes'],
  ['staff.manage', 'Gestionar staff y roles'],
  ['payments.configure', 'Configurar los pagos'],
] as const

/** Solo los tiene el rol superadministrador (ADR-0162). */
const SUPERADMIN_ONLY = new Set<string>(['payments.configure'])

export interface IdentitySeed {
  customers?: Array<{ email: string; firstNames: string; status?: string; activeOrders?: boolean }>
  roles?: Array<{ id?: string; name: string; permissions: string[]; superadmin?: boolean }>
  staff?: Array<{
    email: string
    firstNames: string
    roles: string[]
    status?: string
    self?: boolean
  }>
}

export async function mockIdentityApi(page: Page, seed: IdentitySeed = {}) {
  const calls: Array<{ method: string; path: string; body: unknown }> = []
  const roles = (seed.roles ?? []).map((r) => ({
    id: r.id ?? uuid(),
    name: r.name,
    description: null as string | null,
    isSuperadmin: !!r.superadmin,
    permissions: r.superadmin ? PERMISSIONS.map(([c]) => c as string) : r.permissions,
    userCount: 0,
    version: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  }))
  const roleRef = (name: string) => {
    const r = roles.find((x) => x.name === name)!
    return { id: r.id, name: r.name }
  }
  const staff = (seed.staff ?? []).map((s) => ({
    id: s.self ? SELF_ID : uuid(),
    email: s.email,
    firstNames: s.firstNames,
    lastNames: 'Pérez',
    status: s.status ?? 'ACTIVE',
    mustChangePassword: false,
    roles: s.roles.map(roleRef),
    lastLoginAt: null as string | null,
    version: 1,
    createdAt: '2026-09-15T00:00:00.000Z',
  }))
  const customers = (seed.customers ?? []).map((c) => ({
    id: uuid(),
    email: c.email as string | null,
    firstNames: c.firstNames as string | null,
    lastNames: 'López' as string | null,
    status: c.status ?? 'ACTIVE',
    emailVerified: true,
    addresses: [] as unknown[],
    createdAt: '2026-09-20T00:00:00.000Z',
    lastLoginAt: '2026-10-04T00:00:00.000Z' as string | null,
    anonymizedAt: null as string | null,
    version: 1,
    activeOrders: !!c.activeOrders,
  }))
  const countUsers = () =>
    roles.forEach(
      (r) => (r.userCount = staff.filter((s) => s.roles.some((x) => x.id === r.id)).length),
    )
  countUsers()
  const page1 = <T>(items: T[]) => ({
    data: items,
    meta: { page: 1, pageSize: 20, totalItems: items.length, totalPages: 1 },
  })
  const customerDto = (c: (typeof customers)[number], detail = false) => {
    const { activeOrders: _, addresses, ...rest } = c
    return detail ? { ...rest, addresses } : rest
  }
  const tempPassword = () => `k7qm-3xrt-9fzw-p4hd-${String(seq).padStart(4, '0').slice(-4)}`

  await page.route(`${API}/v1/admin/identity/**`, async (route) => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())
    if (method === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
        },
      })
    const body = request.postDataJSON() as Record<string, unknown> | null
    calls.push({ method, path: url.pathname, body })
    const [, , , , resource, id, action] = url.pathname.split('/')
    const q = url.searchParams.get('q')?.toLowerCase()

    if (resource === 'permissions')
      return json(route, 200, {
        data: PERMISSIONS.map(([code, description]) => ({
          code,
          description,
          superadminOnly: SUPERADMIN_ONLY.has(code),
        })),
      })

    if (resource === 'guest-anonymizations') {
      if (body?.publicCode !== 'K7M4-Q9XA') return problem(route, 404, 'not-found', 'No encontrado')
      return json(route, 200, { anonymizedOrderCount: 2 })
    }

    if (resource === 'customers') {
      if (!id)
        return json(
          route,
          200,
          page1(
            customers
              .filter((c) => !q || c.email?.includes(q) || c.firstNames?.toLowerCase().includes(q))
              .map((c) => customerDto(c)),
          ),
        )
      const c = customers.find((x) => x.id === id)
      if (!c) return problem(route, 404, 'not-found', 'No encontrado')
      if (!action) return json(route, 200, customerDto(c, true))
      if (body?.version !== c.version)
        return problem(route, 409, 'version-conflict', 'El recurso cambió')
      if (action === 'anonymize') {
        if (c.activeOrders)
          return problem(route, 409, 'active-orders-exist', 'Tiene pedidos activos')
        Object.assign(c, {
          email: null,
          firstNames: null,
          lastNames: null,
          status: 'ANONYMIZED',
          anonymizedAt: NOW,
          emailVerified: false,
        })
        c.version += 1
        return json(route, 200, { userId: c.id, anonymizedAt: NOW, anonymizedOrderCount: 3 })
      }
      const from = action === 'suspend' ? 'ACTIVE' : 'SUSPENDED'
      if (c.status !== from)
        return problem(route, 409, 'invalid-state-transition', 'Transición no permitida')
      c.status = action === 'suspend' ? 'SUSPENDED' : 'ACTIVE'
      c.version += 1
      return json(route, 200, customerDto(c, true))
    }

    if (resource === 'roles') {
      if (!id && method === 'GET')
        return json(route, 200, page1(roles.filter((r) => !q || r.name.toLowerCase().includes(q))))
      if (!id && method === 'POST') {
        if (roles.some((r) => r.name === body?.name))
          return problem(route, 409, 'duplicate-value', 'El valor ya existe', { field: 'name' })
        const r = {
          id: uuid(),
          name: String(body?.name),
          description: (body?.description as string) ?? null,
          isSuperadmin: false,
          permissions: body?.permissions as string[],
          userCount: 0,
          version: 1,
          createdAt: NOW,
          updatedAt: NOW,
        }
        roles.push(r)
        return json(route, 201, r)
      }
      const r = roles.find((x) => x.id === id)
      if (!r) return problem(route, 404, 'not-found', 'No encontrado')
      if (method === 'DELETE') {
        if (r.userCount) return problem(route, 409, 'resource-in-use', 'El rol tiene usuarios')
        roles.splice(roles.indexOf(r), 1)
        return json(route, 204, undefined)
      }
      if (method === 'PATCH') {
        if (body?.version !== r.version)
          return problem(route, 409, 'version-conflict', 'El recurso cambió')
        const { version: _, ...changes } = body
        Object.assign(r, changes, { version: r.version + 1, updatedAt: NOW })
        staff.forEach((s) => s.roles.forEach((x) => x.id === r.id && (x.name = r.name)))
        return json(route, 200, r)
      }
      return json(route, 200, r)
    }

    // Staff
    if (!id && method === 'GET')
      return json(route, 200, page1(staff.filter((s) => !q || s.email.includes(q))))
    if (!id && method === 'POST') {
      if (staff.some((s) => s.email === body?.email))
        return problem(route, 409, 'duplicate-value', 'El valor ya existe', { field: 'email' })
      const s = {
        id: uuid(),
        email: String(body?.email),
        firstNames: String(body?.firstNames),
        lastNames: String(body?.lastNames),
        status: 'ACTIVE',
        mustChangePassword: true,
        roles: (body?.roleIds as string[]).map((rid) =>
          roleRef(roles.find((r) => r.id === rid)!.name),
        ),
        lastLoginAt: null,
        version: 1,
        createdAt: NOW,
      }
      staff.push(s)
      countUsers()
      return json(route, 201, { user: s, temporaryPassword: tempPassword() })
    }
    const s = staff.find((x) => x.id === id)
    if (!s) return problem(route, 404, 'not-found', 'No encontrado')
    if (method === 'GET') return json(route, 200, s)
    if (body?.version !== s.version)
      return problem(route, 409, 'version-conflict', 'El recurso cambió')
    if (action === 'roles') {
      const ids = body.roleIds as string[]
      const losesSuper =
        s.roles.some((x) => roles.find((r) => r.id === x.id)?.isSuperadmin) &&
        !ids.some((rid) => roles.find((r) => r.id === rid)?.isSuperadmin)
      const supers = staff.filter(
        (u) =>
          u.status === 'ACTIVE' &&
          u.roles.some((x) => roles.find((r) => r.id === x.id)?.isSuperadmin),
      )
      if (losesSuper && supers.length === 1)
        return problem(route, 409, 'last-superadmin', 'Último superadministrador')
      s.roles = ids.map((rid) => roleRef(roles.find((r) => r.id === rid)!.name))
      countUsers()
    } else if (action === 'suspend') {
      if (s.status !== 'ACTIVE' || s.id === SELF_ID)
        return problem(route, 409, 'invalid-state-transition', 'Transición no permitida')
      s.status = 'SUSPENDED'
    } else if (action === 'reactivate') {
      if (s.status !== 'SUSPENDED')
        return problem(route, 409, 'invalid-state-transition', 'Transición no permitida')
      Object.assign(s, { status: 'ACTIVE', mustChangePassword: true })
      s.version += 1
      return json(route, 200, { user: s, temporaryPassword: tempPassword() })
    }
    s.version += 1
    return json(route, 200, s)
  })

  return { calls, customers, staff, roles }
}
