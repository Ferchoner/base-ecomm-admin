import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { login, mockAuthApi, staff } from './mock-api'
import { mockCatalogApi } from './mock-catalog'
import { mockIdentityApi } from './mock-identity'
import { mockOperationsApi } from './mock-operations'
import { mockPricingInventoryApi } from './mock-pricing-inventory'
import { mockSalesApi } from './mock-sales'

/**
 * Revisión automática de accesibilidad (WCAG 2.1 A y AA con axe) de cada pantalla con datos.
 * No sustituye la revisión manual con teclado y lector de pantalla (docs/TESTING_STRATEGY.md).
 */
const ALL = [
  'catalog.read',
  'catalog.write',
  'pricing.read',
  'pricing.write',
  'inventory.read',
  'inventory.write',
  'orders.read',
  'orders.manage',
  'orders.read-blocked',
  'payments.manage',
  'shipping.manage',
  'shipping.configure',
  'customers.read',
  'customers.manage',
  'staff.manage',
  'audit.read',
  'events.manage',
]

async function seedAll(page: Page) {
  await mockAuthApi(page, staff(ALL))
  await mockSalesApi(page, {
    orders: [
      {
        code: 'K7M4-Q9XA',
        status: 'PAID',
        email: 'maria@example.com',
        payment: { status: 'CAPTURED' },
        shipment: { status: 'PENDING' },
        lines: [{ sku: 'CAM-001', quantity: 2, unit: 59900 }],
      },
    ],
  })
  // Después de ventas: el método de envío vuelve a quedar en el mock de operaciones.
  await mockOperationsApi(page, { countLists: false })
  await mockCatalogApi(page, {
    brands: [{ name: 'Acme' }],
    categories: [{ name: 'Ropa' }],
    products: [{ title: 'Camisa de lino', status: 'PUBLISHED' }],
  })
  await mockPricingInventoryApi(page, {
    stock: [
      {
        variantId: '0192a3b4-0000-7000-8000-000000000101',
        sku: 'CAM-001',
        productTitle: 'Camisa de lino',
        onHand: 3,
      },
    ],
  })
  await mockIdentityApi(page, {
    customers: [{ email: 'maria@example.com', firstNames: 'María' }],
    roles: [{ name: 'Catálogo', permissions: ['catalog.read'] }],
    staff: [{ email: 'luis@example.com', firstNames: 'Luis', roles: ['Catálogo'] }],
  })
}

async function expectNoViolations(page: Page) {
  // Espera a que terminen los esqueletos de carga.
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} → ${v.nodes
        .map((n) => `${n.target.join(' ')} ${n.html.slice(0, 120)} ${n.any[0]?.message ?? ''}`)
        .join(' | ')}`,
  )
  expect(summary).toEqual([])
}

test('accesibilidad: login', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
  await expectNoViolations(page)
})

/** `heading`: el título de la página (h1 del layout); `open`: navegar a un detalle desde el listado. */
const PAGES: Array<{
  path: string
  heading: string
  open?: { link: string; url: RegExp }
}> = [
  { path: '/', heading: 'Inicio' },
  { path: '/cuenta', heading: 'Mi cuenta' },
  { path: '/catalogo/productos', heading: 'Productos' },
  {
    path: '/catalogo/productos',
    heading: 'Detalle de producto',
    open: { link: 'Camisa de lino', url: /\/catalogo\/productos\/.+/ },
  },
  { path: '/catalogo/categorias', heading: 'Categorías' },
  { path: '/catalogo/marcas', heading: 'Marcas' },
  { path: '/precios', heading: 'Precios' },
  { path: '/inventario/stock', heading: 'Inventario' },
  { path: '/inventario/almacenes', heading: 'Almacenes' },
  { path: '/pedidos', heading: 'Pedidos' },
  {
    path: '/pedidos',
    heading: 'Detalle de pedido',
    open: { link: 'K7M4-Q9XA', url: /\/pedidos\/.+/ },
  },
  { path: '/pagos', heading: 'Pagos' },
  { path: '/envios', heading: 'Envíos' },
  { path: '/clientes', heading: 'Clientes' },
  { path: '/staff', heading: 'Staff' },
  { path: '/roles', heading: 'Roles' },
  { path: '/configuracion/envio', heading: 'Método de envío' },
  { path: '/auditoria', heading: 'Auditoría' },
  { path: '/operacion/eventos?status=ALL', heading: 'Eventos' },
]

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`tema ${scheme === 'light' ? 'claro' : 'oscuro'}`, () => {
    test.use({ colorScheme: scheme })

    for (const p of PAGES) {
      test(`accesibilidad: ${p.heading} (${p.path})`, async ({ page }, testInfo) => {
        // El tema oscuro se revisa una vez, en escritorio.
        test.skip(scheme === 'dark' && testInfo.project.name !== 'desktop')
        await seedAll(page)
        await login(page)
        await page.goto(p.path)
        if (p.open) {
          await page.getByRole('link', { name: p.open.link }).first().click()
          await expect(page).toHaveURL(p.open.url)
        } else {
          await expect(page.getByRole('heading', { level: 1, name: p.heading })).toBeVisible()
        }
        await expectNoViolations(page)
      })
    }
  })
}

const DIALOGS: Array<{ name: string; path: string; open: (page: Page) => Promise<void> }> = [
  {
    name: 'alta de staff',
    path: '/staff',
    open: (page) => page.getByRole('button', { name: 'Nuevo staff' }).click(),
  },
  {
    name: 'detalle de una entrega de evento',
    path: '/operacion/eventos',
    open: (page) => page.getByRole('button', { name: 'OrderPaid' }).first().click(),
  },
  {
    name: 'detalle de auditoría',
    path: '/auditoria',
    open: (page) =>
      page.getByRole('list', { name: 'Registros' }).getByRole('button').first().click(),
  },
]

for (const d of DIALOGS) {
  test(`accesibilidad: ${d.name}`, async ({ page }) => {
    await seedAll(page)
    await login(page)
    await page.goto(d.path)
    await d.open(page)
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectNoViolations(page)
  })
}

test('teclado: iniciar sesión y abrir una sección sin ratón', async ({ page }) => {
  await mockAuthApi(page, staff(['audit.read']))
  await mockOperationsApi(page)
  await page.goto('/login')
  await page.getByLabel('Email').focus()
  await page.keyboard.type('ana@example.com')
  await page.keyboard.press('Tab')
  await page.keyboard.type('correcta')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: /^Hola,/ })).toBeVisible()

  // El foco recorre la navegación hasta Auditoría y Enter la abre.
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab')
    if (
      await page
        .getByRole('link', { name: 'Auditoría' })
        .first()
        .evaluate((el) => el === document.activeElement)
    )
      break
  }
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Auditoría' })).toBeVisible()
})
