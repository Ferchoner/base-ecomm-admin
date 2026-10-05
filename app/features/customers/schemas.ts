import { z } from 'zod'

/** `POST /v1/admin/identity/guest-anonymizations` (API_SPEC §9.18). */
export const guestAnonymizationSchema = z.object({
  contactEmail: z.email('Escribe un email válido.').max(254, 'Máximo 254 caracteres.'),
  publicCode: z
    .string()
    .trim()
    .min(1, 'Escribe el código del pedido.')
    .max(100, 'Máximo 100 caracteres.'),
  reason: z
    .string()
    .trim()
    .min(1, 'Escribe la referencia de la solicitud.')
    .max(250, 'Máximo 250 caracteres.'),
  acknowledged: z.boolean().refine((v) => v, 'Confirma que entiendes que no se puede deshacer.'),
})
export type GuestAnonymizationForm = z.infer<typeof guestAnonymizationSchema>
