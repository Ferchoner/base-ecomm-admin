import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { login, mockAuthApi, staff } from './mock-api'
import { mockIdentityApi, PERMISSIONS, SELF_ID } from './mock-identity'

const SUPER_ROLE = '0192a3b4-0000-7000-8000-0000000000aa'
const ROLES = [
  { id: SUPER_ROLE, name: 'Superadministrador', permissions: [], superadmin: true },
  { name: 'Catálogo', permissions: ['catalog.read', 'catalog.write'] },
  { name: 'Atención', permissions: ['customers.read', 'orders.read'] },
]

/**
 * Agrega una opción a un USelectMenu múltiple. El menú puede cerrarse o moverse mientras se abre,
 * así que se reintenta hasta que el disparador muestra la opción elegida.
 */
async function pick(page: Page, trigger: Locator, option: string) {
  await expect(async () => {
    if (!(await page.getByRole('listbox').isVisible())) await trigger.click()
    await page.getByRole('option', { name: option }).click({ timeout: 1000 })
    await expect(trigger).toContainText(option, { timeout: 1000 })
  }).toPass()
  await page.keyboard.press('Escape')
}

test('clientes: buscar, suspender y reactivar con motivo', async ({ page }) => {
  await mockAuthApi(page, staff(['customers.read', 'customers.manage']))
  const api = await mockIdentityApi(page, {
    customers: [
      { email: 'maria@example.com', firstNames: 'María' },
      { email: 'jose@example.com', firstNames: 'José' },
    ],
  })
  await login(page)
  await page.goto('/clientes')
  await page.getByLabel('Buscar clientes').fill('maria')
  await expect(page).toHaveURL(/q=maria/)
  await expect(page.getByRole('row', { name: /José/ })).toHaveCount(0)
  await page.getByRole('link', { name: 'María López' }).click()

  await page.getByRole('button', { name: 'Suspender' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Suspender' }).click()
  await expect(dialog.getByText('Escribe el motivo.')).toBeVisible()
  await dialog.getByLabel('Motivo').fill('Contracargos repetidos')
  await dialog.getByRole('button', { name: 'Suspender' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.locator('header').getByText('Suspendido', { exact: true })).toBeVisible()
  expect(api.calls.find((c) => c.path.endsWith('/suspend'))?.body).toEqual({
    reason: 'Contracargos repetidos',
    version: 1,
  })

  await page.getByRole('button', { name: 'Reactivar' }).click()
  await page.getByRole('dialog').getByLabel('Motivo').fill('Aclarado')
  await page.getByRole('dialog').getByRole('button', { name: 'Reactivar' }).click()
  await expect(page.locator('header').getByText('Activo', { exact: true })).toBeVisible()
})

test('clientes: anonimizar exige confirmar y explica los pedidos activos', async ({ page }) => {
  await mockAuthApi(page, staff(['customers.read', 'customers.manage']))
  const api = await mockIdentityApi(page, {
    customers: [{ email: 'maria@example.com', firstNames: 'María', activeOrders: true }],
  })
  await login(page)
  await page.goto(`/clientes/${api.customers[0]!.id}`)
  await page.getByRole('button', { name: 'Anonimizar' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Motivo').fill('ARCO-2026-0042')
  await dialog.getByRole('button', { name: 'Anonimizar' }).click()
  await expect(dialog.getByText('Confirma que entiendes que no se puede deshacer.')).toBeVisible()
  await dialog.getByLabel('Entiendo que no se puede deshacer.').check()
  await dialog.getByRole('button', { name: 'Anonimizar' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Tiene pedidos sin concluir.')

  api.customers[0]!.activeOrders = false
  await dialog.getByRole('button', { name: 'Anonimizar' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('También se anonimizaron 3 pedidos.', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sin nombre' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reactivar' })).toHaveCount(0)
})

test('clientes: anonimizar pedidos de invitado', async ({ page }) => {
  await mockAuthApi(page, staff(['customers.read', 'customers.manage']))
  const api = await mockIdentityApi(page)
  await login(page)
  await page.goto('/clientes')
  await page.getByRole('button', { name: 'Anonimizar invitado' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Email de contacto').fill('invitado@example.com')
  await dialog.getByLabel('Código de un pedido').fill('ZZZZ-0000')
  await dialog.getByLabel('Motivo').fill('ARCO-2026-0043')
  await dialog.getByLabel('Entiendo que no se puede deshacer.').check()
  await dialog.getByRole('button', { name: 'Anonimizar' }).click()
  await expect(dialog.getByRole('alert')).toContainText('no corresponden a un pedido de invitado')

  await dialog.getByLabel('Código de un pedido').fill('K7M4-Q9XA')
  await dialog.getByRole('button', { name: 'Anonimizar' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Se anonimizaron 2 pedidos.', { exact: true })).toBeVisible()
  expect(api.calls.findLast((c) => c.path.endsWith('/guest-anonymizations'))?.body).toEqual({
    contactEmail: 'invitado@example.com',
    publicCode: 'K7M4-Q9XA',
    reason: 'ARCO-2026-0043',
  })
})

test('staff: alta con roles que se pueden dar y contraseña temporal una sola vez', async ({
  page,
}) => {
  // Sin superadministrador ni permisos de clientes: esos roles no se ofrecen (BR-USR-20).
  await mockAuthApi(page, staff(['staff.manage', 'catalog.read', 'catalog.write']))
  const api = await mockIdentityApi(page, { roles: ROLES })
  await login(page)
  await page.goto('/staff')
  await page.getByRole('button', { name: 'Nuevo staff' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Email').fill('luis@example.com')
  await dialog.getByLabel('Nombres').fill('Luis')
  await dialog.getByLabel('Apellidos').fill('García')
  const rolesSelect = dialog.getByRole('button', { name: /^Roles/ })
  await rolesSelect.click()
  // Nuxt UI marca las opciones deshabilitadas con `data-disabled`.
  await expect(page.getByRole('option', { name: 'Superadministrador' })).toHaveAttribute(
    'data-disabled',
  )
  await expect(page.getByRole('option', { name: 'Atención' })).toHaveAttribute('data-disabled')
  await page.keyboard.press('Escape')
  await pick(page, rolesSelect, 'Catálogo')
  await dialog.getByRole('button', { name: 'Crear staff' }).click()

  const password = page.getByRole('dialog', { name: 'Contraseña temporal' })
  await expect(password.getByLabel('Contraseña temporal')).toHaveText(
    /^[a-z0-9]{4}(-[a-z0-9]{4}){4}$/,
  )
  expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({
    email: 'luis@example.com',
    firstNames: 'Luis',
    lastNames: 'García',
    roleIds: [api.roles[1]!.id],
  })
  await password.getByRole('button', { name: 'Ya la guardé' }).click()
  await expect(password).toBeHidden()
  await expect(page.getByRole('row', { name: /luis@example.com/ })).toContainText(
    'Contraseña temporal',
  )
})

test('staff: cambiar roles, suspender y reactivar; nadie se suspende a sí mismo', async ({
  page,
}) => {
  await mockAuthApi(
    page,
    // Un superadministrador recibe todos los permisos en GET /v1/me.
    staff(
      PERMISSIONS.map(([code]) => code),
      { roles: [{ id: SUPER_ROLE, name: 'Superadministrador' }] },
    ),
  )
  const api = await mockIdentityApi(page, {
    roles: ROLES,
    staff: [
      { email: 'ana@example.com', firstNames: 'Ana', roles: ['Superadministrador'], self: true },
      { email: 'luis@example.com', firstNames: 'Luis', roles: ['Catálogo'] },
    ],
  })
  await login(page)
  await page.goto(`/staff/${SELF_ID}`)
  await expect(page.getByText('Tú', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Suspender' })).toHaveCount(0)

  await page.goto(`/staff/${api.staff[1]!.id}`)
  await page.getByRole('button', { name: 'Cambiar roles' }).click()
  await pick(page, page.getByRole('button', { name: /^Roles/ }), 'Atención')
  await page.getByRole('button', { name: 'Guardar roles' }).click()
  await expect(page.getByRole('list', { name: 'Roles del staff' })).toContainText('Atención')
  expect(api.calls.find((c) => c.method === 'PUT')?.body).toEqual({
    roleIds: [api.roles[1]!.id, api.roles[2]!.id],
    version: 1,
  })

  await page.getByRole('button', { name: 'Suspender' }).click()
  await page.getByRole('dialog').getByLabel('Motivo').fill('Baja temporal')
  await page.getByRole('dialog').getByRole('button', { name: 'Suspender' }).click()
  await expect(page.locator('header').getByText('Suspendido', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Reactivar' }).click()
  await page.getByRole('dialog').getByLabel('Motivo').fill('Regresa')
  await page.getByRole('dialog').getByRole('button', { name: 'Reactivar' }).click()
  const password = page.getByRole('dialog', { name: 'Contraseña temporal' })
  await expect(password).toContainText('luis@example.com')
  await password.getByRole('button', { name: 'Ya la guardé' }).click()
  await expect(page.locator('header').getByText('Activo', { exact: true })).toBeVisible()
})

test('roles: crear con los permisos propios, editar y eliminar', async ({ page }) => {
  await mockAuthApi(page, staff(['staff.manage', 'catalog.read', 'orders.read']))
  const api = await mockIdentityApi(page, {
    roles: ROLES,
    staff: [{ email: 'luis@example.com', firstNames: 'Luis', roles: ['Catálogo'] }],
  })
  await login(page)
  await page.goto('/roles')
  await expect(page.getByRole('button', { name: 'Eliminar Catálogo' })).toBeDisabled()

  await page.getByRole('button', { name: 'Nuevo rol' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nombre').fill('Consulta')
  await expect(dialog.getByLabel('Editar el catálogo')).toBeDisabled()
  // Un permiso exclusivo del superadministrador no se ofrece en otro rol (ADR-0162).
  await expect(dialog.getByLabel('Configurar los pagos')).toHaveCount(0)
  await dialog.getByLabel('Consultar el catálogo').check()
  await dialog.getByLabel('Consultar pedidos').check()
  await dialog.getByRole('button', { name: 'Crear rol' }).click()
  await expect(dialog).toBeHidden()
  expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({
    name: 'Consulta',
    permissions: ['catalog.read', 'orders.read'],
  })

  await page.getByRole('button', { name: 'Editar Consulta' }).click()
  await dialog.getByLabel('Descripción').fill('Solo lectura')
  await dialog.getByLabel('Consultar pedidos').uncheck()
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(dialog).toBeHidden()
  expect(api.calls.find((c) => c.method === 'PATCH')?.body).toEqual({
    version: 1,
    description: 'Solo lectura',
    permissions: ['catalog.read'],
  })
  await expect(page.getByRole('row', { name: /Consulta/ })).toContainText('Solo lectura')

  await page.getByRole('button', { name: 'Eliminar Consulta' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click()
  await expect(page.getByRole('row', { name: /Consulta/ })).toHaveCount(0)
})
