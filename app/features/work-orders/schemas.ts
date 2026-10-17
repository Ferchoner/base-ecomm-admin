import { z } from 'zod'
import { PESOS_PATTERN, centsToPesosText, pesosTextToCents } from '~/shared/utils/money'
import type {
  ChangeWorkOrderStatusInput,
  ReceiveWorkOrderInput,
  UpdateWorkOrderInput,
  WorkOrder,
  WorkOrderStatus,
} from './types'

// ReceiveWorkOrderDto y UpdateWorkOrderDto (openapi/v1.json), API_SPEC §25.2 y §25.5. La validación
// definitiva es de la API.

const MAX_CENTS = 2_147_483_647
const optional = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres.`)
const required = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max, `Máximo ${max} caracteres.`)

/** El teléfono se escribe como sea (`443 123-4567`); se envían sus 10 dígitos. */
export const phoneDigits = (v: string) => v.replace(/[\s\-().]/g, '')

export const workOrderSchema = z.object({
  warehouseId: z.string().min(1, 'Elige el almacén.'),
  customerId: z.string(),
  customerName: required(120, 'Escribe el nombre del cliente.'),
  customerPhone: z
    .string()
    .refine((v) => /^\d{10}$/.test(phoneDigits(v)), 'El teléfono lleva 10 dígitos.'),
  customerEmail: z
    .string()
    .trim()
    .refine((v) => v === '' || z.email().max(254).safeParse(v).success, 'Escribe un email válido.'),
  equipmentType: required(60, 'Escribe el tipo de equipo.'),
  equipmentBrand: optional(60),
  equipmentModel: optional(60),
  serialNumber: optional(60),
  accessories: optional(500),
  equipmentCondition: optional(1000),
  reportedFault: required(2000, 'Describe la falla que reporta el cliente.'),
  diagnosis: optional(4000),
  workPerformed: optional(4000),
  estimatedCost: z
    .string()
    .trim()
    .refine((v) => v === '' || PESOS_PATTERN.test(v), 'Pesos con hasta 2 decimales.')
    .refine((v) => v === '' || pesosTextToCents(v) <= MAX_CENTS, 'El costo es demasiado alto.'),
  technicianId: z.string(),
})

export type WorkOrderForm = z.infer<typeof workOrderSchema>

export function initialWorkOrderForm(w?: WorkOrder, warehouseId = ''): WorkOrderForm {
  return {
    warehouseId: w?.warehouseId ?? warehouseId,
    customerId: w?.customerId ?? '',
    customerName: w?.customerName ?? '',
    customerPhone: w?.customerPhone ?? '',
    customerEmail: w?.customerEmail ?? '',
    equipmentType: w?.equipmentType ?? '',
    equipmentBrand: w?.equipmentBrand ?? '',
    equipmentModel: w?.equipmentModel ?? '',
    serialNumber: w?.serialNumber ?? '',
    accessories: w?.accessories ?? '',
    equipmentCondition: w?.equipmentCondition ?? '',
    reportedFault: w?.reportedFault ?? '',
    diagnosis: w?.diagnosis ?? '',
    workPerformed: w?.workPerformed ?? '',
    estimatedCost: w?.estimatedCost ? centsToPesosText(w.estimatedCost.amount) : '',
    technicianId: w?.technicianId ?? '',
  }
}

const orNull = (v: string) => v.trim() || null
const cents = (v: string) => (v.trim() ? pesosTextToCents(v) : null)

const OPTIONAL_TEXT = [
  'customerEmail',
  'equipmentBrand',
  'equipmentModel',
  'serialNumber',
  'accessories',
  'equipmentCondition',
] as const

/** Recibir un equipo (§25.2): el diagnóstico y el trabajo se registran después. */
export function toReceiveInput(v: WorkOrderForm): ReceiveWorkOrderInput {
  return {
    warehouseId: v.warehouseId,
    customerId: v.customerId || null,
    customerName: v.customerName.trim(),
    customerPhone: phoneDigits(v.customerPhone),
    equipmentType: v.equipmentType.trim(),
    reportedFault: v.reportedFault.trim(),
    estimatedCost: cents(v.estimatedCost),
    technicianId: v.technicianId || null,
    ...Object.fromEntries(OPTIONAL_TEXT.map((k) => [k, orNull(v[k])])),
  }
}

/** Solo lo que cambió, con la `version` leída; `null` quita un opcional (§25.5). */
export function toUpdateInput(v: WorkOrderForm, w: WorkOrder): UpdateWorkOrderInput {
  const out: UpdateWorkOrderInput = { version: w.version }
  const next = {
    customerId: v.customerId || null,
    customerName: v.customerName.trim(),
    customerPhone: phoneDigits(v.customerPhone),
    equipmentType: v.equipmentType.trim(),
    reportedFault: v.reportedFault.trim(),
    estimatedCost: cents(v.estimatedCost),
    technicianId: v.technicianId || null,
    diagnosis: orNull(v.diagnosis),
    workPerformed: orNull(v.workPerformed),
    ...Object.fromEntries(OPTIONAL_TEXT.map((k) => [k, orNull(v[k])])),
  } as Record<string, string | number | null>
  const current: Record<string, unknown> = { ...w, estimatedCost: w.estimatedCost?.amount ?? null }
  for (const [k, value] of Object.entries(next))
    if (value !== (current[k] ?? null)) Object.assign(out, { [k]: value })
  return out
}

export const statusChangeSchema = z
  .object({
    status: z.string().min(1, 'Elige el estado.'),
    note: z.string().trim().max(500, 'Máximo 500 caracteres.'),
  })
  .superRefine((v, ctx) => {
    if (v.status === 'CANCELLED' && !v.note)
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'Explica por qué se cancela.' })
  })

export type StatusChangeForm = z.infer<typeof statusChangeSchema>

export function toStatusInput(v: StatusChangeForm, version: number): ChangeWorkOrderStatusInput {
  return { status: v.status as WorkOrderStatus, version, ...(v.note && { note: v.note }) }
}
