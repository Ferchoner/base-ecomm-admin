import type { Page, Route } from '@playwright/test'

/** Debe coincidir con NUXT_PUBLIC_API_BASE_URL del build (por defecto http://localhost:3000). */
export const API = process.env.E2E_API_BASE_URL ?? 'http://localhost:3000'

export interface MockAccount {
  type: 'STAFF' | 'CUSTOMER'
  firstNames: string
  permissions: string[]
  mustChangePassword?: boolean
  roles?: Array<{ id: string; name: string }>
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
  roles: a.roles ?? [],
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

export const VALID_RESET_TOKEN = 'q8Xz3Lr0VbN7kT2mWc9YhD4sFj6Ae1Pu5Gi8Ko0RnSv'
export const COMMON_PASSWORD = 'contraseña común de prueba'

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
      case 'POST /v1/auth/password-reset/request':
        return json(route, 202, undefined)
      case 'POST /v1/auth/password-reset/confirm': {
        const body = request.postDataJSON() as { token: string; newPassword: string }
        if (body.token !== VALID_RESET_TOKEN) {
          return problem(route, 400, 'invalid-or-expired-token', 'Enlace inválido o vencido')
        }
        if (body.newPassword === COMMON_PASSWORD) {
          return route.fulfill({
            status: 400,
            contentType: 'application/problem+json',
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
              type: '/problems/password-policy-violation',
              title: 'La contraseña no cumple la política',
              status: 400,
              detail: 'Elige otra contraseña.',
              correlationId: 'e2e-correlation',
              errors: [
                {
                  field: 'newPassword',
                  code: 'commonPassword',
                  message: 'Es una contraseña demasiado común.',
                },
              ],
            }),
          })
        }
        return json(route, 204, undefined)
      }
      case 'POST /v1/me/password':
        current = { ...current, mustChangePassword: false }
        return json(route, 204, undefined)
      default:
        return problem(route, 404, 'not-found', 'No encontrado')
    }
  })
  return { calls }
}
