import type { CollectionMethod } from './types'

/** Los cuatro grupos de cobro del corte (API_SPEC §15.9), en el orden en que llegan. */
export function collectionMethodLabel(method: CollectionMethod): string {
  switch (method) {
    case 'CASH':
      return 'Efectivo'
    case 'CARD_TERMINAL':
      return 'Terminal bancaria'
    case 'TRANSFER':
      return 'Transferencia'
    case null:
      return 'Sin método'
    default:
      return String(method)
  }
}

/**
 * Quién registró los cobros de una fila del corte. Sin `staff.manage` no hay nombres (GAPS G-21), así
 * que la cuenta propia sale como "Tú" y las demás por su ID.
 */
export function staffLabel(staffId: string | null, ownId: string | undefined): string {
  if (staffId === null) return 'Sin registrar (proveedor)'
  return staffId === ownId ? 'Tú' : staffId
}

/** Cómo leer una diferencia del cierre: contado menos esperado. */
export function differenceTone(cents: number): {
  label: string
  color: 'success' | 'error' | 'warning'
} {
  if (cents === 0) return { label: 'Cuadra', color: 'success' }
  return cents < 0
    ? { label: 'Falta efectivo', color: 'error' }
    : { label: 'Sobra efectivo', color: 'warning' }
}
