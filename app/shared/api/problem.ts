import type { FieldError } from './types'

/**
 * Tipos de Problem Details de API_SPEC §6.2 que el frontend distingue, más los tipos locales
 * `network-error` y `timeout`, que no vienen de la API. Se decide por `type`, nunca por el texto.
 */
export type ProblemType =
  | 'validation-error'
  | 'password-policy-violation'
  | 'invalid-or-expired-token'
  | 'idempotency-key-missing'
  | 'unauthenticated'
  | 'invalid-credentials'
  | 'invalid-refresh-token'
  | 'forbidden'
  | 'password-change-required'
  | 'manual-payments-disabled'
  | 'not-found'
  | 'version-conflict'
  | 'invalid-state-transition'
  | 'duplicate-value'
  | 'field-locked'
  | 'image-limit-reached'
  | 'resource-in-use'
  | 'insufficient-stock'
  | 'restock-not-allowed'
  | 'source-cart-unavailable'
  | 'last-superadmin'
  | 'active-orders-exist'
  | 'idempotency-request-in-progress'
  | 'idempotency-key-mismatch'
  | 'payload-too-large'
  | 'unsupported-media-type'
  | 'rate-limit-exceeded'
  | 'internal-error'
  | 'network-error'
  | 'timeout'
  // La API puede agregar tipos: se conservan como texto.
  | (string & {})

interface ProblemBody {
  type?: unknown
  title?: unknown
  status?: unknown
  detail?: unknown
  instance?: unknown
  correlationId?: unknown
  errors?: unknown
  [extension: string]: unknown
}

/** Error normalizado de toda llamada a la API. */
export class ApiProblem extends Error {
  readonly type: ProblemType
  readonly status: number
  readonly title: string
  readonly detail: string | null
  readonly correlationId: string | null
  readonly errors: FieldError[]
  /** Extensiones del tipo (`currentVersion`, `lines`, `fields`, `limit`, `maxBytes`…). */
  readonly extensions: Record<string, unknown>
  /** Segundos de `Retry-After` en 429 y 409 `idempotency-request-in-progress`. */
  readonly retryAfter: number | null

  constructor(init: {
    type: ProblemType
    status: number
    title: string
    detail?: string | null
    correlationId?: string | null
    errors?: FieldError[]
    extensions?: Record<string, unknown>
    retryAfter?: number | null
  }) {
    super(init.detail ?? init.title)
    this.name = 'ApiProblem'
    this.type = init.type
    this.status = init.status
    this.title = init.title
    this.detail = init.detail ?? null
    this.correlationId = init.correlationId ?? null
    this.errors = init.errors ?? []
    this.extensions = init.extensions ?? {}
    this.retryAfter = init.retryAfter ?? null
  }

  is(type: ProblemType): boolean {
    return this.type === type
  }
}

const GENERIC_TITLE = 'Ocurrió un error inesperado'

/** `/problems/version-conflict` → `version-conflict`. */
export function problemTypeFromUri(uri: string): ProblemType {
  const slug = uri.split('/').filter(Boolean).pop()
  return slug ?? 'internal-error'
}

function isFieldError(value: unknown): value is FieldError {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.field === 'string' && typeof v.code === 'string' && typeof v.message === 'string'
}

function parseRetryAfter(header: string | null | undefined): number | null {
  if (!header) return null
  const seconds = Number(header)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null
}

/** Construye un ApiProblem a partir de una respuesta de error de la API. */
export function problemFromResponse(
  status: number,
  body: unknown,
  headers?: { get(name: string): string | null },
): ApiProblem {
  const b: ProblemBody = typeof body === 'object' && body !== null ? (body as ProblemBody) : {}
  const known = new Set([
    'type',
    'title',
    'status',
    'detail',
    'instance',
    'correlationId',
    'errors',
  ])
  const extensions = Object.fromEntries(Object.entries(b).filter(([key]) => !known.has(key)))
  const type =
    typeof b.type === 'string'
      ? problemTypeFromUri(b.type)
      : status >= 500
        ? 'internal-error'
        : 'unknown'

  return new ApiProblem({
    type,
    status,
    title: typeof b.title === 'string' ? b.title : GENERIC_TITLE,
    detail: typeof b.detail === 'string' ? b.detail : null,
    correlationId:
      typeof b.correlationId === 'string'
        ? b.correlationId
        : (headers?.get('x-correlation-id') ?? null),
    errors: Array.isArray(b.errors) ? b.errors.filter(isFieldError) : [],
    extensions,
    retryAfter: parseRetryAfter(headers?.get('retry-after')),
  })
}

/** Convierte cualquier error lanzado por una llamada a la API en ApiProblem. */
export function toApiProblem(error: unknown): ApiProblem {
  if (error instanceof ApiProblem) return error

  const e = error as {
    name?: string
    response?: { status: number; _data?: unknown; headers: Headers }
    data?: unknown
    cause?: { name?: string }
  }
  if (e?.response)
    return problemFromResponse(e.response.status, e.response._data ?? e.data, e.response.headers)

  const isTimeout = e?.name === 'TimeoutError' || e?.cause?.name === 'TimeoutError'
  return new ApiProblem({
    type: isTimeout ? 'timeout' : 'network-error',
    status: 0,
    title: isTimeout ? 'La API tardó demasiado en responder' : 'No se pudo conectar con la API',
    detail: 'Revisa tu conexión e inténtalo de nuevo.',
  })
}

/** Errores en los que reintentar una lectura tiene sentido. Las mutaciones nunca se reintentan solas. */
export function isRetryableRead(problem: ApiProblem): boolean {
  return problem.type === 'network-error' || problem.type === 'timeout' || problem.status >= 500
}
