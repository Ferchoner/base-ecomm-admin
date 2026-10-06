import { z } from 'zod'
import { addressFieldsSchema, checkAddress, toAddressInput } from '~/shared/address/address-form'
import type { StaffOrderInput } from './types'

const optionalNote = z.string().trim().max(500, 'Máximo 500 caracteres.')

/** `POST …/cancel` (API_SPEC §15.7): motivo de 1 a 500 caracteres. */
export const cancelSchema = z.object({
  reason: z.string().trim().min(1, 'Escribe el motivo.').max(500, 'Máximo 500 caracteres.'),
  restock: z.boolean(),
})
export type CancelForm = z.infer<typeof cancelSchema>

/**
 * `POST …/manual-capture` (API_SPEC §16.4): comprobante de 1 a 100, cómo se cobró (opcional, ADR-0161),
 * nota hasta 500.
 */
export const manualCaptureSchema = z.object({
  reference: z
    .string()
    .trim()
    .min(1, 'Escribe el comprobante de la tienda.')
    .max(100, 'Máximo 100 caracteres.'),
  method: z.enum(['CASH', 'CARD_TERMINAL', 'TRANSFER']).optional(),
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

/** Una variante del pedido de la tienda, con lo que se muestra mientras llega la cotización. */
export interface StoreOrderLineForm {
  variantId: string
  sku: string
  productTitle: string
  quantity: number | undefined
}

/**
 * Pedido de la tienda física (`POST /v1/admin/orders`, API_SPEC §15.7, ADR-0161): de 1 a 100 líneas
 * con 1 a 30 unidades; exactamente un comprador (cliente o invitado), salvo en venta de mostrador; y
 * en envío, exactamente una dirección (guardada del cliente o nueva).
 */
export const storeOrderSchema = z
  .object({
    warehouseId: z.string().min(1, 'Elige el almacén.'),
    fulfillment: z.enum(['SHIPPING', 'IN_STORE']),
    lines: z.array(
      z.object({
        variantId: z.string(),
        sku: z.string(),
        productTitle: z.string(),
        quantity: z
          .number({ error: 'De 1 a 30 unidades.' })
          .int('De 1 a 30 unidades.')
          .min(1, 'De 1 a 30 unidades.')
          .max(30, 'De 1 a 30 unidades.'),
      }),
    ),
    buyer: z.enum(['customer', 'guest', 'none']),
    customerId: z.string().optional(),
    contactEmail: z.string().trim(),
    privacyNoticeShown: z.boolean(),
    addressMode: z.enum(['saved', 'new']),
    addressId: z.string().optional(),
    address: addressFieldsSchema,
  })
  .superRefine((v, ctx) => {
    const issue = (path: Array<string | number>, message: string) =>
      ctx.addIssue({ code: 'custom', path, message })
    if (v.lines.length === 0) issue(['lines'], 'Agrega al menos un producto.')
    if (v.lines.length > 100) issue(['lines'], 'Máximo 100 productos distintos.')
    if (v.buyer === 'customer' && !v.customerId) issue(['customerId'], 'Elige el cliente.')
    if (v.buyer === 'guest') {
      if (!z.email().max(254).safeParse(v.contactEmail).success)
        issue(['contactEmail'], 'Escribe un email válido.')
      if (!v.privacyNoticeShown)
        issue(['privacyNoticeShown'], 'Presenta el aviso de privacidad al comprador.')
    }
    if (v.buyer === 'none' && v.fulfillment !== 'IN_STORE')
      issue(['buyer'], 'Un pedido con envío necesita los datos del comprador.')
    if (v.fulfillment === 'SHIPPING') {
      if (v.buyer === 'customer' && v.addressMode === 'saved') {
        if (!v.addressId) issue(['addressId'], 'Elige la dirección.')
      } else checkAddress(v.address, ctx, ['address'])
    }
  })
export type StoreOrderForm = z.input<typeof storeOrderSchema>

/** Cuerpo de `POST /v1/admin/orders` a partir del formulario ya válido. */
export function toStaffOrderInput(
  v: StoreOrderForm,
  expectedTotal: number,
  privacyNoticeVersion: string,
): StaffOrderInput {
  const lines = v.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity ?? 0 }))
  const buyer =
    v.buyer === 'customer'
      ? { customerId: v.customerId }
      : v.buyer === 'guest'
        ? { contactEmail: v.contactEmail.trim(), privacyNoticeVersion }
        : {}
  const address =
    v.fulfillment === 'IN_STORE'
      ? {}
      : v.buyer === 'customer' && v.addressMode === 'saved'
        ? { addressId: v.addressId }
        : { shippingAddress: toAddressInput(v.address) }
  return {
    lines,
    warehouseId: v.warehouseId,
    fulfillment: v.fulfillment,
    ...buyer,
    ...address,
    expectedTotal,
  }
}
