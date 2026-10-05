// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  ssr: false,
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@nuxt/eslint', '@pinia/nuxt', '@nuxt/test-utils/module'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'es-MX' },
      title: 'Backoffice',
      meta: [{ name: 'robots', content: 'noindex, nofollow' }],
    },
  },
  runtimeConfig: {
    public: {
      // Base de la API sin el prefijo /v1. Se sobrescribe con NUXT_PUBLIC_API_BASE_URL.
      apiBaseUrl: 'http://localhost:3000',
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
})
