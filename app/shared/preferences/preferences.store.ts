import { defineStore } from 'pinia'
import { useSessionStore } from '~/shared/auth/session.store'

/** Umbral inicial de stock bajo (GAPS G-06, aprobado por el usuario el 2026-10-05). */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5

const KEY_PREFIX = 'backoffice.preferences.'

interface Preferences {
  lowStockThreshold: number
  /** Aviso sonoro al escanear un código (PLAN_API_1.7 §3.1). */
  scanSound: boolean
}

const DEFAULTS: Preferences = { lowStockThreshold: DEFAULT_LOW_STOCK_THRESHOLD, scanSound: true }

function read(key: string): Preferences {
  try {
    const raw = globalThis.localStorage?.getItem(key)
    const parsed = raw ? (JSON.parse(raw) as Partial<Preferences>) : {}
    const t = parsed.lowStockThreshold
    return {
      lowStockThreshold:
        Number.isInteger(t) && (t as number) >= 0 ? (t as number) : DEFAULTS.lowStockThreshold,
      scanSound: typeof parsed.scanSound === 'boolean' ? parsed.scanSound : DEFAULTS.scanSound,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

/**
 * Preferencias de interfaz de cada usuario, guardadas en este navegador (DECISIONS D-P07).
 * No es estado del servidor: la API no las conoce.
 */
export const usePreferencesStore = defineStore('preferences', () => {
  const session = useSessionStore()
  const key = computed(() => (session.account ? `${KEY_PREFIX}${session.account.id}` : null))
  const prefs = ref<Preferences>({ ...DEFAULTS })

  watch(key, (k) => (prefs.value = k ? read(k) : { ...DEFAULTS }), { immediate: true })

  const lowStockThreshold = computed(() => prefs.value.lowStockThreshold)
  const scanSound = computed(() => prefs.value.scanSound)

  function save(changes: Partial<Preferences>) {
    prefs.value = { ...prefs.value, ...changes }
    if (!key.value) return
    try {
      globalThis.localStorage?.setItem(key.value, JSON.stringify(prefs.value))
    } catch {
      // Sin almacenamiento la preferencia dura lo que la pestaña.
    }
  }

  function setLowStockThreshold(value: number) {
    if (!Number.isInteger(value) || value < 0) return
    save({ lowStockThreshold: value })
  }

  function setScanSound(value: boolean) {
    save({ scanSound: value })
  }

  return { lowStockThreshold, setLowStockThreshold, scanSound, setScanSound }
})
