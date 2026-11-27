import { expect, test } from '@playwright/test'
import { login, mockAuthApi, staff } from './mock-api'
import { mockCatalogApi } from './mock-catalog'
import { mockPricingInventoryApi } from './mock-pricing-inventory'
import { mockSalesApi } from './mock-sales'

/** Ubicaciones y hojas de conteo (ADR-0173 de base-shop). */
const V1 = '0192a3b4-0000-7000-8000-00000000c001'
const V2 = '0192a3b4-0000-7000-8000-00000000c002'
const V3 = '0192a3b4-0000-7000-8000-00000000c003'
const STOCK = [
  { variantId: V1, sku: 'CAM-M', productTitle: 'Camisa de lino', onHand: 10, location: 'A1' },
  { variantId: V2, sku: 'CAM-L', productTitle: 'Camisa de lino', onHand: 3, location: 'A2' },
  { variantId: V3, sku: 'GOR-1', productTitle: 'Gorra', onHand: 4 },
]
const REVIEWER = ['inventory.read', 'inventory.write', 'inventory.count']

test('ubicaciones: se ven, se filtran con * y quien cuenta las pone', async ({ page }) => {
  await mockAuthApi(page, staff(['inventory.read', 'inventory.count']))
  const api = await mockPricingInventoryApi(page, { stock: STOCK })
  await login(page)
  await page.goto('/inventario/stock')
  await expect(page.getByRole('row', { name: /CAM-M/ })).toContainText('A1')

  await page.getByLabel('Filtrar por ubicación').fill('a*')
  await expect(page).toHaveURL(/location=A\*/)
  await expect(page.getByRole('row', { name: /GOR-1/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Limpiar' }).click()

  await page.getByRole('button', { name: 'Acciones de GOR-1' }).click()
  await page.getByRole('menuitem', { name: 'Poner ubicación' }).click()
  const dialog = page.getByRole('dialog')
  // Sugiere las que ya existen en el almacén.
  await expect(dialog.getByRole('button', { name: 'A1' })).toBeVisible()
  await dialog.getByLabel('Ubicación').fill('  vitrina   1 ')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('row', { name: /GOR-1/ })).toContainText('VITRINA 1')
  expect(api.calls.find((c) => c.path.endsWith('/locations'))?.body).toMatchObject({
    variantId: V3,
    location: 'VITRINA 1',
  })
  // Sin inventory.write no hay entradas ni ajustes.
  await page.getByRole('button', { name: 'Acciones de CAM-M' }).click()
  await expect(page.getByRole('menuitem', { name: 'Ajustar' })).toHaveCount(0)
})

test('conteo: abrir por ubicación, capturar, recontar y aplicar', async ({ page }) => {
  await mockAuthApi(page, staff(REVIEWER))
  const api = await mockPricingInventoryApi(page, { stock: STOCK })
  await login(page)
  await page.goto('/inventario/conteos')
  await expect(page.getByText('Sin hojas abiertas')).toBeVisible()

  await page.getByRole('button', { name: 'Abrir una hoja' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Abrir la hoja' }).click()
  await expect(dialog.getByText('Elige el almacén.')).toBeVisible()
  await dialog.getByRole('combobox', { name: 'Almacén' }).click()
  await page.getByRole('option', { name: /Almacén principal/ }).click()
  await dialog.getByRole('button', { name: 'Abrir la hoja' }).click()
  await expect(dialog.getByText('Indica una ubicación, una categoría o una clase.')).toBeVisible()
  await dialog.getByLabel('Ubicación').fill('a*')
  await dialog.getByRole('button', { name: 'Abrir la hoja' }).click()

  await expect(page).toHaveURL(/\/inventario\/conteos\/[0-9a-f-]+$/)
  await expect(page.getByRole('heading', { level: 2, name: /Hoja C-000001/ })).toContainText(
    'Abierta',
  )
  await expect(page.getByText('Ubicaciones A…')).toBeVisible()
  await expect(page.getByText('0 de 2 contadas')).toBeVisible()
  expect(api.calls.find((c) => c.method === 'POST' && c.path.endsWith('/counts'))?.body).toEqual(
    expect.objectContaining({ location: 'A*', note: null }),
  )

  // Quien revisa ve lo esperado y la diferencia.
  await page.getByLabel('Contadas de CAM-M').fill('8')
  await page.getByLabel('Contadas de CAM-M').press('Enter')
  await expect(page.getByRole('row', { name: /CAM-M/ })).toContainText('-2')
  await page.getByLabel('Contadas de CAM-L').fill('3')
  await page.getByLabel('Contadas de CAM-L').press('Enter')
  await expect(page.getByText('2 de 2 contadas')).toBeVisible()

  await page.getByRole('button', { name: 'Recontar CAM-L' }).click()
  await expect(page.getByText('1 de 2 contadas')).toBeVisible()
  await expect(page.getByRole('row', { name: /CAM-L/ })).toContainText('Recontar')

  await page.getByRole('button', { name: 'Aplicar' }).click()
  const confirm = page.getByRole('dialog')
  await expect(confirm).toContainText('1 línea se ajusta como conteo físico (-2 en total).')
  await expect(confirm).toContainText('1 sin contar, 1 de ellas por recontar, no se toca.')
  await confirm.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByRole('heading', { level: 2, name: /Hoja C-000001/ })).toContainText(
    'Aplicada',
  )
  await expect(page.getByRole('row', { name: /CAM-M/ })).toContainText('Ajustada')
  await expect(page.getByRole('row', { name: /CAM-L/ })).toContainText('Sin contar')
  expect(api.stock.find((s) => s.variantId === V1)?.onHand).toBe(8)
  const apply = api.calls.find((c) => c.path.endsWith('/apply'))
  expect(apply?.body).toEqual({ version: expect.any(Number) })
  await expect(page.getByLabel('Contadas de CAM-M')).toHaveCount(0)
})

test('conteo a ciegas: escanear suma una pieza y no se ve lo esperado', async ({ page }) => {
  await mockAuthApi(page, staff(REVIEWER))
  const api = await mockPricingInventoryApi(page, { stock: STOCK, blindCounts: true })
  await login(page)
  await page.goto('/inventario/conteos')
  await page.getByRole('button', { name: 'Abrir una hoja' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Almacén' }).click()
  await page.getByRole('option', { name: /Almacén principal/ }).click()
  await dialog.getByLabel('Ubicación').fill('A1')
  await dialog.getByRole('button', { name: 'Abrir la hoja' }).click()

  await expect(page.getByText('Conteo a ciegas')).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Esperadas' })).toHaveCount(0)
  const scan = page.getByLabel('Escanear para contar')
  await scan.fill('cam-m')
  await scan.press('Enter')
  await expect(page.getByText('CAM-M en A1: 1 contada.')).toBeVisible()
  await scan.fill('CAM-M')
  await scan.press('Enter')
  await expect(page.getByText('CAM-M en A1: 2 contadas.')).toBeVisible()
  await expect(page.getByLabel('Contadas de CAM-M')).toHaveValue('2')
  const captures = api.calls.filter((c) => c.method === 'PUT' && c.path.includes('/lines/'))
  expect(captures.map((c) => c.body)).toEqual([{ counted: 1 }, { counted: 2 }])

  // Sin permiso de catálogo, lo que no está en la hoja solo se avisa.
  await scan.fill('OTRO-1')
  await scan.press('Enter')
  await expect(page.getByText('OTRO-1 no está en esta hoja.')).toBeVisible()
})

test('conteo: una variante en otra hoja abierta no deja abrir esta', async ({ page }) => {
  await mockAuthApi(page, staff(REVIEWER))
  const api = await mockPricingInventoryApi(page, {
    stock: STOCK,
    busyVariants: [
      { variantId: V1, countId: '0192a3b4-0000-7000-8000-00000000d001', folio: 'C-000077' },
    ],
  })
  await login(page)
  await page.goto('/inventario/conteos')
  await page.getByRole('button', { name: 'Abrir una hoja' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Almacén' }).click()
  await page.getByRole('option', { name: /Almacén principal/ }).click()
  await dialog.getByLabel('Ubicación').fill('A*')
  await dialog.getByRole('button', { name: 'Abrir la hoja' }).click()
  await expect(dialog.getByRole('alert')).toContainText(
    'Algunos productos ya están en otra hoja abierta de este almacén.',
  )
  await expect(dialog.getByRole('link', { name: 'C-000077' })).toHaveAttribute(
    'href',
    '/inventario/conteos/0192a3b4-0000-7000-8000-00000000d001',
  )
  expect(api.counts).toHaveLength(0)
})

test('conteo: la hoja impresa no lleva cantidades', async ({ page }) => {
  await mockAuthApi(page, staff(REVIEWER))
  await mockPricingInventoryApi(page, { stock: STOCK })
  await login(page)
  await page.goto('/inventario/conteos')
  await page.getByRole('button', { name: 'Abrir una hoja' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Almacén' }).click()
  await page.getByRole('option', { name: /Almacén principal/ }).click()
  await dialog.getByLabel('Ubicación').fill('A*')
  await dialog.getByRole('button', { name: 'Abrir la hoja' }).click()
  await page.getByRole('link', { name: 'Imprimir la hoja' }).click()
  const sheet = page.getByRole('article')
  await expect(sheet).toContainText('Hoja de conteo C-000001')
  await expect(sheet).toContainText('CAM-M')
  await expect(sheet).not.toContainText('10')
})

test('clase de conteo: en el producto, en el filtro y la sugerida por ventas', async ({ page }) => {
  await mockAuthApi(page, staff(['catalog.read', 'catalog.write', 'orders.read']))
  const P1 = '0192a3b4-0000-7000-8000-00000000e001'
  const P2 = '0192a3b4-0000-7000-8000-00000000e002'
  const P3 = '0192a3b4-0000-7000-8000-00000000e003'
  const catalog = await mockCatalogApi(page, {
    products: [
      { id: P1, title: 'Zelda' },
      { id: P2, title: 'Control', countClass: 'C' },
      { id: P3, title: 'Funda', countClass: 'B' },
    ],
  })
  await mockSalesApi(page, {
    orders: [],
    countClassSuggestions: [
      {
        productId: P1,
        productTitle: 'Zelda',
        countClass: null,
        suggestedClass: 'A',
        sales: 800000,
        units: 8,
      },
      {
        productId: P2,
        productTitle: 'Control',
        countClass: 'C',
        suggestedClass: 'B',
        sales: 150000,
        units: 3,
      },
      {
        productId: P3,
        productTitle: 'Funda',
        countClass: 'B',
        suggestedClass: 'B',
        sales: 50000,
        units: 5,
      },
    ],
  })
  await login(page)
  await page.goto('/catalogo/productos')
  await page.getByRole('combobox', { name: 'Filtrar por clase de conteo' }).click()
  await page.getByRole('option', { name: 'Sin clase' }).click()
  await expect(page).toHaveURL(/countClass=none/)
  await expect(page.getByRole('row', { name: /Control/ })).toHaveCount(0)
  await expect(page.getByRole('row', { name: /Zelda/ })).toBeVisible()

  await page.getByRole('link', { name: 'Clases de conteo' }).click()
  await expect(
    page.getByRole('heading', { level: 2, name: 'Clases de conteo sugeridas' }),
  ).toBeVisible()
  // Por omisión, solo los que tienen otra clase sugerida.
  await expect(page.getByRole('row', { name: /Funda/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Elegir los que no tienen clase' }).click()
  await page.getByRole('checkbox', { name: 'Elegir Control' }).click()
  await page.getByRole('button', { name: 'Aplicar a 2' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByText('2 productos cambiaron de clase', { exact: true })).toBeVisible()
  expect(catalog.calls.find((c) => c.path.endsWith('/count-classes'))?.body).toEqual({
    items: [
      { productId: P1, countClass: 'A' },
      { productId: P2, countClass: 'B' },
    ],
  })

  // En el producto se cambia o se quita.
  await page.goto(`/catalogo/productos/${P3}`)
  await page.getByRole('tab', { name: 'Datos' }).click()
  await page.getByRole('combobox', { name: 'Clase de conteo' }).click()
  await page.getByRole('option', { name: 'Sin clase (se cuenta como C)' }).click()
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Producto actualizado', { exact: true })).toBeVisible()
  expect(catalog.calls.find((c) => c.method === 'PATCH')?.body).toEqual({
    countClass: null,
    version: 1,
  })
})
