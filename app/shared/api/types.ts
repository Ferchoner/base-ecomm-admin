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

export type CursorMeta = Schemas['CursorMetaDto']

export interface CursorPage<T> {
  data: T[]
  meta: CursorMeta
}
