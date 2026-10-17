// GTIN (EAN/UPC) de la variante (API_SPEC §11.7, ADR-0163): 8, 12, 13 o 14 dígitos con su dígito
// verificador GS1. La validación definitiva es de la API; aquí solo se anticipa el error.

export const GTIN_FORMAT = /^(\d{8}|\d{12,14})$/

/** Dígito verificador GS1 (módulo 10) de los dígitos sin el último. */
export function gtinCheckDigit(body: string): number {
  let sum = 0
  for (let i = 0; i < body.length; i++) {
    const digit = Number(body[body.length - 1 - i])
    sum += i % 2 === 0 ? digit * 3 : digit
  }
  return (10 - (sum % 10)) % 10
}

export function isValidGtin(code: string): boolean {
  if (!GTIN_FORMAT.test(code)) return false
  return gtinCheckDigit(code.slice(0, -1)) === Number(code.at(-1))
}

/** GTIN completado con ceros a 14 dígitos, como lo compara la API. */
export function gtin14(code: string): string {
  return code.padStart(14, '0')
}
