import { z } from 'zod'

// SetPriceDto (openapi/v1.json) y API_SPEC §12: montos en centavos, enteros ≥ 0; el usuario escribe pesos.

const PESOS = /^\d+(\.\d{1,2})?$/

const pesos = (required: boolean) =>
  z
    .string()
    .trim()
    .refine((v) => (v === '' ? !required : PESOS.test(v)), {
      message: required
        ? 'Escribe el precio en pesos, con hasta 2 decimales.'
        : 'Pesos con hasta 2 decimales.',
    })

export const priceSchema = z
  .object({
    amount: pesos(true),
    compareAtAmount: pesos(false),
    mode: z.enum(['now', 'scheduled']),
    /** `datetime-local` del navegador; se envía en ISO con zona. */
    effectiveFrom: z.string(),
  })
  .refine((v) => v.compareAtAmount === '' || Number(v.compareAtAmount) > Number(v.amount), {
    path: ['compareAtAmount'],
    message: 'Debe ser mayor que el precio.',
  })
  .refine(
    (v) =>
      v.mode === 'now' ||
      (v.effectiveFrom !== '' && new Date(v.effectiveFrom).getTime() > Date.now()),
    {
      path: ['effectiveFrom'],
      message: 'Elige una fecha y hora futuras.',
    },
  )
export type PriceForm = z.input<typeof priceSchema>

/** Pesos escritos (`599.5`) → centavos, sin errores de coma flotante. */
export function pesosTextToCents(text: string): number {
  const [int, dec = ''] = text.trim().split('.')
  return Number(int) * 100 + Number(dec.padEnd(2, '0'))
}
