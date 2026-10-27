import { useQueryClient } from '@tanstack/vue-query'
import { fixScannedCode } from '~/shared/scanner/scanned-text'
import type { Schemas } from './types'
import { useApi } from './use-api'

export type VariantLookup = Schemas['VariantLookupDto']

/** Formato de `code` en el contrato (API_SPEC §11.10): de 1 a 64 letras, dígitos, `-`, `_` y `.`. */
export const SCAN_CODE = /^[A-Za-z0-9._-]{1,64}$/

export function isScanCode(value: string): boolean {
  return SCAN_CODE.test(fixScannedCode(value, SCAN_CODE).trim())
}

/**
 * Busca variantes por su SKU exacto o su GTIN (`GET /v1/admin/catalog/variants/lookup`,
 * `catalog.read`). Vive en la capa compartida porque la usan Catálogo, Inventario y Pedidos, y una
 * feature no importa a otra (D-P17). Responde una lista, activas primero; vacía si nada coincide.
 */
export function useVariantLookup() {
  const api = useApi()
  const qc = useQueryClient()
  return (code: string) =>
    qc.fetchQuery({
      queryKey: ['catalog', 'variant-lookup', code],
      queryFn: async ({ signal }) =>
        (
          await api<{ data: VariantLookup[] }>('/v1/admin/catalog/variants/lookup', {
            query: { code },
            signal,
          })
        ).data,
      staleTime: 5_000,
    })
}

/** Solo se vende una variante activa de un producto publicado (API_SPEC §11.10). */
export function isSellable(v: VariantLookup): boolean {
  return v.status === 'ACTIVE' && v.product.status === 'PUBLISHED'
}

/** Por qué no se vende, con los datos de la respuesta. */
export function notSellableReason(v: VariantLookup): string {
  if (v.product.status === 'DRAFT') return `${v.product.title} está en borrador: no se vende.`
  if (v.product.status === 'ARCHIVED') return `${v.product.title} está archivado: no se vende.`
  if (v.status === 'DISCONTINUED') return `La variante ${v.sku} está descontinuada: no se vende.`
  return `${v.sku} no se vende.`
}

/** "talla: M · color: Azul". */
export function variantOptionsLabel(v: Pick<VariantLookup, 'options'>): string {
  return Object.entries(v.options)
    .map(([k, val]) => `${k}: ${val}`)
    .join(' · ')
}
