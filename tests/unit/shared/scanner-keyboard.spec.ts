import { describe, expect, it } from 'vitest'
import { linearWidthMm } from '~/shared/print/symbology'
import { createFieldScanFix } from '~/shared/scanner/field-scan-fix'
import { scanKey, usKeyChar } from '~/shared/scanner/us-keyboard'

/** Teclas físicas que manda un lector de fábrica (EE. UU.) y lo que teclea Windows en latinoamericano. */
const LATAM: Record<string, string> = { Minus: "'", Slash: '-', Period: '.', 'Shift+Minus': '?' }

function keys(text: string) {
  return [...text].map((ch) => {
    if (/[a-z]/i.test(ch)) return { code: `Key${ch.toUpperCase()}`, shift: ch !== ch.toLowerCase() }
    if (/\d/.test(ch)) return { code: `Digit${ch}`, shift: false }
    if (ch === '-') return { code: 'Minus', shift: false }
    if (ch === '_') return { code: 'Minus', shift: true }
    return { code: 'Period', shift: false }
  })
}

function scanInto(input: HTMLInputElement, text: string, us = true, gap = 10) {
  const fix = createFieldScanFix(() => us)
  let t = 1000
  for (const { code, shift } of keys(text)) {
    const typed = LATAM[shift ? `Shift+${code}` : code] ?? usKeyChar(code, shift)!
    const e = new KeyboardEvent('keydown', { key: typed, code, shiftKey: shift })
    Object.defineProperty(e, 'timeStamp', { value: (t += gap) })
    Object.defineProperty(e, 'target', { value: input })
    fix(e)
    input.value += typed
  }
  const enter = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter' })
  Object.defineProperty(enter, 'timeStamp', { value: t + gap })
  Object.defineProperty(enter, 'target', { value: input })
  fix(enter)
}

describe('lector con teclado de EE. UU. en un equipo en español', () => {
  it('traduce la tecla física como en EE. UU.', () => {
    expect(usKeyChar('Minus', false)).toBe('-')
    expect(usKeyChar('Minus', true)).toBe('_')
    expect(usKeyChar('KeyA', true)).toBe('A')
    expect(usKeyChar('Digit7', false)).toBe('7')
    expect(usKeyChar('Numpad3', false)).toBe('3')
    expect(usKeyChar('NumpadSubtract', false)).toBe('-')
    expect(usKeyChar('F5', false)).toBeNull()
    expect(scanKey({ key: "'", code: 'Minus', shiftKey: false }, true)).toBe('-')
    expect(scanKey({ key: "'", code: 'Minus', shiftKey: false }, false)).toBe("'")
  })

  it('el campo queda con el código impreso, con guiones y guiones bajos', () => {
    const input = document.createElement('input')
    document.body.append(input)
    let fired = 0
    input.addEventListener('input', () => fired++)
    scanInto(input, 'K7M4-Q9XA')
    expect(input.value).toBe('K7M4-Q9XA')
    expect(fired).toBe(1)
    input.value = ''
    scanInto(input, 'CAM_LIN-AZ.M')
    expect(input.value).toBe('CAM_LIN-AZ.M')
  })

  it('con la opción apagada, o si escribe una persona, el texto no cambia', () => {
    const input = document.createElement('input')
    document.body.append(input)
    scanInto(input, 'K7M4-Q9XA', false)
    expect(input.value).toBe("K7M4'Q9XA")
    input.value = ''
    scanInto(input, 'K7M4-Q9XA', true, 200)
    expect(input.value).toBe("K7M4'Q9XA")
  })
})

describe('barras en puntos enteros de la térmica (8 por mm)', () => {
  it('usa módulos de 3 puntos si caben, si no de 2', () => {
    // Code 128 de 8 dígitos con zona blanca: 101 módulos.
    expect(linearWidthMm(101, 46)).toBe(37.875)
    // EAN-13 con zona blanca: 117 módulos.
    expect(linearWidthMm(117, 46)).toBe(43.875)
    expect(linearWidthMm(200, 46)).toBe(46)
    expect(linearWidthMm(160, 46)).toBe(40)
  })
})
