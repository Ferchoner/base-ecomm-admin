import type { StatusStyle } from '~/components/StatusBadge.vue'
import type { AuditActorType, AuditChangeRow, AuditResult } from './types'

export const AUDIT_RESULT: Record<AuditResult, StatusStyle> = {
  SUCCESS: { label: 'Correcto', color: 'success' },
  DENIED: { label: 'Denegado', color: 'warning' },
  FAILED: { label: 'Falló', color: 'error' },
}

/** `USER` con sesión, `SYSTEM` en jobs y eventos, `ANONYMOUS` sin sesión (AuditEntryDto). */
export const AUDIT_ACTOR_TYPE: Record<AuditActorType, string> = {
  USER: 'Usuario',
  SYSTEM: 'Sistema',
  ANONYMOUS: 'Anónimo',
}

const options = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }))
export const AUDIT_RESULT_OPTIONS = options(
  Object.fromEntries(Object.entries(AUDIT_RESULT).map(([k, v]) => [k, v.label])),
)
export const AUDIT_ACTOR_TYPE_OPTIONS = options(AUDIT_ACTOR_TYPE)

/** Meses que la API conserva; lo anterior está en archivos fuera de la API (API_SPEC §18). */
export const AUDIT_RETENTION_MONTHS = 3

/**
 * `action` acepta un código exacto (`orders.cancel`) o un prefijo terminado en `.*` (`orders.*`);
 * otra forma responde 400 (T-220). La validación local solo evita el viaje: decide la API.
 */
export function isValidActionFilter(value: string): boolean {
  return /^[^\s*]+(\.\*)?$/.test(value)
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

/** Filas de `changes` para mostrarlas como texto (nunca HTML). Un valor con otra forma va crudo. */
export function changeRows(changes: Record<string, unknown> | null): AuditChangeRow[] {
  if (!changes) return []
  return Object.entries(changes).map(([field, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const v = value as Record<string, unknown>
      if (v.changed === true && !('from' in v) && !('to' in v))
        return { field, hidden: true, from: '', to: '' }
      if ('from' in v || 'to' in v)
        return { field, hidden: false, from: display(v.from), to: display(v.to) }
    }
    return { field, hidden: false, from: '—', to: display(value) }
  })
}
