import type { Page, Route } from '@playwright/test'
import { API, json } from './mock-api'

/**
 * Método de envío, entregas de eventos, auditoría y los listados que cuenta el tablero, en memoria y
 * con las formas de openapi/v1.json (API_SPEC §5.2, §17, §18, §22).
 */
const NOW = '2026-10-05T12:00:00.000Z'
const id = (n: number) => `0192a3b4-0000-7000-8000-${String(800000 + n).padStart(12, '0')}`

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

const preflight = (route: Route) =>
  route.fulfill({
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
    },
  })

/** Solo el listado, sin capturar sus rutas hijas (detalle, acciones). */
const listOf = (path: string) => (url: URL) =>
  url.origin === new URL(API).origin && url.pathname === path

const page1 = <T>(items: T[], totalItems = items.length) => ({
  data: items,
  meta: { page: 1, pageSize: 20, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / 20)) },
})

export interface OperationsSeed {
  /** Totales que responden los listados del tablero, por ruta y filtro. */
  counts?: Partial<
    Record<
      | 'pendingPayment'
      | 'awaitingFulfillment'
      | 'pendingRefund'
      | 'shipments'
      | 'lowStock'
      | 'failed',
      number
    >
  >
  /** Cuántos registros de auditoría hay; se sirven de 2 en 2 con cursor. */
  auditEntries?: number
}

