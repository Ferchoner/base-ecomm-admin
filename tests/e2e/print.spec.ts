import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { login, mockAuthApi, staff } from './mock-api'
import { mockCatalogApi } from './mock-catalog'
import { mockSalesApi } from './mock-sales'

/** El diálogo del sistema no existe en las pruebas: se cuenta cuántas veces se abrió. */
async function stubPrint(page: Page) {
  await page.addInitScript(() => {
    ;(window as unknown as { printed: number }).printed = 0
    window.print = () => {
      ;(window as unknown as { printed: number }).printed++
    }
  })
}

test('ticket: 58 mm por defecto, carta como opción y el papel preferido de Mi cuenta', async ({
  page,
}) => {
  await stubPrint(page)
  await mockAuthApi(page, staff(['orders.read']))
  await mockSalesApi(page, {
    orders: [
      {
        code: 'K7M4-Q9XA',
        status: 'PAID',
        email: 'maria@example.com',
        payment: { status: 'CAPTURED' },
        lines: [{ sku: 'CAM-001', quantity: 2, unit: 59900 }],
      },
    ],
  })
  await login(page)
  await page.goto('/pedidos')
  await page.getByRole('link', { name: 'K7M4-Q9XA' }).first().click()
  await page.getByRole('link', { name: 'Imprimir ticket' }).click()

  await expect(page).toHaveURL(/\/imprimir\/ticket\/.+/)
  const ticket = page.getByRole('article', { name: 'Ticket' })
  await expect(ticket.getByText('Tienda Ejemplo')).toBeVisible()
  await expect(ticket.getByText('RFC EJE260101AB1')).toBeVisible()
  await expect(ticket.getByText('Pedido K7M4-Q9XA')).toBeVisible()
  await expect(ticket.getByText('2 × $599.00')).toBeVisible()
  await expect(ticket.getByText('Este ticket no es un comprobante fiscal.')).toBeVisible()
  await expect(ticket.getByRole('img', { name: 'Código K7M4-Q9XA' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Papel' })).toContainText('Térmica 58 mm')

  await page.getByRole('combobox', { name: 'Papel' }).click()
  await page.getByRole('option', { name: 'Hoja carta' }).click()
  await expect(ticket.getByRole('table', { name: 'Productos' })).toBeVisible()

  await page.getByRole('button', { name: 'Imprimir' }).click()
  expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1)
  // Al imprimir solo sale el ticket.
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('button', { name: 'Imprimir' })).toBeHidden()
  await expect(ticket).toBeVisible()
  await page.emulateMedia({ media: 'screen' })

  // El papel preferido se guarda en Mi cuenta.
  await page.goto('/cuenta')
  await page.getByRole('combobox', { name: 'Ticket' }).click()
  await page.getByRole('option', { name: 'Térmica 80 mm' }).click()
  await page.goBack()
  await expect(page.getByRole('combobox', { name: 'Papel' })).toContainText('Térmica 80 mm')
})

const V1 = '0192a3b4-0000-7000-8000-00000000e001'
const V2 = '0192a3b4-0000-7000-8000-00000000e002'
const variant = (id: string, sku: string, talla: string, gtin: string | null) => ({
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

test('etiquetas: desde el producto, con copias, compactas en Data Matrix o QR', async ({
  page,
}) => {
  await stubPrint(page)
  await mockAuthApi(page, staff(['catalog.read']))
  await mockCatalogApi(page, {
    products: [
      {
        title: 'Camisa de lino',
        status: 'PUBLISHED',
        variants: [
          variant(V1, 'CAM-M', 'M', '7501055363063'),
          variant(V2, 'CAMISA-LINO-AZUL-MARINO-L', 'L', null),
        ],
      },
    ],
  })
  await login(page)
  await page.goto('/catalogo/productos')
  await page.getByRole('link', { name: 'Camisa de lino' }).click()
  await page.getByRole('link', { name: 'Imprimir etiquetas' }).click()

  await expect(page).toHaveURL(/\/catalogo\/etiquetas\?product=/)
  const preview = page.getByRole('region', { name: 'Vista previa' })
  await expect(preview.getByRole('img', { name: 'Código 7501055363063' })).toBeVisible()
  await expect(preview.getByRole('img', { name: 'Código CAMISA-LINO-AZUL-MARINO-L' })).toBeVisible()
  await expect(page.getByText('EAN-13')).toBeVisible()
  await expect(page.getByText('SKU largos para el código de barras')).toBeVisible()

  await page.getByLabel('Copias de CAM-M').fill('3')
  await page.getByLabel('Copias de CAM-M').blur()
  await expect(page.getByText('4 etiquetas')).toBeVisible()
  await expect(preview.getByRole('img', { name: 'Código 7501055363063' })).toHaveCount(3)

  await page.getByRole('combobox', { name: 'Papel' }).click()
  await page.getByRole('option', { name: /compactas 2D/ }).click()
  await expect(page.getByText('SKU largos para el código de barras')).toBeHidden()
  await expect(page.getByRole('combobox', { name: 'Código 2D' })).toContainText('Data Matrix')
  await expect(preview.getByRole('img', { name: 'Código 7501055363063' })).toHaveCount(3)
  await page.getByRole('combobox', { name: 'Código 2D' }).click()
  await page.getByRole('option', { name: 'QR' }).click()
  await expect(preview.getByRole('img', { name: 'Código CAMISA-LINO-AZUL-MARINO-L' })).toBeVisible()

  await page.getByRole('button', { name: 'Quitar CAMISA-LINO-AZUL-MARINO-L' }).click()
  await expect(page.getByText('3 etiquetas')).toBeVisible()
  await page.getByRole('button', { name: 'Imprimir' }).click()
  expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1)
})

test('etiquetas: agregar una variante escaneando', async ({ page }) => {
  await mockAuthApi(page, staff(['catalog.read']))
  await mockCatalogApi(page, {
    products: [{ title: 'Camisa de lino', variants: [variant(V1, 'CAM-M', 'M', '7501055363063')] }],
  })
  await login(page)
  await page.goto('/catalogo/etiquetas')
  await page.getByLabel('Agregar por código').fill('7501055363063')
  await page.getByLabel('Agregar por código').press('Enter')
  await expect(page.getByText('CAM-M agregado.')).toBeVisible()
  await expect(page.getByText('1 etiqueta', { exact: true })).toBeVisible()
})
