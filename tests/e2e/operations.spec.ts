import { expect, test } from '@playwright/test'
import { login, mockAuthApi, staff } from './mock-api'
import { mockOperationsApi } from './mock-operations'

test('método de envío: solo lectura sin permiso de configurar', async ({ page }) => {
  await mockAuthApi(page, staff(['shipping.manage']))
  await mockOperationsApi(page)
  await login(page)
  await page.goto('/configuracion/envio')
  await expect(page.getByText('Solo lectura')).toBeVisible()
  await expect(page.getByLabel('Costo de envío')).toHaveValue('99')
  await expect(page.getByLabel('Costo de envío')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Guardar' })).toHaveCount(0)
})

test('método de envío: configurar costo, envío gratis y plazo', async ({ page }) => {
  await mockAuthApi(page, staff(['shipping.manage', 'shipping.configure']))
  const api = await mockOperationsApi(page)
  await login(page)
  await page.getByRole('link', { name: 'Método de envío' }).first().click()

  await page.getByLabel('Costo de envío').fill('129.5')
  await page.getByRole('switch', { name: 'Envío gratis a partir de un monto' }).click()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Escribe el monto para el envío gratis.')).toBeVisible()
  await page.getByLabel('Monto para envío gratis').fill('1500')

  const max = page.getByRole('spinbutton', { name: 'Máximo' })
  await max.fill('2')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('No puede ser menor que el mínimo.')).toBeVisible()
  await max.fill('8')
  // El número se confirma al salir del campo; el aviso desaparece y el botón sube.
  await max.press('Tab')
  await expect(page.getByText('No puede ser menor que el mínimo.')).toBeHidden()

  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Método de envío guardado', { exact: true })).toBeVisible()
  expect(api.calls.find((c) => c.method === 'PUT')?.body).toEqual({
    name: 'Envío Estándar',
    flatFee: 12950,
    freeShippingThreshold: 150000,
    deliveryMinBusinessDays: 3,
    deliveryMaxBusinessDays: 8,
    version: 1,
  })

  // Otro usuario lo cambió: el 409 recarga los datos y no se reenvía solo.
  api.method.version = 5
  api.method.name = 'Envío Nacional'
  await page.getByLabel('Nombre').fill('Envío Express')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Otro usuario modificó este registro', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Nombre')).toHaveValue('Envío Nacional')
  expect(api.calls.filter((c) => c.method === 'PUT')).toHaveLength(2)
})

test('eventos: ver una entrega fallida y reintentarla', async ({ page }) => {
  await mockAuthApi(page, staff(['events.manage']))
  const api = await mockOperationsApi(page)
  await login(page)
  await page.goto('/operacion/eventos')

  const rows = page.getByRole('row', { name: /OrderPaid|PaymentCaptured/ })
  await expect(rows).toHaveCount(2)
  await page.getByRole('button', { name: 'OrderPaid' }).first().click()
  const detail = page.getByRole('dialog')
  await expect(detail.getByLabel('Último error')).toHaveText(
    'EmailDeliveryError: connection refused',
  )
  await expect(detail.getByLabel('Contenido del evento')).toContainText('"orderId"')
  await expect(detail.getByText('Sin reintentos automáticos')).toBeVisible()
  await detail.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByText('Entrega reactivada', { exact: true })).toBeVisible()
  await expect(detail).toBeHidden()
  await expect(rows).toHaveCount(1)
  expect(
    api.calls.some((c) => c.method === 'POST' && c.path.endsWith(`${api.deliveries[0]!.id}/retry`)),
  ).toBe(true)

  await page.getByLabel('Filtrar por estado').click()
  await page.getByRole('option', { name: 'Todos los estados' }).click()
  await expect(page).toHaveURL(/status=ALL/)
  await expect(rows).toHaveCount(3)
  await expect(page.getByRole('row', { name: /PaymentCaptured/ })).toContainText('Entregada')
})

test('eventos: reintentar las fallidas de un tipo de evento', async ({ page }) => {
  await mockAuthApi(page, staff(['events.manage']))
  const api = await mockOperationsApi(page)
  await login(page)
  await page.goto('/operacion/eventos')

  await page.getByLabel('Filtrar por tipo de evento').fill('OrderPaid')
  await expect(page).toHaveURL(/eventType=OrderPaid/)
  await page.getByRole('button', { name: 'Reintentar fallidas' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('las fallidas del evento OrderPaid')
  await dialog.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByText('Se reactivaron 2 entregas', { exact: true })).toBeVisible()
  expect(api.calls.find((c) => c.path.endsWith('/event-deliveries/retry'))?.body).toEqual({
    eventType: 'OrderPaid',
  })
  await expect(page.getByText('No hay entregas fallidas')).toBeVisible()
})

test('auditoría: cargar más, ver cambios y filtrar por recurso', async ({ page }) => {
  await mockAuthApi(page, staff(['audit.read']))
  const api = await mockOperationsApi(page, { auditEntries: 3 })
  await login(page)
  await page.goto('/auditoria')

  const entries = page.getByRole('list', { name: 'Registros' }).getByRole('listitem')
  await expect(entries).toHaveCount(2)
  await page.getByRole('button', { name: 'Cargar más' }).click()
  await expect(entries).toHaveCount(3)
  expect(api.calls.some((c) => c.path === '/v1/admin/audit' && c.query.includes('cursor=2'))).toBe(
    true,
  )

  await page.getByLabel('Filtrar por acción').fill('orders*')
  await expect(page.getByText('Escribe un código exacto')).toBeVisible()
  await page.getByLabel('Filtrar por acción').fill('orders.*')
  await expect(page).toHaveURL(/action=orders\.\*/)
  await expect(entries).toHaveCount(1)

  await entries.first().getByRole('button').click()
  const detail = page.getByRole('dialog')
  await expect(detail.getByText('El cliente lo pidió por teléfono')).toBeVisible()
  await expect(detail.getByRole('row', { name: /status/ })).toContainText('PAID')
  await expect(detail.getByRole('row', { name: /email/ })).toContainText('dato personal o sensible')
  await detail.getByRole('button', { name: 'Ver el historial de este recurso' }).click()
  await expect(page).toHaveURL(/resourceType=order/)
  await expect(page).not.toHaveURL(/action=/)
  await expect(page.getByLabel('Filtrar por ID del recurso')).toHaveValue(/0192a3b4/)
  await expect(entries).toHaveCount(1)
})

test('tablero: conteos según los permisos', async ({ page }) => {
  await mockAuthApi(page, staff(['orders.read', 'shipping.manage', 'inventory.read']))
  const api = await mockOperationsApi(page, {
    counts: {
      pendingPayment: 4,
      awaitingFulfillment: 1,
      pendingRefund: 0,
      shipments: 7,
      lowStock: 3,
    },
  })
  await login(page)

  await expect(page.getByRole('link', { name: 'Pedidos por cobrar: 4' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Pedidos esperando surtido: 1' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Pedidos con reembolso pendiente: 0' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Envíos por despachar: 7' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Variantes con stock bajo (≤ 5): 3' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Entregas de eventos fallidas/ })).toHaveCount(0)
  expect(api.calls.some((c) => c.path === '/v1/admin/event-deliveries')).toBe(false)
  expect(api.calls.find((c) => c.path === '/v1/admin/inventory/stock-items')?.query).toContain(
    'availableMax=5',
  )

  await page.getByRole('link', { name: 'Pedidos esperando surtido: 1' }).click()
  await expect(page).toHaveURL(/\/pedidos\?status=AWAITING_MANUAL_FULFILLMENT/)
})
