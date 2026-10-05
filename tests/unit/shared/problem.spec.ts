import { describe, expect, it } from 'vitest'
import {
  ApiProblem,
  isRetryableRead,
  problemFromResponse,
  problemTypeFromUri,
  toApiProblem,
} from '~/shared/api/problem'

const headers = (values: Record<string, string>) => ({
  get: (name: string) => values[name.toLowerCase()] ?? null,
})

describe('problemFromResponse', () => {
  it('normaliza un Problem Details de validación (API_SPEC §6.1)', () => {
    const problem = problemFromResponse(
      400,
      {
        type: '/problems/validation-error',
        title: 'Solicitud inválida',
        status: 400,
        detail: 'Uno o más campos no son válidos.',
        instance: '/v1/me/addresses',
        correlationId: 'c-1',
        errors: [
          { field: 'postalCode', code: 'matches', message: 'Debe tener 5 dígitos.' },
          { bad: true },
        ],
      },
      headers({}),
    )
    expect(problem.type).toBe('validation-error')
    expect(problem.status).toBe(400)
    expect(problem.correlationId).toBe('c-1')
    expect(problem.errors).toEqual([
      { field: 'postalCode', code: 'matches', message: 'Debe tener 5 dígitos.' },
    ])
    expect(problem.extensions).toEqual({})
  })

  it('conserva las extensiones del tipo y lee Retry-After', () => {
    const problem = problemFromResponse(
      409,
      { type: '/problems/version-conflict', title: 'Conflicto', status: 409, currentVersion: 8 },
      headers({ 'retry-after': '2', 'x-correlation-id': 'from-header' }),
    )
    expect(problem.type).toBe('version-conflict')
    expect(problem.extensions).toEqual({ currentVersion: 8 })
    expect(problem.retryAfter).toBe(2)
    expect(problem.correlationId).toBe('from-header')
  })

  it('tolera un cuerpo que no es Problem Details', () => {
    expect(problemFromResponse(502, 'Bad gateway').type).toBe('internal-error')
    expect(problemFromResponse(418, null).type).toBe('unknown')
  })
})

describe('toApiProblem', () => {
  it('convierte errores de red y de tiempo', () => {
    expect(toApiProblem(new TypeError('fetch failed')).type).toBe('network-error')
    expect(toApiProblem({ name: 'FetchError', cause: { name: 'TimeoutError' } }).type).toBe(
      'timeout',
    )
  })

  it('devuelve el mismo ApiProblem', () => {
    const p = new ApiProblem({ type: 'not-found', status: 404, title: 'No encontrado' })
    expect(toApiProblem(p)).toBe(p)
  })
})

describe('isRetryableRead', () => {
  it('solo reintenta red, tiempo y 5xx', () => {
    expect(
      isRetryableRead(new ApiProblem({ type: 'internal-error', status: 500, title: '' })),
    ).toBe(true)
    expect(isRetryableRead(new ApiProblem({ type: 'network-error', status: 0, title: '' }))).toBe(
      true,
    )
    expect(isRetryableRead(new ApiProblem({ type: 'forbidden', status: 403, title: '' }))).toBe(
      false,
    )
    expect(
      isRetryableRead(new ApiProblem({ type: 'rate-limit-exceeded', status: 429, title: '' })),
    ).toBe(false)
  })
})

it('problemTypeFromUri toma el último segmento', () => {
  expect(problemTypeFromUri('/problems/insufficient-stock')).toBe('insufficient-stock')
})
