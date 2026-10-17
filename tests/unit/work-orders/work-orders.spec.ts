import { describe, expect, it } from 'vitest'
import {
  initialWorkOrderForm,
  statusChangeSchema,
  toReceiveInput,
  toStatusInput,
  toUpdateInput,
  workOrderSchema,
} from '~/features/work-orders/schemas'
import { equipmentLabel, folioNumber, isClosed, nextStatuses } from '~/features/work-orders/status'
import type { WorkOrder } from '~/features/work-orders/types'

const money = (amount: number) => ({ amount, currency: 'MXN' as const })

const WORK_ORDER: WorkOrder = {
  id: 'w-1',
  folio: 'OT-000123',
  status: 'DIAGNOSED',
  customerId: null,
  customerName: 'María López',
  customerPhone: '4431234567',
  customerEmail: 'maria@example.com',
  equipmentType: 'Laptop',
  equipmentBrand: 'Lenovo',
  equipmentModel: 'ThinkPad T14',
  serialNumber: 'PF3ABC12',
  accessories: 'Cargador',
  equipmentCondition: null,
  reportedFault: 'No enciende',
  diagnosis: 'Disco dañado',
  workPerformed: null,
  estimatedCost: money(120000),
  warehouseId: 'wh-1',
  receivedBy: 's-1',
  technicianId: null,
  receivedAt: '2026-10-15T16:00:00.000Z',
  closedAt: null,
  blockedAt: null,
  anonymizedAt: null,
  version: 3,
  statusHistory: [],
  sales: [],
  paidTotal: money(0),
  unpaidTotal: money(0),
}

describe('órdenes de trabajo', () => {
  it('valida los obligatorios y el teléfono de 10 dígitos, escrito como sea', () => {
    const form = {
      ...initialWorkOrderForm(undefined, 'wh-1'),
      customerName: 'María',
      customerPhone: '(443) 123-4567',
      equipmentType: 'Laptop',
      reportedFault: 'No enciende',
    }
    expect(workOrderSchema.safeParse(form).success).toBe(true)
    expect(workOrderSchema.safeParse({ ...form, customerPhone: '443 123 456' }).success).toBe(false)
    expect(workOrderSchema.safeParse({ ...form, reportedFault: ' ' }).success).toBe(false)
    expect(workOrderSchema.safeParse({ ...form, estimatedCost: '12.345' }).success).toBe(false)
    expect(workOrderSchema.safeParse({ ...form, customerEmail: 'no' }).success).toBe(false)
  })

  it('al recibir envía los dígitos, centavos y null en lo vacío', () => {
    const input = toReceiveInput({
      ...initialWorkOrderForm(undefined, 'wh-1'),
      customerName: ' María ',
      customerPhone: '443 123-4567',
      equipmentType: 'Laptop',
      reportedFault: 'No enciende',
      estimatedCost: '350.50',
      technicianId: 's-1',
    })
    expect(input).toEqual({
      warehouseId: 'wh-1',
      customerId: null,
      customerName: 'María',
      customerPhone: '4431234567',
      customerEmail: null,
      equipmentType: 'Laptop',
      equipmentBrand: null,
      equipmentModel: null,
      serialNumber: null,
      accessories: null,
      equipmentCondition: null,
      reportedFault: 'No enciende',
      estimatedCost: 35050,
      technicianId: 's-1',
    })
  })

  it('al corregir envía solo lo que cambió con la versión; null quita un opcional', () => {
    const form = initialWorkOrderForm(WORK_ORDER)
    expect(toUpdateInput(form, WORK_ORDER)).toEqual({ version: 3 })
    expect(
      toUpdateInput(
        { ...form, diagnosis: 'Disco y pantalla', accessories: '', estimatedCost: '' },
        WORK_ORDER,
      ),
    ).toEqual({ version: 3, diagnosis: 'Disco y pantalla', accessories: null, estimatedCost: null })
  })

  it('solo avanza, aunque salte pasos; cancelar exige nota', () => {
    expect(nextStatuses('DIAGNOSED')).toEqual(['IN_REPAIR', 'READY', 'DELIVERED', 'CANCELLED'])
    expect(nextStatuses('READY')).toEqual(['DELIVERED', 'CANCELLED'])
    expect(nextStatuses('DELIVERED')).toEqual([])
    expect(isClosed('CANCELLED')).toBe(true)
    expect(statusChangeSchema.safeParse({ status: 'CANCELLED', note: ' ' }).success).toBe(false)
    expect(statusChangeSchema.safeParse({ status: 'READY', note: '' }).success).toBe(true)
    expect(toStatusInput({ status: 'READY', note: '' }, 3)).toEqual({ status: 'READY', version: 3 })
  })

  it('reconoce el folio como lo busca la API y arma el nombre del equipo', () => {
    expect(folioNumber('OT-000123')).toBe(123)
    expect(folioNumber('ot-123')).toBe(123)
    expect(folioNumber('123')).toBe(123)
    expect(folioNumber('María')).toBeNull()
    expect(
      equipmentLabel({ equipmentType: 'Laptop', equipmentBrand: null, equipmentModel: 'T14' }),
    ).toBe('Laptop T14')
  })
})
