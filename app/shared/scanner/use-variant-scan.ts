import type { ApiProblem } from '~/shared/api/problem'
import {
  SCAN_CODE,
  isSellable,
  notSellableReason,
  useVariantLookup,
} from '~/shared/api/variant-lookup'
import type { VariantLookup } from '~/shared/api/variant-lookup'
import { usePreferencesStore } from '~/shared/preferences/preferences.store'
import { scanBeep } from './beep'
import { fixScannedCode } from './scanned-text'

export interface ScanFeedback {
  tone: 'success' | 'info' | 'warning' | 'error'
  text: string
}

export interface VariantScanOptions {
  /** Solo variantes que se venden; si ninguna, se explica por qué (venta en tienda). */
  sellableOnly?: boolean
  /** Mensaje cuando ninguna variante tiene el código. */
  notFound?: (code: string) => string
  /** Qué hacer con la variante elegida; puede devolver un aviso (por ejemplo, sin existencias). */
  onFound: (variant: VariantLookup) => ScanFeedback | undefined | Promise<ScanFeedback | undefined>
}

/**
 * Escaneo de un SKU o GTIN (PLAN_API_1.7 §3.1): busca el código exacto, toma la única variante
 * que coincide o pide elegir entre varias, y explica lo que no se encontró o no se vende.
 */
export function useVariantScan(options: VariantScanOptions) {
  const lookup = useVariantLookup()
  const prefs = usePreferencesStore()
  const pending = ref(false)
  const feedback = ref<ScanFeedback | null>(null)
  const choices = ref<VariantLookup[]>([])

  function beep(ok: boolean) {
    if (prefs.scanSound) scanBeep(ok)
  }

  function clear() {
    feedback.value = null
    choices.value = []
  }

  async function choose(variant: VariantLookup) {
    clear()
    const result = await options.onFound(variant)
    if (result) feedback.value = result
    beep(!result || result.tone === 'success')
  }

  async function scan(raw: string) {
    const code = fixScannedCode(raw, SCAN_CODE).trim()
    clear()
    if (!code) return
    pending.value = true
    let list: VariantLookup[]
    try {
      list = await lookup(code)
    } catch (e) {
      const p = e as ApiProblem
      feedback.value = {
        tone: 'error',
        text:
          p.type === 'validation-error'
            ? `«${code}» no es un SKU ni un GTIN válido.`
            : (p.detail ?? 'No se pudo buscar el código. Intenta de nuevo.'),
      }
      beep(false)
      return
    } finally {
      pending.value = false
    }
    const candidates = options.sellableOnly ? list.filter(isSellable) : list
    if (candidates.length === 0) {
      feedback.value = {
        tone: 'warning',
        text: list[0]
          ? notSellableReason(list[0])
          : (options.notFound?.(code) ?? `Ningún producto tiene el código ${code}.`),
      }
      beep(false)
      return
    }
    if (candidates.length > 1) {
      choices.value = candidates
      feedback.value = {
        tone: 'info',
        text: `El código ${code} coincide con ${candidates.length} variantes: elige una.`,
      }
      return
    }
    await choose(candidates[0]!)
  }

  return { scan, choose, clear, pending, feedback, choices }
}
