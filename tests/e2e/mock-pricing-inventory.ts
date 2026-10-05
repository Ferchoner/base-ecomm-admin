import type { Page, Route } from '@playwright/test'
import { API, json } from './mock-api'

/** Precios e inventario en memoria con las formas de openapi/v1.json (API_SPEC §12–13). */
const NOW = new Date('2026-10-05T12:00:00.000Z')
const LIST_ID = '0192a3b4-0000-7000-8000-00000000a001'
const WAREHOUSE_ID = '0192a3b4-0000-7000-8000-00000000b001'
let seq = 0
const uuid = () => `0192a3b4-0000-7000-8000-${String(900000 + ++seq).padStart(12, '0')}`

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

const money = (amount: number) => ({ amount, currency: 'MXN' })

interface Period {
  id: string
  variantId: string
  amount: number
  compareAtAmount: number | null
  effectiveFrom: string
}

interface Stock {
  id: string
  variantId: string
  sku: string
  productTitle: string
  onHand: number
  reserved: number
}

export interface PricingInventorySeed {
  prices?: Array<{
    variantId: string
    amount: number
    compareAtAmount?: number | null
    effectiveFrom?: string
  }>
  stock?: Array<{
    variantId: string
    sku: string
    productTitle: string
    onHand: number
    reserved?: number
  }>
  /** Movimientos de cada stock item por SKU, para probar la paginación por cursor. */
  movements?: Record<string, number>
  /** Respuesta de la importación de precios: `ok` o errores por fila. */
  importErrors?: Array<{ field: string; code: string; message: string }>
}

