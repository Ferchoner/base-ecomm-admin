import { z } from 'zod'

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
