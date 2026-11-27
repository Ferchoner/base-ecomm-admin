import type { Page, Route } from '@playwright/test'
import { API, json } from './mock-api'

export const LOCAL_204 = '0192a3b4-0000-7000-8000-000000000204'
export const LOCAL_206 = '0192a3b4-0000-7000-8000-000000000206'
const OWN_ID = '0192a3b4-0000-7000-8000-000000000001'
const NOW = '2026-11-07T20:00:00.000Z'
const money = (amount: number) => ({ amount, currency: 'MXN' })

const cors = (route: Route) =>
  route.fulfill({
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST',
    },
  })

/** Cifras del día de un local (API_SPEC §15.9): el 204 cobró $3,525 en efectivo y $800 con terminal. */
function day(warehouseId: string) {
  const cash = warehouseId === LOCAL_204 ? 352_500 : 0
  return {
    placedCount: warehouseId === LOCAL_204 ? 5 : 0,
    placedAmount: money(warehouseId === LOCAL_204 ? 432_500 : 0),
    pendingPaymentCount: 0,
    cancelledCount: 0,
    payments: [
      { method: 'CASH', count: cash ? 4 : 0, amount: money(cash) },
      { method: 'CARD_TERMINAL', count: cash ? 1 : 0, amount: money(cash ? 80_000 : 0) },
      { method: 'TRANSFER', count: 0, amount: money(0) },
      { method: null, count: 0, amount: money(0) },
    ],
    paymentAmount: money(cash ? 432_500 : 0),
    refundCount: 0,
    refundAmount: money(0),
    cashRefundAmount: money(0),
    expectedCash: money(cash),
    byStaff: cash
      ? [
          {
            staffId: OWN_ID,
            paymentCount: 5,
            paymentAmount: money(432_500),
            cashAmount: money(cash),
            refundAmount: money(0),
          },
        ]
      : [],
    openPriceLineCount: cash ? 1 : 0,
    openPriceAmount: money(cash ? 34_950 : 0),
  }
}

/** El corte de caja de dos locales (API_SPEC §15.9), con sus cierres en memoria. */
/** `openLoans`: préstamos para mostrar sin cerrar que tocan cada local (ADR-0172 de base-shop). */
export async function mockCashClosingsApi(
  page: Page,
  options: { openLoans?: Record<string, number> } = {},
) {
  const closings: Array<Record<string, unknown>> = []
  const calls: Array<{ method: string; path: string; query: string; body: unknown }> = []

  // Solo el conteo: el corte pide `pageSize=1` y lee `meta.totalItems`.
  await page.route(`${API}/v1/admin/inventory/transfers**`, (route) => {
    if (route.request().method() === 'OPTIONS') return cors(route)
    const url = new URL(route.request().url())
    calls.push({ method: 'GET', path: url.pathname, query: url.search, body: null })
    const open =
      url.searchParams.get('kind') === 'LOAN' && url.searchParams.get('status') === 'OPEN'
        ? (options.openLoans?.[url.searchParams.get('warehouseId') ?? ''] ?? 0)
        : 0
    return json(route, 200, {
      data: [],
      meta: { page: 1, pageSize: 1, totalItems: open, totalPages: open },
    })
  })

  await page.route(`${API}/v1/admin/inventory/warehouses**`, (route) =>
    route.request().method() === 'OPTIONS'
      ? cors(route)
      : json(route, 200, {
          data: [LOCAL_204, LOCAL_206].map((id, i) => ({
            id,
            code: i === 0 ? 'L204' : 'L206',
            name: i === 0 ? 'Local 204' : 'Local 206',
            priority: i + 1,
            status: 'ACTIVE',
            address: null,
            createdAt: NOW,
            updatedAt: NOW,
          })),
        }),
  )

  await page.route(`${API}/v1/admin/cash-closings**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return cors(route)
    const url = new URL(request.url())
    const body = request.method() === 'POST' ? request.postDataJSON() : null
    calls.push({ method: request.method(), path: url.pathname, query: url.search, body })
    if (url.pathname.endsWith('/summary')) {
      const warehouseId = url.searchParams.get('warehouseId')!
      const date = url.searchParams.get('date')!
      const closing = closings.find((c) => c.warehouseId === warehouseId && c.date === date) ?? null
      return json(route, 200, {
        ...day(warehouseId),
        warehouseId,
        date,
        from: `${date}T06:00:00.000Z`,
        to: `${date}T06:00:00.000Z`,
        closing,
        afterClosing: closing
          ? {
              paymentCount: 0,
              paymentAmount: money(0),
              cashAmount: money(0),
              refundCount: 0,
              refundAmount: money(0),
              cashRefundAmount: money(0),
            }
          : null,
      })
    }
    if (request.method() === 'POST') {
      const input = body as {
        warehouseId: string
        date: string
        countedCash: number
        note?: string
      }
      const expected = day(input.warehouseId).expectedCash.amount
      const closing = {
        id: `0192a3b4-0000-7000-8000-00000000c${String(closings.length + 1).padStart(3, '0')}`,
        warehouseId: input.warehouseId,
        date: input.date,
        expectedCash: money(expected),
        countedCash: money(input.countedCash),
        difference: money(input.countedCash - expected),
        note: input.note ?? null,
        summary: day(input.warehouseId),
        closedBy: OWN_ID,
        closedAt: NOW,
      }
      closings.push(closing)
      return json(route, 201, closing)
    }
    const warehouseId = url.searchParams.get('warehouseId')
    const data = closings.filter((c) => !warehouseId || c.warehouseId === warehouseId)
    return json(route, 200, {
      data,
      meta: { page: 1, pageSize: 31, totalItems: data.length, totalPages: data.length ? 1 : 0 },
    })
  })

  return { calls, closings }
}
