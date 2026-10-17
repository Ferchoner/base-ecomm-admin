/**
 * Detecta lo que "teclea" un lector de códigos en modo teclado (HID): una ráfaga de teclas con
 * menos de `maxGapMs` entre cada una, terminada en Enter (PLAN_API_1.7 §3.1, GAPS G-26). Una persona
 * escribe más despacio, así que su texto nunca se toma como escaneo.
 */
export interface ScanDetectorOptions {
  maxGapMs?: number
  minLength?: number
}

export function createScanDetector(
  onScan: (code: string) => void,
  { maxGapMs = 50, minLength = 4 }: ScanDetectorOptions = {},
) {
  let buffer = ''
  let last = -Infinity

  /** Procesa una tecla; devuelve `true` si cerró un escaneo (para evitar que Enter haga otra cosa). */
  function key(k: string, time: number): boolean {
    if (time - last > maxGapMs) buffer = ''
    last = time
    if (k === 'Enter') {
      const code = buffer
      buffer = ''
      if (code.length < minLength) return false
      onScan(code)
      return true
    }
    if (k.length === 1) buffer += k
    else if (k !== 'Shift') buffer = ''
    return false
  }

  function reset() {
    buffer = ''
    last = -Infinity
  }

  return { key, reset }
}

/** Campos donde la persona está escribiendo: ahí el lector escribe como teclado normal. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  if (!(target instanceof HTMLInputElement)) return false
  return !['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'range', 'color'].includes(
    target.type,
  )
}
