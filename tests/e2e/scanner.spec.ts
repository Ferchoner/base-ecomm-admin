import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { login, mockAuthApi, staff } from './mock-api'
import { mockCatalogApi } from './mock-catalog'
import { mockPricingInventoryApi } from './mock-pricing-inventory'
import { mockSalesApi } from './mock-sales'

/**
 * Lector de códigos en modo teclado (PLAN_API_1.7 §3.1): "escribe" el código muy rápido y termina
 * con Enter. Playwright teclea sin pausa, como el lector.
 */
async function scan(page: Page, code: string) {
  await page.keyboard.type(code)
  await page.keyboard.press('Enter')
}

const V1 = '0192a3b4-0000-7000-8000-00000000d001'
const V2 = '0192a3b4-0000-7000-8000-00000000d002'
const V3 = '0192a3b4-0000-7000-8000-00000000d003'
const variant = (id: string, sku: string, talla: string, gtin: string | null = null) => ({
  id,
  sku,
  gtin,
  options: { talla },
  status: 'ACTIVE' as const,
  weightGrams: null,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  editableIdentity: false,
})
/** `CAM-L` lleva como GTIN el SKU de dígitos de otra variante (API_SPEC §11.10). */
const catalog = () => ({
  products: [
    {
      title: 'Camisa de lino',
      status: 'PUBLISHED' as const,
      variants: [variant(V1, 'CAM-M', 'M', '7501055363063'), variant(V2, 'CAM-L', 'L', '40170725')],
    },
    { title: 'Calcetas', variants: [variant(V3, '40170725', 'Única')] },
  ],
})

test('lector: en productos, el código exacto abre la variante y explica lo que no encuentra', async ({
  page,
}) => {
  await mockAuthApi(page, staff(['catalog.read']))
  await mockCatalogApi(page, catalog())
  await login(page)
  await page.goto('/catalogo/productos')

  const search = page.getByLabel('Buscar productos')
  await search.fill('NOPE-1')
  await search.press('Enter')
  await expect(
    page.getByText('Ninguna variante tiene el SKU o GTIN NOPE-1; abajo, lo que coincide.'),
  ).toBeVisible()

  await search.fill('40170725')
  await search.press('Enter')
  await expect(
    page.getByText('El código 40170725 coincide con 2 variantes: elige una.'),
  ).toBeVisible()
  const choices = page.getByRole('list', { name: 'Variantes con ese código' })
  await expect(choices.getByRole('button')).toHaveCount(2)
  await choices.getByRole('button', { name: /Calcetas/ }).click()
  await expect(page).toHaveURL(/tab=variantes&variant=0192a3b4-0000-7000-8000-00000000d003/)

  await page.goto('/catalogo/productos')
  await search.click()
  await scan(page, '7501055363063')
  await expect(page).toHaveURL(/tab=variantes&variant=0192a3b4-0000-7000-8000-00000000d001/)
  await expect(page.getByRole('row', { name: /CAM-M/ })).toContainText('Código leído')
})

const SELLER = ['orders.read', 'orders.place', 'inventory.read', 'catalog.read', 'customers.read']

test('lector: venta en tienda escaneando, también sin el foco en el buscador', async ({ page }) => {
  await mockAuthApi(page, staff(SELLER))
  const api = await mockSalesApi(page, { orders: [], storeCatalog: true })
  await login(page)
  await page.goto('/pedidos/nuevo')

  // El buscador abre con el foco: el primer escaneo entra ahí.
  const search = page.getByLabel('Buscar productos')
  await expect(search).toBeEnabled()
  await expect(search).toBeFocused()
  await scan(page, '7501055363063')
  await expect(page.getByText('CAM-M · Camisa de lino: 1 unidad.')).toBeVisible()
  await expect(page.getByLabel('Unidades de CAM-M')).toHaveValue('1')

  // Sin foco en un campo, el lector se escucha en toda la página.
  await page.getByRole('heading', { name: 'Productos', level: 3 }).click()
  await scan(page, 'CAM-M')
  await expect(page.getByText('CAM-M · Camisa de lino: 2 unidades.')).toBeVisible()
  await expect(page.getByLabel('Unidades de CAM-M')).toHaveValue('2')
  await expect(page.getByText('$1,198.00').last()).toBeVisible()

  await page.getByRole('heading', { name: 'Productos', level: 3 }).click()
  await scan(page, 'GOR-01')
  await expect(page.getByText('La variante GOR-01 está descontinuada: no se vende.')).toBeVisible()
  await scan(page, 'CIN-01')
  await expect(page.getByText('No hay existencias de CIN-01 en este almacén.')).toBeVisible()
  await scan(page, 'XYZ-999')
  await expect(page.getByText('Ningún producto tiene el código XYZ-999.')).toBeVisible()
  await expect(page.getByLabel(/^Unidades de/)).toHaveCount(1)

  const stockCheck = api.calls.find((c) => c.query.includes('variantId='))
  expect(stockCheck?.query).toContain('warehouseId=')
})

test('lector: el código del ticket abre el pedido', async ({ page }) => {
  await mockAuthApi(page, staff(['orders.read']))
  await mockSalesApi(page, {
    orders: [
      { code: 'K7M4-Q9XA', status: 'PAID', email: 'maria@example.com' },
      { code: 'B2C3-D4EF', status: 'PAID', email: 'jose@example.com' },
    ],
  })
  await login(page)
  await page.goto('/pedidos')
  await page.getByLabel('Buscar pedidos').click()
  await scan(page, 'K7M4-Q9XA')
  await expect(page.getByRole('heading', { name: 'Pedido K7M4-Q9XA' })).toBeVisible()
})

test('lector: registrar una entrada escaneando la variante', async ({ page }) => {
  await mockAuthApi(page, staff(['catalog.read', 'inventory.read', 'inventory.write']))
  await mockCatalogApi(page, catalog())
  const api = await mockPricingInventoryApi(page, {
    stock: [{ variantId: V1, sku: 'CAM-M', productTitle: 'Camisa de lino', onHand: 10 }],
  })
  await login(page)
  await page.goto('/inventario/stock')
  await page.getByRole('button', { name: 'Registrar movimiento' }).click()
  const picker = page.getByRole('dialog', { name: 'Registrar movimiento' })
  await expect(picker.getByLabel('Código')).toBeFocused()
  await scan(page, '7501055363063')
  await expect(picker.getByText('Camisa de lino · talla: M')).toBeVisible()
  await expect(picker.getByText('Disponibles: 10 de 10 físicas.')).toBeVisible()
  await picker.getByRole('button', { name: 'Registrar entrada' }).click()
  await expect(picker).toBeHidden()

  const dialog = page.getByRole('dialog', { name: 'Registrar entrada' })
  await expect(dialog.getByText(/CAM-M · Camisa de lino/)).toBeVisible()
  await dialog.getByLabel('Cantidad').fill('4')
  await dialog.getByRole('button', { name: 'Registrar entrada' }).click()
  await expect(dialog).toBeHidden()
  expect(api.calls.find((c) => c.path.endsWith('/receipts'))?.body).toMatchObject({
    variantId: V1,
    quantity: 4,
  })
})
