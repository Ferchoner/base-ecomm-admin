import type { Page, Route } from '@playwright/test'
import { API, json } from './mock-api'

/** Órdenes de trabajo en memoria, con las formas de openapi/v1.json (API_SPEC §25). */
const NOW = '2026-10-17T12:00:00.000Z'
export const ME = '0192a3b4-0000-7000-8000-000000000001'
export const TECH = '0192a3b4-0000-7000-8000-00000000c002'
export const WO_WAREHOUSE = '0192a3b4-0000-7000-8000-00000000b001'
let next = 1
const uuid = () => `0192a3b4-0000-7000-8000-${String(700000 + next++).padStart(12, '0')}`
const money = (amount: number) => ({ amount, currency: 'MXN' })
const FLOW = ['RECEIVED', 'DIAGNOSED', 'IN_REPAIR', 'READY', 'DELIVERED']
const PAID = ['PAID', 'AWAITING_MANUAL_FULFILLMENT', 'SHIPPED', 'DELIVERED']
const NOT_LINKABLE = ['EXPIRED', 'CANCELLED', 'REFUNDED']
const HIDDEN = [
  'customerName',
  'customerPhone',
  'customerEmail',
  'serialNumber',
  'accessories',
  'equipmentCondition',
  'reportedFault',
  'diagnosis',
  'workPerformed',
] as const

function problem(route: Route, status: number, type: string, extra: Record<string, unknown> = {}) {
  return route.fulfill({
    status,
    contentType: 'application/problem+json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({
      type: `/problems/${type}`,
      title: type,
      status,
      detail: null,
      correlationId: 'e2e',
      ...extra,
    }),
  })
}

/** Una venta de la tienda (u otra) que se puede ligar, leída en el momento. */
export interface LinkableSale {
  id: string
  publicCode: string
  orderNumber: number
  status: string
  channel: 'ONLINE' | 'STORE'
  total: number
}

export interface WorkOrderSeed {
  folio?: number
  status?: string
  customerName?: string
  technicianId?: string | null
  blocked?: boolean
  diagnosis?: string | null
}

interface Options {
  workOrders?: WorkOrderSeed[]
  /** Las ventas del mock de ventas, para ligarlas. */
  sales?: () => LinkableSale[]
  /** Almacenes propios (sin el mock de ventas). */
  warehouses?: boolean
  /** Staff propio para elegir técnico; `false` deja el del mock de identidad. */
  staff?: boolean
  terms?: string
}

