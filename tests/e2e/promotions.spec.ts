import { expect, test } from '@playwright/test'
import { login, mockAuthApi, staff } from './mock-api'
import { mockCatalogApi } from './mock-catalog'
import { mockPromotionsApi } from './mock-promotions'

const MANAGER = ['promotions.read', 'promotions.manage', 'catalog.read']

test('promociones: alta de un cupón con límite de usos', async ({ page }) => {
  await mockAuthApi(page, staff(MANAGER))
  await mockCatalogApi(page, { products: [{ title: 'Camisa de lino', status: 'PUBLISHED' }] })
  const api = await mockPromotionsApi(page, [{ name: 'Buen Fin 10%' }])
  await login(page)
  await page.goto('/promociones')
  await expect(page.getByRole('link', { name: 'Buen Fin 10%' })).toBeVisible()

  await page.getByRole('link', { name: 'Nueva promoción' }).click()
  await expect(page).toHaveURL(/\/promociones\/nueva$/)
  // Sin código no hay límite de usos: solo un cupón lo tiene.
  await expect(page.getByLabel('Límite de usos')).toBeDisabled()
  await page.getByLabel('Nombre').fill('Otoño 15%')
  await page.getByRole('textbox', { name: 'Porcentaje' }).fill('15')
  await page.getByLabel('Código').fill('OTONO15')
  await page.getByLabel('Límite de usos').fill('50')
  await page.getByRole('button', { name: 'Crear promoción' }).click()

  await expect(page.getByRole('heading', { name: 'Otoño 15%' })).toBeVisible()
  await expect(page).toHaveURL(/\/promociones\/[0-9a-f-]+$/)
  const created = api.calls.find((c) => c.method === 'POST')!
  expect(created.body).toMatchObject({
    name: 'Otoño 15%',
    percentage: 15,
    code: 'OTONO15',
    usageLimit: 50,
    channels: ['ONLINE', 'STORE'],
    targets: [],
  })
})

test('promociones: una vigente solo cambia nombre, fin y límite, y se puede terminar', async ({
  page,
}) => {
  await mockAuthApi(page, staff(MANAGER))
  const api = await mockPromotionsApi(page, [{ name: 'Buen Fin 10%' }])
  await login(page)
  await page.goto('/promociones')
  await page.getByRole('link', { name: 'Buen Fin 10%' }).click()

  await expect(page.getByText('Ya está vigente')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Porcentaje' })).toBeDisabled()
  await page.getByLabel('Nombre').fill('Buen Fin')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('heading', { name: 'Buen Fin', exact: true })).toBeVisible()
  expect(api.calls.find((c) => c.method === 'PATCH')!.body).toEqual({
    version: 1,
    name: 'Buen Fin',
  })

  await page.getByRole('button', { name: 'Terminar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Terminar' }).click()
  await expect(page.getByText('Terminada').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Terminar' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toHaveCount(0)
  const end = api.calls.find((c) => c.path.endsWith('/end'))!
  expect(end.body).toEqual({ version: 2 })
})

test('promociones: quien solo consulta no ve acciones', async ({ page }) => {
  await mockAuthApi(page, staff(['promotions.read']))
  await mockPromotionsApi(page, [
    { name: 'Buen Fin 10%', code: 'BUENFIN', usageLimit: 100, uses: 3 },
  ])
  await login(page)
  await page.goto('/promociones')
  await expect(page.getByText('3 de 100')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Nueva promoción' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Buen Fin 10%' }).click()
  await expect(page.getByLabel('Nombre')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Terminar' })).toHaveCount(0)
})
