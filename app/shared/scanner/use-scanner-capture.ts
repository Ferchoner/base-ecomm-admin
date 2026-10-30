import { usePreferencesStore } from '~/shared/preferences/preferences.store'
import { createScanDetector, isEditableTarget } from './scan-detector'
import type { ScanDetectorOptions } from './scan-detector'
import { scanKey } from './us-keyboard'

/**
 * Escuchar el lector en toda la página (venta en tienda): escanear funciona sin dar clic en el
 * campo primero. No interviene mientras el foco está en un campo de texto, donde el lector escribe
 * como un teclado normal y el campo maneja su Enter.
 */
export function useScannerCapture(onScan: (code: string) => void, options?: ScanDetectorOptions) {
  const detector = createScanDetector(onScan, options)
  const prefs = usePreferencesStore()

  function onKeydown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey || isEditableTarget(e.target)) {
      detector.reset()
      return
    }
    if (detector.key(scanKey(e, prefs.scannerUsKeyboard), e.timeStamp)) {
      // El Enter del lector no debe activar el botón que tenga el foco.
      e.preventDefault()
      e.stopPropagation()
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown, true))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, true))
}
