import { describe, expect, it } from 'vitest'
import {
  blockedDataSchema,
  cancelSchema,
  manualCaptureSchema,
  restockSchema,
  storeOrderSchema,
  toStaffOrderInput,
} from '~/features/orders/schemas'
import { emptyAddress } from '~/shared/address/address-form'
import { canRun, cancelStartsRefund, restockReason } from '~/features/orders/status'
import type { AdminOrder } from '~/features/orders/types'
import { manualRefundSchema } from '~/features/payments/schemas'
import { canRegisterManualRefund } from '~/features/payments/status'
import type { AdminPayment } from '~/features/payments/types'
import { trackingSchema } from '~/features/shipping/schemas'
import { canEditTracking, canRunShipment, shipmentStatusQuery } from '~/features/shipping/status'

const order = (o: Partial<AdminOrder>) =>
  ({ status: 'PAID', paidAt: null, shipment: null, ...o }) as AdminOrder

describe('pedidos', () => {
  it('acciones según el estado (API_SPEC §15.7, §16.4, §14.3)', () => {
    expect(canRun('cancel', 'PAID')).toBe(true)
    expect(canRun('cancel', 'SHIPPED')).toBe(false)
    expect(canRun('manualCapture', 'EXPIRED')).toBe(true)
    expect(canRun('manualCapture', 'PAID')).toBe(false)
    expect(canRun('retryFulfillment', 'AWAITING_MANUAL_FULFILLMENT')).toBe(true)
    expect(canRun('reorder', 'REFUNDED')).toBe(true)
    expect(canRun('reorder', 'DELIVERED')).toBe(false)
    expect(canRun('cancel', 'ESTADO_NUEVO')).toBe(false)
  })

  it('cancelar inicia reembolso solo si ya está pagado (ADR-0051)', () => {
    expect(cancelStartsRefund('PAID')).toBe(true)
    expect(cancelStartsRefund('AWAITING_MANUAL_FULFILLMENT')).toBe(true)
    expect(cancelStartsRefund('PENDING_PAYMENT')).toBe(false)
  })

  it('motivo del reintegro: cancelado con pago o envío devuelto', () => {
    expect(restockReason(order({ status: 'CANCELLED', paidAt: '2026-10-01T00:00:00Z' }))).toBe(
      'ORDER_CANCELLED',
    )
    expect(restockReason(order({ status: 'CANCELLED' }))).toBeNull()
    expect(
      restockReason(
        order({ status: 'SHIPPED', shipment: { status: 'RETURNED' } as AdminOrder['shipment'] }),
      ),
    ).toBe('SHIPMENT_RETURNED')
    expect(restockReason(order({ status: 'DELIVERED' }))).toBeNull()
  })

  it('motivos y comprobantes con sus límites', () => {
    expect(cancelSchema.safeParse({ reason: '  ', restock: false }).success).toBe(false)
    expect(cancelSchema.safeParse({ reason: 'x'.repeat(501), restock: false }).success).toBe(false)
    expect(cancelSchema.safeParse({ reason: 'Sin stock', restock: true }).success).toBe(true)
    expect(manualCaptureSchema.safeParse({ reference: '', note: '' }).success).toBe(false)
    expect(manualCaptureSchema.safeParse({ reference: 'x'.repeat(101), note: '' }).success).toBe(
      false,
    )
    expect(manualCaptureSchema.safeParse({ reference: 'Ticket 1', note: '' }).success).toBe(true)
    expect(blockedDataSchema.safeParse({ reason: '' }).success).toBe(false)
  })

  it('reintegro: al menos una unidad y nunca más de lo vendido', () => {
    const schema = restockSchema({ a: 2, b: 1 })
    expect(schema.safeParse({ quantities: { a: 0, b: 0 }, note: '' }).success).toBe(false)
    expect(schema.safeParse({ quantities: { a: 3, b: 0 }, note: '' }).success).toBe(false)
    expect(schema.safeParse({ quantities: { a: 1.5, b: 0 }, note: '' }).success).toBe(false)
    expect(schema.safeParse({ quantities: { a: 2, b: 1 }, note: '' }).success).toBe(true)
  })
})

