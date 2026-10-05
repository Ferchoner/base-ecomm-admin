import type { Page, Route } from '@playwright/test'

/** Debe coincidir con NUXT_PUBLIC_API_BASE_URL del build (por defecto http://localhost:3000). */
export const API = process.env.E2E_API_BASE_URL ?? 'http://localhost:3000'

export interface MockAccount {
  type: 'STAFF' | 'CUSTOMER'
  firstNames: string
  permissions: string[]
  mustChangePassword?: boolean
}

export const staff = (permissions: string[], extra: Partial<MockAccount> = {}): MockAccount => ({
  type: 'STAFF',
  firstNames: 'Ana',
  permissions,
  ...extra,
})

const account = (a: MockAccount) => ({
  id: '0192a3b4-0000-7000-8000-000000000001',
  type: a.type,
  email: 'ana@example.com',
  firstNames: a.firstNames,
  lastNames: 'Pérez',
  emailVerified: true,
  mustChangePassword: a.mustChangePassword ?? false,
  roles: [],
  permissions: a.permissions,
  createdAt: '2026-10-01T00:00:00.000Z',
})

const authResult = (n: number, mustChangePassword = false) => ({
  outcome: 'AUTHENTICATED',
  accessToken: `at-${n}`,
  accessTokenExpiresIn: 900,
  refreshToken: `rt-${n}`,
  refreshTokenExpiresIn: 604800,
  tokenType: 'Bearer',
  mustChangePassword,
})

const problem = (route: Route, status: number, type: string, title: string) =>
  route.fulfill({
    status,
    contentType: 'application/problem+json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({
      type: `/problems/${type}`,
      title,
      status,
      detail: null,
      correlationId: 'e2e-correlation',
    }),
  })

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: body === undefined ? '' : JSON.stringify(body),
  })

/** Simula los endpoints de autenticación de API_SPEC §9 con el contrato del OpenAPI. */
export async function mockAuthApi(
  page: Page,
  initial: MockAccount,
  options: { password?: string } = {},
) {
  let current = { ...initial }
  let n = 0
  const calls: string[] = []

  await page.route(`${API}/v1/**`, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    calls.push(`${request.method()} ${path}`)
    if (request.method() === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
        },
      })
    }
    switch (`${request.method()} ${path}`) {
      case 'POST /v1/auth/login': {
        const body = request.postDataJSON() as { password: string }
        if (body.password !== (options.password ?? 'correcta')) {
          return problem(route, 401, 'invalid-credentials', 'Credenciales inválidas')
        }
        n += 1
        return json(route, 200, authResult(n, current.mustChangePassword))
      }
      case 'POST /v1/auth/refresh':
        n += 1
        return json(route, 200, authResult(n, current.mustChangePassword))
      case 'POST /v1/auth/logout':
        return json(route, 204, undefined)
      case 'GET /v1/me':
        return json(route, 200, account(current))
      case 'POST /v1/me/password':
        current = { ...current, mustChangePassword: false }
        return json(route, 204, undefined)
      default:
        return problem(route, 404, 'not-found', 'No encontrado')
    }
  })
  return { calls }
}
