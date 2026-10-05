import { expect, test } from '@playwright/test'
import { mockAuthApi, staff } from './mock-api'

async function login(page: import('@playwright/test').Page, password = 'correcta') {
  await page.getByLabel('Email').fill('ana@example.com')
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

test('sin sesión, una ruta protegida lleva al login', async ({ page }) => {
  await mockAuthApi(page, staff([]))
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
})

test('el staff entra y ve solo las secciones de sus permisos', async ({ page }) => {
  await mockAuthApi(page, staff(['orders.read', 'shipping.manage']))
  await page.goto('/login')
  await login(page)
  await expect(page.getByRole('heading', { name: 'Hola, Ana' })).toBeVisible()
  const sections = page.getByRole('list', { name: 'Tus secciones' })
  await expect(sections).toContainText('Pedidos')
  await expect(sections).toContainText('Envíos')
  await expect(sections).not.toContainText('Productos')
  await expect(sections).not.toContainText('Staff')
})

test('credenciales inválidas muestran el error de la API', async ({ page }) => {
  await mockAuthApi(page, staff([]))
  await page.goto('/login')
  await login(page, 'incorrecta')
  await expect(page.getByRole('alert')).toContainText('Credenciales inválidas')
  await expect(page.getByRole('alert')).toContainText('e2e-correlation')
})

test('una cuenta de cliente no entra al backoffice', async ({ page }) => {
  await mockAuthApi(page, { type: 'CUSTOMER', firstNames: 'Cliente', permissions: [] })
  await page.goto('/login')
  await login(page)
  await expect(page.getByRole('alert')).toContainText('Esta cuenta no tiene acceso al backoffice')
  await expect(page).toHaveURL(/\/login$/)
})

test('la contraseña temporal obliga a cambiarla antes de seguir', async ({ page }) => {
  await mockAuthApi(page, staff(['orders.read'], { mustChangePassword: true }))
  await page.goto('/login')
  await login(page)
  await expect(page).toHaveURL(/\/cambiar-contrasena$/)
  await page.goto('/')
  await expect(page).toHaveURL(/\/cambiar-contrasena$/)

  await page.getByLabel('Contraseña temporal').fill('correcta')
  await page.getByLabel('Contraseña nueva', { exact: true }).fill('una frase larga y segura')
  await page.getByLabel('Confirma la contraseña nueva').fill('una frase larga y segura')
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await expect(page.getByRole('heading', { name: 'Hola, Ana' })).toBeVisible()
})

test('al recargar, la sesión se recupera con el refresh token', async ({ page }) => {
  const api = await mockAuthApi(page, staff(['orders.read']))
  await page.goto('/login')
  await login(page)
  await expect(page.getByRole('heading', { name: 'Hola, Ana' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Hola, Ana' })).toBeVisible()
  expect(api.calls).toContain('POST /v1/auth/refresh')
})

test('vuelve a la ruta pedida después del login', async ({ page }) => {
  await mockAuthApi(page, staff(['orders.read']))
  await page.goto('/cambiar-contrasena')
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await login(page)
  await expect(page).toHaveURL(/\/cambiar-contrasena$/)
})
