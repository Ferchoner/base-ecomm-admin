import { expect, test } from '@playwright/test'
import { login, mockAuthApi, staff } from './mock-api'
import { LOCAL_206, mockCashClosingsApi } from './mock-cash-closings'

const SELLER = ['inventory.read', 'cash-closings.read', 'cash-closings.manage']

test('corte de caja: el equipo guarda su local y cierra la caja con la diferencia y su nota', async ({
  page,
}) => {
  await mockAuthApi(page, staff(SELLER))
  const api = await mockCashClosingsApi(page)
  await login(page)

  // El local es del equipo: se elige una vez en Mi cuenta, con confirmación.
  await page.goto('/cuenta')
  await page.getByRole('combobox', { name: 'Local de este equipo' }).click()
  await page.getByRole('option', { name: 'Local 206 (L206)' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cambiar local' }).click()
  await expect(page.getByText('Local de este equipo guardado', { exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Local de este equipo' }).click()
  await page.getByRole('option', { name: 'Local 204 (L204)' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cambiar local' }).click()

  await page.goto('/caja')
  await expect(page.getByRole('heading', { name: /Local 204 \(L204\)/ })).toBeVisible()
  await expect(page.getByLabel('Efectivo esperado')).toContainText('$3,525.00')
  await expect(page.getByText('Tú')).toBeVisible()
  await expect(page.getByText(/1 artículo sin registrar/)).toBeVisible()

  await page.getByLabel('Efectivo contado').fill('3505')
  await expect(page.getByText('Falta efectivo')).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar caja' }).click()
  await expect(page.getByText('El efectivo no cuadra: escribe por qué.')).toBeVisible()
  await page.getByLabel('Nota').fill('Faltan $20 de un cambio')
  // Al salir del campo se quita el aviso, y el botón se mueve: se sale antes de cerrar.
  await page.getByLabel('Nota').press('Tab')
  await page.getByRole('button', { name: 'Cerrar caja' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar caja' }).click()

  await expect(page.getByRole('heading', { name: 'Caja cerrada' })).toBeVisible()
  await expect(page.getByText('Faltan $20 de un cambio').first()).toBeVisible()
  const post = api.calls.find((c) => c.method === 'POST')
  expect(post!.body).toEqual({
    warehouseId: expect.not.stringMatching(LOCAL_206),
    date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    countedCash: 350_500,
    note: 'Faltan $20 de un cambio',
  })
  await expect(page.getByRole('heading', { name: 'Cierres anteriores' })).toBeVisible()
})

test('corte de caja: sin cash-closings.manage se consulta pero no se cierra', async ({ page }) => {
  await mockAuthApi(page, staff(['inventory.read', 'cash-closings.read']))
  await mockCashClosingsApi(page)
  await login(page)
  await page.goto(`/caja?local=${LOCAL_206}`)
  await expect(page.getByRole('heading', { name: /Local 206 \(L206\)/ })).toBeVisible()
  await expect(page.getByText(/Cerrar la caja requiere el permiso/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cerrar caja' })).toHaveCount(0)
})
