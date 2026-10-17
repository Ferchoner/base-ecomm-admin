/** Una variante en la cola de etiquetas, con cuántas copias imprimir (PLAN_API_1.7 §3.2). */
export interface LabelItem {
  variantId: string
  sku: string
  gtin: string | null
  title: string
  options: Record<string, string>
  copies: number
}

export const MAX_COPIES = 100
/** Tope de etiquetas por impresión, para no dibujar miles de códigos a la vez. */
export const MAX_LABELS = 600
/** Hoja carta de 30 etiquetas de 66.7 × 25.4 mm (3 × 10). */
export const LABELS_PER_LETTER = 30

/** Una entrada por etiqueta impresa, en el orden de la cola. */
export function expandLabels(items: readonly LabelItem[]): LabelItem[] {
  const out: LabelItem[] = []
  for (const item of items)
    for (let i = 0; i < item.copies && out.length < MAX_LABELS; i++) out.push(item)
  return out
}

export function chunk<T>(list: readonly T[], size: number): T[][] {
  const pages: T[][] = []
  for (let i = 0; i < list.length; i += size) pages.push(list.slice(i, i + size))
  return pages
}
