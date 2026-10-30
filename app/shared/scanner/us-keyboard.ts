/**
 * El lector en modo teclado (HID) manda teclas físicas, no letras: el sistema las traduce con la
 * distribución de teclado del equipo. Un lector de fábrica asume teclado de EE. UU., así que en un
 * equipo con teclado latinoamericano o español el `-` llega como `'` y otros símbolos cambian
 * (GAPS G-28). Traducir la tecla física (`KeyboardEvent.code`) con la distribución de EE. UU. da
 * el código tal como está impreso, sin importar el idioma del equipo.
 */
const SHIFTED_DIGITS = ')!@#$%^&*('

const SYMBOLS: Record<string, [string, string]> = {
  Minus: ['-', '_'],
  Equal: ['=', '+'],
  BracketLeft: ['[', '{'],
  BracketRight: [']', '}'],
  Backslash: ['\\', '|'],
  Semicolon: [';', ':'],
  Quote: ["'", '"'],
  Backquote: ['`', '~'],
  Comma: [',', '<'],
  Period: ['.', '>'],
  Slash: ['/', '?'],
  Space: [' ', ' '],
}

const NUMPAD: Record<string, string> = {
  NumpadSubtract: '-',
  NumpadAdd: '+',
  NumpadDecimal: '.',
  NumpadMultiply: '*',
  NumpadDivide: '/',
}

/** El carácter de la tecla física en un teclado de EE. UU.; `null` si no escribe uno. */
export function usKeyChar(code: string, shift: boolean): string | null {
  const letter = /^Key([A-Z])$/.exec(code)?.[1]
  if (letter) return shift ? letter : letter.toLowerCase()
  const digit = /^Digit(\d)$/.exec(code)?.[1]
  if (digit) return shift ? SHIFTED_DIGITS[Number(digit)]! : digit
  const pad = /^Numpad(\d)$/.exec(code)?.[1]
  if (pad) return pad
  if (code in NUMPAD) return NUMPAD[code]!
  const symbol = SYMBOLS[code]
  return symbol ? symbol[shift ? 1 : 0] : null
}

/** Lo que una tecla aporta a un escaneo: la tecla física en EE. UU. o lo que tecleó el sistema. */
export function scanKey(e: Pick<KeyboardEvent, 'key' | 'code' | 'shiftKey'>, us: boolean): string {
  if (!us || e.key === 'Enter' || e.key === 'Shift') return e.key
  return usKeyChar(e.code, e.shiftKey) ?? e.key
}
