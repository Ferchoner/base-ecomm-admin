import { z } from 'zod'
import type { Schemas } from '~/shared/api/types'

/** Dirección en el formato `AddressInput` (API_SPEC §8.2): almacenes y pedidos de la tienda. */
export type AddressInput = Schemas['AddressInputDto']

const optional = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres.`)

/** Campos como texto; las reglas de obligatoriedad las aplica `checkAddress`. */
export const addressFieldsSchema = z.object({
  recipientName: optional(120),
  phone: z.string().trim(),
  street: optional(150),
  exteriorNumber: optional(20),
  interiorNumber: optional(20),
  neighborhood: optional(120),
  postalCode: z.string().trim(),
  stateCode: z.string(),
  municipalityCode: z.string(),
  city: optional(120),
  references: optional(250),
})
export type AddressFields = z.input<typeof addressFieldsSchema>

export const ADDRESS_FIELDS = Object.keys(addressFieldsSchema.shape) as Array<keyof AddressFields>

export function emptyAddress(): AddressFields {
  return {
    recipientName: '',
    phone: '',
    street: '',
    exteriorNumber: '',
    interiorNumber: '',
    neighborhood: '',
    postalCode: '',
    stateCode: '',
    municipalityCode: '',
    city: '',
    references: '',
  }
}

/** Valores del formulario a partir de una dirección guardada (o vacíos). */
export function addressFields(a: Partial<Record<keyof AddressFields, string | null>> | null) {
  const out = emptyAddress()
  if (!a) return out
  for (const key of ADDRESS_FIELDS) out[key] = a[key] ?? ''
  return out
}

/** Reglas de `AddressInput`: obligatorios, teléfono de 10 dígitos y código postal de 5. */
export function checkAddress(a: AddressFields, ctx: z.RefinementCtx, path: Array<string | number>) {
  const need = (field: keyof AddressFields, message: string) =>
    ctx.addIssue({ code: 'custom', path: [...path, field], message })
  if (!a.recipientName) need('recipientName', 'Escribe el nombre de quien recibe.')
  if (!/^\d{10}$/.test(a.phone)) need('phone', 'Exactamente 10 dígitos.')
  if (!a.street) need('street', 'Escribe la calle.')
  if (!a.exteriorNumber) need('exteriorNumber', 'Escribe el número exterior.')
  if (!a.neighborhood) need('neighborhood', 'Escribe la colonia.')
  if (!/^\d{5}$/.test(a.postalCode)) need('postalCode', '5 dígitos.')
  if (!a.stateCode) need('stateCode', 'Elige el estado.')
  if (!a.municipalityCode) need('municipalityCode', 'Elige el municipio.')
}

export function toAddressInput(a: AddressFields): AddressInput {
  return {
    recipientName: a.recipientName,
    phone: a.phone,
    street: a.street,
    exteriorNumber: a.exteriorNumber,
    interiorNumber: a.interiorNumber || null,
    neighborhood: a.neighborhood,
    postalCode: a.postalCode,
    stateCode: a.stateCode,
    municipalityCode: a.municipalityCode,
    city: a.city || null,
    references: a.references || null,
  }
}
