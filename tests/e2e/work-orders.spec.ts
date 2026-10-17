import { expect, test } from '@playwright/test'
import { login, mockAuthApi, staff } from './mock-api'
import { mockSalesApi } from './mock-sales'
import { ME, TECH, mockWorkOrdersApi } from './mock-work-orders'

const SELLER = [
  'work-orders.read',
  'work-orders.manage',
  'orders.read',
  'orders.place',
  'inventory.read',
  'catalog.read',
  'customers.read',
]
const ADMIN = [...SELLER, 'staff.manage', 'work-orders.read-blocked', 'customers.manage']

test('órdenes de trabajo: recibir un equipo, asignármela e imprimir la nota', async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => undefined
  })
  await mockAuthApi(page, staff(SELLER))
  const api = await mockWorkOrdersApi(page, { warehouses: true })
  await login(page)
  await page.goto('/ordenes-trabajo')
  await page.getByRole('link', { name: 'Recibir equipo' }).click()
  await expect(page).toHaveURL(/\/ordenes-trabajo\/nueva$/)

  await page.getByLabel('Nombre').fill('María López Hernández')
  await page.getByLabel('Teléfono').fill('443 123-456')
  await page.getByLabel('Tipo de equipo').fill('Laptop')
  await page.getByLabel('Falla que reporta').fill('No enciende')
  await page.getByLabel('Costo estimado').fill('350')
  // Sin `staff.manage` no hay lista de técnicos: solo asignársela a sí mismo (D-085).
  await expect(page.getByRole('button', { name: 'Técnico' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Asignármela' }).click()
  await expect(page.getByText('Tú', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Recibir equipo' }).click()
  await expect(page.getByText('El teléfono lleva 10 dígitos.')).toBeVisible()
  await page.getByLabel('Teléfono').fill('443 123-4567')
  await page.getByRole('button', { name: 'Recibir equipo' }).click()

  await expect(page.getByRole('heading', { name: 'Orden de trabajo OT-000123' })).toBeVisible()
  await expect(page.getByText('Equipo recibido con el folio OT-000123').first()).toBeVisible()
  const created = api.calls.find((c) => c.method === 'POST' && c.path === '')!
  expect(created.headers['idempotency-key']).toBeTruthy()
  expect(created.body).toMatchObject({
    warehouseId: expect.any(String),
    customerName: 'María López Hernández',
    customerPhone: '4431234567',
    customerEmail: null,
    equipmentType: 'Laptop',
    reportedFault: 'No enciende',
    estimatedCost: 35000,
    technicianId: ME,
  })

  await page.getByRole('link', { name: 'Imprimir nota', exact: true }).click()
  await expect(page).toHaveURL(/\/imprimir\/nota-servicio\/.+/)
  const note = page.getByRole('article', { name: 'Nota de servicio' })
  await expect(note.getByText('Nota de servicio OT-000123')).toBeVisible()
  await expect(note.getByText('María López Hernández')).toBeVisible()
  await expect(note.getByRole('img', { name: 'Código OT-000123' })).toBeVisible()
  await expect(note.getByText('Garantía de 30 días en la mano de obra.')).toBeVisible()
  await expect(note.getByText('Firma del cliente')).toBeVisible()
  // La nota abre en carta por defecto; la térmica es opción.
  await expect(page.getByRole('combobox', { name: 'Papel' })).toContainText('Hoja carta')
})

test('órdenes de trabajo: con staff.manage se elige técnico; diagnóstico y estados', async ({
  page,
}) => {
  await mockAuthApi(page, staff(ADMIN))
  const api = await mockWorkOrdersApi(page, {
    warehouses: true,
    workOrders: [{ folio: 123, customerName: 'María López' }],
  })
  await login(page)
  await page.goto('/ordenes-trabajo')
  // El folio exacto, escrito o escaneado, abre la orden.
  await page.getByLabel('Buscar órdenes de trabajo').fill('ot-123')
  await page.getByLabel('Buscar órdenes de trabajo').press('Enter')
  await expect(page.getByRole('heading', { name: 'Orden de trabajo OT-000123' })).toBeVisible()

  await page.getByRole('button', { name: 'Técnico' }).click()
  await page.getByRole('option', { name: /Luis Ramírez/ }).click()
  await page.getByLabel('Diagnóstico').fill('Disco dañado')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Orden de trabajo actualizada').first()).toBeVisible()
  expect(api.calls.find((c) => c.method === 'PATCH')!.body).toEqual({
    version: 1,
    technicianId: TECH,
    diagnosis: 'Disco dañado',
  })

  // Salta pasos hacia adelante: de recibida a lista para entregar.
  await page.getByRole('button', { name: 'Cambiar estado' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Nuevo estado' }).click()
  await page.getByRole('option', { name: 'Lista para entregar' }).click()
  await dialog.getByLabel('Nota').fill('Revisión sin reparación')
  await dialog.getByRole('button', { name: 'Cambiar estado' }).click()
  await expect(page.getByRole('heading', { name: 'Orden de trabajo OT-000123' })).toBeVisible()
  const history = page.getByRole('list', { name: 'Historial de estados' })
  await expect(history.getByText('Revisión sin reparación')).toBeVisible()
  expect(api.calls.find((c) => c.path.endsWith('/status'))!.body).toEqual({
    status: 'READY',
    note: 'Revisión sin reparación',
    version: 2,
  })

  // Cancelar exige la nota, y cierra la orden.
  await page.getByRole('button', { name: 'Cambiar estado' }).click()
  await dialog.getByRole('combobox', { name: 'Nuevo estado' }).click()
  await page.getByRole('option', { name: 'Cancelada' }).click()
  await dialog.getByRole('button', { name: 'Cancelar la orden' }).click()
  await expect(dialog.getByText('Explica por qué se cancela.')).toBeVisible()
  await dialog.getByLabel('Nota').fill('El cliente se lleva el equipo')
  await dialog.getByRole('button', { name: 'Cancelar la orden' }).click()
  await expect(page.getByText('Orden cerrada')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cambiar estado' })).toHaveCount(0)
  await expect(page.getByLabel('Diagnóstico')).toBeDisabled()
})

test('órdenes de trabajo: nueva venta desde la orden, ligarla, otra por código y desligar', async ({
  page,
}) => {
  await mockAuthApi(page, staff(SELLER))
  const salesApi = await mockSalesApi(page, {
    orders: [
      { code: 'K7M4-Q9XA', status: 'PAID', store: { fulfillment: 'IN_STORE' } },
      { code: 'X1Y2-Z3W4', status: 'EXPIRED', store: { fulfillment: 'IN_STORE' } },
    ],
    storeCatalog: true,
  })
  const api = await mockWorkOrdersApi(page, {
    workOrders: [{ folio: 123, status: 'READY' }],
    sales: () =>
      salesApi.orders.map((o) => ({
        id: o.id,
        publicCode: o.publicCode,
        orderNumber: o.orderNumber,
        status: o.status,
        channel: o.channel,
        total: o.lines.reduce((t, l) => t + l.unit * l.quantity, 0),
      })),
  })
  await login(page)
  await page.goto('/ordenes-trabajo')
  await page.getByRole('link', { name: 'OT-000123' }).click()

  await page.getByRole('link', { name: 'Nueva venta para esta orden' }).click()
  await expect(page).toHaveURL(/\/pedidos\/nuevo\?ordenTrabajo=.+&folio=OT-000123$/)
  await expect(page.getByText('Venta para la orden de trabajo OT-000123')).toBeVisible()
  await page.getByLabel('Buscar productos').fill('cam')
  await page.getByRole('button', { name: 'Agregar CAM-M' }).click()
  await page.getByRole('radio', { name: 'Sin datos del comprador' }).click()
  await page.getByRole('button', { name: 'Colocar pedido' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Colocar pedido' }).click()

  // Vuelve a la orden con la venta lista para ligarse.
  await expect(page).toHaveURL(/\/ordenes-trabajo\/[^?]+\?ligar=.+&venta=T5N8-W2RP$/)
  await page.getByRole('button', { name: 'Ligar venta' }).click()
  const linked = page.getByRole('list', { name: 'Ventas ligadas' })
  await expect(linked.getByText('T5N8-W2RP')).toBeVisible()
  await expect(page).not.toHaveURL(/ligar=/)

  // Otra ya colocada, por su código del ticket; una vencida no se liga.
  await page.getByLabel('Código de la venta a ligar').fill('x1y2-z3w4')
  await page.getByLabel('Código de la venta a ligar').press('Enter')
  await expect(page.getByRole('button', { name: 'Ligar X1Y2-Z3W4' })).toBeDisabled()
  await page.getByLabel('Código de la venta a ligar').fill('K7M4-Q9XA')
  await page.getByLabel('Código de la venta a ligar').press('Enter')
  await page.getByRole('button', { name: 'Ligar K7M4-Q9XA' }).click()
  await expect(linked.getByText('K7M4-Q9XA')).toBeVisible()
  await expect(page.getByText('$1,198.00').first()).toBeVisible()
  expect(api.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/sales'))).toHaveLength(2)

  await page.getByRole('button', { name: 'Desligar T5N8-W2RP' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Desligar' }).click()
  await expect(linked.getByText('T5N8-W2RP')).toHaveCount(0)
  const unlink = api.calls.find((c) => c.method === 'DELETE')!
  expect(unlink.query).toBe('?version=3')
})

test('órdenes de trabajo: datos bloqueados con motivo; sin manage no hay acciones', async ({
  page,
}) => {
  await mockAuthApi(page, staff(['work-orders.read', 'work-orders.read-blocked']))
  await mockWorkOrdersApi(page, {
    workOrders: [{ folio: 120, status: 'DELIVERED', blocked: true }],
  })
  await login(page)
  await page.goto('/ordenes-trabajo')
  await expect(page.getByText('Datos no disponibles')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Recibir equipo' })).toHaveCount(0)
  await page.getByRole('link', { name: 'OT-000120' }).click()

  await expect(page.getByRole('button', { name: 'Cambiar estado' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Ver datos' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Motivo').fill('Reclamación 2026-07')
  await dialog.getByRole('button', { name: 'Ver datos' }).click()
  await expect(dialog.getByText('Consulta registrada en la auditoría')).toBeVisible()
  await expect(dialog.getByText('4431234567')).toBeVisible()
})
