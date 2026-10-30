import { usePreferencesStore } from '~/shared/preferences/preferences.store'
import { createFieldScanFix } from '~/shared/scanner/field-scan-fix'

/** Lo que el lector escribe en cualquier campo llega como está impreso (GAPS G-28). */
export default defineNuxtPlugin({
  name: 'scanner-keyboard',
  setup() {
    const prefs = usePreferencesStore()
    window.addEventListener(
      'keydown',
      createFieldScanFix(() => prefs.scannerUsKeyboard),
      true,
    )
  },
})