export async function mockPricingInventoryApi(page: Page, seed: PricingInventorySeed = {}) {
  const periods: Period[] = (seed.prices ?? []).map((p) => ({
    id: uuid(),
    variantId: p.variantId,
    amount: p.amount,
    compareAtAmount: p.compareAtAmount ?? null,
    effectiveFrom: p.effectiveFrom ?? '2026-09-01T06:00:00.000Z',
  }))
  const stock: Stock[] = (seed.stock ?? []).map((s) => ({ id: uuid(), reserved: 0, ...s }))
  const movements = new Map<string, Array<Record<string, unknown>>>()
  for (const s of stock) {
    const n = seed.movements?.[s.sku] ?? 1
    movements.set(
      s.id,
      Array.from({ length: n }, (_, i) => ({
        id: uuid(),
        type: i % 2 ? 'SALE' : 'RECEIPT',
        quantity: i % 2 ? -1 : 5,
        onHandAfter: s.onHand - i,
        reasonCode: null,
        note: i === 0 ? 'Remisión 1234' : null,
        orderId: null,
        orderLineId: null,
        actorId: i % 2 ? null : '0192a3b4-0000-7000-8000-000000000001',
        createdAt: new Date(NOW.getTime() - i * 3600_000).toISOString(),
      })),
    )
  }
  const warehouse: Record<string, unknown> = {
    id: WAREHOUSE_ID,
    code: 'PRINCIPAL',
    name: 'Almacén principal',
    address: null,
    status: 'ACTIVE',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  }
  const calls: Array<{ method: string; path: string; body: unknown; query: string }> = []

  const periodDto = (p: Period, all: Period[]) => {
    const sorted = [...all].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
    const next = sorted[sorted.indexOf(p) + 1]
    const started = new Date(p.effectiveFrom) <= NOW
    const ended = next && new Date(next.effectiveFrom) <= NOW
    return {
      id: p.id,
      amount: money(p.amount),
      compareAtAmount: p.compareAtAmount === null ? null : money(p.compareAtAmount),
      effectiveFrom: p.effectiveFrom,
      effectiveTo: next?.effectiveFrom ?? null,
      state: !started ? 'SCHEDULED' : ended ? 'PAST' : 'CURRENT',
      createdBy: '0192a3b4-0000-7000-8000-000000000001',
      createdAt: p.effectiveFrom,
    }
  }
  const stockDto = (s: Stock) => ({
    ...s,
    warehouseId: WAREHOUSE_ID,
    available: s.onHand - s.reserved,
    updatedAt: NOW.toISOString(),
  })

  await page.route(`${API}/v1/geo/**`, (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/v1/geo/states')
      return json(route, 200, { data: [{ code: '16', name: 'Michoacán de Ocampo' }] })
    return json(route, 200, { data: [{ code: '16053', name: 'Morelia' }] })
  })

  await page.route(new RegExp(`^${API}/v1/admin/(pricing|inventory)/`), async (route) => {
    const request = route.request()
    const method = request.method()
    if (method === 'OPTIONS') return route.fallback()
    const url = new URL(request.url())
    const path = url.pathname
    const isJson = (request.headers()['content-type'] ?? '').includes('application/json')
    const body = (isJson ? request.postDataJSON() : null) as Record<string, unknown> | null
    calls.push({ method, path, body, query: url.search })
    const seg = path.split('/').filter(Boolean).slice(2)

    // ── Precios ──
    if (seg[0] === 'pricing') {
      if (seg.length === 2)
        return json(route, 200, {
          data: [
            {
              id: LIST_ID,
              code: 'GENERAL',
              name: 'Lista general',
              currency: 'MXN',
              priority: 0,
              isDefault: true,
              taxesIncluded: true,
              status: 'ACTIVE',
            },
          ],
        })
      if (seg[3] === 'imports') {
        if (seed.importErrors)
          return route.fulfill({
            status: 400,
            contentType: 'application/problem+json',
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
              type: '/problems/validation-error',
              title: 'Datos inválidos',
              status: 400,
              detail: null,
              correlationId: 'e2e',
              errors: seed.importErrors,
            }),
          })
        return json(route, 200, {
          rows: 3,
          created: 2,
          unchanged: 1,
          dryRun: url.searchParams.get('dryRun') === 'true',
        })
      }
      const variantId = seg[4]!
      const own = periods.filter((p) => p.variantId === variantId)
      if (seg.length === 6 && method === 'GET') {
        const dtos = own
          .map((p) => periodDto(p, own))
          .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
        return json(route, 200, {
          data: dtos,
          current: dtos.find((d) => d.state === 'CURRENT') ?? null,
        })
      }
      if (seg.length === 6 && method === 'POST') {
        const from = (body?.effectiveFrom as string | undefined) ?? NOW.toISOString()
        const period: Period = {
          id: uuid(),
          variantId,
          amount: body!.amount as number,
          compareAtAmount: (body?.compareAtAmount as number | null) ?? null,
          effectiveFrom: from,
        }
        periods.push(period)
        return json(route, 201, periodDto(period, [...own, period]))
      }
      if (seg.length === 7 && method === 'DELETE') {
        const period = periods.find((p) => p.id === seg[6])
        if (!period) return problem(route, 404, 'not-found', 'No encontrado')
        if (new Date(period.effectiveFrom) <= NOW)
          return problem(route, 409, 'price-period-conflict', 'El precio ya empezó', {
            reason: 'already-started',
          })
        periods.splice(periods.indexOf(period), 1)
        return json(route, 204, undefined)
      }
    }

    // ── Inventario ──
    if (seg[0] === 'inventory') {
      if (seg[1] === 'warehouses') {
        if (method === 'GET') return json(route, 200, { data: [warehouse] })
        const address = body?.address as Record<string, unknown> | null | undefined
        Object.assign(warehouse, {
          ...(body?.name !== undefined && { name: body.name }),
          ...(address !== undefined && {
            address: address && {
              ...address,
              stateName: 'Michoacán de Ocampo',
              municipalityName: 'Morelia',
              country: 'MX',
            },
          }),
        })
        return json(route, 200, warehouse)
      }
      if (seg[1] === 'stock-items' && seg.length === 2) {
        const q = url.searchParams.get('q')?.toLowerCase()
        const max = url.searchParams.get('availableMax')
        const variantId = url.searchParams.get('variantId')
        const items = stock
          .filter(
            (s) =>
              !q || s.sku.toLowerCase().includes(q) || s.productTitle.toLowerCase().includes(q),
          )
          .filter((s) => max === null || s.onHand - s.reserved <= Number(max))
          .filter((s) => !variantId || s.variantId === variantId)
          .map(stockDto)
        return json(route, 200, {
          data: items,
          meta: {
            page: 1,
            pageSize: 20,
            totalItems: items.length,
            totalPages: items.length ? 1 : 0,
          },
        })
      }
      if (seg[1] === 'stock-items' && seg[3] === 'movements') {
        const all = movements.get(seg[2]!) ?? []
        const types = url.searchParams.get('type')?.split(',')
        const filtered = all.filter((m) => !types || types.includes(m.type as string))
        const start = Number(url.searchParams.get('cursor') ?? 0)
        const limit = Number(url.searchParams.get('limit') ?? 50)
        const slice = filtered.slice(start, start + limit)
        return json(route, 200, {
          data: slice,
          meta: {
            limit,
            nextCursor: start + limit < filtered.length ? String(start + limit) : null,
          },
        })
      }
      if (seg[1] === 'receipts' || seg[1] === 'adjustments') {
        if (body?.warehouseId !== WAREHOUSE_ID)
          return problem(route, 404, 'not-found', 'No encontrado')
        let item = stock.find((s) => s.variantId === body.variantId)
        const quantity = body.quantity as number
        if (seg[1] === 'adjustments' && item && item.onHand + quantity < item.reserved)
          return problem(route, 409, 'insufficient-stock', 'Existencias insuficientes', {
            lines: [{ variantId: body.variantId, canFulfill: false }],
          })
        if (!item) {
          item = {
            id: uuid(),
            variantId: body.variantId as string,
            sku: 'NUEVO',
            productTitle: 'Producto',
            onHand: 0,
            reserved: 0,
          }
          stock.push(item)
          movements.set(item.id, [])
        }
        item.onHand += quantity
        const movement = {
          id: uuid(),
          type: seg[1] === 'receipts' ? 'RECEIPT' : 'ADJUSTMENT',
          quantity,
          onHandAfter: item.onHand,
          reasonCode: (body.reasonCode as string) ?? null,
          note: (body.note as string) ?? null,
          orderId: null,
          orderLineId: null,
          actorId: '0192a3b4-0000-7000-8000-000000000001',
          createdAt: NOW.toISOString(),
        }
        movements.get(item.id)!.unshift(movement)
        return json(route, 201, { stockItem: stockDto(item), movement })
      }
    }
    return problem(route, 404, 'not-found', 'No encontrado')
  })

  return { calls, periods, stock, warehouse }
}
