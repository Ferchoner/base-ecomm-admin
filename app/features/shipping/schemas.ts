import { z } from 'zod'
import { PESOS_PATTERN, pesosTextToCents } from '~/shared/utils/money'

/** Paquetería y guía (API_SPEC §17): de 1 a 100 caracteres cada una, sin quedar en blanco. */
export const trackingSchema = z.object({
  carrierName: z
    .string()
    .trim()
    .min(1, 'Escribe la paquetería.')
    .max(100, 'Máximo 100 caracteres.'),
  trackingNumber: z.string().trim().min(1, 'Escribe la guía.').max(100, 'Máximo 100 caracteres.'),
})
export type TrackingForm = z.infer<typeof trackingSchema>

/** Nota de entrega fallida o devolución: opcional, hasta 500 (ADR-0141). */
export const shipmentNoteSchema = z.object({
  note: z.string().trim().max(500, 'Máximo 500 caracteres.'),
})
export type ShipmentNoteForm = z.infer<typeof shipmentNoteSchema>

/** Tope de los montos del método de envío: 2147483647 centavos (UpdateShippingMethodDto). */
export const MAX_CENTS = 2147483647

const pesos = (requiredMessage: string) =>
  z
    .string()
    .trim()
    .min(1, { error: requiredMessage, abort: true })
    .regex(PESOS_PATTERN, { error: 'Escribe pesos, con hasta 2 decimales.', abort: true })
    .refine((v) => pesosTextToCents(v) <= MAX_CENTS, 'El monto es demasiado alto.')

const businessDays = z
  .number({ error: 'Escribe los días hábiles.' })
  .int('Escribe un número entero.')
  .min(1, 'Al menos 1 día hábil.')
  .max(30, 'Máximo 30 días hábiles.')

/**
 * Método de envío (API_SPEC §17, T-196): nombre de 1 a 100; costo fijo ≥ 0 con IVA incluido; umbral
 * de envío gratis opcional y mayor que 0; plazo de 1 a 30 días hábiles con máximo ≥ mínimo.
 */
export const shippingMethodSchema = z
  .object({
    name: z.string().trim().min(1, 'Escribe el nombre.').max(100, 'Máximo 100 caracteres.'),
    flatFee: pesos('Escribe el costo; 0 si el envío siempre es gratis.'),
    hasFreeShipping: z.boolean(),
    freeShippingThreshold: z.string().trim(),
    deliveryMinBusinessDays: businessDays,
    deliveryMaxBusinessDays: businessDays,
  })
  .superRefine((v, ctx) => {
    if (v.hasFreeShipping) {
      const parsed = pesos('Escribe el monto para el envío gratis.').safeParse(
        v.freeShippingThreshold,
      )
      const message = parsed.success
        ? pesosTextToCents(v.freeShippingThreshold) === 0
          ? 'Debe ser mayor que 0.'
          : null
        : parsed.error.issues[0]?.message
      if (message) ctx.addIssue({ code: 'custom', path: ['freeShippingThreshold'], message })
    }
    if (v.deliveryMaxBusinessDays < v.deliveryMinBusinessDays)
      ctx.addIssue({
        code: 'custom',
        path: ['deliveryMaxBusinessDays'],
        message: 'No puede ser menor que el mínimo.',
      })
  })
export type ShippingMethodForm = z.infer<typeof shippingMethodSchema>
