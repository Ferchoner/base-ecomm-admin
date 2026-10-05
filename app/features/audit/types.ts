import type { CursorPage, Schemas } from '~/shared/api/types'

/** Registro de auditoría (API_SPEC §18, UC-AUD-02). */
export type AuditEntry = Schemas['AuditEntryDto']
export type AuditActorType = AuditEntry['actorType']
export type AuditResult = AuditEntry['result']

/** `AuditEntryListDto` declara `CursorMetaDto` vacío; la forma sale de API_SPEC §5.2 (GAPS G-10). */
export type AuditPage = CursorPage<AuditEntry>

/** Filtros de `GET /v1/admin/audit` (API_SPEC §18, T-220). */
export interface AuditFilters {
  actorId?: string
  actorType?: string
  action?: string
  resourceType?: string
  resourceId?: string
  result?: string
  from?: string
  to?: string
}

/** Un campo de `changes`: `{ from, to }`, o `{ changed: true }` si es personal o sensible. */
export interface AuditChangeRow {
  field: string
  hidden: boolean
  from: string
  to: string
}
