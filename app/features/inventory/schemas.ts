import { z } from 'zod'
import { DECREASE_ONLY } from './status'

// ReceiptDto, AdjustmentDto y UpdateWarehouseDto (openapi/v1.json) y API_SPEC §13.

const note = z.string().trim().max(500, 'Máximo 500 caracteres.')

export const receiptSchema = z.object({
  quantity: z
    .number({ error: 'Escribe una cantidad entera.' })
    .int('Escribe una cantidad entera.')
    .min(1, 'Al menos 1.')
    .max(100_000, 'Máximo 100,000.'),
  note,
})
export type ReceiptForm = z.input<typeof receiptSchema>

export const adjustmentSchema = z
  .object({
    direction: z.enum(['increase', 'decrease']),
    quantity: z
      .number({ error: 'Escribe una cantidad entera.' })
      .int('Escribe una cantidad entera.')
      .min(1, 'Al menos 1.')
      .max(100_000, 'Máximo 100,000.'),
    reasonCode: z.enum(
      ['PHYSICAL_COUNT', 'DAMAGED', 'LOSS_OR_THEFT', 'INTERNAL_USE', 'DATA_ENTRY_ERROR', 'OTHER'],
      {
        error: 'Elige un motivo.',
      },
    ),
    note,
  })
  .refine((v) => !(v.direction === 'increase' && DECREASE_ONLY.includes(v.reasonCode)), {
    path: ['reasonCode'],
    message: 'Este motivo solo resta unidades.',
  })
  .refine((v) => v.reasonCode !== 'OTHER' || v.note !== '', {
    path: ['note'],
    message: 'Explica el ajuste cuando el motivo es "Otro".',
  })
export type AdjustmentForm = z.input<typeof adjustmentSchema>

const required = (max: number, label: string) =>
  z.string().trim().min(1, `Escribe ${label}.`).max(max, `Máximo ${max} caracteres.`)
const optional = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres.`)

/** `code` solo al crear (CreateWarehouseDto): 2 a 20 mayúsculas, dígitos y guiones. */
export const warehouseSchema = z
  .object({
    creating: z.boolean(),
    code: z.string().trim(),
    name: required(100, 'el nombre'),
    priority: z
      .number({ error: 'Escribe un número entero de 1 a 1000.' })
      .int('Escribe un número entero de 1 a 1000.')
      .min(1, 'Mínimo 1.')
      .max(1000, 'Máximo 1000.'),
    hasAddress: z.boolean(),
    address: z.object({
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
    }),
  })
  .superRefine((v, ctx) => {
    if (v.creating && !/^[A-Z0-9-]{2,20}$/.test(v.code))
      ctx.addIssue({
        code: 'custom',
        path: ['code'],
        message: 'De 2 a 20 mayúsculas, dígitos o guiones.',
      })
    if (!v.hasAddress) return
    const a = v.address
    const need = (field: keyof typeof a, message: string) =>
      ctx.addIssue({ code: 'custom', path: ['address', field], message })
    if (!a.recipientName) need('recipientName', 'Escribe el nombre de quien recibe.')
    if (!/^\d{10}$/.test(a.phone)) need('phone', 'Exactamente 10 dígitos.')
    if (!a.street) need('street', 'Escribe la calle.')
    if (!a.exteriorNumber) need('exteriorNumber', 'Escribe el número exterior.')
    if (!a.neighborhood) need('neighborhood', 'Escribe la colonia.')
    if (!/^\d{5}$/.test(a.postalCode)) need('postalCode', '5 dígitos.')
    if (!a.stateCode) need('stateCode', 'Elige el estado.')
    if (!a.municipalityCode) need('municipalityCode', 'Elige el municipio.')
  })
export type WarehouseForm = z.input<typeof warehouseSchema>

/** Transferencia entre almacenes: dos ajustes `WAREHOUSE_TRANSFER` (API_SPEC §13, ADR-0160). */
export const transferSchema = z
  .object({
    fromWarehouseId: z.string().min(1, 'Elige el almacén de origen.'),
    toWarehouseId: z
      .string({ error: 'Elige el almacén de destino.' })
      .min(1, 'Elige el almacén de destino.'),
    quantity: z
      .number({ error: 'Escribe una cantidad entera.' })
      .int('Escribe una cantidad entera.')
      .min(1, 'Al menos 1.')
      .max(100_000, 'Máximo 100,000.'),
    note,
  })
  .refine((v) => v.fromWarehouseId !== v.toWarehouseId, {
    path: ['toWarehouseId'],
    message: 'Elige un almacén distinto del origen.',
  })
export type TransferForm = z.input<typeof transferSchema>
