import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { login, mockAuthApi, staff } from './mock-api'
import { mockCatalogApi } from './mock-catalog'
import { SECOND_WAREHOUSE_ID, mockPricingInventoryApi } from './mock-pricing-inventory'

const V1 = '0192a3b4-0000-7000-8000-00000000c001'
const V2 = '0192a3b4-0000-7000-8000-00000000c002'
const variant = (id: string, sku: string, talla: string) => ({
  id,
  sku,
  options: { talla },
  status: 'ACTIVE' as const,
  weightGrams: null,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  editableIdentity: false,
})
const CATALOG = {
  products: [
    { title: 'Camisa de lino', variants: [variant(V1, 'CAM-M', 'M'), variant(V2, 'CAM-L', 'L')] },
  ],
}

/**
 * Abre un USelectMenu y elige una opción escribiéndola y con Enter. El menú puede cerrarse si el
 * clic coincide con el desplazamiento de la página, así que se reintenta hasta ver la opción.
 */
async function choose(page: Page, trigger: string, option: string) {
  const item = page.getByRole('option', { name: option })
  await expect(async () => {
    await page.getByRole('button').filter({ hasText: trigger }).click()
    await expect(item).toBeVisible({ timeout: 1000 })
  }).toPass()
  await page.keyboard.type(option)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button').filter({ hasText: option })).toBeVisible()
}

async function pickProduct(page: Page, scope = page.locator('body')) {
  await scope.getByRole('button').filter({ hasText: 'Buscar producto' }).click()
  await page.getByRole('option', { name: /Camisa de lino/ }).click()
}

test('precios: ver el vigente, cambiarlo, programar y cancelar', async ({ page }) => {
  await mockAuthApi(page, staff(['catalog.read', 'pricing.read', 'pricing.write']))
  await mockCatalogApi(page, CATALOG)
  const api = await mockPricingInventoryApi(page, {
    prices: [{ variantId: V1, amount: 59900, compareAtAmount: 79900 }],
  })
  await login(page)
  await page.goto('/precios')

  await pickProduct(page)
  await expect(page).toHaveURL(/product=/)
  const row = page.getByRole('row', { name: /CAM-M/ })
  await expect(row).toContainText('$599.00')
  await expect(page.getByRole('row', { name: /CAM-L/ })).toContainText('Sin precio')

  await row.getByRole('button', { name: 'Cambiar precio' }).click()
  const panel = page.getByRole('dialog')
  await panel.getByLabel('Precio (MXN)').fill('549.90')
  await panel.getByRole('button', { name: 'Aplicar precio' }).click()
  await expect(panel.getByText('$549.90').first()).toBeVisible()
  expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({
    amount: 54990,
    compareAtAmount: null,
  })

  await panel.getByLabel('Precio antes (opcional)').fill('100')
  await panel.getByLabel('Precio (MXN)').fill('499')
  await panel.getByText('Programar', { exact: true }).click()
  await panel.getByLabel('Empieza').fill('2030-11-14T00:00')
  await expect(panel.getByText('Debe ser mayor que el precio.')).toBeVisible()
  await panel.getByLabel('Precio antes (opcional)').fill('')
  await expect(panel.getByText('Debe ser mayor que el precio.')).toHaveCount(0)
  await panel.getByRole('button', { name: 'Programar precio' }).click()
  await expect(panel.getByText('Programado', { exact: true })).toBeVisible()
  const scheduled = api.calls.filter((c) => c.method === 'POST').at(-1)?.body as Record<
    string,
    unknown
  >
  expect(scheduled.amount).toBe(49900)
  expect(String(scheduled.effectiveFrom)).toMatch(/^2030-11-1[34]T/)

  await panel.getByRole('button', { name: 'Cancelar' }).click()
  await page
    .getByRole('dialog', { name: /Cancelar este precio/ })
    .getByRole('button', { name: 'Cancelar precio' })
    .click()
  await expect(panel.getByText('Programado', { exact: true })).toHaveCount(0)
})

test('precios: la importación CSV se revisa antes de guardar', async ({ page }) => {
  await mockAuthApi(page, staff(['catalog.read', 'pricing.read', 'pricing.write']))
  await mockCatalogApi(page, CATALOG)
  const api = await mockPricingInventoryApi(page)
  await login(page)
  await page.goto('/precios')

  await expect(page.getByRole('button', { name: 'Importar', exact: true })).toBeDisabled()
  await page.getByLabel('Archivo CSV de precios').setInputFiles({
    name: 'precios.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('sku,amount\nCAM-M,599.00\n'),
  })
  await page.getByRole('button', { name: 'Revisar archivo' }).click()
  await expect(page.getByText('Archivo sin errores')).toBeVisible()
  expect(api.calls.at(-1)?.query).toBe('?dryRun=true')

  await page.getByRole('button', { name: 'Importar', exact: true }).click()
  await expect(page.getByText('Importación terminada')).toBeVisible()
  expect(api.calls.at(-1)?.query).toBe('')
})

