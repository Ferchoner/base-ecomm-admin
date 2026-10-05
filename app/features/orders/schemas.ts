import { z } from 'zod'

const optionalNote = z.string().trim().max(500, 'Máximo 500 caracteres.')

/** `POST …/cancel` (API_SPEC §15.7): motivo de 1 a 500 caracteres. */
export const cancelSchema = z.object({
  reason: z.string().trim().min(1, 'Escribe el motivo.').max(500, 'Máximo 500 caracteres.'),
  restock: z.boolean(),
})
export type CancelForm = z.infer<typeof cancelSchema>

/** `POST …/manual-capture` (API_SPEC §16.4): comprobante de 1 a 100, nota hasta 500. */
export const manualCaptureSchema = z.object({
  reference: z
    .string()
    .trim()
    .min(1, 'Escribe el comprobante de la tienda.')
    .max(100, 'Máximo 100 caracteres.'),
  note: optionalNote,
})
export type ManualCaptureForm = z.infer<typeof manualCaptureSchema>

/** `POST …/blocked-data` (API_SPEC §15.7): motivo de 1 a 500, sin datos personales. */
export const blockedDataSchema = z.object({
  reason: z.string().trim().min(1, 'Escribe el motivo.').max(500, 'Máximo 500 caracteres.'),
})
export type BlockedDataForm = z.infer<typeof blockedDataSchema>

/**
 * `POST …/restocks` (API_SPEC §15.7, T-161): de 1 a 100 líneas con cantidad entera de 1 a 100,000 y
 * sin pasar de lo vendido; nota hasta 500. Las líneas en 0 no se envían.
 */
export function restockSchema(maxByLine: Record<string, number>) {
  return z
    .object({
      quantities: z.record(
        z.string(),
        z.number().int('Solo unidades enteras.').min(0, 'No puede ser negativa.'),
      ),
      note: optionalNote,
    })
    .superRefine((value, ctx) => {
      let any = false
      for (const [lineId, qty] of Object.entries(value.quantities)) {
        if (qty > 0) any = true
        const max = maxByLine[lineId]
        if (max !== undefined && qty > max)
          ctx.addIssue({
            code: 'custom',
            path: ['quantities', lineId],
            message: `Máximo ${max}: lo vendido en la línea.`,
          })
      }
      if (!any)
        ctx.addIssue({
          code: 'custom',
          path: ['quantities'],
          message: 'Indica al menos una unidad.',
        })
    })
}
export type RestockForm = z.infer<ReturnType<typeof restockSchema>>
