import { expect, test } from '@playwright/test'
import type { Route } from '@playwright/test'
import { login, mockAuthApi, staff } from './mock-api'
import { mockOperationsApi } from './mock-operations'

test.describe('PWA', () => {
  test.use({ serviceWorkers: 'allow' })

  test('se puede instalar y abre el shell sin conexión', async ({ page, context }) => {
    await page.goto('/login')
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
    expect(manifestHref).toBeTruthy()
    const manifest = await (await page.request.get(manifestHref!)).json()
    expect(manifest).toMatchObject({
      name: 'Backoffice base-shop',
      short_name: 'Backoffice',
      lang: 'es-MX',
      display: 'standalone',
      start_url: '/',
    })
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
      expect.arrayContaining(['192x192', '512x512']),
    )
    for (const icon of manifest.icons as Array<{ src: string }>)
      expect((await page.request.get(icon.src)).headers()['content-type']).toBe('image/png')

    // El service worker queda activo y precachea el shell, nunca respuestas de la API.
    await page.evaluate(() => navigator.serviceWorker.ready)
    const cached = await page.evaluate(async () => {
      const urls: string[] = []
      for (const name of await caches.keys())
        for (const request of await (await caches.open(name)).keys()) urls.push(request.url)
      return urls
    })
    expect(cached.some((u) => new URL(u).pathname === '/')).toBe(true)
    expect(cached.some((u) => u.includes('/v1/'))).toBe(false)

    await context.setOffline(true)
    await page.goto('/pedidos')
    await expect(page.getByRole('status').filter({ hasText: 'Sin conexión' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
  })
})

test('sin conexión un cambio no se guarda ni se envía solo al reconectar', async ({
  page,
  context,
}) => {
  await mockAuthApi(page, staff(['shipping.manage', 'shipping.configure']))
  const api = await mockOperationsApi(page)
  await login(page)
  await page.goto('/configuracion/envio')
  await expect(page.getByLabel('Costo de envío')).toHaveValue('99')

  // page.route responde aunque el contexto esté sin conexión: mientras dure, la API no contesta.
  const unreachable = (route: Route) => route.abort('internetdisconnected')
  await context.setOffline(true)
  await page.route('**/v1/**', unreachable)
  await expect(page.getByRole('status').filter({ hasText: 'Sin conexión' })).toBeVisible()
  await page.getByLabel('Costo de envío').fill('150')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Revisa tu conexión e inténtalo de nuevo.').first()).toBeVisible()

  await page.unroute('**/v1/**', unreachable)
  await context.setOffline(false)
  await expect(page.getByRole('status').filter({ hasText: 'Sin conexión' })).toBeHidden()
  await page.waitForTimeout(500)
  expect(api.calls.filter((c) => c.method === 'PUT')).toHaveLength(0)
})
