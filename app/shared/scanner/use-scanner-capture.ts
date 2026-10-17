import { createScanDetector, isEditableTarget } from './scan-detector'
import type { ScanDetectorOptions } from './scan-detector'

/**
 * Escuchar el lector en toda la página (venta en tienda): escanear funciona sin dar clic en el
 * campo primero. No interviene mientras el foco está en un campo de texto, donde el lector escribe
 * como un teclado normal y el campo maneja su Enter.
 */
export function useScannerCapture(onScan: (code: string) => void, options?: ScanDetectorOptions) {
  const detector = createScanDetector(onScan, options)

  function onKeydown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey || isEditableTarget(e.target)) {
      detector.reset()
      return
    }
    if (detector.key(e.key, e.timeStamp)) {
      // El Enter del lector no debe activar el botón que tenga el foco.
      e.preventDefault()
      e.stopPropagation()
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown, true))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, true))
}
