import { expect, test } from '@playwright/test'
import { login, mockAuthApi, staff } from './mock-api'
import { mockCatalogApi } from './mock-catalog'

const WRITER = ['catalog.read', 'catalog.write']

test('con solo catalog.read se consulta sin acciones de escritura', async ({ page }) => {
  await mockAuthApi(page, staff(['catalog.read']))
  await mockCatalogApi(page, {
    brands: [{ name: 'Acme' }],
    products: [{ title: 'Camisa de lino', status: 'PUBLISHED' }],
  })
  await login(page)

  await page.goto('/catalogo/marcas')
  await expect(page.getByRole('cell', { name: 'Acme', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nueva marca' })).toHaveCount(0)

  await page.goto('/catalogo/productos')
  await expect(page.getByRole('link', { name: 'Camisa de lino' })).toBeVisible()
  await expect(page.getByText('Oculto: sin variante con precio')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Nuevo producto' })).toHaveCount(0)

  await page.goto('/catalogo/productos/nuevo')
  await expect(page.getByText('No tienes permiso')).toBeVisible()
})

test('marcas: alta, nombre duplicado y desactivación', async ({ page }) => {
  await mockAuthApi(page, staff(WRITER))
  await mockCatalogApi(page, { brands: [{ name: 'Acme' }] })
  await login(page)
  await page.goto('/catalogo/marcas')

  await page.getByRole('button', { name: 'Nueva marca' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nombre').fill('acme')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog.getByText('Ya existe; escribe otro valor.')).toBeVisible()

  await dialog.getByLabel('Nombre').fill('Lumen')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog).toBeHidden()
  const row = page.getByRole('row', { name: /Lumen/ })
  await expect(row).toContainText('lumen')

  await row.getByRole('button', { name: 'Acciones de Lumen' }).click()
  await page.getByRole('menuitem', { name: 'Desactivar' }).click()
  await expect(row).toContainText('Inactiva')
})

test('categorías: subcategoría bajo su padre en el árbol', async ({ page }) => {
  await mockAuthApi(page, staff(WRITER))
  await mockCatalogApi(page, { categories: [{ name: 'Ropa' }] })
  await login(page)
  await page.goto('/catalogo/categorias')

  await page.getByRole('button', { name: 'Acciones de Ropa' }).click()
  await page.getByRole('menuitem', { name: 'Agregar subcategoría' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Categoría padre' })).toContainText('Ropa')
  await dialog.getByLabel('Nombre').fill('Camisas')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByLabel('Ropa › Camisas')).toBeVisible()
})

test('producto: alta, variante, publicación y slug fijo', async ({ page }) => {
  await mockAuthApi(page, staff(WRITER))
  const api = await mockCatalogApi(page, { brands: [{ name: 'Acme' }] })
  await login(page)
  await page.goto('/catalogo/productos')

  await page.getByRole('link', { name: 'Nuevo producto' }).click()
  await page.getByLabel('Título').fill('Camisa de lino')
  await page.getByRole('button', { name: 'Crear producto' }).click()
  await expect(page).toHaveURL(/\/catalogo\/productos\/[\w-]+\?tab=variantes$/)
  await expect(page.getByRole('heading', { name: 'Camisa de lino' })).toBeVisible()
  await expect(page.getByText('Para publicar necesita al menos una variante activa.')).toBeVisible()

  await page.getByRole('button', { name: 'Nueva variante' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('SKU').fill('cam-lin-m')
  await dialog.getByRole('button', { name: 'Agregar opción' }).click()
  await dialog.getByLabel('Nombre de la opción 1').fill('talla')
  await dialog.getByLabel('Valor de la opción 1').fill('M')
  await dialog.getByLabel('Peso (g)').fill('350')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('cell', { name: 'CAM-LIN-M', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'talla: M' })).toBeVisible()
  const variantCall = api.calls.find((c) => c.method === 'POST' && c.path.endsWith('/variants'))
  expect(variantCall?.body).toMatchObject({
    sku: 'cam-lin-m',
    options: { talla: 'M' },
    weightGrams: 350,
    version: 1,
  })

  await page.getByRole('button', { name: 'Publicar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Publicar' }).click()
  await expect(page.getByText('Publicado', { exact: true })).toBeVisible()

  await page.getByRole('tab', { name: 'Datos' }).click()
  await expect(page.getByLabel('Slug')).toBeDisabled()
  await expect(page.getByText('Fijo desde la primera publicación.')).toBeVisible()
})

test('un conflicto de versión recarga el producto sin sobrescribir', async ({ page }) => {
  await mockAuthApi(page, staff(WRITER))
  const api = await mockCatalogApi(page, { products: [{ title: 'Taza' }] })
  const id = api.products[0]!.id
  await login(page)
  await page.goto(`/catalogo/productos/${id}`)
  await expect(page.getByLabel('Título')).toHaveValue('Taza')

  api.touchProduct(id)
  await page.getByLabel('Título').fill('Taza grande')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Otro usuario modificó este registro', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Título')).toHaveValue('Taza (editado)')
  expect(api.products[0]!.title).toBe('Taza (editado)')
})

test('imágenes: subir, reordenar y eliminar', async ({ page }) => {
  await mockAuthApi(page, staff(WRITER))
  const api = await mockCatalogApi(page, { products: [{ title: 'Taza' }] })
  const id = api.products[0]!.id
  await login(page)
  await page.goto(`/catalogo/productos/${id}?tab=imagenes`)
  await expect(page.getByText('0 de 20 imágenes')).toBeVisible()

  const png = { mimeType: 'image/png', buffer: Buffer.from('fake') }
  await page.getByLabel('Elegir imágenes').setInputFiles([
    { name: 'a.png', ...png },
    { name: 'b.png', ...png },
  ])
  await expect(page.getByText('2 de 20 imágenes')).toBeVisible()
  const [first, second] = api.products[0]!.images.map((i) => i.id)

  await page.getByRole('button', { name: 'Mover la imagen 2 antes' }).click()
  await expect
    .poll(() => api.calls.find((c) => c.path.endsWith('/images/order'))?.body)
    .toEqual({ imageIds: [second, first] })

  await page.getByRole('button', { name: 'Eliminar la imagen 1' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click()
  await expect(page.getByText('1 de 20 imágenes')).toBeVisible()
})

test('los filtros del listado quedan en la URL', async ({ page }) => {
  await mockAuthApi(page, staff(WRITER))
  await mockCatalogApi(page, {
    products: [{ title: 'Camisa', status: 'PUBLISHED' }, { title: 'Pantalón' }],
  })
  await login(page)
  await page.goto('/catalogo/productos')
  await expect(page.getByRole('link', { name: 'Pantalón' })).toBeVisible()

  await page.getByRole('combobox', { name: 'Filtrar por estado' }).click()
  await page.getByRole('option', { name: 'Publicado' }).click()
  await expect(page).toHaveURL(/status=PUBLISHED/)
  await expect(page.getByRole('link', { name: 'Pantalón' })).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('link', { name: 'Camisa' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Pantalón' })).toHaveCount(0)
})