describe('pagos', () => {
  const payment = (p: Partial<AdminPayment>) =>
    ({ provider: 'MANUAL', refunds: [], ...p }) as AdminPayment

  it('reembolso manual: pago MANUAL con un reembolso pendiente (API_SPEC §16.5)', () => {
    const pending = [{ status: 'PENDING' }] as AdminPayment['refunds']
    expect(canRegisterManualRefund(payment({ refunds: pending }))).toBe(true)
    expect(canRegisterManualRefund(payment({ provider: 'PAYPAL', refunds: pending }))).toBe(false)
    expect(canRegisterManualRefund(payment({}))).toBe(false)
    expect(manualRefundSchema.safeParse({ reference: ' ', note: '' }).success).toBe(false)
  })
})

describe('envíos', () => {
  it('sin filtro se piden los PENDING; "Todos" envía todos los estados', () => {
    expect(shipmentStatusQuery(undefined)).toBe('PENDING')
    expect(shipmentStatusQuery('DISPATCHED')).toBe('DISPATCHED')
    expect(shipmentStatusQuery('ALL').split(',')).toHaveLength(6)
  })

  it('transiciones y guía según el estado (API_SPEC §17)', () => {
    expect(canRunShipment('dispatch', 'PENDING')).toBe(true)
    expect(canRunShipment('deliver', 'PENDING')).toBe(false)
    expect(canRunShipment('return', 'DELIVERY_FAILED')).toBe(true)
    expect(canEditTracking({ status: 'DISPATCHED', ownDelivery: false })).toBe(true)
    expect(canEditTracking({ status: 'DISPATCHED', ownDelivery: true })).toBe(false)
    expect(canEditTracking({ status: 'DELIVERED', ownDelivery: false })).toBe(false)
  })

  it('paquetería y guía de 1 a 100 caracteres', () => {
    expect(trackingSchema.safeParse({ carrierName: ' ', trackingNumber: 'X' }).success).toBe(false)
    expect(trackingSchema.safeParse({ carrierName: 'DHL', trackingNumber: '123' }).success).toBe(
      true,
    )
  })
})

describe('pedido en la tienda física (ADR-0161)', () => {
  const base = {
    warehouseId: 'w1',
    fulfillment: 'IN_STORE' as const,
    lines: [{ variantId: 'v1', sku: 'CAM-M', productTitle: 'Camisa', quantity: 2 }],
    buyer: 'none' as const,
    customerId: undefined,
    contactEmail: '',
    privacyNoticeShown: false,
    addressMode: 'saved' as const,
    addressId: undefined,
    address: emptyAddress(),
  }
  const paths = (v: unknown) => {
    const r = storeOrderSchema.safeParse(v)
    return r.success ? [] : r.error.issues.map((i) => i.path.join('.'))
  }

  it('venta de mostrador sin datos del comprador: solo líneas, almacén y total', () => {
    expect(paths(base)).toEqual([])
    expect(toStaffOrderInput(base, 119800, '')).toEqual({
      lines: [{ variantId: 'v1', quantity: 2 }],
      warehouseId: 'w1',
      fulfillment: 'IN_STORE',
      expectedTotal: 119800,
    })
  })

  it('de 1 a 30 unidades por línea y al menos un producto', () => {
    expect(paths({ ...base, lines: [] })).toContain('lines')
    expect(paths({ ...base, lines: [{ ...base.lines[0], quantity: 31 }] })).toContain(
      'lines.0.quantity',
    )
  })

  it('con envío pide comprador y una sola dirección', () => {
    const shipping = { ...base, fulfillment: 'SHIPPING' as const }
    expect(paths(shipping)).toContain('buyer')
    const customer = { ...shipping, buyer: 'customer' as const }
    expect(paths(customer)).toEqual(expect.arrayContaining(['customerId', 'addressId']))
    const ready = { ...customer, customerId: 'c1', addressId: 'a1' }
    expect(paths(ready)).toEqual([])
    expect(toStaffOrderInput(ready, 1000, '')).toMatchObject({ customerId: 'c1', addressId: 'a1' })
    expect(paths({ ...ready, addressMode: 'new' })).toContain('address.phone')
  })

  it('un invitado necesita email y que se le presente el aviso de privacidad', () => {
    const guest = { ...base, buyer: 'guest' as const }
    expect(paths(guest)).toEqual(expect.arrayContaining(['contactEmail', 'privacyNoticeShown']))
    const ready = { ...guest, contactEmail: ' ana@example.com ', privacyNoticeShown: true }
    expect(paths(ready)).toEqual([])
    expect(toStaffOrderInput(ready, 1000, '2026-09')).toMatchObject({
      contactEmail: 'ana@example.com',
      privacyNoticeVersion: '2026-09',
    })
  })
})
