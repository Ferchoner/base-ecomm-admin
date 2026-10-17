import { describe, expect, it } from 'vitest'
import {
  initialPromotionForm,
  promotionSchema,
  toCreateInput,
  toUpdateInput,
} from '~/features/promotions/schemas'
import { editableFields } from '~/features/promotions/status'
import type { Promotion } from '~/features/promotions/types'

const money = (amount: number) => ({ amount, currency: 'MXN' })

const PROMOTION: Promotion = {
  id: 'p-1',
  name: 'Buen Fin 10%',
  status: 'ACTIVE',
  percentage: 10,
  amountOff: null,
  targetCount: 0,
  channels: ['ONLINE', 'STORE'],
  minimumSubtotal: money(50000),
  startsAt: '2026-11-13T06:00:00.000Z',
  endsAt: '2026-11-17T06:00:00.000Z',
  endedAt: null,
  code: 'BUENFIN',
  usageLimit: 500,
  oncePerCustomer: true,
  uses: 12,
  targets: [],
  endedBy: null,
  createdBy: 's-1',
  createdAt: '2026-10-16T18:00:00.000Z',
  updatedAt: '2026-10-16T18:00:00.000Z',
  version: 3,
}

describe('promociones', () => {
  it('exige un descuento y valida el cupón', () => {
    const base = initialPromotionForm()
    expect(promotionSchema.safeParse({ ...base, name: 'X' }).success).toBe(false)
    expect(promotionSchema.safeParse({ ...base, name: 'X', percentage: '101' }).success).toBe(false)
    expect(promotionSchema.safeParse({ ...base, name: 'X', percentage: '15' }).success).toBe(true)
    expect(
      promotionSchema.safeParse({ ...base, name: 'X', percentage: '15', usageLimit: '5' }).success,
    ).toBe(false)
    expect(
      promotionSchema.safeParse({ ...base, name: 'X', percentage: '15', code: 'AB' }).success,
    ).toBe(false)
  })

  it('arma el alta con centavos, destinos y el cupón', () => {
    const input = toCreateInput({
      ...initialPromotionForm(),
      name: ' Regreso a clases ',
      discountType: 'amount',
      amountOff: '100.50',
      targets: [{ type: 'BRAND', id: 'b-1', name: 'Lino Fino' }],
      channels: ['STORE'],
      minimumSubtotal: '500',
      code: 'CLASES26',
      usageLimit: '20',
    })
    expect(input).toEqual({
      name: 'Regreso a clases',
      amountOff: 10050,
      targets: [{ type: 'BRAND', id: 'b-1' }],
      channels: ['STORE'],
      minimumSubtotal: 50000,
      code: 'CLASES26',
      usageLimit: 20,
      oncePerCustomer: false,
    })
  })

  it('ya vigente, solo manda nombre, fin y límite que cambiaron, con su versión', () => {
    const form = { ...initialPromotionForm(PROMOTION), name: 'Buen Fin', usageLimit: '600' }
    form.percentage = '20'
    expect(toUpdateInput(form, PROMOTION, editableFields('ACTIVE'))).toEqual({
      version: 3,
      name: 'Buen Fin',
      usageLimit: 600,
    })
    expect(editableFields('ENDED').size).toBe(0)
  })

  it('quitar el código y la compra mínima se envía como null', () => {
    const scheduled = { ...PROMOTION, status: 'SCHEDULED' as const }
    const form = {
      ...initialPromotionForm(scheduled),
      code: '',
      usageLimit: '',
      oncePerCustomer: false,
      minimumSubtotal: '',
    }
    expect(toUpdateInput(form, scheduled, editableFields('SCHEDULED'))).toEqual({
      version: 3,
      minimumSubtotal: null,
      code: null,
      usageLimit: null,
      oncePerCustomer: false,
    })
  })
})
