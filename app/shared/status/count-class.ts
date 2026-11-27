import type { Schemas } from '~/shared/api/types'

// La clase de conteo de un producto (ADR-0173 de base-shop) la guarda Catálogo y la usan Inventario,
// al abrir hojas, y Catálogo, en el producto y en las clases sugeridas por ventas.

export type CountClass = NonNullable<Schemas['AdminProductDto']['countClass']>

/** A cada semana, B cada mes, C cada trimestre; un producto sin clase cuenta como C. */
export const COUNT_CLASS_OPTIONS: { value: CountClass; label: string }[] = [
  { value: 'A', label: 'A (cada semana)' },
  { value: 'B', label: 'B (cada mes)' },
  { value: 'C', label: 'C (cada trimestre)' },
]
