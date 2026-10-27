/**
 * Un lector configurado con teclado de EE. UU. en un equipo con teclado latinoamericano o español
 * "teclea" `'` donde el código lleva `-`: es la tecla a la derecha del 0 (GAPS G-28). Ningún código
 * que se imprime o se busca aquí lleva apóstrofo, así que se corrige al leerlo; un texto que no
 * queda con la forma del código (un nombre como O'Neil) se deja como está.
 */
export function fixScannedCode(text: string, code: RegExp): string {
  if (!text.includes("'")) return text
  const fixed = text.trim().replaceAll("'", '-')
  return code.test(fixed) ? fixed : text
}

/** Código público de un pedido, el del ticket: 8 caracteres con o sin el guion del medio. */
export const ORDER_CODE = /^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/

/** Folio de una orden de trabajo, el de la nota de servicio: `OT-000123`. */
export const FOLIO_CODE = /^ot-\d{1,10}$/i
