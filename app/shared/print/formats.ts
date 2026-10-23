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

export type LabelFormat = 'roll58' | 'roll58compact' | 'label50x25' | 'label25x15' | 'letter30'

/**
 * Etiquetas en rollo térmico de 58 mm sin troquel: se acomodan a lo ancho del rollo, una tras otra,
 * y el papel mide lo que miden las filas. Una hoja de 50 × 25 mm es más ancha que alta y el
 * controlador la gira, así que en un rollo de 58 mm salía de lado y con mucho papel en blanco.
 */
export interface RollLayout {
  /** Etiquetas por fila, dentro del ancho imprimible de 48 mm. */
  perRow: number
  /** Alto de cada fila en mm. */
  rowMm: number
}

export const LABEL_FORMATS: Record<
  LabelFormat,
  { label: string; page: string; roll?: RollLayout }
> = {
  roll58: { label: 'Rollo 58 mm, código de barras', page: '', roll: { perRow: 1, rowMm: 22 } },
  roll58compact: {
    label: 'Rollo 58 mm, compactas 2D (2 por fila)',
    page: '',
    roll: { perRow: 2, rowMm: 15 },
  },
  label50x25: { label: 'Adhesiva 50 × 25 mm', page: '50mm 25mm' },
  label25x15: { label: 'Adhesiva compacta 25 × 15 mm, código 2D', page: '25mm 15mm' },
  letter30: { label: 'Hoja carta de 30 (3 × 10)', page: 'letter' },
}

export const ROLL_WIDTH_MM = 58
/** Filas por hoja de rollo: hojas de menos de un metro, que el navegador maneja sin problema. */
export const ROLL_ROWS_PER_PAGE = 40
/** La hoja debe quedar más alta que ancha para que el controlador no la gire. */
export const ROLL_MIN_HEIGHT_MM = 60

/** Filas en cada hoja de rollo para `count` etiquetas. */
export function rollRows(roll: RollLayout, count: number): number {
  return Math.min(ROLL_ROWS_PER_PAGE, Math.ceil(count / roll.perRow))
}

/** Tamaño de hoja para `count` etiquetas: en rollo, 58 mm de ancho y el alto de las filas. */
export function labelPageSize(format: LabelFormat, count: number): string {
  const { page, roll } = LABEL_FORMATS[format]
  if (!roll) return page
  const height = Math.max(ROLL_MIN_HEIGHT_MM, rollRows(roll, count) * roll.rowMm)
  return `${ROLL_WIDTH_MM}mm ${height}mm`
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
