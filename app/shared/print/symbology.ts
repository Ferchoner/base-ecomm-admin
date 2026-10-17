/**
 * Qué código lleva cada etiqueta (PLAN_API_1.7 §3.2): con GTIN, su simbología GS1; sin él, Code 128
 * del SKU. Los dos los encuentra la búsqueda por código, que compara el SKU exacto y el GTIN
 * completado a 14 dígitos (API_SPEC §11.10).
 */
export type LinearBcid = 'ean13' | 'upca' | 'ean8' | 'itf14' | 'code128'

export interface LabelBarcode {
  bcid: LinearBcid
  text: string
  name: string
}

export function linearBarcode(v: { sku: string; gtin: string | null }): LabelBarcode {
  const g = v.gtin
  if (g?.length === 13) return { bcid: 'ean13', text: g, name: 'EAN-13' }
  if (g?.length === 12) return { bcid: 'upca', text: g, name: 'UPC-A' }
  if (g?.length === 8) return { bcid: 'ean8', text: g, name: 'EAN-8' }
  // Un GTIN-14 con 0 al inicio es el mismo artículo que su EAN-13.
  if (g?.length === 14 && g.startsWith('0'))
    return { bcid: 'ean13', text: g.slice(1), name: 'EAN-13' }
  if (g?.length === 14) return { bcid: 'itf14', text: g, name: 'ITF-14' }
  return { bcid: 'code128', text: v.sku, name: 'Code 128' }
}

/** El código 2D guarda el texto tal cual: el lector lo "teclea" igual que uno lineal. */
export function compactText(v: { sku: string; gtin: string | null }): string {
  return v.gtin ?? v.sku
}

/**
 * Un Code 128 de más de 20 caracteres queda con barras demasiado finas para 50 mm en una térmica
 * de 203 dpi: se avisa y se ofrece la etiqueta compacta.
 */
export const MAX_CODE128_ON_50MM = 20

export function tooLongFor50mm(v: { sku: string; gtin: string | null }): boolean {
  const b = linearBarcode(v)
  return b.bcid === 'code128' && b.text.length > MAX_CODE128_ON_50MM
}
