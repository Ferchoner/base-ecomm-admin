import type { StatusStyle } from '~/components/StatusBadge.vue'
import type { BrandStatus, ProductStatus, StoreVisibility, VariantStatus } from './types'

// Etiquetas de los valores del contrato. Un valor nuevo de la API se muestra crudo (StatusBadge).

export const ACTIVE_STATUS: Record<BrandStatus, StatusStyle> = {
  ACTIVE: { label: 'Activa', color: 'success' },
  INACTIVE: { label: 'Inactiva', color: 'neutral' },
}

export const PRODUCT_STATUS: Record<ProductStatus, StatusStyle> = {
  DRAFT: { label: 'Borrador', color: 'warning' },
  PUBLISHED: { label: 'Publicado', color: 'success' },
  ARCHIVED: { label: 'Archivado', color: 'neutral' },
}

/** API_SPEC §11.6 (ADR-0016). */
export const STORE_VISIBILITY: Record<StoreVisibility, StatusStyle> = {
  VISIBLE: { label: 'Visible en tienda', color: 'success' },
  HIDDEN_NO_PRICE: { label: 'Oculto: sin variante con precio', color: 'error' },
  NOT_PUBLISHED: { label: 'No publicado', color: 'neutral' },
}

export const VARIANT_STATUS: Record<VariantStatus, StatusStyle> = {
  ACTIVE: { label: 'Activa', color: 'success' },
  DISCONTINUED: { label: 'Descontinuada', color: 'neutral' },
}

export const PRODUCT_STATUS_OPTIONS = (Object.keys(PRODUCT_STATUS) as ProductStatus[]).map(
  (value) => ({
    value: value as string,
    label: PRODUCT_STATUS[value].label,
  }),
)

export const ACTIVE_STATUS_OPTIONS = (Object.keys(ACTIVE_STATUS) as BrandStatus[]).map((value) => ({
  value: value as string,
  label: ACTIVE_STATUS[value].label,
}))

/**
 * Transiciones que la API documenta para el producto (API_SPEC §11.6). Solo deciden qué botón
 * se ofrece; si la API rechaza la acción, se muestra su 409.
 */
export const PRODUCT_ACTIONS: Record<'publish' | 'archive' | 'reactivate', readonly string[]> = {
  publish: ['DRAFT'],
  archive: ['DRAFT', 'PUBLISHED'],
  reactivate: ['ARCHIVED'],
}

/** Orden admitido por el listado de productos (API_SPEC §11.6). */
export const PRODUCT_SORT_OPTIONS = [
  { value: '-updatedAt', label: 'Modificados recientemente' },
  { value: 'title', label: 'Título (A–Z)' },
  { value: '-title', label: 'Título (Z–A)' },
  { value: '-createdAt', label: 'Creados recientemente' },
  { value: '-publishedAt', label: 'Publicados recientemente' },
]
