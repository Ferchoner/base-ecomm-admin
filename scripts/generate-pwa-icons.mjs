// Genera los iconos de la PWA en public/ a partir del glifo "store" de Lucide (el mismo del sidebar).
// Uso: node scripts/generate-pwa-icons.mjs  (requiere Chromium de Playwright).
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const lucide = JSON.parse(
  readFileSync(new URL('../node_modules/@iconify-json/lucide/icons.json', import.meta.url)),
)
const glyph = lucide.icons.store.body.replaceAll('currentColor', '#ffffff')
const INDIGO = '#4f46e5' // indigo-600, el color primario de app.config.ts

/** `padding`: margen alrededor del glifo, en fracción del lado; los maskable necesitan más. */
function svg({ radius, padding }) {
  const inner = 24 / (1 - 2 * padding)
  const offset = (inner - 24) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${inner} ${inner}">
  <rect width="${inner}" height="${inner}" rx="${radius * inner}" fill="${INDIGO}"/>
  <g transform="translate(${offset} ${offset})">${glyph}</g>
</svg>`
}

const icons = [
  { file: 'icon.svg', size: null, radius: 0.22, padding: 0.2 },
  { file: 'pwa-192x192.png', size: 192, radius: 0.22, padding: 0.2 },
  { file: 'pwa-512x512.png', size: 512, radius: 0.22, padding: 0.2 },
  { file: 'maskable-icon-512x512.png', size: 512, radius: 0, padding: 0.3 },
  { file: 'apple-touch-icon-180x180.png', size: 180, radius: 0, padding: 0.22 },
  { file: 'favicon-32x32.png', size: 32, radius: 0.22, padding: 0.12 },
]

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
})
const page = await browser.newPage()
for (const icon of icons) {
  const markup = svg(icon)
  const target = new URL(`../public/${icon.file}`, import.meta.url)
  if (!icon.size) {
    writeFileSync(target, markup)
    continue
  }
  await page.setViewportSize({ width: icon.size, height: icon.size })
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}</style><img src="data:image/svg+xml;base64,${Buffer.from(markup).toString('base64')}" width="${icon.size}" height="${icon.size}">`,
  )
  writeFileSync(target, await page.screenshot({ omitBackground: true }))
}
await browser.close()
console.log(`Iconos generados: ${icons.map((i) => i.file).join(', ')}`)