export async function mockWorkOrdersApi(page: Page, options: Options = {}) {
  let folio = 122
  const blockedData = new Map<string, Record<string, string | null>>()
  const make = (s: WorkOrderSeed = {}) => {
    const n = s.folio ?? ++folio
    const status = s.status ?? 'RECEIVED'
    const w = {
      id: uuid(),
      folio: `OT-${String(n).padStart(6, '0')}`,
      status,
      customerId: null as string | null,
      customerName: (s.customerName ?? 'María López') as string | null,
      customerPhone: '4431234567' as string | null,
      customerEmail: null as string | null,
      equipmentType: 'Laptop',
      equipmentBrand: 'Lenovo' as string | null,
      equipmentModel: 'ThinkPad T14' as string | null,
      serialNumber: 'PF3ABC12' as string | null,
      accessories: 'Cargador' as string | null,
      equipmentCondition: null as string | null,
      reportedFault: 'No enciende' as string | null,
      diagnosis: (s.diagnosis ?? null) as string | null,
      workPerformed: null as string | null,
      estimatedCost: money(120000) as { amount: number; currency: string } | null,
      warehouseId: WO_WAREHOUSE,
      receivedBy: ME,
      technicianId: s.technicianId === undefined ? null : s.technicianId,
      receivedAt: '2026-10-15T16:00:00.000Z',
      closedAt: ['DELIVERED', 'CANCELLED'].includes(status) ? '2026-10-16T16:00:00.000Z' : null,
      blockedAt: s.blocked ? '2026-10-17T06:00:00.000Z' : (null as string | null),
      anonymizedAt: null as string | null,
      version: 1,
      statusHistory: [
        {
          fromStatus: null as string | null,
          toStatus: 'RECEIVED',
          actorId: ME,
          note: null as string | null,
          occurredAt: '2026-10-15T16:00:00.000Z',
        },
        ...(status === 'RECEIVED'
          ? []
          : [
              {
                fromStatus: 'RECEIVED',
                toStatus: status,
                actorId: ME,
                note: null,
                occurredAt: '2026-10-16T16:00:00.000Z',
              },
            ]),
      ],
      links: [] as Array<{ orderId: string; linkedAt: string }>,
    }
    if (s.blocked) {
      blockedData.set(w.id, Object.fromEntries(HIDDEN.map((k) => [k, w[k]])))
      for (const k of HIDDEN) w[k] = null
    }
    return w
  }
  type WorkOrder = ReturnType<typeof make>
  const workOrders: WorkOrder[] = (options.workOrders ?? []).map(make)
  const calls: Array<{
    method: string
    path: string
    query: string
    body: Record<string, unknown> | null
    headers: Record<string, string>
  }> = []
  const idempotency = new Map<string, WorkOrder>()
  const sales = () => options.sales?.() ?? []

  function dto(w: WorkOrder) {
    const { links, ...rest } = w
    const linked = links.map((l) => {
      const s = sales().find((x) => x.id === l.orderId)!
      const paid = PAID.includes(s.status)
      return {
        orderId: s.id,
        publicCode: s.publicCode,
        orderNumber: s.orderNumber,
        status: s.status,
        paid,
        grandTotal: money(s.total),
        placedAt: '2026-10-15T16:05:00.000Z',
        paidAt: paid ? '2026-10-15T16:06:00.000Z' : null,
        linkedBy: ME,
        linkedAt: l.linkedAt,
      }
    })
    const sum = (f: (s: (typeof linked)[number]) => boolean) =>
      money(linked.filter(f).reduce((t, s) => t + s.grandTotal.amount, 0))
    return {
      ...rest,
      sales: linked,
      paidTotal: sum((s) => s.paid),
      unpaidTotal: sum((s) => !s.paid && !NOT_LINKABLE.includes(s.status)),
    }
  }
  const summary = (w: WorkOrder) => ({
    id: w.id,
    folio: w.folio,
    status: w.status,
    customerName: w.customerName,
    customerPhone: w.customerPhone,
    equipmentType: w.equipmentType,
    equipmentBrand: w.equipmentBrand,
    equipmentModel: w.equipmentModel,
    serialNumber: w.serialNumber,
    warehouseId: w.warehouseId,
    technicianId: w.technicianId,
    receivedAt: w.receivedAt,
    closedAt: w.closedAt,
  })
  const closed = (w: WorkOrder) => ['DELIVERED', 'CANCELLED'].includes(w.status)

  await page.route(`${API}/v1/admin/work-orders**`, async (route) => {
    const request = route.request()
    const method = request.method()
    if (method === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE',
        },
      })
    const url = new URL(request.url())
    const path = url.pathname.replace('/v1/admin/work-orders', '')
    const body = (request.postDataJSON() ?? null) as Record<string, unknown> | null
    calls.push({ method, path, query: url.search, body, headers: request.headers() })
    const seg = path.split('/').filter(Boolean)
    const q = url.searchParams

    if (seg.length === 0 && method === 'GET') {
      const text = q.get('q')?.trim().toLowerCase() ?? ''
      const folioN = /^(?:ot-?)?0*(\d+)$/.exec(text)?.[1]
      const status = q.get('status')?.split(',')
      const items = workOrders
        .filter(
          (w) =>
            !text ||
            (folioN && Number(w.folio.slice(3)) === Number(folioN)) ||
            (!w.blockedAt &&
              (!!w.customerName?.toLowerCase().includes(text) ||
                !!w.customerPhone?.includes(text.replace(/\D/g, '') || '∅'))),
        )
        .filter((w) => !status || status.includes(w.status))
        .filter((w) => !q.get('technicianId') || w.technicianId === q.get('technicianId'))
      return json(route, 200, {
        data: items.map(summary),
        meta: { page: 1, pageSize: 20, totalItems: items.length, totalPages: 1 },
      })
    }
    if (seg.length === 0 && method === 'POST') {
      const key = request.headers()['idempotency-key']
      if (!key) return problem(route, 400, 'idempotency-key-missing')
      const seen = idempotency.get(key)
      if (seen) return json(route, 201, dto(seen))
      const w = make()
      Object.assign(w, body, { status: 'RECEIVED', diagnosis: null, workPerformed: null })
      w.estimatedCost =
        body?.estimatedCost === null || body?.estimatedCost === undefined
          ? null
          : money(Number(body.estimatedCost))
      workOrders.unshift(w)
      idempotency.set(key, w)
      return json(route, 201, dto(w))
    }
    const w = workOrders.find((x) => x.id === seg[0])
    if (!w) return problem(route, 404, 'not-found')
    if (seg.length === 1 && method === 'GET') return json(route, 200, dto(w))
    if (seg[1] === 'service-note' && method === 'GET')
      return json(route, 200, {
        workOrder: dto(w),
        store: {
          name: 'Tienda Ejemplo',
          address: 'Av. Madero Poniente 123, Centro, 58000 Morelia, Mich.',
          taxId: 'EJE260101AB1',
          phone: '443 123 4567',
        },
        terms: options.terms ?? 'Garantía de 30 días en la mano de obra.\nNo incluye refacciones.',
      })
    if (seg[1] === 'blocked-data') {
      const data = blockedData.get(w.id)
      if (!data || w.anonymizedAt) return problem(route, 409, 'invalid-state-transition')
      return json(route, 200, data)
    }
    if (seg[1] === 'anonymize') {
      if (!closed(w) || w.anonymizedAt) return problem(route, 409, 'invalid-state-transition')
      for (const k of HIDDEN) w[k] = null
      w.anonymizedAt = NOW
      w.version++
      return json(route, 200, dto(w))
    }
    const version = method === 'DELETE' ? Number(q.get('version')) : body?.version
    if (version !== w.version)
      return problem(route, 409, 'version-conflict', { currentVersion: w.version })
    if (closed(w))
      return problem(route, 409, 'invalid-state-transition', { currentStatus: w.status })

    if (seg.length === 1 && method === 'PATCH') {
      const { version: _v, ...changes } = body!
      Object.assign(w, changes)
      if ('estimatedCost' in changes)
        w.estimatedCost =
          changes.estimatedCost === null ? null : money(Number(changes.estimatedCost))
      w.version++
      return json(route, 200, dto(w))
    }
    if (seg[1] === 'status') {
      const to = String(body?.status)
      const forward = FLOW.indexOf(to) > FLOW.indexOf(w.status)
      if (to !== 'CANCELLED' && !forward)
        return problem(route, 409, 'invalid-state-transition', { currentStatus: w.status })
      if (to === 'CANCELLED' && !body?.note)
        return problem(route, 400, 'validation-error', {
          errors: [{ field: 'note', message: 'La nota es obligatoria al cancelar.' }],
        })
      w.statusHistory.push({
        fromStatus: w.status,
        toStatus: to,
        actorId: ME,
        note: (body?.note as string | undefined) ?? null,
        occurredAt: NOW,
      })
      w.status = to
      if (closed(w)) w.closedAt = NOW
      w.version++
      return json(route, 200, dto(w))
    }
    if (seg[1] === 'sales' && method === 'POST') {
      const sale = sales().find((s) => s.id === body?.orderId)
      if (!sale || sale.channel !== 'STORE') return problem(route, 404, 'not-found')
      if (NOT_LINKABLE.includes(sale.status))
        return problem(route, 409, 'sale-not-linkable', { saleStatus: sale.status })
      if (workOrders.some((x) => x.links.some((l) => l.orderId === sale.id)))
        return problem(route, 409, 'duplicate-value', { field: 'orderId' })
      w.links.push({ orderId: sale.id, linkedAt: NOW })
      w.version++
      return json(route, 200, dto(w))
    }
    if (seg[1] === 'sales' && method === 'DELETE') {
      if (!w.links.some((l) => l.orderId === seg[2])) return problem(route, 404, 'not-found')
      w.links = w.links.filter((l) => l.orderId !== seg[2])
      w.version++
      return json(route, 200, dto(w))
    }
    return problem(route, 404, 'not-found')
  })

  // Staff activo para elegir técnico (`staff.manage`, GAPS G-23).
  const STAFF = [
    { id: ME, firstNames: 'Ana', lastNames: 'Pérez', email: 'ana@example.com' },
    { id: TECH, firstNames: 'Luis', lastNames: 'Ramírez', email: 'luis@example.com' },
  ].map((s) => ({
    ...s,
    status: 'ACTIVE',
    mustChangePassword: false,
    lastLoginAt: null,
    roles: [],
    createdAt: NOW,
    version: 1,
  }))
  if (options.staff !== false)
    await page.route(`${API}/v1/admin/identity/staff**`, async (route) => {
      const request = route.request()
      if (request.method() === 'OPTIONS') return route.fallback()
      const url = new URL(request.url())
      calls.push({
        method: request.method(),
        path: url.pathname,
        query: url.search,
        body: null,
        headers: request.headers(),
      })
      const id = url.pathname.split('/')[5]
      if (id) {
        const s = STAFF.find((x) => x.id === id)
        return s ? json(route, 200, s) : problem(route, 404, 'not-found')
      }
      const text = url.searchParams.get('q')?.toLowerCase() ?? ''
      const items = STAFF.filter((s) =>
        `${s.firstNames} ${s.lastNames}`.toLowerCase().includes(text),
      )
      return json(route, 200, {
        data: items,
        meta: { page: 1, pageSize: 20, totalItems: items.length, totalPages: 1 },
      })
    })

  if (options.warehouses)
    await page.route(`${API}/v1/admin/inventory/warehouses**`, async (route) => {
      if (route.request().method() === 'OPTIONS') return route.fallback()
      return json(route, 200, {
        data: [
          {
            id: WO_WAREHOUSE,
            code: 'CENTRO',
            name: 'Tienda Centro',
            priority: 1,
            status: 'ACTIVE',
            address: null,
            createdAt: NOW,
            updatedAt: NOW,
            version: 1,
          },
        ],
      })
    })

  return { workOrders, calls }
}
