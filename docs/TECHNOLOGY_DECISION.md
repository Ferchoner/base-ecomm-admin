# TECHNOLOGY_DECISION

**Última actualización:** 2026-10-05. Stack aprobado por el usuario el 2026-10-05 (DECISIONS D-P01…D-P17). Versiones instaladas según `package-lock.json`.

## Stack

| Área                  | Tecnología                                          | Versión        | Decisión     | Por qué                                                                                             |
| --------------------- | --------------------------------------------------- | -------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| Framework             | Nuxt (SPA, `ssr: false`, `nuxt generate`)           | 4.5.2          | D-001, D-P02 | Exigido por el proyecto; la API no usa cookies, así que SSR o un BFF no aportan y suman un servidor |
| UI                    | Vue 3 + TypeScript estricto                         | 3.5.43 · 5.9.3 | D-001, D-018 | TS fijado en `~5.9`: TS 7 no expone la API que usan `openapi-typescript` y `vue-tsc`                |
| Componentes           | Nuxt UI + Tailwind CSS                              | 4.11.3 · 4.3.3 | D-P05        | Componentes accesibles listos para backoffice (dashboard, tablas, formularios, modales)             |
| Server state          | TanStack Query (`@tanstack/vue-query`)              | 5.104.1        | D-P06        | Cache, invalidación, estados de carga y error, cancelación; reintentos controlados                  |
| Client state          | Pinia                                               | 4.0.3          | D-P07        | Solo sesión y preferencias; nunca datos del servidor                                                |
| HTTP                  | ofetch envuelto en un cliente propio                | 1.5.1          | D-P08        | Bearer, renovación ante 401, Problem Details, `Idempotency-Key`, timeout                            |
| Tipos del contrato    | `openapi-typescript`                                | 7.13.0         | D-P09        | Tipos generados de `openapi/v1.json`; sin escribir DTO a mano                                       |
| Validación            | Zod                                                 | 4.6.5          | D-P10        | Esquemas de formularios con los límites de API_SPEC, integrados con `UForm`                         |
| PWA                   | `@vite-pwa/nuxt` (Workbox)                          | 1.1.1          | D-P13, D-056 | Manifest y service worker online-first sin escribir Workbox a mano                                  |
| Pruebas unitarias     | Vitest + `@nuxt/test-utils` + happy-dom             | 5.0.3          | D-P11        | Mismo pipeline de Vite que la app                                                                   |
| Simulación de API     | MSW (solo pruebas unitarias)                        | 2.15.0         | D-P11        | Prueba el cliente HTTP contra respuestas reales de red                                              |
| E2E                   | Playwright (Chromium escritorio y móvil)            | 1.63.0         | D-P11        | Prueba el build estático con la API simulada en `page.route`                                        |
| Accesibilidad         | `@axe-core/playwright`                              | 4.13.0         | D-058        | WCAG 2.1 A/AA automático en cada pantalla                                                           |
| Calidad               | `@nuxt/eslint` (ESLint 10) + Prettier 3 + `vue-tsc` | —              | D-P12, D-022 | Lint con reglas de arquitectura y seguridad; formato; typecheck estricto                            |
| CI                    | GitHub Actions (`.github/workflows/ci.yml`)         | —              | D-P12        | La misma secuencia del gate local en cada PR y en `main`                                            |
| Runtime de desarrollo | Node.js 22 (`.nvmrc`)                               | 22             | —            | Requisito de Nuxt 4 y de las herramientas                                                           |

## Alternativas descartadas

| Alternativa                   | Motivo                                                                    |
| ----------------------------- | ------------------------------------------------------------------------- |
| SSR o BFF con Nitro           | La API no usa cookies; un servidor extra sin beneficio (D-P02)            |
| `useFetch`/`useAsyncData`     | Sin invalidación por llaves ni control fino de reintentos (D-P06)         |
| openapi-fetch, axios          | El cliente propio sobre ofetch cubre renovación y Problem Details (D-P08) |
| PrimeVue, Vuetify             | Nuxt UI se integra con Nuxt 4 y Tailwind 4 (D-P05)                        |
| VeeValidate                   | `UForm` + Zod basta                                                       |
| dayjs, date-fns               | `Intl.DateTimeFormat` basta                                               |
| `@nuxtjs/i18n`                | Solo español (D-036)                                                      |
| Cypress                       | Playwright cubre escritorio y móvil con un solo runner                    |
| Husky / lint-staged           | CI obligatorio cubre el control                                           |
| DDD por capas en cada feature | Sin lógica de dominio propia en el frontend (D-P17)                       |

## Configuración relevante

- `nuxt.config.ts`: `ssr: false`, TS estricto con `noUncheckedIndexedAccess`, iconos en el bundle (`icon.provider: 'none'`), sin fuentes remotas (`ui.fonts: false`), `robots: noindex`, PWA.
- `runtimeConfig.public.apiBaseUrl` ← `NUXT_PUBLIC_API_BASE_URL`, **fijado al construir** (D-019).
- `eslint.config.mjs`: `no-restricted-imports` entre features y `vue/no-v-html` como error (D-022).
- `playwright.config.ts`: proyectos `desktop` (Desktop Chrome) y `mobile` (Pixel 7), `serviceWorkers: 'block'` salvo en `pwa.spec.ts` (D-060), servidor estático propio (`tests/e2e/serve.mjs`).

## Riesgos de las dependencias

- `npm audit`: 11 altas y 1 baja en herramientas de build de Nuxt (`node-forge`, `braces`/`micromatch`, `esbuild` en Windows). `nuxt` 4.5.2 es la versión más reciente publicada y sigue afectada; ninguna llega al bundle estático (QA-05).
- `typescript` fijado en 5.9 hasta que `openapi-typescript` y `vue-tsc` soporten TS 7 (D-018).
- `msw` 3 está publicado; la actualización no es necesaria para el MVP.
