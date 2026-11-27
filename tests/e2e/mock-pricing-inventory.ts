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
  warehouseId: string
  location: string | null
}

export const SECOND_WAREHOUSE_ID = '0192a3b4-0000-7000-8000-00000000b002'

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
    warehouseId?: string
    /** Ubicación en su almacén (ADR-0173 de base-shop). */
    location?: string | null
  }>
  /** Las hojas responden a ciegas, como a quien solo cuenta (sin `inventory.write`). */
  blindCounts?: boolean
  /** Hojas ya abiertas en el almacén principal, por ubicación. */
  openCounts?: Array<{ location: string }>
  /** Una hoja abierta que ya tiene estas variantes: abrir otra con ellas es 409. */
  busyVariants?: Array<{ variantId: string; countId: string; folio: string }>
  /** Almacenes además del principal (ADR-0160). */
  warehouses?: Array<{ id?: string; code: string; name: string; priority: number; status?: string }>
  /**
   * Préstamos para mostrar ya registrados (ADR-0172 de base-shop), por SKU, del almacén principal al
   * primero de `warehouses`; `minutesLeft` negativo, vencido.
   */
  loans?: Array<{ sku: string; quantity: number; minutesLeft: number }>
  /** Movimientos de cada stock item por SKU, para probar la paginación por cursor. */
  movements?: Record<string, number>
  /** Respuesta de la importación de precios: `ok` o errores por fila. */
  importErrors?: Array<{ field: string; code: string; message: string }>
  /** Fecha de una carga anterior del mismo archivo de entradas: responde 409 (BR-INV-15). */
  receiptFileImportedAt?: string
}

