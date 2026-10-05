import { expect, test } from '@playwright/test'
import { COMMON_PASSWORD, mockAuthApi, staff, VALID_RESET_TOKEN } from './mock-api'

test('Mi cuenta muestra los datos, roles y permisos de GET /v1/me', async ({ page }) => {
  await mockAuthApi(
    page,
    staff(['orders.read', 'shipping.manage'], { roles: [{ id: 'r1', name: 'Operador' }] }),
  )
  await page.goto('/login')
  await page.getByLabel('Email').fill('ana@example.com')
  await page.getByLabel('Contraseña').fill('correcta')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Hola, Ana' })).toBeVisible()

  await page.goto('/cuenta')
  await expect(page.getByText('ana@example.com')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Roles' })).toContainText('Operador')
  await expect(page.getByRole('list', { name: 'Permisos' })).toContainText('shipping.manage')

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('pedir el enlace de recuperación siempre muestra el mismo mensaje', async ({ page }) => {
  const api = await mockAuthApi(page, staff([]))
  await page.goto('/login')
  await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click()
  await expect(page).toHaveURL(/\/recuperar-contrasena$/)
  await page.getByLabel('Email').fill('quien-sea@example.com')
  await page.getByRole('button', { name: 'Enviar enlace' }).click()
  await expect(page.getByRole('status')).toContainText('Revisa tu correo')
  expect(api.calls).toContain('POST /v1/auth/password-reset/request')
})

test('el enlace del correo permite elegir una contraseña nueva', async ({ page }) => {
  await mockAuthApi(page, staff([]))
  await page.goto(`/reset-password?token=${VALID_RESET_TOKEN}`)
  await page.getByLabel('Contraseña nueva', { exact: true }).fill(COMMON_PASSWORD)
  await page.getByLabel('Confirma la contraseña nueva').fill(COMMON_PASSWORD)
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await expect(page.getByText('Es una contraseña demasiado común.')).toBeVisible()

  await page.getByLabel('Contraseña nueva', { exact: true }).fill('una frase larga y segura')
  await page.getByLabel('Confirma la contraseña nueva').fill('una frase larga y segura')
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await expect(page.getByRole('status')).toContainText('Contraseña actualizada')
})

test('un enlace vencido ofrece pedir otro', async ({ page }) => {
  await mockAuthApi(page, staff([]))
  await page.goto('/reset-password?token=vencido')
  await page.getByLabel('Contraseña nueva', { exact: true }).fill('una frase larga y segura')
  await page.getByLabel('Confirma la contraseña nueva').fill('una frase larga y segura')
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await expect(page.getByRole('alert')).toContainText('El enlace no es válido')
  await expect(page.getByRole('link', { name: 'Pedir otro enlace' })).toBeVisible()
})

test('sin token, la página de restablecer no muestra el formulario', async ({ page }) => {
  await mockAuthApi(page, staff([]))
  await page.goto('/reset-password')
  await expect(page.getByRole('alert')).toContainText('El enlace no es válido')
})
