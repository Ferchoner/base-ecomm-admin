import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // Opcional: Chromium ya instalado en la máquina (por ejemplo, en entornos sin descarga).
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // Requiere `npm run build` antes; la API se simula con page.route (tests/e2e/mock-api.ts).
  webServer: {
    command: `node tests/e2e/serve.mjs`,
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
  },
})
