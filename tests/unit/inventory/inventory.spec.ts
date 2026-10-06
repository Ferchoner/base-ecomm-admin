import { describe, expect, it } from 'vitest'
import {
  adjustmentSchema,
  receiptSchema,
  transferSchema,
  warehouseSchema,
} from '~/features/inventory/schemas'

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
    const base = { fromWarehouseId: 'a', toWarehouseId: 'b', quantity: 3, note: '' }
    expect(transferSchema.safeParse(base).success).toBe(true)
    expect(transferSchema.safeParse({ ...base, toWarehouseId: 'a' }).success).toBe(false)
    expect(transferSchema.safeParse({ ...base, quantity: 0 }).success).toBe(false)
  })
})
