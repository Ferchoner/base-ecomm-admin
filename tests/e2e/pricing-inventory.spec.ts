import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { login, mockAuthApi, staff } from './mock-api'
import { mockCatalogApi } from './mock-catalog'
import { mockPricingInventoryApi } from './mock-pricing-inventory'

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

test('almacén: nombre y dirección con el catálogo del INEGI', async ({ page }) => {
  await mockAuthApi(page, staff(['inventory.read', 'inventory.write']))
  const api = await mockPricingInventoryApi(page)
  await login(page)
  await page.goto('/inventario/almacen')

  await page.getByLabel('Nombre').fill('Almacén Morelia')
  await page.getByRole('switch', { name: 'Tiene dirección' }).click()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Exactamente 10 dígitos.')).toBeVisible()

  await page.getByLabel('Contacto').fill('María López')
  await page.getByLabel('Teléfono').fill('4431234567')
  await page.getByLabel('Calle').fill('Av. Madero')
  await page.getByLabel('Número exterior').fill('123')
  await page.getByLabel('Colonia').fill('Centro')
  await page.getByLabel('Código postal').fill('58000')
  await choose(page, 'Elige el estado', 'Michoacán de Ocampo')
  await choose(page, 'Elige el municipio', 'Morelia')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Almacén actualizado', { exact: true })).toBeVisible()
  expect(api.calls.find((c) => c.method === 'PATCH')?.body).toEqual({
    name: 'Almacén Morelia',
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
