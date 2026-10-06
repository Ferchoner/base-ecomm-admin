// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  ssr: false,
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@nuxt/eslint', '@pinia/nuxt', '@nuxt/test-utils/module', '@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'es-MX' },
      title: 'Backoffice',
      meta: [
        { name: 'robots', content: 'noindex, nofollow' },
        { name: 'theme-color', content: '#4f46e5' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon-180x180.png' },
      ],
    },
  },
  runtimeConfig: {
    public: {
      // Base de la API sin el prefijo /v1. Se sobrescribe con NUXT_PUBLIC_API_BASE_URL.
      apiBaseUrl: 'http://localhost:3000',
      // Versión del aviso de privacidad que el staff presenta a un invitado en la tienda física
      // (ADR-0161). La API no la expone (GAPS G-19): debe ser la misma que usa la tienda en línea.
      // Se sobrescribe con NUXT_PUBLIC_PRIVACY_NOTICE_VERSION; vacía, no se aceptan invitados.
      privacyNoticeVersion: '',
    },
  },
  typescript: {
    strict: true,
    typeCheck: false,
    tsConfig: {
      compilerOptions: {
        noUncheckedIndexedAccess: true,
      },
    },
  },
  eslint: {
    config: { stylistic: false },
  },
  ui: {
    fonts: false,
  },
  // SPA estática sin servidor: los iconos van en el bundle, sin pedirlos a la API de Iconify.
  icon: {
    provider: 'none',
    clientBundle: {
      scan: { globInclude: ['app/**/*.{vue,ts}'] },
    },
  },
  // PWA online-first (DECISIONS D-P13, docs/PWA_STRATEGY.md): se precachea solo el shell y sus
  // assets. La API vive en otro origen y nunca se cachea; sin conexión no se envía nada.
  pwa: {
    registerType: 'prompt',
    manifest: {
      name: 'Backoffice base-shop',
      short_name: 'Backoffice',
      description: 'Administración de la tienda base-shop',
      lang: 'es-MX',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: '#4f46e5',
      background_color: '#ffffff',
      icons: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        {
          src: '/maskable-icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      navigateFallback: '/',
      // Las rutas comparten el mismo shell: basta index.html y la navegación cae en él.
      globPatterns: ['**/*.{js,css,svg,png,ico,woff2,webmanifest}', 'index.html'],
      cleanupOutdatedCaches: true,
      runtimeCaching: [],
    },
    client: { installPrompt: false, periodicSyncForUpdates: 3600 },
    devOptions: { enabled: false },
  },
})
