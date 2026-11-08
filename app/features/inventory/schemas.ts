import { z } from 'zod'
import { addressFieldsSchema, checkAddress } from '~/shared/address/address-form'
import { DECREASE_ONLY, LOAN_MINUTES } from './status'

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
    address: addressFieldsSchema,
  })
  .superRefine((v, ctx) => {
    if (v.creating && !/^[A-Z0-9-]{2,20}$/.test(v.code))
      ctx.addIssue({
        code: 'custom',
        path: ['code'],
        message: 'De 2 a 20 mayúsculas, dígitos o guiones.',
      })
    if (v.hasAddress) checkAddress(v.address, ctx, ['address'])
  })
export type WarehouseForm = z.input<typeof warehouseSchema>

/**
 * Traslado o préstamo de una variante (CreateTransferDto, API_SPEC §13, ADR-0172): un traslado lleva
 * motivo, y `OTHER` exige nota; un préstamo dura de 5 minutos a 24 horas.
 */
export const transferSchema = z
  .object({
    kind: z.enum(['TRANSFER', 'LOAN']),
    reason: z.enum(['SALE', 'RESTOCK', 'OTHER']),
    loanMinutes: z
      .number({ error: 'Elige cuánto dura el préstamo.' })
      .int()
      .min(LOAN_MINUTES.min, `Mínimo ${LOAN_MINUTES.min} minutos.`)
      .max(LOAN_MINUTES.max, 'Máximo 24 horas.'),
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
  .refine((v) => v.kind === 'LOAN' || v.reason !== 'OTHER' || v.note !== '', {
    path: ['note'],
    message: 'Explica el traslado cuando el motivo es "Otro".',
  })
export type TransferForm = z.input<typeof transferSchema>

/** Cierre de un préstamo (CloseLoanDto): lo que regresó de cada línea, de 0 a lo prestado. */
export function closeLoanSchema(lines: { variantId: string; quantity: number }[]) {
  return z
    .object({ returned: z.record(z.string(), z.number().int().optional()) })
    .superRefine((v, ctx) => {
      for (const line of lines) {
        const value = v.returned[line.variantId]
        if (value === undefined || value < 0 || value > line.quantity)
          ctx.addIssue({
            code: 'custom',
            path: ['returned', line.variantId],
            message: `De 0 a ${line.quantity}.`,
          })
      }
    })
}
export type CloseLoanForm = { returned: Record<string, number | undefined> }
