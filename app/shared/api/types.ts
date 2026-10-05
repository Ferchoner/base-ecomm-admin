import type { components } from './generated/openapi'

/** Esquemas del contrato (openapi/v1.json). No se declaran campos a mano salvo excepción documentada. */
export type Schemas = components['schemas']

export type Account = Schemas['AccountDto']
export type AuthResult = Schemas['AuthResultDto']
export type Permission = Account['permissions'][number]
export type Money = Schemas['MoneyDto']
export type PageMeta = Schemas['PageMetaDto']
export type FieldError = Schemas['FieldError']

export interface Page<T> {
  data: T[]
  meta: PageMeta
}

/**
 * `CursorMetaDto` no declara propiedades en openapi/v1.json; la forma sale de API_SPEC §5.2,
 * que tiene prioridad sobre el OpenAPI (GAPS G-10).
 */
export interface CursorMeta {
  limit: number
  nextCursor: string | null
}

export interface CursorPage<T> {
  data: T[]
  meta: CursorMeta
}
