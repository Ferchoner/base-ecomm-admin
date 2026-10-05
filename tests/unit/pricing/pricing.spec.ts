import { describe, expect, it } from 'vitest'
import { pesosTextToCents, priceSchema } from '~/features/pricing/schemas'

describe('precios', () => {
  it('convierte pesos escritos a centavos sin errores de coma flotante', () => {
    expect(pesosTextToCents('599')).toBe(59900)
    expect(pesosTextToCents('549.9')).toBe(54990)
    expect(pesosTextToCents('0.07')).toBe(7)
    expect(pesosTextToCents('19.99')).toBe(1999)
  })

  it('valida montos, precio de comparación y fecha programada', () => {
    const base = { amount: '599.00', compareAtAmount: '', mode: 'now' as const, effectiveFrom: '' }
    expect(priceSchema.safeParse(base).success).toBe(true)
    expect(priceSchema.safeParse({ ...base, amount: '599.999' }).success).toBe(false)
    expect(priceSchema.safeParse({ ...base, amount: '$599' }).success).toBe(false)
    expect(priceSchema.safeParse({ ...base, compareAtAmount: '599' }).success).toBe(false)
    expect(priceSchema.safeParse({ ...base, compareAtAmount: '799' }).success).toBe(true)
    expect(
      priceSchema.safeParse({ ...base, mode: 'scheduled', effectiveFrom: '2000-01-01T00:00' })
        .success,
    ).toBe(false)
    expect(
      priceSchema.safeParse({ ...base, mode: 'scheduled', effectiveFrom: '2999-01-01T00:00' })
        .success,
    ).toBe(true)
  })
})
