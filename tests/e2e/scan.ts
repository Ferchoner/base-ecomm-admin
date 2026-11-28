import type { Page } from '@playwright/test'

/**
 * Escanea un código como un lector en modo teclado (HID, PLAN_API_1.7 §3.1): las teclas físicas
 * en una ráfaga de pocos milisegundos, terminada en Enter, con Shift en las mayúsculas.
 *
 * - Con el foco en un campo de texto, el lector escribe ahí como un teclado y el campo maneja su
 *   Enter: se usa el teclado de Playwright, que no depende del tiempo.
 * - Sin foco en un campo, el lector se escucha en toda la página (`useScannerCapture`) y solo se
 *   acepta una ráfaga con menos de 50 ms entre teclas. Playwright espera a que la página procese
 *   cada tecla antes de mandar la siguiente, así que con la CPU ocupada (varias pruebas en
 *   paralelo) una pausa pasaba de 50 ms y el escaneo se perdía. Las teclas se despachan en la
 *   página de un solo golpe, como las manda un lector real.
 */
export async function scan(page: Page, code: string) {
  const inField = await page.evaluate(() =>
    Boolean(
      document.activeElement?.matches(
        'input:not([type=button],[type=checkbox],[type=radio],[type=submit],[type=reset],[type=file],[type=range],[type=color]), textarea, select, [contenteditable]',
      ),
    ),
  )
  if (inField) {
    await page.keyboard.type(code)
    await page.keyboard.press('Enter')
    return
  }
  const keys = [...code].map((char) => ({ char, ...physicalKey(char) }))
  await page.evaluate((keys) => {
    const target = document.activeElement ?? document.body
    const send = (type: string, init: KeyboardEventInit) =>
      target.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init }))
    for (const { char, code, shift } of keys) {
      if (shift) send('keydown', { key: 'Shift', code: 'ShiftLeft', shiftKey: true })
      send('keydown', { key: char, code, shiftKey: shift })
      send('keyup', { key: char, code, shiftKey: shift })
      if (shift) send('keyup', { key: 'Shift', code: 'ShiftLeft' })
    }
    send('keydown', { key: 'Enter', code: 'Enter' })
    send('keyup', { key: 'Enter', code: 'Enter' })
  }, keys)
}

const SYMBOLS: Record<string, string> = { '-': 'Minus', '.': 'Period', '/': 'Slash', ' ': 'Space' }

/** La tecla física de un carácter en un teclado de EE. UU., como la manda un lector de fábrica. */
function physicalKey(char: string): { code: string; shift: boolean } {
  if (/^[A-Z]$/.test(char)) return { code: `Key${char}`, shift: true }
  if (/^[a-z]$/.test(char)) return { code: `Key${char.toUpperCase()}`, shift: false }
  if (/^\d$/.test(char)) return { code: `Digit${char}`, shift: false }
  const code = SYMBOLS[char]
  if (!code) throw new Error(`scan(): falta la tecla física de «${char}»`)
  return { code, shift: false }
}
