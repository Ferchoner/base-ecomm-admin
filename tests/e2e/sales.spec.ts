import { expect, test } from '@playwright/test'
import { login, mockAuthApi, staff } from './mock-api'
import { mockSalesApi } from './mock-sales'

const ALL = [
  'orders.read',
  'orders.manage',
  'orders.read-blocked',
  'payments.manage',
  'inventory.write',
  'shipping.manage',
]

test('pedidos: filtrar, abrir y registrar el pago en tienda', async ({ page }) => {
  await mockAuthApi(page, staff(ALL))
  const api = await mockSalesApi(page, {
    orders: [
      { code: 'K7M4-Q9XA', status: 'PENDING_PAYMENT', email: 'maria@example.com' },
      { code: 'B2C3-D4E5', status: 'DELIVERED', customer: true },
    ],
  })
  await login(page)
  await page.goto('/pedidos')
  await expect(page.getByRole('row', { name: /K7M4-Q9XA/ })).toContainText('Por cobrar')

  await page.getByLabel('Buscar pedidos').fill('k7m4q9xa')
  await expect(page).toHaveURL(/q=k7m4q9xa/)
  await expect(page.getByRole('row', { name: /B2C3-D4E5/ })).toHaveCount(0)

  await page.getByRole('link', { name: 'K7M4-Q9XA' }).click()
  await expect(page.getByRole('heading', { name: 'Pedido K7M4-Q9XA' })).toBeVisible()
  await expect(page.getByText('maria@example.com')).toBeVisible()
  await expect(page.getByText('El comprador todavía no inicia el pago.')).toBeVisible()

  await page.getByRole('button', { name: 'Registrar pago' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Registrar pago' }).click()
  await expect(dialog.getByText('Escribe el comprobante de la tienda.')).toBeVisible()
  await dialog.getByLabel('Comprobante').fill('Ticket 00452')
  await dialog.getByRole('button', { name: 'Registrar pago' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Pago registrado', { exact: true })).toBeVisible()
  expect(api.calls.find((c) => c.path.endsWith('/manual-capture'))?.body).toEqual({
    reference: 'Ticket 00452',
  })

  // La orden pasa a PAID en segundo plano; la pantalla vuelve a consultarla (API_SPEC §2.5).
  const header = page.locator('header').filter({ hasText: 'Pedido K7M4-Q9XA' })
  await expect(header.getByText('Pagado', { exact: true })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Por despachar', { exact: true })).toBeVisible()
})

test('pedidos: si el pago manual está deshabilitado se explica el 403 (G-02)', async ({ page }) => {
  await mockAuthApi(page, staff(ALL))
  const api = await mockSalesApi(page, {
    orders: [{ code: 'K7M4-Q9XA', status: 'PENDING_PAYMENT' }],
    manualPaymentsDisabled: true,
  })
  await login(page)
  await page.goto(`/pedidos/${api.orders[0]!.id}`)
  await page.getByRole('button', { name: 'Registrar pago' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Comprobante').fill('Ticket 1')
  await dialog.getByRole('button', { name: 'Registrar pago' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Un superadministrador debe activarlo.')
})

test('pedidos: cancelar uno pagado inicia el reembolso y puede reintegrar', async ({ page }) => {
  await mockAuthApi(page, staff(ALL))
  const api = await mockSalesApi(page, {
    orders: [
      {
        code: 'K7M4-Q9XA',
        status: 'PAID',
        payment: { status: 'CAPTURED' },
        shipment: { status: 'PENDING' },
      },
    ],
  })
  await login(page)
  await page.goto(`/pedidos/${api.orders[0]!.id}`)
  await page.getByRole('button', { name: 'Cancelar pedido' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Se inicia el reembolso total')).toBeVisible()
  await dialog.getByLabel('Motivo').fill('Cliente se arrepintió')
  await dialog.getByLabel('Reintegrar todas las unidades al inventario').check()
  await dialog.getByRole('button', { name: 'Cancelar pedido' }).click()
  await expect(dialog).toBeHidden()
  expect(api.calls.find((c) => c.path.endsWith('/cancel'))?.body).toEqual({
    reason: 'Cliente se arrepintió',
    restock: true,
    version: 3,
  })
  await expect(page.getByText('Reembolso pendiente', { exact: true })).toBeVisible()
  await expect(page.getByText('Cliente se arrepintió')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancelar pedido' })).toHaveCount(0)
})

test('pagos: registrar el reembolso manual de un pedido cancelado', async ({ page }) => {
  await mockAuthApi(page, staff(ALL))
  const api = await mockSalesApi(page, {
    orders: [
      {
        code: 'K7M4-Q9XA',
        status: 'CANCELLED',
        payment: { status: 'CAPTURED', refund: 'PENDING' },
      },
    ],
  })
  await login(page)
  await page.goto('/pagos')
  await page.getByRole('link', { name: 'K7M4-Q9XA' }).click()
  await expect(page.getByText('Reembolso pendiente', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Registrar reembolso' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Comprobante').fill('Devolución 77')
  await dialog.getByRole('button', { name: 'Registrar reembolso' }).click()
  await expect(dialog).toBeHidden()
  expect(api.calls.find((c) => c.path.endsWith('/refunds/manual'))?.body).toEqual({
    reference: 'Devolución 77',
    version: 2,
  })
  await expect(page.getByText('Reembolso completado', { exact: true })).toBeVisible()
  await expect(page.getByText('Comprobante: Devolución 77')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Registrar reembolso' })).toHaveCount(0)
})

test('envíos: capturar la guía, despachar y entregar', async ({ page }) => {
  await mockAuthApi(page, staff(['shipping.manage', 'orders.read']))
  const api = await mockSalesApi(page, {
    orders: [
      {
        code: 'K7M4-Q9XA',
        status: 'PAID',
        payment: { status: 'CAPTURED' },
        shipment: { status: 'PENDING' },
      },
      { code: 'B2C3-D4E5', status: 'DELIVERED', shipment: { status: 'DELIVERED' } },
    ],
  })
  await login(page)
  await page.goto('/envios')
  // Por defecto, solo los pendientes (UC-SHI-08).
  await expect(page.getByRole('row', { name: /K7M4-Q9XA/ })).toContainText('Sin guía')
  await expect(page.getByRole('row', { name: /B2C3-D4E5/ })).toHaveCount(0)

  await page.getByRole('link', { name: 'K7M4-Q9XA' }).click()
  await page.getByRole('button', { name: 'Despachar' }).click()
  let dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Primero captura la paquetería y la guía.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancelar' }).click()

  await page.getByRole('button', { name: 'Capturar guía' }).click()
  await page.getByLabel('Paquetería').fill('Estafeta')
  await page.getByLabel('Número de guía').fill('EST123456')
  await page.getByRole('button', { name: 'Guardar guía' }).click()
  await expect(page.getByText('EST123456')).toBeVisible()
  expect(api.calls.find((c) => c.method === 'PATCH')?.body).toEqual({
    carrierName: 'Estafeta',
    trackingNumber: 'EST123456',
    version: 1,
  })

  await page.getByRole('button', { name: 'Despachar' }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Despachar' }).click()
  await expect(dialog).toBeHidden()
  expect(api.calls.find((c) => c.path.endsWith('/dispatch'))?.body).toEqual({
    ownDelivery: false,
    version: 2,
  })
  await expect(page.getByText('En camino', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Marcar entregado' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Marcar entregado' }).click()
  await expect(page.locator('header').getByText('Entregado', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Marcar entregado' })).toHaveCount(0)
})

test('pedidos: reintegrar stock con llave de idempotencia y límite de lo vendido', async ({
  page,
}) => {
  await mockAuthApi(page, staff(ALL))
  const api = await mockSalesApi(page, {
    orders: [
      {
        code: 'K7M4-Q9XA',
        status: 'CANCELLED',
        payment: { status: 'REFUNDED', refund: 'COMPLETED' },
        lines: [{ sku: 'CAM-M', quantity: 2, unit: 59900 }],
      },
    ],
  })
  api.orders[0]!.restocked[api.orders[0]!.lines[0]!.id] = 1
  await login(page)
  await page.goto(`/pedidos/${api.orders[0]!.id}`)
  await page.getByRole('button', { name: 'Reintegrar stock' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Todas las unidades vendidas' }).click()
  await dialog.getByRole('button', { name: 'Reintegrar' }).click()
  // Ya se había reintegrado una: la API responde 409 con lo vendido y lo reintegrado.
  await expect(dialog.getByRole('alert')).toContainText(
    'CAM-M: vendidas 2, ya reintegradas 1, pedidas 2.',
  )
  const first = api.calls.find((c) => c.path.endsWith('/restocks'))!
  expect(first.headers['idempotency-key']).toBeTruthy()
  expect(first.body).toEqual({
    reasonCode: 'ORDER_CANCELLED',
    lines: [{ orderLineId: api.orders[0]!.lines[0]!.id, quantity: 2 }],
  })

  await dialog.getByLabel('Unidades de CAM-M').fill('1')
  await dialog.getByRole('button', { name: 'Reintegrar' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('1 unidades volvieron al inventario.', { exact: true })).toBeVisible()
  const second = api.calls.filter((c) => c.path.endsWith('/restocks'))[1]!
  expect(second.headers['idempotency-key']).not.toBe(first.headers['idempotency-key'])
})

test('pedidos: los datos bloqueados se ven solo con motivo', async ({ page }) => {
  await mockAuthApi(page, staff(['orders.read', 'orders.read-blocked']))
  const api = await mockSalesApi(page, {
    orders: [{ code: 'K7M4-Q9XA', status: 'DELIVERED', email: 'maria@example.com', blocked: true }],
  })
  await login(page)
  await page.goto('/pedidos')
  await expect(page.getByRole('row', { name: /K7M4-Q9XA/ })).toContainText('Datos bloqueados')
  await page.goto(`/pedidos/${api.orders[0]!.id}`)
  await expect(page.getByText('maria@example.com')).toHaveCount(0)
  await page.getByRole('button', { name: 'Ver datos bloqueados' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Motivo').fill('Reclamación 2026-118')
  await dialog.getByRole('button', { name: 'Ver datos' }).click()
  await expect(dialog.getByText('maria@example.com')).toBeVisible()
  expect(api.calls.find((c) => c.path.endsWith('/blocked-data'))?.body).toEqual({
    reason: 'Reclamación 2026-118',
  })
  await dialog.getByRole('button', { name: 'Cerrar' }).first().click()
  await expect(page.getByText('maria@example.com')).toHaveCount(0)
})

test('pedidos: una venta de mostrador sin datos del comprador se muestra completa', async ({
  page,
}) => {
  await mockAuthApi(page, staff(ALL))
  const api = await mockSalesApi(page, {
    orders: [
      { code: 'K7M4-Q9XA', status: 'PENDING_PAYMENT' },
      {
        code: 'S7T8-U9V0',
        status: 'PAID',
        payment: { status: 'CAPTURED' },
        store: { fulfillment: 'IN_STORE', anonymousBuyer: true },
      },
    ],
  })
  await login(page)
  await page.goto('/pedidos')
  await page.getByLabel('Filtrar por canal').click()
  await page.getByRole('option', { name: 'En tienda' }).click()
  await expect(page).toHaveURL(/channel=STORE/)
  const row = page.getByRole('row', { name: /S7T8-U9V0/ })
  await expect(row).toContainText('Sin datos')
  await expect(page.getByRole('row', { name: /K7M4-Q9XA/ })).toHaveCount(0)

  await page.getByRole('link', { name: 'S7T8-U9V0' }).click()
  await expect(page.getByRole('heading', { name: 'Pedido S7T8-U9V0' })).toBeVisible()
  await expect(page.getByText('Venta de mostrador: el comprador no dio sus datos.')).toBeVisible()
  await expect(page.getByText('Se entrega en la tienda al pagarse')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Envío', exact: true })).toHaveCount(0)
  await expect(page.getByText('Colocado por')).toBeVisible()
  await expect(page.getByText('Tú', { exact: true })).toBeVisible()
  expect(api.calls.some((c) => c.query.includes('channel=STORE'))).toBe(true)
})
