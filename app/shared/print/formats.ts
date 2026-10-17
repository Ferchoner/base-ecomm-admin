/**
 * Papeles para imprimir desde el navegador (PLAN_API_1.7 §3.2, D-083): la API no genera PDF ni
 * imágenes, así que cada documento es una página con estilos de impresión y el diálogo del sistema.
 */
export type DocumentFormat = 'thermal58' | 'thermal80' | 'letter'

export const DOCUMENT_FORMATS: Record<DocumentFormat, { label: string; page: string }> = {
  thermal58: { label: 'Térmica 58 mm', page: '58mm auto' },
  thermal80: { label: 'Térmica 80 mm', page: '80mm auto' },
  letter: { label: 'Hoja carta', page: 'letter' },
}

export type LabelFormat = 'label50x25' | 'label25x15' | 'letter30'

export const LABEL_FORMATS: Record<LabelFormat, { label: string; page: string }> = {
  label50x25: { label: 'Etiqueta 50 × 25 mm', page: '50mm 25mm' },
  label25x15: { label: 'Compacta 25 × 15 mm, código 2D', page: '25mm 15mm' },
  letter30: { label: 'Hoja carta de 30 (3 × 10)', page: 'letter' },
}

/** Código 2D de la etiqueta compacta: Data Matrix por defecto, QR como opción (D-083). */
export type CompactSymbology = 'datamatrix' | 'qrcode'

export const COMPACT_SYMBOLOGIES: Record<CompactSymbology, string> = {
  datamatrix: 'Data Matrix',
  qrcode: 'QR',
}

export const options = <K extends string>(map: Record<K, string | { label: string }>) =>
  (Object.keys(map) as K[]).map((value) => {
    const v = map[value]
    return { value, label: typeof v === 'string' ? v : v.label }
  })

/**
 * Tamaño de la hoja para el diálogo de impresión. En térmica, el alto lo pone el rollo; si el
 * navegador no respeta el tamaño, manda el que tenga configurado la impresora (GAPS G-25).
 */
export function usePrintPage(size: MaybeRefOrGetter<string>, margin: MaybeRefOrGetter<string>) {
  useHead({
    style: [
      {
        key: 'print-page',
        innerHTML: computed(() => `@page { size: ${toValue(size)}; margin: ${toValue(margin)}; }`),
      },
    ],
  })
}
