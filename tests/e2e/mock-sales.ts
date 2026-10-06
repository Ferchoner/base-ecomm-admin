import type { Page, Route } from '@playwright/test'
import { API, json } from './mock-api'

/** Pedidos, pagos y envíos en memoria con las formas de openapi/v1.json (API_SPEC §15–17). */
const NOW = '2026-10-05T12:00:00.000Z'
const WAREHOUSE_ID = '0192a3b4-0000-7000-8000-00000000b001'
const STAFF_ID = '0192a3b4-0000-7000-8000-000000000001'
let seq = 0
const uuid = () => `0192a3b4-0000-7000-8000-${String(800000 + ++seq).padStart(12, '0')}`
const money = (amount: number) => ({ amount, currency: 'MXN' })

function problem(
  route: Route,
  status: number,
  type: string,
  title: string,
  extra: Record<string, unknown> = {},
) {
  return route.fulfill({
    status,
    contentType: 'application/problem+json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({
      type: `/problems/${type}`,
      title,
      status,
      detail: null,
      correlationId: 'e2e',
      ...extra,
    }),
  })
}

const ADDRESS = {
  recipientName: 'María López',
  phone: '4431234567',
  street: 'Av. Madero Poniente',
  exteriorNumber: '123',
  interiorNumber: null,
  neighborhood: 'Centro',
  city: 'Morelia',
  references: null,
  postalCode: '58000',
  stateCode: '16',
  stateName: 'Michoacán de Ocampo',
  municipalityCode: '16053',
  municipalityName: 'Morelia',
  country: 'MX',
}
const REDUCED_ADDRESS = {
  ...ADDRESS,
  recipientName: null,
  phone: null,
  street: null,
  exteriorNumber: null,
  neighborhood: null,
  city: null,
}

export interface SalesOrderSeed {
  code: string
  status: string
  email?: string
  customer?: boolean
  blocked?: boolean
  /** Pago: estado y reembolso pendiente. */
  payment?: { status: string; refund?: 'PENDING' | 'COMPLETED' }
  shipment?: { status: string; carrierName?: string; trackingNumber?: string }
  lines?: Array<{ sku: string; quantity: number; unit: number }>
  /** Orden colocada por el staff en la tienda física (ADR-0161). */
  store?: { fulfillment?: 'SHIPPING' | 'IN_STORE'; anonymousBuyer?: boolean; placedBy?: string }
}

export interface SalesSeed {
  orders: SalesOrderSeed[]
  /** Pago manual deshabilitado (API_SPEC §16.6). */
  manualPaymentsDisabled?: boolean
  /** La configuración leída dice habilitado, pero otro cambio lo deshabilitó antes del registro. */
  staleSettings?: boolean
  /** Almacén, existencias y clientes para colocar pedidos en la tienda (ADR-0161). */
  storeCatalog?: boolean
  /** El precio sube entre la cotización y la colocación: el primer intento recibe `total-mismatch`. */
  priceChangeOnPlace?: boolean
}

interface Line {
  id: string
  lineNumber: number
  sku: string
  productName: string
  quantity: number
  unit: number
}

interface Order {
  id: string
  orderNumber: number
  publicCode: string
  status: string
  email: string | null
  customerId: string | null
  blockedAt: string | null
  channel: 'ONLINE' | 'STORE'
  fulfillment: 'SHIPPING' | 'IN_STORE'
  placedBy: string | null
  warehouseId: string | null
  deliveredAt: string | null
  version: number
  lines: Line[]
  paidAt: string | null
  cancelledAt: string | null
  history: Array<Record<string, unknown>>
  paymentId: string | null
  shipmentId: string | null
  restocked: Record<string, number>
}

interface Payment {
  id: string
  orderId: string
  status: string
  capturedAt: string | null
  version: number
  attempts: Array<Record<string, unknown>>
  refunds: Array<Record<string, unknown>>
}

