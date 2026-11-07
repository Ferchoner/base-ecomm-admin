const dateTime = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
const dateOnly = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' })

/** Fechas ISO 8601 en UTC de la API (API_SPEC §2.1) mostradas en la zona del navegador. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : dateTime.format(date)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : dateOnly.format(date)
}

const mexicoDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Mexico_City',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** El día de la Ciudad de México de un instante, `AAAA-MM-DD`: el día del corte de caja (API_SPEC §15.9). */
export function mexicoDate(at: Date = new Date()): string {
  return mexicoDay.format(at)
}

/** `AAAA-MM-DD` → "7 nov 2026", sin pasar por la zona del navegador. */
export function formatCalendarDate(date: string | null | undefined): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return '—'
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  )
}