export async function mockOperationsApi(page: Page, seed: OperationsSeed = {}) {
  const calls: Array<{ method: string; path: string; query: string; body: unknown }> = []
  const record = (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    const body = request.postDataJSON() as Record<string, unknown> | null
    calls.push({ method: request.method(), path: url.pathname, query: url.search, body })
    return { method: request.method(), url, body }
  }

  const method = {
    id: id(1),
    name: 'Envío Estándar',
    flatFee: { amount: 9900, currency: 'MXN' },
    freeShippingThreshold: null as { amount: number; currency: string } | null,
    deliveryMinBusinessDays: 3,
    deliveryMaxBusinessDays: 7,
    isActive: true,
    version: 1,
    updatedAt: '2026-10-01T00:00:00.000Z',
  }

  const deliveries = [
    {
      id: id(10),
      eventId: id(20),
      eventType: 'OrderPaid',
      occurredAt: '2026-10-05T11:00:00.000Z',
      handler: 'OrderEmails.onOrderPaid',
      status: 'FAILED',
      attempts: 8,
      nextAttemptAt: '2026-10-05T11:30:00.000Z',
      lastError: 'EmailDeliveryError: connection refused',
      deliveredAt: null as string | null,
      event: { eventId: id(20), eventType: 'OrderPaid', occurredAt: NOW, orderId: id(30) },
    },
    {
      id: id(11),
      eventId: id(21),
      eventType: 'OrderPaid',
      occurredAt: '2026-10-05T10:00:00.000Z',
      handler: 'InventoryHandler.onOrderPaid',
      status: 'FAILED',
      attempts: 8,
      nextAttemptAt: '2026-10-05T10:30:00.000Z',
      lastError: 'TimeoutError: lock wait',
      deliveredAt: null as string | null,
      event: { eventId: id(21), eventType: 'OrderPaid', occurredAt: NOW, orderId: id(31) },
    },
    {
      id: id(12),
      eventId: id(22),
      eventType: 'PaymentCaptured',
      occurredAt: '2026-10-05T09:00:00.000Z',
      handler: 'PaymentCapturedHandler.onPaymentCaptured',
      status: 'DELIVERED',
      attempts: 1,
      nextAttemptAt: '2026-10-05T09:00:00.000Z',
      lastError: null as string | null,
      deliveredAt: '2026-10-05T09:00:05.000Z' as string | null,
      event: { eventId: id(22), eventType: 'PaymentCaptured', occurredAt: NOW },
    },
  ]

  const audit = Array.from({ length: seed.auditEntries ?? 3 }, (_, i) => ({
    id: id(100 + i),
    occurredAt: new Date(Date.parse(NOW) - i * 3600_000).toISOString(),
    actorType: 'USER' as const,
    actorId: id(200),
    action: i === 0 ? 'orders.cancel' : `catalog.products.update`,
    resourceType: i === 0 ? 'order' : 'product',
    resourceId: i === 0 ? id(30) : id(300 + i),
    result: 'SUCCESS' as const,
    correlationId: `corr-${i}`,
    ip: '203.0.113.7',
    userAgent: 'Mozilla/5.0',
    changes:
      i === 0
        ? { status: { from: 'PAID', to: 'CANCELLED' }, email: { changed: true } }
        : { title: { from: `Producto ${i}`, to: `Producto ${i} nuevo` } },
    reason: i === 0 ? 'El cliente lo pidió por teléfono' : null,
  }))

  await page.route(`${API}/v1/admin/shipping/method`, async (route) => {
    if (route.request().method() === 'OPTIONS') return preflight(route)
    const { method: m, body } = record(route)
    if (m === 'GET') return json(route, 200, method)
    if (body?.version !== method.version)
      return problem(route, 409, 'version-conflict', 'El recurso cambió', {
        currentVersion: method.version,
      })
    const fee = body.flatFee as number
    const threshold = body.freeShippingThreshold as number | null
    Object.assign(method, {
      name: body.name,
      flatFee: { amount: fee, currency: 'MXN' },
      freeShippingThreshold: threshold === null ? null : { amount: threshold, currency: 'MXN' },
      deliveryMinBusinessDays: body.deliveryMinBusinessDays,
      deliveryMaxBusinessDays: body.deliveryMaxBusinessDays,
      version: method.version + 1,
      updatedAt: NOW,
    })
    return json(route, 200, method)
  })

  await page.route(`${API}/v1/admin/event-deliveries**`, async (route) => {
    if (route.request().method() === 'OPTIONS') return preflight(route)
    const { method: m, url, body } = record(route)
    const parts = url.pathname.split('/')
    if (m === 'GET') {
      if (seed.counts?.failed !== undefined) return json(route, 200, page1([], seed.counts.failed))
      const statuses = (url.searchParams.get('status') ?? 'FAILED').split(',')
      const type = url.searchParams.get('eventType')
      return json(
        route,
        200,
        page1(
          deliveries.filter((d) => statuses.includes(d.status) && (!type || d.eventType === type)),
        ),
      )
    }
    if (parts.at(-1) === 'retry' && parts.length === 5) {
      const matching = deliveries.filter(
        (d) =>
          d.status === 'FAILED' &&
          (!body?.eventType || d.eventType === body.eventType) &&
          (!body?.handler || d.handler === body.handler),
      )
      matching.forEach((d) => Object.assign(d, { status: 'PENDING', attempts: 0 }))
      return json(route, 200, { retried: matching.length })
    }
    const d = deliveries.find((x) => x.id === parts[4])
    if (!d) return problem(route, 404, 'not-found', 'No encontrado')
    if (d.status !== 'FAILED')
      return problem(route, 409, 'invalid-state-transition', 'Transición no permitida', {
        currentStatus: d.status,
      })
    Object.assign(d, { status: 'PENDING', attempts: 0 })
    return json(route, 202, undefined)
  })

  await page.route(`${API}/v1/admin/audit**`, async (route) => {
    if (route.request().method() === 'OPTIONS') return preflight(route)
    const { url } = record(route)
    const p = url.searchParams
    const filtered = audit.filter(
      (e) =>
        (!p.get('resourceType') || e.resourceType === p.get('resourceType')) &&
        (!p.get('resourceId') || e.resourceId === p.get('resourceId')) &&
        (!p.get('action') ||
          (p.get('action')!.endsWith('.*')
            ? e.action.startsWith(p.get('action')!.slice(0, -1))
            : e.action === p.get('action'))),
    )
    const start = Number(p.get('cursor') ?? 0)
    const size = 2
    const next = start + size < filtered.length ? String(start + size) : null
    return json(route, 200, {
      data: filtered.slice(start, start + size),
      meta: { limit: Number(p.get('limit') ?? 50), nextCursor: next },
    })
  })

  // Listados que cuenta el tablero: solo importa `meta.totalItems`.
  const counted = (key: keyof NonNullable<OperationsSeed['counts']>) => seed.counts?.[key] ?? 0
  await page.route(listOf('/v1/admin/orders'), async (route) => {
    if (route.request().method() === 'OPTIONS') return preflight(route)
    const { url } = record(route)
    const p = url.searchParams
    const key =
      p.get('hasPendingRefund') === 'true'
        ? 'pendingRefund'
        : p.get('status') === 'AWAITING_MANUAL_FULFILLMENT'
          ? 'awaitingFulfillment'
          : 'pendingPayment'
    return json(route, 200, page1([], counted(key)))
  })
  await page.route(listOf('/v1/admin/shipping/shipments'), async (route) => {
    if (route.request().method() === 'OPTIONS') return preflight(route)
    record(route)
    return json(route, 200, page1([], counted('shipments')))
  })
  await page.route(listOf('/v1/admin/inventory/stock-items'), async (route) => {
    if (route.request().method() === 'OPTIONS') return preflight(route)
    record(route)
    return json(route, 200, page1([], counted('lowStock')))
  })

  return { calls, method, deliveries }
}
