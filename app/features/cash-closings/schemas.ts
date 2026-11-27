import { z } from 'zod'
import { PESOS_PATTERN, pesosTextToCents } from '~/shared/utils/money'
import type { CloseCashInput } from './types'

/** Lo más que se puede contar: el máximo de `Money` (API_SPEC §15.9). */
export const MAX_COUNTED_CENTS = 2_147_483_647
export const MAX_CLOSING_NOTE = 500

/** Pesos escritos → centavos, o `null` si no es una cantidad válida. */
export function countedCents(text: string): number | null {
  const t = text.trim()
  if (!PESOS_PATTERN.test(t)) return null
  const cents = pesosTextToCents(t)
  return cents <= MAX_COUNTED_CENTS ? cents : null
}

/**
 * `POST /v1/admin/cash-closings` (UC-ORD-17): el efectivo contado y, si no es el esperado, por qué. La
 * API vuelve a calcular lo esperado al cerrar y repite la regla de la nota.
 */
export function closeCashSchema(expectedCents: number) {
  return z
    .object({
      counted: z.string(),
      note: z.string().max(MAX_CLOSING_NOTE, `Máximo ${MAX_CLOSING_NOTE} caracteres.`),
    })
    .superRefine((v, ctx) => {
      const cents = countedCents(v.counted)
      if (cents === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['counted'],
          message: 'Escribe el efectivo contado en pesos, por ejemplo 3525.50.',
        })
        return
      }
      if (cents !== expectedCents && v.note.trim() === '')
        ctx.addIssue({
          code: 'custom',
          path: ['note'],
          message: 'El efectivo no cuadra: escribe por qué.',
        })
    })
}
export type CloseCashForm = z.infer<ReturnType<typeof closeCashSchema>>

export function toCloseCashInput(
  form: CloseCashForm,
  warehouseId: string,
  date: string,
): CloseCashInput {
  const note = form.note.trim()
  return {
    warehouseId,
    date,
    countedCash: countedCents(form.counted) ?? 0,
    ...(note && { note }),
  }
}
