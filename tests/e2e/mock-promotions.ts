import type { Page, Route } from '@playwright/test'
import { API, json } from './mock-api'

/** Promociones en memoria, con las formas de openapi/v1.json (API_SPEC §26). */
const NOW = '2026-10-17T12:00:00.000Z'
let next = 1
const uuid = () => `0192a3b4-0000-7000-8000-${String(900000 + next++).padStart(12, '0')}`
const money = (amount: number) => ({ amount, currency: 'MXN' })

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

export interface PromotionSeed {
  name: string
  status?: 'SCHEDULED' | 'ACTIVE' | 'ENDED'
  percentage?: number | null
  code?: string | null
  usageLimit?: number | null
  uses?: number
}

export async function mockPromotionsApi(page: Page, seed: PromotionSeed[] = []) {
  const make = (s: PromotionSeed) => ({
    id: uuid(),
    name: s.name,
    status: s.status ?? 'ACTIVE',
    percentage: s.percentage === undefined ? 10 : s.percentage,
    amountOff: null as { amount: number; currency: string } | null,
    targetCount: 0,
    channels: ['ONLINE', 'STORE'],
    minimumSubtotal: null as { amount: number; currency: string } | null,
    startsAt: '2026-10-01T06:00:00.000Z',
    endsAt: null as string | null,
    endedAt: null as string | null,
    code: s.code ?? null,
    usageLimit: s.usageLimit ?? null,
    oncePerCustomer: false,
    uses: s.uses ?? 0,
    targets: [] as Array<{ type: string; id: string; name: string | null }>,
    endedBy: null as string | null,
    createdBy: 'staff-1',
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  })
  const promotions = seed.map(make)
  const calls: Array<{ method: string; path: string; body: Record<string, unknown> | null }> = []
  const summary = ({
    targets: _t,
    endedBy: _e,
    createdBy: _c,
    createdAt: _a,
    updatedAt: _u,
    version: _v,
    ...rest
  }: (typeof promotions)[number]) => rest

  function apply(p: (typeof promotions)[number], body: Record<string, unknown>) {
    if ('percentage' in body) Object.assign(p, { percentage: body.percentage, amountOff: null })
    if ('amountOff' in body)
      Object.assign(p, { amountOff: money(Number(body.amountOff)), percentage: null })
    if ('minimumSubtotal' in body)
      p.minimumSubtotal = body.minimumSubtotal === null ? null : money(Number(body.minimumSubtotal))
    for (const k of [
      'name',
      'channels',
      'startsAt',
      'endsAt',
      'usageLimit',
      'oncePerCustomer',
    ] as const)
      if (k in body) Object.assign(p, { [k]: body[k] })
    if ('code' in body) p.code = body.code ? String(body.code).toUpperCase() : null
    if (Array.isArray(body.targets)) {
      p.targets = (body.targets as Array<{ type: string; id: string }>).map((t) => ({
        ...t,
        name: `Destino ${t.id.slice(-4)}`,
      }))
      p.targetCount = p.targets.length
    }
  }

  await page.route(`${API}/v1/admin/promotions**`, async (route) => {
    const request = route.request()
    const method = request.method()
    if (method === 'OPTIONS') return route.fallback()
    const url = new URL(request.url())
    const path = url.pathname.replace('/v1/admin/promotions', '')
    const body = (request.postDataJSON() ?? null) as Record<string, unknown> | null
    calls.push({ method, path, body })
    const seg = path.split('/').filter(Boolean)

    if (seg.length === 0 && method === 'GET') {
      const q = url.searchParams.get('q')?.toLowerCase()
      const kind = url.searchParams.get('kind')
      const items = promotions
        .filter((p) => !q || p.name.toLowerCase().includes(q) || p.code?.toLowerCase() === q)
        .filter((p) => !kind || (kind === 'COUPON' ? !!p.code : !p.code))
      return json(route, 200, {
        data: items.map(summary),
        meta: { page: 1, pageSize: 20, totalItems: items.length, totalPages: 1 },
      })
    }
    if (seg.length === 0 && method === 'POST') {
      const code = body?.code ? String(body.code).toUpperCase() : null
      if (code && promotions.some((p) => p.code === code))
        return problem(route, 409, 'duplicate-value', { field: 'code' })
      const p = { ...make({ name: '', percentage: null }), startsAt: NOW }
      apply(p, body ?? {})
      promotions.unshift(p)
      return json(route, 201, p)
    }
    const p = promotions.find((x) => x.id === seg[0])
    if (!p) return problem(route, 404, 'not-found')
    if (seg.length === 1 && method === 'GET') return json(route, 200, p)
    if (body?.version !== p.version)
      return problem(route, 409, 'version-conflict', { currentVersion: p.version })
    if (seg.length === 1 && method === 'PATCH') {
      const { version: _v, ...changes } = body
      apply(p, changes)
      p.version++
      return json(route, 200, p)
    }
    if (seg[1] === 'end') {
      if (p.status === 'ENDED') return problem(route, 409, 'invalid-state-transition')
      Object.assign(p, { status: 'ENDED', endedAt: NOW, endedBy: 'staff-1' })
      p.version++
      return json(route, 200, p)
    }
    return problem(route, 404, 'not-found')
  })
  return { promotions, calls }
}