test('precios: los errores de la importación se muestran por línea', async ({ page }) => {
  await mockAuthApi(page, staff(['pricing.read', 'pricing.write']))
  await mockPricingInventoryApi(page, {
    importErrors: [
      { field: 'rows[3].sku', code: 'unknownSku', message: 'No existe una variante con ese SKU.' },
    ],
  })
  await login(page)
  await page.goto('/precios')
  await expect(page.getByText('Necesitas permiso de catálogo')).toBeVisible()

  await page.getByLabel('Archivo CSV de precios').setInputFiles({
    name: 'precios.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('sku,amount\nX,1\n'),
  })
  await page.getByRole('button', { name: 'Revisar archivo' }).click()
  const errors = page.getByRole('table', { name: 'Errores del archivo' })
  await expect(errors).toContainText('Línea 3 (sku)')
  await expect(errors).toContainText('No existe una variante con ese SKU.')
  await expect(page.getByRole('button', { name: 'Importar', exact: true })).toBeDisabled()
})

test('inventario: filtro de disponibles, entrada y ajuste', async ({ page }) => {
  await mockAuthApi(page, staff(['catalog.read', 'inventory.read', 'inventory.write']))
  await mockCatalogApi(page, CATALOG)
  const api = await mockPricingInventoryApi(page, {
    stock: [
      { variantId: V1, sku: 'CAM-M', productTitle: 'Camisa de lino', onHand: 10, reserved: 2 },
      { variantId: V2, sku: 'CAM-L', productTitle: 'Camisa de lino', onHand: 3 },
    ],
  })
  await login(page)
  await page.goto('/inventario/stock')
  await expect(page.getByRole('row', { name: /CAM-M/ })).toContainText('8')

  await page.getByLabel('Disponibles hasta').fill('5')
  await expect(page).toHaveURL(/availableMax=5/)
  await expect(page.getByRole('row', { name: /CAM-M/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Limpiar' }).click()

  await page.getByRole('button', { name: 'Acciones de CAM-M' }).click()
  await page.getByRole('menuitem', { name: 'Registrar entrada' }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Cantidad').fill('25')
  await dialog.getByLabel('Nota').fill('Remisión 99')
  await expect(dialog.getByText('Quedarán 35 unidades físicas.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Registrar entrada' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('row', { name: /CAM-M/ })).toContainText('33')
  expect(api.calls.find((c) => c.path.endsWith('/receipts'))?.body).toMatchObject({
    variantId: V1,
    quantity: 25,
    note: 'Remisión 99',
  })

  await page.getByRole('button', { name: 'Acciones de CAM-L' }).click()
  await page.getByRole('menuitem', { name: 'Ajustar' }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Cantidad').fill('5')
  await dialog.getByRole('combobox', { name: 'Motivo' }).click()
  await page.getByRole('option', { name: 'Otro' }).click()
  await dialog.getByRole('button', { name: 'Registrar ajuste' }).click()
  await expect(dialog.getByText('Explica el ajuste cuando el motivo es "Otro".')).toBeVisible()
  await dialog.getByLabel('Nota').fill('Conteo de cierre')
  await dialog.getByRole('button', { name: 'Registrar ajuste' }).click()
  await expect(dialog.getByText('Existencias insuficientes')).toBeVisible()
  expect(api.calls.find((c) => c.path.endsWith('/adjustments'))?.body).toMatchObject({
    quantity: -5,
    reasonCode: 'OTHER',
    note: 'Conteo de cierre',
  })
})

test('inventario: "Stock bajo" usa el umbral de cada usuario (G-06)', async ({ page }) => {
  await mockAuthApi(page, staff(['inventory.read']))
  await mockPricingInventoryApi(page, {
    stock: [
      { variantId: V1, sku: 'CAM-M', productTitle: 'Camisa de lino', onHand: 10, reserved: 2 },
      { variantId: V2, sku: 'CAM-L', productTitle: 'Camisa de lino', onHand: 3 },
    ],
  })
  await login(page)
  await page.goto('/inventario/stock')
  await page.getByRole('button', { name: 'Stock bajo (≤ 5)' }).click()
  await expect(page).toHaveURL(/availableMax=5/)
  await expect(page.getByRole('row', { name: /CAM-M/ })).toHaveCount(0)
  await expect(page.getByRole('row', { name: /CAM-L/ })).toBeVisible()

  await page.goto('/cuenta')
  await page.getByLabel('Umbral de stock bajo').fill('8')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Preferencia guardada', { exact: true })).toBeVisible()

  await page.goto('/inventario/stock')
  await page.getByRole('button', { name: 'Stock bajo (≤ 8)' }).click()
  await expect(page).toHaveURL(/availableMax=8/)
  await expect(page.getByRole('row', { name: /CAM-M/ })).toBeVisible()
})

test('inventario: movimientos con paginación por cursor', async ({ page }) => {
  await mockAuthApi(page, staff(['inventory.read']))
  await mockPricingInventoryApi(page, {
    stock: [{ variantId: V1, sku: 'CAM-M', productTitle: 'Camisa de lino', onHand: 80 }],
    movements: { 'CAM-M': 60 },
  })
  await login(page)
  await page.goto('/inventario/stock')

  await page.getByRole('button', { name: 'Acciones de CAM-M' }).click()
  await expect(page.getByRole('menuitem', { name: 'Registrar entrada' })).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'Ver movimientos' }).click()
  const list = page.getByRole('list', { name: 'Movimientos' })
  await expect(list.getByRole('listitem')).toHaveCount(50)
  await expect(list).toContainText('Remisión 1234')
  await page.getByRole('button', { name: 'Cargar más' }).click()
  await expect(list.getByRole('listitem')).toHaveCount(60)
  await expect(page.getByRole('button', { name: 'Cargar más' })).toHaveCount(0)
})

test('almacenes: editar nombre, prioridad y dirección con el catálogo del INEGI', async ({
  page,
}) => {
  await mockAuthApi(page, staff(['inventory.read', 'inventory.write']))
  const api = await mockPricingInventoryApi(page)
  await login(page)
  await page.goto('/inventario/almacenes')
  // El último almacén activo no se puede desactivar.
  await expect(page.getByRole('button', { name: 'Desactivar PRINCIPAL' })).toBeDisabled()
  await page.getByRole('button', { name: 'Editar PRINCIPAL' }).click()
  const dialog = page.getByRole('dialog')

  await dialog.getByLabel('Nombre').fill('Almacén Morelia')
  await dialog.getByRole('switch', { name: 'Tiene dirección' }).click()
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog.getByText('Exactamente 10 dígitos.')).toBeVisible()

  await dialog.getByLabel('Contacto').fill('María López')
  await dialog.getByLabel('Teléfono').fill('4431234567')
  await dialog.getByLabel('Calle').fill('Av. Madero')
  await dialog.getByLabel('Número exterior').fill('123')
  await dialog.getByLabel('Colonia').fill('Centro')
  await dialog.getByLabel('Código postal').fill('58000')
  await choose(page, 'Elige el estado', 'Michoacán de Ocampo')
  await choose(page, 'Elige el municipio', 'Morelia')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Almacén actualizado', { exact: true })).toBeVisible()
  expect(api.calls.find((c) => c.method === 'PATCH')?.body).toEqual({
    name: 'Almacén Morelia',
    priority: 1,
    address: {
      recipientName: 'María López',
      phone: '4431234567',
      street: 'Av. Madero',
      exteriorNumber: '123',
      interiorNumber: null,
      neighborhood: 'Centro',
      postalCode: '58000',
      stateCode: '16',
      municipalityCode: '16053',
      city: null,
      references: null,
    },
  })
})

test('almacenes: crear uno y desactivarlo', async ({ page }) => {
  await mockAuthApi(page, staff(['inventory.read', 'inventory.write']))
  const api = await mockPricingInventoryApi(page)
  await login(page)
  await page.goto('/inventario/almacenes')
  await page.getByRole('button', { name: 'Nuevo almacén' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Código').fill('cdmx')
  await dialog.getByLabel('Nombre').fill('Tienda CDMX')
  await dialog.getByLabel('Prioridad').fill('2')
  await dialog.getByRole('button', { name: 'Crear almacén' }).click()
  await expect(page.getByText('Almacén creado', { exact: true })).toBeVisible()
  expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({
    code: 'CDMX',
    name: 'Tienda CDMX',
    priority: 2,
    address: null,
  })
  const row = page.getByRole('row', { name: /CDMX/ })
  await expect(row).toContainText('Activo')

  await page.getByRole('button', { name: 'Desactivar CDMX' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Desactivar' }).click()
  await expect(page.getByText('Almacén desactivado', { exact: true })).toBeVisible()
  await expect(row).toContainText('Inactivo')
})

test('inventario: trasladar a otro almacén en un solo paso y cancelarlo (G-20)', async ({
  page,
}) => {
  await mockAuthApi(page, staff(['inventory.read', 'inventory.transfer']))
  const api = await mockPricingInventoryApi(page, {
    warehouses: [{ id: SECOND_WAREHOUSE_ID, code: 'L206', name: 'Local 206', priority: 2 }],
    stock: [{ variantId: V1, sku: 'CAM-M', productTitle: 'Camisa de lino', onHand: 10 }],
  })
  await login(page)
  await page.goto('/inventario/stock')
  await page.getByRole('button', { name: 'Acciones de CAM-M' }).click()
  await page.getByRole('menuitem', { name: 'Trasladar a otro almacén' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Cantidad').fill('4')
  await dialog.getByRole('button', { name: 'Trasladar' }).click()
  await expect(page.getByText('Traslado T-000001 registrado', { exact: true })).toBeVisible()
  const created = api.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/transfers'))
  expect(created.map((c) => c.body)).toEqual([
    {
      kind: 'TRANSFER',
      reason: 'SALE',
      fromWarehouseId: '0192a3b4-0000-7000-8000-00000000b001',
      toWarehouseId: SECOND_WAREHOUSE_ID,
      lines: [{ variantId: V1, quantity: 4 }],
    },
  ])
  // Ya no se registra con dos ajustes.
  expect(api.calls.some((c) => c.path.endsWith('/adjustments'))).toBe(false)
  await expect(page.getByRole('row', { name: /CAM-M/ })).toHaveCount(2)

  // Equivocado: se cancela desde Traslados en sus primeros 10 minutos.
  await page.getByRole('link', { name: 'Traslados' }).click()
  await page.getByLabel('Qué mostrar').click()
  await page.getByRole('option', { name: 'Todos', exact: true }).click()
  const row = page.getByRole('row', { name: /T-000001/ })
  await expect(row).toContainText('Almacén principal → Local 206')
  await expect(row).toContainText('4 × CAM-M')
  await expect(row).toContainText('Hecho')
  await row.getByRole('button', { name: 'Acciones de T-000001' }).click()
  await page.getByRole('menuitem', { name: 'Cancelar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar el traslado' }).click()
  await expect(page.getByText('T-000001 cancelado', { exact: true })).toBeVisible()
  await expect(row).toContainText('Cancelado')
  const cancel = api.calls.find((c) => c.path.endsWith('/cancel'))
  expect(cancel?.body).toEqual({ version: 1 })
  expect(api.stock.find((s) => s.warehouseId === SECOND_WAREHOUSE_ID)?.onHand).toBe(0)
})

test('inventario: prestar para mostrar y cerrar el préstamo con lo que regresó', async ({
  page,
}) => {
  await mockAuthApi(page, staff(['inventory.read', 'inventory.transfer']))
  const api = await mockPricingInventoryApi(page, {
    warehouses: [{ id: SECOND_WAREHOUSE_ID, code: 'L206', name: 'Local 206', priority: 2 }],
    stock: [{ variantId: V1, sku: 'CAM-M', productTitle: 'Camisa de lino', onHand: 10 }],
  })
  await login(page)
  await page.goto('/inventario/stock')
  await page.getByRole('button', { name: 'Acciones de CAM-M' }).click()
  await page.getByRole('menuitem', { name: 'Prestar para mostrar' }).click()
  const dialog = page.getByRole('dialog', { name: 'Prestar para mostrar' })
  await dialog.getByLabel('Cantidad').fill('2')
  await dialog.getByRole('button', { name: 'Prestar' }).click()
  await expect(page.getByText('Préstamo P-000001 registrado', { exact: true })).toBeVisible()
  const loan = api.calls.find((c) => c.method === 'POST' && c.path.endsWith('/transfers'))!
  const body = loan.body as { returnBy: string }
  expect(body).toMatchObject({ kind: 'LOAN', reason: 'SHOW', lines: [{ quantity: 2 }] })
  // Una hora por defecto.
  const minutes = (Date.parse(body.returnBy) - Date.now()) / 60_000
  expect(minutes).toBeGreaterThan(55)
  expect(minutes).toBeLessThanOrEqual(60)

  // Los préstamos abiertos son la vista inicial de Traslados.
  await page.goto('/inventario/traslados')
  const row = page.getByRole('row', { name: /P-000001/ })
  await expect(row).toContainText('Prestado')
  await expect(row).toContainText('Regresa')
  await row.getByRole('button', { name: 'Acciones de P-000001' }).click()
  await page.getByRole('menuitem', { name: 'Cerrar el préstamo' }).click()
  const close = page.getByRole('dialog', { name: 'Cerrar el préstamo P-000001' })
  await expect(close.getByLabel('Regresaron de CAM-M')).toHaveValue('2')
  await close.getByLabel('Regresaron de CAM-M').fill('1')
  await close.getByRole('button', { name: 'Cerrar el préstamo' }).click()
  await expect(page.getByText('Préstamo P-000001 cerrado', { exact: true })).toBeVisible()
  await expect(page.getByText('1 unidad se queda en Local 206.', { exact: true })).toBeVisible()
  expect(api.calls.find((c) => c.path.endsWith('/close'))?.body).toEqual({
    version: 1,
    lines: [{ variantId: V1, returned: 1 }],
  })
  await expect(page.getByText('Sin préstamos')).toBeVisible()
})

test('inventario: los préstamos vencidos se cuentan en Inicio y ya no se cancelan', async ({
  page,
}) => {
  await mockAuthApi(page, staff(['inventory.read', 'inventory.transfer']))
  await mockPricingInventoryApi(page, {
    warehouses: [{ id: SECOND_WAREHOUSE_ID, code: 'L206', name: 'Local 206', priority: 2 }],
    stock: [
      { variantId: V1, sku: 'CAM-M', productTitle: 'Camisa de lino', onHand: 10 },
      { variantId: V2, sku: 'CAM-L', productTitle: 'Camisa de lino', onHand: 5 },
    ],
    loans: [
      { sku: 'CAM-M', quantity: 1, minutesLeft: -30 },
      { sku: 'CAM-L', quantity: 1, minutesLeft: 30 },
    ],
  })
  await login(page)
  await page.goto('/')
  const card = page.getByRole('link', { name: /Préstamos vencidos/ })
  await expect(card).toContainText('1')
  await card.click()
  await expect(page).toHaveURL(/\/inventario\/traslados\?view=overdue/)
  await expect(page.getByRole('row', { name: /P-0000/ })).toHaveCount(1)
  await expect(page.getByRole('row', { name: /CAM-M/ })).toContainText('Vencido')
  // Pasados los 10 minutos ya no se cancela; se cierra.
  await page.getByRole('button', { name: /^Acciones de P-/ }).click()
  await expect(page.getByRole('menuitem', { name: 'Cerrar el préstamo' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Cancelar' })).toHaveCount(0)
})

test('inventario: carga masiva de entradas con revisión previa', async ({ page }) => {
  await mockAuthApi(page, staff(['inventory.read', 'inventory.write']))
  const api = await mockPricingInventoryApi(page)
  await login(page)
  await page.goto('/inventario/stock')
  await page.getByRole('link', { name: 'Cargar entradas' }).click()

  await page.getByLabel('Archivo CSV de entradas').setInputFiles({
    name: 'existencias.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('sku,warehouse,quantity\nCAM-M,PRINCIPAL,25\n'),
  })
  await page.getByRole('button', { name: 'Revisar archivo' }).click()
  await expect(page.getByText('2 entradas con 45 unidades. Aún no se guardó nada.')).toBeVisible()
  expect(api.calls.at(-1)?.query).toBe('?dryRun=true')
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
  await expect(page.getByText('Importación terminada')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Descargar plantilla' })).toHaveAttribute(
    'href',
    '/plantillas/existencias.csv',
  )
})

test('inventario: el mismo archivo de entradas no se carga dos veces', async ({ page }) => {
  await mockAuthApi(page, staff(['inventory.read', 'inventory.write']))
  await mockPricingInventoryApi(page, { receiptFileImportedAt: '2026-10-15T16:00:00.000Z' })
  await login(page)
  await page.goto('/inventario/cargar-entradas')
  await page.getByLabel('Archivo CSV de entradas').setInputFiles({
    name: 'existencias.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('sku,warehouse,quantity\nCAM-M,PRINCIPAL,25\n'),
  })
  await page.getByRole('button', { name: 'Revisar archivo' }).click()
  await expect(page.getByText(/Este archivo ya se cargó el/)).toBeVisible()
})
