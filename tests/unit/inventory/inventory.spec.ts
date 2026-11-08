import { describe, expect, it } from 'vitest'
import {
  adjustmentSchema,
  closeLoanSchema,
  receiptSchema,
  transferSchema,
  warehouseSchema,
} from '~/features/inventory/schemas'
import { canCancelNow, transferStatusStyle } from '~/features/inventory/status'

const empty = {
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
const edit = { creating: false, code: '', name: 'Principal', priority: 1 }

describe('inventario', () => {
  it('entrada de 1 a 100,000 unidades enteras', () => {
    expect(receiptSchema.safeParse({ quantity: 0, note: '' }).success).toBe(false)
    expect(receiptSchema.safeParse({ quantity: 100_001, note: '' }).success).toBe(false)
    expect(receiptSchema.safeParse({ quantity: 2.5, note: '' }).success).toBe(false)
    expect(receiptSchema.safeParse({ quantity: 25, note: 'Remisión 1' }).success).toBe(true)
  })

  it('ajuste: motivos que solo restan y nota obligatoria con OTHER (API_SPEC §13)', () => {
    const base = {
      direction: 'decrease' as const,
      quantity: 2,
      reasonCode: 'DAMAGED' as const,
      note: '',
    }
    expect(adjustmentSchema.safeParse(base).success).toBe(true)
    expect(adjustmentSchema.safeParse({ ...base, direction: 'increase' }).success).toBe(false)
    expect(adjustmentSchema.safeParse({ ...base, reasonCode: 'OTHER' }).success).toBe(false)
    expect(
      adjustmentSchema.safeParse({ ...base, reasonCode: 'OTHER', note: 'Conteo' }).success,
    ).toBe(true)
    expect(
      adjustmentSchema.safeParse({ ...base, direction: 'increase', reasonCode: 'PHYSICAL_COUNT' })
        .success,
    ).toBe(true)
  })

  it('almacén: la dirección solo se valida si se captura', () => {
    expect(warehouseSchema.safeParse({ ...edit, hasAddress: false, address: empty }).success).toBe(
      true,
    )
    const result = warehouseSchema.safeParse({
      ...edit,
      hasAddress: true,
      address: empty,
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((i) => i.path.join('.'))).toContain('address.phone')
  })

  it('almacén: código solo al crear, prioridad de 1 a 1000 (ADR-0160)', () => {
    const base = { ...edit, hasAddress: false, address: empty }
    expect(warehouseSchema.safeParse({ ...base, priority: 0 }).success).toBe(false)
    expect(warehouseSchema.safeParse({ ...base, priority: 1001 }).success).toBe(false)
    expect(warehouseSchema.safeParse({ ...base, creating: true, code: 'x' }).success).toBe(false)
    expect(warehouseSchema.safeParse({ ...base, creating: true, code: 'cdmx' }).success).toBe(false)
    expect(warehouseSchema.safeParse({ ...base, creating: true, code: 'CDMX-2' }).success).toBe(
      true,
    )
  })

  it('transferencia: destino distinto del origen', () => {
    const base = {
      kind: 'TRANSFER',
      reason: 'SALE',
      loanMinutes: 60,
      fromWarehouseId: 'a',
      toWarehouseId: 'b',
      quantity: 3,
      note: '',
    }
    expect(transferSchema.safeParse(base).success).toBe(true)
    expect(transferSchema.safeParse({ ...base, toWarehouseId: 'a' }).success).toBe(false)
    expect(transferSchema.safeParse({ ...base, quantity: 0 }).success).toBe(false)
  })

  it('transferencia: "Otro" exige nota, y el préstamo dura de 5 minutos a 24 horas', () => {
    const base = {
      kind: 'TRANSFER',
      reason: 'OTHER',
      loanMinutes: 60,
      fromWarehouseId: 'a',
      toWarehouseId: 'b',
      quantity: 1,
      note: '',
    }
    expect(transferSchema.safeParse(base).success).toBe(false)
    expect(transferSchema.safeParse({ ...base, note: 'Para la exhibición' }).success).toBe(true)
    // En un préstamo el motivo es siempre SHOW: el del traslado no cuenta.
    expect(transferSchema.safeParse({ ...base, kind: 'LOAN' }).success).toBe(true)
    expect(transferSchema.safeParse({ ...base, kind: 'LOAN', loanMinutes: 4 }).success).toBe(false)
    expect(transferSchema.safeParse({ ...base, kind: 'LOAN', loanMinutes: 1441 }).success).toBe(
      false,
    )
  })

  it('cierre de préstamo: de 0 a lo prestado en cada línea', () => {
    const schema = closeLoanSchema([
      { variantId: 'v1', quantity: 2 },
      { variantId: 'v2', quantity: 1 },
    ])
    expect(schema.safeParse({ returned: { v1: 2, v2: 0 } }).success).toBe(true)
    const tooMany = schema.safeParse({ returned: { v1: 3, v2: 1 } })
    expect(tooMany.success).toBe(false)
    expect(tooMany.error?.issues[0]?.path).toEqual(['returned', 'v1'])
    expect(schema.safeParse({ returned: { v1: 1 } }).success).toBe(false)
    expect(schema.safeParse({ returned: { v1: -1, v2: 0 } }).success).toBe(false)
  })

  it('traslados: se cancelan hasta cancellableUntil, y el préstamo vencido se ve como tal', () => {
    const now = Date.parse('2026-11-08T12:00:00Z')
    expect(canCancelNow({ cancellableUntil: '2026-11-08T12:05:00Z' }, now)).toBe(true)
    expect(canCancelNow({ cancellableUntil: '2026-11-08T11:59:59Z' }, now)).toBe(false)
    expect(canCancelNow({ cancellableUntil: null }, now)).toBe(false)
    expect(transferStatusStyle({ status: 'OPEN', overdue: true }).label).toBe('Vencido')
    expect(transferStatusStyle({ status: 'OPEN', overdue: false }).label).toBe('Prestado')
    expect(transferStatusStyle({ status: 'COMPLETED', overdue: false }).label).toBe('Hecho')
  })
})
