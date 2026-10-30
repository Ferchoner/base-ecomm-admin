import { isEditableTarget } from './scan-detector'
import type { ScanDetectorOptions } from './scan-detector'
import { scanKey } from './us-keyboard'

/**
 * Cuando el lector escribe en un campo, el sistema ya tradujo cada tecla con la distribución del
 * equipo. Al llegar el Enter de una ráfaga, el texto escaneado se reemplaza por el de las teclas
 * físicas en EE. UU. (GAPS G-28), antes de que el campo maneje su Enter. Escuchar en captura sobre
 * `window` cubre todos los campos sin tocar cada pantalla.
 */
export function createFieldScanFix(
  usKeyboard: () => boolean,
  { maxGapMs = 50, minLength = 4 }: ScanDetectorOptions = {},
) {
  let typed = ''
  let us = ''
  let last = -Infinity
  let target: EventTarget | null = null

  function reset() {
    typed = ''
    us = ''
  }

  return function onKeydown(e: KeyboardEvent) {
    if (e.timeStamp - last > maxGapMs || e.target !== target) reset()
    last = e.timeStamp
    target = e.target
    if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey || !isEditableTarget(e.target)) {
      reset()
      return
    }
    if (e.key === 'Enter') {
      const from = typed
      const to = us
      reset()
      if (from.length >= minLength && from !== to) replaceTyped(e.target, from, to)
      return
    }
    if (e.key.length === 1) {
      typed += e.key
      us += scanKey(e, usKeyboard())
    } else if (e.key !== 'Shift') reset()
  }
}

/** Cambia el texto recién escrito (justo antes del cursor) y avisa al `v-model` del campo. */
function replaceTyped(el: EventTarget | null, from: string, to: string) {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return
  const end = el.selectionEnd ?? el.value.length
  const start = end - from.length
  if (start < 0 || el.value.slice(start, end) !== from) return
  el.value = el.value.slice(0, start) + to + el.value.slice(end)
  el.setSelectionRange(start + to.length, start + to.length)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