export async function mockPricingInventoryApi(page: Page, seed: PricingInventorySeed = {}) {
  const periods: Period[] = (seed.prices ?? []).map((p) => ({
    id: uuid(),
    variantId: p.variantId,
    amount: p.amount,
    compareAtAmount: p.compareAtAmount ?? null,
    effectiveFrom: p.effectiveFrom ?? '2026-09-01T06:00:00.000Z',
  }))
  const stock: Stock[] = (seed.stock ?? []).map((s) => ({
    id: uuid(),
    reserved: 0,
    warehouseId: WAREHOUSE_ID,
    location: null,
    ...s,
  }))
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
  const newWarehouse = (w: Record<string, unknown>): Record<string, unknown> => ({
    id: uuid(),
    address: null,
    status: 'ACTIVE',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...w,
  })
  const warehouses = [
    newWarehouse({ id: WAREHOUSE_ID, code: 'PRINCIPAL', name: 'Almacén principal', priority: 1 }),
    ...(seed.warehouses ?? []).map((w) => newWarehouse(w)),
  ]
  const warehouse = warehouses[0]!
  const sortedWarehouses = () =>
    [...warehouses].sort(
      (a, b) =>
        (a.priority as number) - (b.priority as number) ||
        String(a.code).localeCompare(String(b.code)),
    )
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
    available: s.onHand - s.reserved,
    updatedAt: NOW.toISOString(),
  })

  await page.route(`${API}/v1/geo/**`, (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/v1/geo/states')
      return json(route, 200, { data: [{ code: '16', name: 'Michoacán de Ocampo' }] })
    return json(route, 200, { data: [{ code: '16053', name: 'Morelia' }] })
  })

  // ── Traslados y préstamos (API_SPEC §13, ADR-0172 de base-shop), con la hora real del navegador ──
  const transfers: Array<Record<string, unknown> & { lines: Array<Record<string, unknown>> }> = []
  let folio = 0
  const stockAt = (variantId: string, warehouseId: string) => {
    let item = stock.find((s) => s.variantId === variantId && s.warehouseId === warehouseId)
    if (!item) {
      const same = stock.find((s) => s.variantId === variantId)!
      item = { ...same, id: uuid(), onHand: 0, reserved: 0, warehouseId, location: null }
      stock.push(item)
      movements.set(item.id, [])
    }
    return item
  }
  const move = (
    t: Record<string, unknown>,
    lines: Array<{ variantId: string; quantity: number }>,
  ) => {
    for (const l of lines) {
      stockAt(l.variantId, t.fromWarehouseId as string).onHand -= l.quantity
      stockAt(l.variantId, t.toWarehouseId as string).onHand += l.quantity
    }
  }
  const newTransfer = (input: {
    kind: string
    reason: string
    fromWarehouseId: string
    toWarehouseId: string
    lines: Array<{ variantId: string; quantity: number }>
    note?: string | null
    returnBy?: string | null
    loanId?: string | null
    createdAt?: Date
  }) => {
    const created = input.createdAt ?? new Date()
    const t = {
      id: uuid(),
      folio: `${input.kind === 'LOAN' ? 'P' : 'T'}-${String(++folio).padStart(6, '0')}`,
      kind: input.kind,
      reason: input.reason,
      status: input.kind === 'LOAN' ? 'OPEN' : 'COMPLETED',
      fromWarehouseId: input.fromWarehouseId,
      toWarehouseId: input.toWarehouseId,
      note: input.note ?? null,
      lines: input.lines.map((l) => {
        const s = stock.find((x) => x.variantId === l.variantId)!
        return {
          variantId: l.variantId,
          sku: s.sku,
          productTitle: s.productTitle,
          quantity: l.quantity,
          returned: null as number | null,
        }
      }),
      createdBy: '0192a3b4-0000-7000-8000-000000000001',
      createdAt: created.toISOString(),
      cancellableUntil: input.loanId
        ? null
        : new Date(created.getTime() + 10 * 60_000).toISOString(),
      cancelledAt: null,
      cancelledBy: null,
      returnBy: input.returnBy ?? null,
      closedBy: null,
      closedAt: null,
      loanId: input.loanId ?? null,
      returnTransferId: null,
      version: 1,
    }
    transfers.unshift(t)
    return t
  }
  const transferDto = (t: Record<string, unknown>) => {
    const now = Date.now()
    return {
      ...t,
      cancellableUntil:
        ['COMPLETED', 'OPEN'].includes(t.status as string) &&
        t.cancellableUntil &&
        Date.parse(t.cancellableUntil as string) >= now
          ? t.cancellableUntil
          : null,
      overdue: t.status === 'OPEN' && Date.parse(t.returnBy as string) < now,
    }
  }
  for (const loan of seed.loans ?? []) {
    const s = stock.find((x) => x.sku === loan.sku)!
    const createdAt = new Date(Date.now() - 2 * 3600_000)
    const t = newTransfer({
      kind: 'LOAN',
      reason: 'SHOW',
      fromWarehouseId: WAREHOUSE_ID,
      toWarehouseId: warehouses[1]!.id as string,
      lines: [{ variantId: s.variantId, quantity: loan.quantity }],
      returnBy: new Date(Date.now() + loan.minutesLeft * 60_000).toISOString(),
      createdAt,
    })
    move(t, [{ variantId: s.variantId, quantity: loan.quantity }])
  }
  const idempotentTransfers = new Map<string, Record<string, unknown>>()
  function transfersRoute(
    route: Route,
    method: string,
    seg: string[],
    url: URL,
    body: Record<string, unknown> | null,
  ) {
    if (method === 'GET' && seg.length === 2) {
      const q = url.searchParams
      const items = transfers
        .map(transferDto)
        .filter((t) => !q.get('kind') || t.kind === q.get('kind'))
        .filter((t) => !q.get('status') || t.status === q.get('status'))
        .filter(
          (t) =>
            !q.get('warehouseId') ||
            t.fromWarehouseId === q.get('warehouseId') ||
            t.toWarehouseId === q.get('warehouseId'),
        )
        .filter((t) => q.get('overdue') === null || String(t.overdue) === q.get('overdue'))
      return json(route, 200, {
        data: items,
        meta: { page: 1, pageSize: 20, totalItems: items.length, totalPages: items.length ? 1 : 0 },
      })
    }
    if (method === 'POST' && seg.length === 2) {
      const key = route.request().headers()['idempotency-key']
      if (!key) return problem(route, 400, 'validation-error', 'Falta Idempotency-Key')
      if (idempotentTransfers.has(key)) return json(route, 201, idempotentTransfers.get(key))
      const lines = body!.lines as Array<{ variantId: string; quantity: number }>
      for (const l of lines) {
        const from = stockAt(l.variantId, body!.fromWarehouseId as string)
        if (from.onHand - from.reserved < l.quantity)
          return problem(route, 409, 'insufficient-stock', 'Existencias insuficientes', {
            lines: [{ variantId: l.variantId, canFulfill: false }],
          })
      }
      const t = newTransfer(body as Parameters<typeof newTransfer>[0])
      move(t, lines)
      const dto = transferDto(t)
      idempotentTransfers.set(key, dto)
      return json(route, 201, dto)
    }
    const t = transfers.find((x) => x.id === seg[2])
    if (!t) return problem(route, 404, 'not-found', 'No encontrado')
    if (body?.version !== t.version)
      return problem(route, 409, 'version-conflict', 'El recurso cambió')
    if (seg[3] === 'cancel') {
      if (!transferDto(t).cancellableUntil)
        return problem(route, 409, 'invalid-state-transition', 'Transición no permitida', {
          reason: 'cancel-window-closed',
        })
      move({ fromWarehouseId: t.toWarehouseId, toWarehouseId: t.fromWarehouseId }, t.lines as never)
      Object.assign(t, {
        status: 'CANCELLED',
        cancelledAt: new Date().toISOString(),
        cancelledBy: '0192a3b4-0000-7000-8000-000000000001',
        version: (t.version as number) + 1,
      })
      return json(route, 200, transferDto(t))
    }
    if (seg[3] === 'close') {
      const returned = body.lines as Array<{ variantId: string; returned: number }>
      const back = returned
        .filter((r) => r.returned > 0)
        .map((r) => ({ variantId: r.variantId, quantity: r.returned }))
      for (const line of t.lines)
        line.returned = returned.find((r) => r.variantId === line.variantId)?.returned ?? 0
      let returnTransferId: string | null = null
      if (back.length) {
        const r = newTransfer({
          kind: 'TRANSFER',
          reason: 'LOAN_RETURN',
          fromWarehouseId: t.toWarehouseId as string,
          toWarehouseId: t.fromWarehouseId as string,
          lines: back,
          loanId: t.id as string,
        })
        move(r, back)
        returnTransferId = r.id
      }
      Object.assign(t, {
        status: 'CLOSED',
        closedAt: new Date().toISOString(),
        closedBy: '0192a3b4-0000-7000-8000-000000000001',
        returnTransferId,
        version: (t.version as number) + 1,
      })
      return json(route, 200, transferDto(t))
    }
    return problem(route, 404, 'not-found', 'No encontrado')
  }

  // ── Hojas de conteo (API_SPEC §13, ADR-0173 de base-shop) ──
  const counts: Array<Record<string, unknown> & { lines: Array<Record<string, unknown>> }> = []
  const matches = (pattern: string, location: string | null) =>
    location !== null &&
    (pattern.endsWith('*') ? location.startsWith(pattern.slice(0, -1)) : location === pattern)
  const countDto = (c: (typeof counts)[number]) => {
    const blind = !!seed.blindCounts
    const lines = c.lines.map((l) => ({
      ...l,
      expected: blind ? null : l.expected,
      difference:
        blind || l.counted === null ? null : (l.counted as number) - (l.expected as number),
    }))
    return {
      ...c,
      blind,
      lines,
      lineCount: lines.length,
      countedCount: lines.filter((l) => l.counted !== null).length,
    }
  }
  const openCount = (body: Record<string, unknown> | null) => {
    const location = body?.location as string | undefined
    const taken = stock
      .filter((s) => s.warehouseId === body?.warehouseId)
      .filter((s) => !location || matches(location, s.location))
      .sort(
        (a, b) =>
          (a.location ?? '\uffff').localeCompare(b.location ?? '\uffff') ||
          a.sku.localeCompare(b.sku),
      )
    const busy = (seed.busyVariants ?? []).filter((b) =>
      taken.some((s) => s.variantId === b.variantId),
    )
    if (busy.length)
      return { status: 409, type: 'variant-in-open-count', extra: { lines: busy } } as const
    if (taken.length === 0)
      return {
        status: 400,
        type: 'validation-error',
        extra: { errors: [{ field: 'location', code: 'noLines', message: 'Ninguna variante.' }] },
      } as const
    const filter = Object.fromEntries(
      ['location', 'categoryId', 'countClass']
        .filter((k) => body?.[k] !== undefined)
        .map((k) => [k, body![k]]),
    )
    const created = {
      id: uuid(),
      folio: `C-${String(counts.length + 1).padStart(6, '0')}`,
      warehouseId: body?.warehouseId,
      status: 'OPEN',
      filter,
      note: body?.note ?? null,
      version: 1,
      createdAt: NOW.toISOString(),
      createdBy: '0192a3b4-0000-7000-8000-000000000001',
      closedAt: null,
      closedBy: null,
      lines: taken.map((s, i) => ({
        variantId: s.variantId,
        sku: s.sku,
        productTitle: s.productTitle,
        position: i + 1,
        location: s.location,
        counted: null,
        countedBy: null,
        countedAt: null,
        recount: false,
        expected: null,
        outcome: null,
        movementId: null,
      })),
    }
    counts.unshift(created)
    return created
  }
  const countsRoute = (
    route: Route,
    method: string,
    seg: string[],
    url: URL,
    body: Record<string, unknown> | null,
  ) => {
    if (seg.length === 2 && method === 'GET') {
      const status = url.searchParams.get('status')
      const warehouseId = url.searchParams.get('warehouseId')
      const data = counts
        .filter(
          (c) =>
            (!status || c.status === status) && (!warehouseId || c.warehouseId === warehouseId),
        )
        .map((c) => {
          const { lines: _lines, blind: _blind, ...summary } = countDto(c)
          return summary
        })
      return json(route, 200, {
        data,
        meta: { page: 1, pageSize: 20, totalItems: data.length, totalPages: data.length ? 1 : 0 },
      })
    }
    if (seg.length === 2 && method === 'POST') {
      const created = openCount(body)
      if ('type' in created)
        return problem(route, created.status, created.type, 'No se pudo abrir', created.extra)
      return json(route, 201, countDto(created))
    }
    const count = counts.find((c) => c.id === seg[2])
    if (!count) return problem(route, 404, 'not-found', 'No encontrado')
    if (seg.length === 3) return json(route, 200, countDto(count))
    const open = count.status === 'OPEN'
    if (!open) return problem(route, 409, 'invalid-state-transition', 'Transición no permitida')
    const versioned = seg[3] !== 'lines' || seg[5] === 'recount'
    if (versioned && body?.version !== count.version)
      return problem(route, 409, 'version-conflict', 'Otro usuario lo cambió')
    count.version = (count.version as number) + 1
    if (seg[3] === 'lines' && method === 'PUT') {
      let line = count.lines.find((l) => l.variantId === seg[4])
      const item = stock.find((s) => s.variantId === seg[4] && s.warehouseId === count.warehouseId)
      if (!line) {
        const same = stock.find((s) => s.variantId === seg[4])
        line = {
          variantId: seg[4],
          sku: same?.sku ?? 'NUEVO',
          productTitle: same?.productTitle ?? 'Producto',
          position: count.lines.length + 1,
          location: item?.location ?? null,
          recount: false,
          outcome: null,
          movementId: null,
        }
        count.lines.push(line)
      }
      Object.assign(line, {
        counted: body?.counted,
        expected: item?.onHand ?? 0,
        countedBy: '0192a3b4-0000-7000-8000-000000000001',
        countedAt: NOW.toISOString(),
        recount: false,
      })
      return json(
        route,
        200,
        countDto(count).lines.find((l) => l.variantId === seg[4]),
      )
    }
    if (seg[5] === 'recount') {
      const line = count.lines.find((l) => l.variantId === seg[4])!
      Object.assign(line, {
        counted: null,
        expected: null,
        countedBy: null,
        countedAt: null,
        recount: true,
      })
      return json(route, 200, countDto(count))
    }
    if (seg[3] === 'apply') {
      if (!route.request().headers()['idempotency-key'])
        return problem(route, 400, 'validation-error', 'Falta Idempotency-Key')
      for (const line of count.lines) {
        if (line.counted === null) {
          line.outcome = 'NOT_COUNTED'
          continue
        }
        const item = stock.find(
          (s) => s.variantId === line.variantId && s.warehouseId === count.warehouseId,
        )!
        const difference = (line.counted as number) - (line.expected as number)
        if (difference === 0) line.outcome = 'NO_DIFFERENCE'
        else if (item.onHand + difference < item.reserved) line.outcome = 'SKIPPED_RESERVED'
        else {
          item.onHand += difference
          line.outcome = 'ADJUSTED'
          line.movementId = uuid()
        }
      }
      Object.assign(count, { status: 'APPLIED', closedAt: NOW.toISOString() })
      return json(route, 200, countDto(count))
    }
    if (seg[3] === 'cancel') {
      for (const line of count.lines) line.outcome = 'NOT_COUNTED'
      Object.assign(count, { status: 'CANCELLED', closedAt: NOW.toISOString() })
      return json(route, 200, countDto(count))
    }
    return problem(route, 404, 'not-found', 'No encontrado')
  }

  for (const c of seed.openCounts ?? [])
    openCount({ warehouseId: WAREHOUSE_ID, location: c.location })

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
      if (seg[1] === 'receipt-imports' && method === 'POST') {
        if (seed.receiptFileImportedAt)
          return problem(route, 409, 'duplicate-value', 'El valor ya existe', {
            field: 'file',
            importedAt: seed.receiptFileImportedAt,
          })
        return json(route, 200, {
          rows: 2,
          units: 45,
          dryRun: url.searchParams.get('dryRun') === 'true',
        })
      }
      if (seg[1] === 'warehouses') {
        if (method === 'GET') return json(route, 200, { data: sortedWarehouses() })
        const address = body?.address as Record<string, unknown> | null | undefined
        const withNames = (a: Record<string, unknown> | null | undefined) =>
          a && {
            ...a,
            stateName: 'Michoacán de Ocampo',
            municipalityName: 'Morelia',
            country: 'MX',
          }
        if (method === 'POST' && !seg[2]) {
          if (warehouses.some((w) => w.code === body?.code))
            return problem(route, 409, 'duplicate-value', 'Valor duplicado', { field: 'code' })
          const created = newWarehouse({
            code: body?.code,
            name: body?.name,
            priority: body?.priority,
            address: withNames(address) ?? null,
          })
          warehouses.push(created)
          return json(route, 201, created)
        }
        const target = warehouses.find((w) => w.id === seg[2])
        if (!target) return problem(route, 404, 'not-found', 'No encontrado')
        if (seg[3] === 'deactivate') {
          if (stock.some((s) => s.warehouseId === target.id && s.reserved > 0))
            return problem(route, 409, 'resource-in-use', 'El almacén tiene unidades apartadas')
          if (warehouses.filter((w) => w.status === 'ACTIVE').length <= 1)
            return problem(route, 409, 'invalid-state-transition', 'Transición no permitida', {
              reason: 'last-active-warehouse',
            })
          target.status = 'INACTIVE'
          return json(route, 200, target)
        }
        Object.assign(target, {
          ...(body?.name !== undefined && { name: body.name }),
          ...(body?.priority !== undefined && { priority: body.priority }),
          ...(address !== undefined && { address: withNames(address) }),
        })
        return json(route, 200, target)
      }
      if (seg[1] === 'stock-items' && seg.length === 2) {
        const q = url.searchParams.get('q')?.toLowerCase()
        const max = url.searchParams.get('availableMax')
        const variantId = url.searchParams.get('variantId')
        const warehouseId = url.searchParams.get('warehouseId')
        const location = url.searchParams.get('location')
        const hasLocation = url.searchParams.get('hasLocation')
        const items = stock
          .filter((s) => !warehouseId || s.warehouseId === warehouseId)
          .filter((s) => !location || matches(location, s.location))
          .filter((s) => hasLocation === null || (s.location !== null) === (hasLocation === 'true'))
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
        const target = warehouses.find((w) => w.id === body?.warehouseId)
        // Entradas solo en almacenes activos; ajustes en cualquiera (API_SPEC §13, ADR-0160).
        if (!target || (seg[1] === 'receipts' && target.status !== 'ACTIVE'))
          return problem(route, 404, 'not-found', 'No encontrado')
        let item = stock.find((s) => s.variantId === body.variantId && s.warehouseId === target.id)
        const quantity = body.quantity as number
        if (seg[1] === 'adjustments' && !item && quantity < 0)
          return problem(route, 409, 'insufficient-stock', 'Existencias insuficientes', {
            lines: [{ variantId: body.variantId, canFulfill: false }],
          })
        if (seg[1] === 'adjustments' && item && item.onHand + quantity < item.reserved)
          return problem(route, 409, 'insufficient-stock', 'Existencias insuficientes', {
            lines: [{ variantId: body.variantId, canFulfill: false }],
          })
        if (!item) {
          const same = stock.find((s) => s.variantId === body.variantId)
          item = {
            id: uuid(),
            variantId: body.variantId as string,
            sku: same?.sku ?? 'NUEVO',
            productTitle: same?.productTitle ?? 'Producto',
            onHand: 0,
            reserved: 0,
            warehouseId: target.id as string,
            location: null,
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
      if (seg[1] === 'transfers') return transfersRoute(route, method, seg, url, body)
      if (seg[1] === 'counts') return countsRoute(route, method, seg, url, body)
      if (seg[1] === 'locations' && method === 'PUT') {
        const item = stockAt(body?.variantId as string, body?.warehouseId as string)
        const text = body?.location as string | null
        item.location = text === null ? null : text.trim().replace(/\s+/g, ' ').toUpperCase()
        return json(route, 200, stockDto(item))
      }
    }
    return problem(route, 404, 'not-found', 'No encontrado')
  })

  return { calls, periods, stock, warehouse, warehouses, transfers, counts }
}
