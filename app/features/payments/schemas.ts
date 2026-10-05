import { z } from 'zod'

/** `POST …/refunds/manual` (API_SPEC §16.5): comprobante de 1 a 100, nota hasta 500. */
export const manualRefundSchema = z.object({
  reference: z
    .string()
    .trim()
    .min(1, 'Escribe el comprobante del reembolso.')
    .max(100, 'Máximo 100 caracteres.'),
  note: z.string().trim().max(500, 'Máximo 500 caracteres.'),
})
export type ManualRefundForm = z.infer<typeof manualRefundSchema>
