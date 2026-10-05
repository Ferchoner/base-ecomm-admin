import { describe, expect, it } from 'vitest'
import { adjustmentSchema, receiptSchema, warehouseSchema } from '~/features/inventory/schemas'

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
    expect(
      warehouseSchema.safeParse({ name: 'Principal', hasAddress: false, address: empty }).success,
    ).toBe(true)
    const result = warehouseSchema.safeParse({
      name: 'Principal',
      hasAddress: true,
      address: empty,
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((i) => i.path.join('.'))).toContain('address.phone')
  })
})
