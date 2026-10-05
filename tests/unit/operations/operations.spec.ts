import { describe, expect, it } from 'vitest'
import { changeRows, isValidActionFilter } from '~/features/audit/status'
import {
  bulkRetryScope,
  canRetryDelivery,
  deliveryMoment,
  deliveryStatusQuery,
} from '~/features/events/status'
import { shippingMethodSchema } from '~/features/shipping/schemas'
import { centsToPesosText, pesosTextToCents } from '~/shared/utils/money'

const method = {
  name: 'Envío Estándar',
  flatFee: '99',
  hasFreeShipping: true,
  freeShippingThreshold: '1500',
  deliveryMinBusinessDays: 3,
  deliveryMaxBusinessDays: 7,
}
const issues = (data: unknown) =>
  shippingMethodSchema.safeParse(data).error?.issues.map((i) => i.path.join('.')) ?? []

describe('método de envío', () => {
  it('convierte centavos a pesos para el formulario y de regreso', () => {
    expect(centsToPesosText(9900)).toBe('99')
    expect(centsToPesosText(59950)).toBe('599.50')
    expect(centsToPesosText(7)).toBe('0.07')
    for (const cents of [0, 7, 9900, 59950, 2147483647])
      expect(pesosTextToCents(centsToPesosText(cents))).toBe(cents)
  })

  it('acepta costo 0 y envío gratis desactivado sin monto', () => {
    expect(issues(method)).toEqual([])
    expect(
      issues({ ...method, flatFee: '0', hasFreeShipping: false, freeShippingThreshold: '' }),
    ).toEqual([])
  })

  it('exige un umbral mayor que 0 solo con envío gratis activado', () => {
    expect(issues({ ...method, freeShippingThreshold: '' })).toEqual(['freeShippingThreshold'])
    expect(issues({ ...method, freeShippingThreshold: '0' })).toEqual(['freeShippingThreshold'])
    expect(issues({ ...method, freeShippingThreshold: '12.345' })).toEqual([
      'freeShippingThreshold',
    ])
  })

  it('valida pesos, tope y plazo en días hábiles', () => {
    expect(issues({ ...method, flatFee: '' })).toEqual(['flatFee'])
    expect(issues({ ...method, flatFee: '-5' })).toEqual(['flatFee'])
    expect(issues({ ...method, flatFee: '21474837' })).toEqual(['flatFee'])
    expect(issues({ ...method, name: '   ' })).toEqual(['name'])
    expect(issues({ ...method, deliveryMinBusinessDays: 0 })).toEqual(['deliveryMinBusinessDays'])
    expect(issues({ ...method, deliveryMaxBusinessDays: 31 })).toEqual(['deliveryMaxBusinessDays'])
    expect(issues({ ...method, deliveryMinBusinessDays: 5, deliveryMaxBusinessDays: 4 })).toEqual([
      'deliveryMaxBusinessDays',
    ])
  })
})

describe('entregas de eventos', () => {
  it('lista las fallidas por defecto y todas con "Todos"', () => {
    expect(deliveryStatusQuery(undefined)).toBe('FAILED')
    expect(deliveryStatusQuery('PENDING')).toBe('PENDING')
    expect(deliveryStatusQuery('ALL')).toBe('PENDING,DELIVERED,FAILED')
  })

  it('solo reintenta las fallidas', () => {
    expect(canRetryDelivery('FAILED')).toBe(true)
    expect(canRetryDelivery('PENDING')).toBe(false)
    expect(canRetryDelivery('DELIVERED')).toBe(false)
  })

  it('muestra el próximo intento solo en las pendientes', () => {
    const base = { deliveredAt: null, nextAttemptAt: '2026-10-05T12:00:00.000Z' }
    expect(deliveryMoment({ ...base, status: 'PENDING' }).at).toBe(base.nextAttemptAt)
    expect(deliveryMoment({ ...base, status: 'FAILED' }).at).toBeNull()
    expect(
      deliveryMoment({ ...base, status: 'DELIVERED', deliveredAt: '2026-10-05T13:00:00.000Z' }),
    ).toEqual({ label: 'Entregada', at: '2026-10-05T13:00:00.000Z' })
  })

  it('explica a qué entregas afecta el reintento masivo', () => {
    expect(bulkRetryScope({})).toBe('todas las entregas fallidas')
    expect(bulkRetryScope({ eventType: 'OrderPaid' })).toBe('las fallidas del evento OrderPaid')
    expect(bulkRetryScope({ handler: 'OrderEmails.onOrderPaid' })).toBe(
      'las fallidas del manejador OrderEmails.onOrderPaid',
    )
  })
})

describe('auditoría', () => {
  it('acepta un código exacto o un prefijo terminado en .*', () => {
    expect(isValidActionFilter('orders.cancel')).toBe(true)
    expect(isValidActionFilter('orders.*')).toBe(true)
    expect(isValidActionFilter('orders*')).toBe(false)
    expect(isValidActionFilter('*.cancel')).toBe(false)
    expect(isValidActionFilter('orders cancel')).toBe(false)
  })

  it('convierte los cambios en filas de texto y oculta los datos sensibles', () => {
    expect(
      changeRows({
        status: { from: 'PAID', to: 'CANCELLED' },
        email: { changed: true },
        tags: { from: null, to: ['a', 'b'] },
        raw: 5,
      }),
    ).toEqual([
      { field: 'status', hidden: false, from: 'PAID', to: 'CANCELLED' },
      { field: 'email', hidden: true, from: '', to: '' },
      { field: 'tags', hidden: false, from: '—', to: '["a","b"]' },
      { field: 'raw', hidden: false, from: '—', to: '5' },
    ])
    expect(changeRows(null)).toEqual([])
  })
})
