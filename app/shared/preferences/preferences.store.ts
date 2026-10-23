import { defineStore } from 'pinia'
import { useSessionStore } from '~/shared/auth/session.store'
import { COMPACT_SYMBOLOGIES, DOCUMENT_FORMATS, LABEL_FORMATS } from '~/shared/print/formats'
import type { CompactSymbology, DocumentFormat, LabelFormat } from '~/shared/print/formats'

/** Umbral inicial de stock bajo (GAPS G-06, aprobado por el usuario el 2026-10-05). */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5

const KEY_PREFIX = 'backoffice.preferences.'

interface Preferences {
  lowStockThreshold: number
  /** Aviso sonoro al escanear un código (PLAN_API_1.7 §3.1). */
  scanSound: boolean
  /** Papeles preferidos para imprimir (D-083): ticket en 58 mm y nota de servicio en carta. */
  ticketFormat: DocumentFormat
  serviceNoteFormat: DocumentFormat
  labelFormat: LabelFormat
  compactSymbology: CompactSymbology
}

const DEFAULTS: Preferences = {
  lowStockThreshold: DEFAULT_LOW_STOCK_THRESHOLD,
  scanSound: true,
  ticketFormat: 'thermal58',
  serviceNoteFormat: 'letter',
  labelFormat: 'roll58',
  compactSymbology: 'datamatrix',
}

const oneOf = <T extends string>(map: Record<T, unknown>, value: unknown, fallback: T): T =>
  typeof value === 'string' && value in map ? (value as T) : fallback

function read(key: string): Preferences {
  try {
    const raw = globalThis.localStorage?.getItem(key)
    const p = raw ? (JSON.parse(raw) as Partial<Preferences>) : {}
    const t = p.lowStockThreshold
    return {
      lowStockThreshold:
        Number.isInteger(t) && (t as number) >= 0 ? (t as number) : DEFAULTS.lowStockThreshold,
      scanSound: typeof p.scanSound === 'boolean' ? p.scanSound : DEFAULTS.scanSound,
      ticketFormat: oneOf(DOCUMENT_FORMATS, p.ticketFormat, DEFAULTS.ticketFormat),
      serviceNoteFormat: oneOf(DOCUMENT_FORMATS, p.serviceNoteFormat, DEFAULTS.serviceNoteFormat),
      labelFormat: oneOf(LABEL_FORMATS, p.labelFormat, DEFAULTS.labelFormat),
      compactSymbology: oneOf(COMPACT_SYMBOLOGIES, p.compactSymbology, DEFAULTS.compactSymbology),
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
  const ticketFormat = computed(() => prefs.value.ticketFormat)
  const serviceNoteFormat = computed(() => prefs.value.serviceNoteFormat)
  const labelFormat = computed(() => prefs.value.labelFormat)
  const compactSymbology = computed(() => prefs.value.compactSymbology)

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

  /** Papeles de impresión; un valor desconocido se ignora. */
  function setPrint(
    changes: Partial<
      Pick<Preferences, 'ticketFormat' | 'serviceNoteFormat' | 'labelFormat' | 'compactSymbology'>
    >,
  ) {
    const p = prefs.value
    save({
      ticketFormat: oneOf(DOCUMENT_FORMATS, changes.ticketFormat, p.ticketFormat),
      serviceNoteFormat: oneOf(DOCUMENT_FORMATS, changes.serviceNoteFormat, p.serviceNoteFormat),
      labelFormat: oneOf(LABEL_FORMATS, changes.labelFormat, p.labelFormat),
      compactSymbology: oneOf(COMPACT_SYMBOLOGIES, changes.compactSymbology, p.compactSymbology),
    })
  }

  return {
    lowStockThreshold,
    setLowStockThreshold,
    scanSound,
    setScanSound,
    ticketFormat,
    serviceNoteFormat,
    labelFormat,
    compactSymbology,
    setPrint,
  }
})