interface Shipment {
  id: string
  orderId: string
  status: string
  carrierName: string | null
  trackingNumber: string | null
  ownDelivery: boolean
  dispatchedAt: string | null
  deliveredAt: string | null
  failedAt: string | null
  returnedAt: string | null
  failureNote: string | null
  returnNote: string | null
  version: number
}

export async function mockSalesApi(page: Page, seed: SalesSeed) {
  const orders: Order[] = []
  const payments: Payment[] = []
  const shipments: Shipment[] = []
  const calls: Array<{
    method: string
    path: string
    body: unknown
    query: string
    headers: Record<string, string>
  }> = []

  seed.orders.forEach((o, i) => {
    const order: Order = {
      id: uuid(),
      orderNumber: 1001 + i,
      publicCode: o.code,
      status: o.status,
      email: o.store?.anonymousBuyer ? null : (o.email ?? `comprador${i + 1}@example.com`),
      customerId: o.customer ? uuid() : null,
      blockedAt: o.blocked ? '2026-10-04T10:00:00.000Z' : null,
      channel: o.store ? 'STORE' : 'ONLINE',
      fulfillment: o.store?.fulfillment ?? 'SHIPPING',
      placedBy: o.store ? (o.store.placedBy ?? STAFF_ID) : null,
      warehouseId: o.store ? WAREHOUSE_ID : null,
      deliveredAt: null,
      version: 3,
      lines: (o.lines ?? [{ sku: 'CAM-M', quantity: 2, unit: 59900 }]).map((l, n) => ({
        id: uuid(),
        lineNumber: n + 1,
        productName: 'Camisa de lino',
        ...l,
      })),
      paidAt:
        o.payment?.status === 'CAPTURED' || o.payment?.refund ? '2026-10-04T12:00:00.000Z' : null,
      cancelledAt: o.status === 'CANCELLED' ? '2026-10-04T13:00:00.000Z' : null,
      history: [
        {
          fromStatus: null,
          toStatus: 'PENDING_PAYMENT',
          actorId: null,
          reason: null,
          occurredAt: '2026-10-04T11:00:00.000Z',
        },
        ...(o.status === 'PENDING_PAYMENT'
          ? []
          : [
              {
                fromStatus: 'PENDING_PAYMENT',
                toStatus: o.status,
                actorId: null,
                reason: null,
                occurredAt: '2026-10-04T12:00:00.000Z',
              },
            ]),
      ],
      paymentId: null,
      shipmentId: null,
      restocked: {},
    }
    if (o.payment) {
      const p: Payment = {
        id: uuid(),
        orderId: order.id,
        status: o.payment.status,
        capturedAt: order.paidAt,
        version: 2,
        attempts: [
          {
            status: 'PENDING',
            providerReference: null,
            method: null,
            failureCode: null,
            registeredBy: null,
            createdAt: '2026-10-04T11:05:00.000Z',
          },
        ],
        refunds: o.payment.refund
          ? [
              {
                id: uuid(),
                amount: money(total(order)),
                status: o.payment.refund,
                providerRefundId: null,
                registeredBy: null,
                createdAt: '2026-10-04T13:00:00.000Z',
                completedAt: null,
              },
            ]
          : [],
      }
      payments.push(p)
      order.paymentId = p.id
    }
    if (o.shipment) {
      const s = newShipment(order)
      Object.assign(s, {
        status: o.shipment.status,
        carrierName: o.shipment.carrierName ?? null,
        trackingNumber: o.shipment.trackingNumber ?? null,
      })
      order.shipmentId = s.id
    }
    orders.push(order)
  })

  function total(o: Order) {
    return o.lines.reduce((sum, l) => sum + l.unit * l.quantity, 0)
  }

  function newShipment(o: Order): Shipment {
    const s: Shipment = {
      id: uuid(),
      orderId: o.id,
      status: 'PENDING',
      carrierName: null,
      trackingNumber: null,
      ownDelivery: false,
      dispatchedAt: null,
      deliveredAt: null,
      failedAt: null,
      returnedAt: null,
      failureNote: null,
      returnNote: null,
      version: 1,
    }
    shipments.push(s)
    return s
  }

  const paymentOf = (o: Order) => payments.find((p) => p.id === o.paymentId) ?? null
  const shipmentOf = (o: Order) => shipments.find((s) => s.id === o.shipmentId) ?? null

  function paymentDto(p: Payment) {
    const o = orders.find((x) => x.id === p.orderId)!
    const amount = total(o)
    const captured = p.capturedAt ? amount : 0
    const refunded = p.refunds
      .filter((r) => r.status === 'COMPLETED')
      .reduce((sum, r) => sum + (r.amount as { amount: number }).amount, 0)
    return {
      id: p.id,
      orderId: o.id,
      orderCode: o.publicCode,
      provider: 'MANUAL',
      status: p.status,
      amount: money(amount),
      capturedAmount: money(captured),
      refundedAmount: money(refunded),
      currency: 'MXN',
      providerPaymentId: null,
      capturedAt: p.capturedAt,
      attempts: p.attempts,
      refunds: p.refunds,
      createdAt: '2026-10-04T11:05:00.000Z',
      updatedAt: NOW,
      version: p.version,
    }
  }

  function shipmentDto(s: Shipment) {
    const o = orders.find((x) => x.id === s.orderId)!
    return {
      ...s,
      orderCode: o.publicCode,
      warehouseId: WAREHOUSE_ID,
      destination: o.blockedAt ? REDUCED_ADDRESS : ADDRESS,
      items: o.lines.map((l) => ({
        orderLineId: l.id,
        sku: l.sku,
        productName: l.productName,
        quantity: l.quantity,
      })),
      cancelledAt: s.status === 'CANCELLED' ? NOW : null,
      blockedAt: o.blockedAt,
      createdAt: '2026-10-04T12:00:00.000Z',
    }
  }

  function orderDto(o: Order, detail: boolean) {
    const sum = total(o)
    const p = paymentOf(o)
    const s = shipmentOf(o)
    const pd = p && paymentDto(p)
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      publicCode: o.publicCode,
      customerId: o.customerId,
      status: o.status,
      contactEmail: o.blockedAt ? null : o.email,
      itemCount: o.lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: money(sum),
      taxTotal: money(Math.round((sum * 16) / 116)),
      shippingCost: money(0),
      shippingTaxAmount: money(0),
      discountTotal: money(0),
      grandTotal: money(sum),
      fulfillment: o.fulfillment,
      channel: o.channel,
      placedBy: o.placedBy,
      warehouseId: o.warehouseId,
      shippingAddress:
        o.fulfillment === 'IN_STORE' ? null : o.blockedAt ? REDUCED_ADDRESS : ADDRESS,
      estimatedDelivery:
        o.fulfillment === 'IN_STORE' ? null : { minBusinessDays: 3, maxBusinessDays: 7 },
      payment: pd && {
        id: pd.id,
        provider: pd.provider,
        status: pd.status,
        method: (pd.attempts.find((a) => a.status === 'CAPTURED')?.method as string) ?? null,
        amount: pd.amount,
        capturedAmount: pd.capturedAmount,
        refundedAmount: pd.refundedAmount,
        capturedAt: pd.capturedAt,
        refunds: pd.refunds,
      },
      shipment: s && {
        id: s.id,
        status: s.status,
        carrierName: s.carrierName,
        trackingNumber: s.trackingNumber,
        ownDelivery: s.ownDelivery,
        dispatchedAt: s.dispatchedAt,
        deliveredAt: s.deliveredAt,
        version: s.version,
        warehouseId: WAREHOUSE_ID,
      },
      placedAt: '2026-10-04T11:00:00.000Z',
      paymentDueAt: o.status === 'PENDING_PAYMENT' ? '2026-10-05T11:00:00.000Z' : null,
      paidAt: o.paidAt,
      shippedAt: null,
      deliveredAt: o.deliveredAt,
      cancelledAt: o.cancelledAt,
      expiredAt: null,
      refundedAt: null,
      anonymizedAt: null,
      blockedAt: o.blockedAt,
      version: o.version,
      ...(detail
        ? {
            lines: o.lines.map((l) => ({
              id: l.id,
              lineNumber: l.lineNumber,
              sku: l.sku,
              productName: l.productName,
              variantOptions: { talla: 'M' },
              unitPrice: money(l.unit),
              quantity: l.quantity,
              taxRateBp: 1600,
              taxAmount: money(Math.round((l.unit * l.quantity * 16) / 116)),
              lineTotal: money(l.unit * l.quantity),
            })),
            statusHistory: o.history,
          }
        : {}),
    }
  }

  function transition(o: Order, to: string, reason: string | null = null, actor = true) {
    o.history.push({
      fromStatus: o.status,
      toStatus: to,
      actorId: actor ? STAFF_ID : null,
      reason,
      occurredAt: NOW,
    })
    o.status = to
    o.version += 1
  }

  const page1 = <T>(items: T[]) => ({
    data: items,
    meta: { page: 1, pageSize: 20, totalItems: items.length, totalPages: 1 },
  })

  const settings = {
    manualPaymentsEnabled: !seed.manualPaymentsDisabled || !!seed.staleSettings,
    version: 1,
    updatedAt: NOW,
  }
  await page.route(`${API}/v1/admin/payment-settings`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Allow-Methods': 'GET, PUT',
        },
      })
    if (request.method() === 'GET') return json(route, 200, settings)
    const body = request.postDataJSON() as { manualPaymentsEnabled: boolean; version: number }
    calls.push({
      method: 'PUT',
      path: '/v1/admin/payment-settings',
      body,
      query: '',
      headers: request.headers(),
    })
    if (body.version !== settings.version)
      return problem(route, 409, 'version-conflict', 'El recurso cambió', {
        currentVersion: settings.version,
      })
    Object.assign(settings, {
      manualPaymentsEnabled: body.manualPaymentsEnabled,
      version: settings.version + 1,
    })
    return json(route, 200, settings)
  })

  // ── Tienda física: almacén, existencias y clientes (solo lectura) ───────────────
  const STOCK = [
    { variantId: uuid(), sku: 'CAM-M', productTitle: 'Camisa de lino', unit: 59900, available: 5 },
    { variantId: uuid(), sku: 'PAN-32', productTitle: 'Pantalón chino', unit: 89900, available: 1 },
  ]
  let priceBump = 0
  let pendingPriceChange = !!seed.priceChangeOnPlace
  const CUSTOMER = {
    id: uuid(),
    email: 'lucia@example.com',
    emailVerified: true,
    firstNames: 'Lucía',
    lastNames: 'Ramírez',
    status: 'ACTIVE',
    anonymizedAt: null,
    lastLoginAt: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    version: 1,
    addresses: [
      {
        ...ADDRESS,
        id: uuid(),
        recipientName: 'Lucía Ramírez',
        isDefault: true,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
  }
  const idempotency = new Map<string, Order>()

  if (seed.storeCatalog) {
    await page.route(
      `${API}/v1/admin/{inventory/warehouses,inventory/stock-items,identity/customers}**`,
      async (route) => {
        const request = route.request()
        const url = new URL(request.url())
        if (request.method() === 'OPTIONS')
          return route.fulfill({
            status: 204,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Authorization, Content-Type',
              'Access-Control-Allow-Methods': 'GET',
            },
          })
        calls.push({
          method: request.method(),
          path: url.pathname,
          body: null,
          query: url.search,
          headers: request.headers(),
        })
        if (url.pathname.endsWith('/warehouses'))
          return json(route, 200, {
            data: [
              {
                id: WAREHOUSE_ID,
                code: 'CENTRO',
                name: 'Tienda Centro',
                priority: 1,
                status: 'ACTIVE',
                address: null,
                createdAt: NOW,
                updatedAt: NOW,
              },
            ],
          })
        if (url.pathname.endsWith('/stock-items')) {
          const text = url.searchParams.get('q')?.toLowerCase() ?? ''
          const items = STOCK.filter(
            (v) =>
              v.sku.toLowerCase().includes(text) || v.productTitle.toLowerCase().includes(text),
          ).map((v) => ({
            id: uuid(),
            variantId: v.variantId,
            warehouseId: WAREHOUSE_ID,
            sku: v.sku,
            productTitle: v.productTitle,
            onHand: v.available,
            reserved: 0,
            available: v.available,
            updatedAt: NOW,
          }))
          return json(route, 200, page1(items))
        }
        const id = url.pathname.split('/')[5]
        if (id) return json(route, 200, CUSTOMER)
        const text = url.searchParams.get('q')?.toLowerCase() ?? ''
        const match = `${CUSTOMER.email} ${CUSTOMER.firstNames} ${CUSTOMER.lastNames}`
          .toLowerCase()
          .includes(text)
        return json(route, 200, page1(match ? [{ ...CUSTOMER, addresses: [] }] : []))
      },
    )
  }

  function quote(input: {
    lines: Array<{ variantId: string; quantity: number }>
    fulfillment?: string
  }) {
    const lines = input.lines.map((l) => {
      const v = STOCK.find((x) => x.variantId === l.variantId)!
      const lineTotal = (v.unit + priceBump) * l.quantity
      return {
        variantId: v.variantId,
        sku: v.sku,
        productTitle: v.productTitle,
        options: { talla: 'M' },
        quantity: l.quantity,
        unitPrice: money(v.unit + priceBump),
        taxRateBp: 1600,
        taxAmount: money(Math.round((lineTotal * 16) / 116)),
        lineTotal: money(lineTotal),
        sellable: true,
        canFulfill: l.quantity <= v.available,
      }
    })
    const subtotal = lines.reduce((n, l) => n + l.lineTotal.amount, 0)
    const shipping = input.fulfillment === 'IN_STORE' ? 0 : 9900
    return {
      lines,
      subtotal: money(subtotal),
      discountTotal: money(0),
      shippingCost: money(shipping),
      shippingTaxAmount: money(Math.round((shipping * 16) / 116)),
      taxTotal: money(Math.round(((subtotal + shipping) * 16) / 116)),
      grandTotal: money(subtotal + shipping),
      freeShippingThreshold: null,
      estimatedDelivery:
        input.fulfillment === 'IN_STORE' ? null : { minBusinessDays: 3, maxBusinessDays: 7 },
      readyToPlace: lines.every((l) => l.canFulfill),
    }
  }

  function placeOrder(input: Record<string, unknown>): Order {
    const q = quote(input as Parameters<typeof quote>[0])
    const order: Order = {
      id: uuid(),
      orderNumber: 2001 + orders.length,
      publicCode: 'T5N8-W2RP',
      status: 'PENDING_PAYMENT',
      email: input.customerId ? CUSTOMER.email : ((input.contactEmail as string) ?? null),
      customerId: (input.customerId as string) ?? null,
      blockedAt: null,
      channel: 'STORE',
      fulfillment: input.fulfillment as Order['fulfillment'],
      placedBy: STAFF_ID,
      warehouseId: input.warehouseId as string,
      deliveredAt: null,
      version: 1,
      lines: q.lines.map((l, n) => ({
        id: uuid(),
        lineNumber: n + 1,
        sku: l.sku,
        productName: l.productTitle,
        quantity: l.quantity,
        unit: l.unitPrice.amount,
      })),
      paidAt: null,
      cancelledAt: null,
      history: [
        {
          fromStatus: null,
          toStatus: 'PENDING_PAYMENT',
          actorId: STAFF_ID,
          reason: null,
          occurredAt: NOW,
        },
      ],
      paymentId: null,
      shipmentId: null,
      restocked: {},
    }
    orders.push(order)
    return order
  }

  await page.route(`${API}/v1/admin/{orders,payments,shipping}**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    if (method === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
        },
      })
    }
    const body = request.postDataJSON() as Record<string, unknown> | null
    calls.push({ method, path: url.pathname, body, query: url.search, headers: request.headers() })
    const parts = url.pathname.split('/').slice(3) // ['orders', id?, action?]
    const q = url.searchParams

    // ── Pedidos ────────────────────────────────────────────────────────────────
    if (parts[0] === 'orders') {
      if (parts[1] === 'quote' && method === 'POST')
        return json(route, 200, quote(body as Parameters<typeof quote>[0]))
      if (!parts[1] && method === 'POST') {
        const key = request.headers()['idempotency-key']
        if (!key) return problem(route, 400, 'idempotency-key-missing', 'Falta Idempotency-Key')
        const seen = idempotency.get(key)
        if (seen) return json(route, 201, orderDto(seen, true))
        if (pendingPriceChange) {
          pendingPriceChange = false
          priceBump = 1000
        }
        const current = quote(body as Parameters<typeof quote>[0]).grandTotal
        if (body?.expectedTotal !== current.amount)
          return problem(route, 409, 'total-mismatch', 'El total cambió', {
            currentTotal: current,
          })
        const created = placeOrder(body!)
        idempotency.set(key, created)
        return json(route, 201, orderDto(created, true))
      }
      if (!parts[1] && method === 'GET') {
        const status = q.get('status')?.split(',')
        const text = q.get('q')?.toLowerCase().replace('-', '')
        const items = orders.filter(
          (o) =>
            (!status || status.includes(o.status)) &&
            (!text ||
              o.publicCode.toLowerCase().replace('-', '') === text ||
              (!o.blockedAt && !!o.email?.includes(text))) &&
            (q.get('guest') === null || (q.get('guest') === 'true') === !o.customerId) &&
            (!q.get('channel') || q.get('channel') === o.channel) &&
            (!q.get('placedBy') || q.get('placedBy') === o.placedBy),
        )
        return json(route, 200, page1(items.map((o) => orderDto(o, false))))
      }
      const o = orders.find((x) => x.id === parts[1])
      if (!o) return problem(route, 404, 'not-found', 'No encontrado')
      if (!parts[2] && method === 'GET') return json(route, 200, orderDto(o, true))
      if (body && 'version' in body && body.version !== o.version)
        return problem(route, 409, 'version-conflict', 'El recurso cambió', {
          currentVersion: o.version,
        })
      switch (parts[2]) {
        case 'cancel': {
          if (!['PENDING_PAYMENT', 'PAID', 'AWAITING_MANUAL_FULFILLMENT'].includes(o.status))
            return problem(route, 409, 'invalid-state-transition', 'Transición no permitida')
          const p = paymentOf(o)
          if (p && o.paidAt)
            p.refunds.push({
              id: uuid(),
              amount: money(total(o)),
              status: 'PENDING',
              providerRefundId: null,
              registeredBy: null,
              createdAt: NOW,
              completedAt: null,
            })
          else if (p) p.status = 'CANCELLED'
          const s = shipmentOf(o)
          if (s) s.status = 'CANCELLED'
          o.cancelledAt = NOW
          transition(o, 'CANCELLED', String(body?.reason))
          return json(route, 200, orderDto(o, true))
        }
        case 'manual-capture': {
          if (!settings.manualPaymentsEnabled || seed.staleSettings)
            return problem(
              route,
              403,
              'manual-payments-disabled',
              'El pago manual no está habilitado',
            )
          if (!['PENDING_PAYMENT', 'EXPIRED'].includes(o.status))
            return problem(route, 409, 'invalid-state-transition', 'Transición no permitida')
          let p = paymentOf(o)
          if (!p) {
            p = {
              id: uuid(),
              orderId: o.id,
              status: 'PENDING',
              capturedAt: null,
              version: 1,
              attempts: [],
              refunds: [],
            }
            payments.push(p)
            o.paymentId = p.id
          }
          p.status = 'CAPTURED'
          p.capturedAt = NOW
          p.version += 1
          p.attempts.push({
            status: 'CAPTURED',
            providerReference: body?.reference,
            method: body?.method ?? null,
            failureCode: null,
            registeredBy: STAFF_ID,
            createdAt: NOW,
          })
          // La respuesta trae el pago capturado; la orden cambia después (API_SPEC §2.5).
          const response = orderDto(o, true)
          o.paidAt = NOW
          transition(o, 'PAID', null, false)
          if (o.fulfillment === 'SHIPPING') o.shipmentId = newShipment(o).id
          return json(route, 200, response)
        }
        case 'retry-fulfillment':
          if (o.status !== 'AWAITING_MANUAL_FULFILLMENT')
            return problem(route, 409, 'invalid-state-transition', 'Transición no permitida')
          transition(o, 'PAID')
          o.shipmentId = newShipment(o).id
          return json(route, 200, orderDto(o, true))
        case 'reorder':
          if (!['CANCELLED', 'REFUNDED'].includes(o.status))
            return problem(route, 409, 'invalid-state-transition', 'Transición no permitida')
          return json(route, 200, { cartId: uuid(), skippedVariantIds: [uuid()] })
        case 'restocks': {
          if (!request.headers()['idempotency-key'])
            return problem(route, 400, 'idempotency-key-missing', 'Falta Idempotency-Key')
          const lines = body?.lines as Array<{ orderLineId: string; quantity: number }>
          const over = lines
            .map((l) => {
              const line = o.lines.find((x) => x.id === l.orderLineId)!
              const restocked = o.restocked[l.orderLineId] ?? 0
              return {
                orderLineId: l.orderLineId,
                sold: line.quantity,
                restocked,
                requested: l.quantity,
              }
            })
            .filter((l) => l.restocked + l.requested > l.sold)
          if (over.length)
            return problem(route, 409, 'restock-not-allowed', 'No se puede reintegrar', {
              lines: over,
            })
          for (const l of lines)
            o.restocked[l.orderLineId] = (o.restocked[l.orderLineId] ?? 0) + l.quantity
          return json(route, 201, {
            movements: lines.map((l) => ({
              id: uuid(),
              stockItemId: uuid(),
              type: 'RESTOCK',
              reasonCode: body?.reasonCode,
              note: body?.note ?? null,
              orderId: o.id,
              orderLineId: l.orderLineId,
              actorId: STAFF_ID,
              createdAt: NOW,
              quantity: l.quantity,
              onHandAfter: 10,
            })),
          })
        }
        case 'hand-over':
          if (o.status !== 'PAID' || o.fulfillment !== 'IN_STORE')
            return problem(route, 409, 'invalid-state-transition', 'Transición no permitida')
          o.deliveredAt = NOW
          transition(o, 'DELIVERED')
          return json(route, 200, orderDto(o, true))
        case 'blocked-data':
          if (!o.blockedAt)
            return problem(route, 409, 'invalid-state-transition', 'La orden no está bloqueada')
          return json(route, 200, {
            contactEmail: o.email,
            shippingAddress: ADDRESS,
            shipmentDestination: shipmentOf(o) ? ADDRESS : null,
          })
      }
    }

    // ── Pagos ──────────────────────────────────────────────────────────────────
    if (parts[0] === 'payments') {
      if (!parts[1]) {
        const status = q.get('status')?.split(',')
        return json(
          route,
          200,
          page1(payments.filter((p) => !status || status.includes(p.status)).map(paymentDto)),
        )
      }
      const p = payments.find((x) => x.id === parts[1])
      if (!p) return problem(route, 404, 'not-found', 'No encontrado')
      if (!parts[2]) return json(route, 200, paymentDto(p))
      if (body?.version !== p.version)
        return problem(route, 409, 'version-conflict', 'El recurso cambió', {
          currentVersion: p.version,
        })
      const pending = p.refunds.find((r) => r.status === 'PENDING')
      if (!pending)
        return problem(route, 409, 'invalid-state-transition', 'Sin reembolso pendiente')
      Object.assign(pending, {
        status: 'COMPLETED',
        providerRefundId: body.reference,
        registeredBy: STAFF_ID,
        completedAt: NOW,
      })
      p.status = 'REFUNDED'
      p.version += 1
      const o = orders.find((x) => x.id === p.orderId)!
      transition(o, 'REFUNDED', null, false)
      return json(route, 200, paymentDto(p))
    }

    // ── Envíos ─────────────────────────────────────────────────────────────────
    const shipmentId = parts[2]
    if (!shipmentId) {
      const status = (q.get('status') ?? 'PENDING').split(',')
      const text = q.get('q')?.toLowerCase().replace('-', '')
      const items = shipments.filter((s) => {
        const o = orders.find((x) => x.id === s.orderId)!
        return (
          status.includes(s.status) &&
          (!text ||
            o.publicCode.toLowerCase().replace('-', '') === text ||
            s.trackingNumber?.toLowerCase() === text)
        )
      })
      return json(route, 200, page1(items.map(shipmentDto)))
    }
    const s = shipments.find((x) => x.id === shipmentId)
    if (!s) return problem(route, 404, 'not-found', 'No encontrado')
    if (method === 'GET') return json(route, 200, shipmentDto(s))
    if (body?.version !== s.version)
      return problem(route, 409, 'version-conflict', 'El recurso cambió', {
        currentVersion: s.version,
      })
    const o = orders.find((x) => x.id === s.orderId)!
    const invalid = () =>
      problem(route, 409, 'invalid-state-transition', 'Transición no permitida', {
        currentStatus: s.status,
      })
    const action = parts[3]
    if (method === 'PATCH') {
      if (!['PENDING', 'DISPATCHED'].includes(s.status) || s.ownDelivery) return invalid()
      s.carrierName = body.carrierName as string | null
      s.trackingNumber = body.trackingNumber as string | null
    } else if (action === 'dispatch') {
      if (s.status !== 'PENDING') return invalid()
      const own = body.ownDelivery === true
      if (own === !!s.trackingNumber)
        return problem(route, 400, 'validation-error', 'Datos inválidos', {
          errors: [
            {
              field: 'ownDelivery',
              code: own ? 'trackingNotAllowed' : 'trackingRequired',
              message: own
                ? 'Una entrega propia no lleva guía.'
                : 'Captura la paquetería y la guía.',
            },
          ],
        })
      Object.assign(s, { status: 'DISPATCHED', ownDelivery: own, dispatchedAt: NOW })
      transition(o, 'SHIPPED', null, false)
    } else if (action === 'deliver') {
      if (s.status !== 'DISPATCHED') return invalid()
      Object.assign(s, { status: 'DELIVERED', deliveredAt: NOW })
      transition(o, 'DELIVERED', null, false)
    } else if (action === 'delivery-failure') {
      if (s.status !== 'DISPATCHED') return invalid()
      Object.assign(s, { status: 'DELIVERY_FAILED', failedAt: NOW, failureNote: body.note ?? null })
    } else if (action === 'return') {
      if (s.status !== 'DELIVERY_FAILED') return invalid()
      Object.assign(s, { status: 'RETURNED', returnedAt: NOW, returnNote: body.note ?? null })
    }
    s.version += 1
    return json(route, 200, shipmentDto(s))
  })

  return { calls, orders, payments, shipments, settings }
}
