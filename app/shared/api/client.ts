import { $fetch as ofetch } from 'ofetch'
import { toApiProblem } from './problem'

export type QueryValue = string | number | boolean | null | undefined | Array<string | number>

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Record<string, QueryValue>
  body?: Record<string, unknown> | FormData
  headers?: Record<string, string>
  /** Obligatoria en las operaciones de API_SPEC §4 (en el backoffice: reintegros). */
  idempotencyKey?: string
  signal?: AbortSignal
  /** `false` para rutas públicas: no envía el token ni intenta renovar. */
  auth?: boolean
}

export type ApiClient = <T>(path: string, options?: RequestOptions) => Promise<T>

export interface ApiClientDeps {
  baseURL: string
  getAccessToken: () => string | null
  /** Renueva la sesión (single-flight). Devuelve `true` si hay un token de acceso nuevo. */
  refreshSession: () => Promise<boolean>
  /** La sesión ya no se puede recuperar: cerrar localmente y pedir login. */
  onSessionExpired: () => void
  timeoutMs?: number
}

/**
 * Serializa filtros según API_SPEC §5.3: listas separadas por coma; vacíos fuera,
 * porque un parámetro vacío o no declarado responde 400.
 */
export function toQuery(query: Record<string, QueryValue> = {}): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length > 0) out[key] = value.join(',')
      continue
    }
    out[key] = String(value)
  }
  return out
}

/**
 * Cliente HTTP de la API: Bearer, renovación ante 401 y errores como ApiProblem.
 * No reintenta por su cuenta; los reintentos de lecturas los decide TanStack Query.
 */
export function createApiClient(deps: ApiClientDeps): ApiClient {
  const raw = ofetch.create({
    baseURL: deps.baseURL,
    timeout: deps.timeoutMs ?? 30_000,
    retry: 0,
  })

  function send<T>(path: string, options: RequestOptions, token: string | null): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json', ...options.headers }
    if (token) headers.Authorization = `Bearer ${token}`
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey
    return raw<T>(path, {
      method: options.method ?? 'GET',
      query: toQuery(options.query),
      body: options.body,
      headers,
      signal: options.signal,
    })
  }

  return async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const useAuth = options.auth !== false
    try {
      return await send<T>(path, options, useAuth ? deps.getAccessToken() : null)
    } catch (error) {
      const problem = toApiProblem(error)
      if (!useAuth || problem.type !== 'unauthenticated') throw problem

      // Un 401 se responde antes de procesar la solicitud, así que repetirla es seguro.
      const renewed = await deps.refreshSession()
      if (!renewed) {
        deps.onSessionExpired()
        throw problem
      }
      try {
        return await send<T>(path, options, deps.getAccessToken())
      } catch (retryError) {
        const retryProblem = toApiProblem(retryError)
        if (retryProblem.type === 'unauthenticated') deps.onSessionExpired()
        throw retryProblem
      }
    }
  }
}
