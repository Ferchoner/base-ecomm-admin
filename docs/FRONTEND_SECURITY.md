# FRONTEND_SECURITY

**Última actualización:** 2026-10-05. Controles del frontend y lo que depende del servidor que lo publique. Autenticación en AUTHENTICATION.md; permisos en AUTHORIZATION_MATRIX.md.

## Principios

1. La API es la frontera de seguridad: autoriza cada solicitud. El frontend no protege datos, solo evita ofrecer lo que no se puede hacer.
2. Ningún secreto en el repo ni en el bundle. La única variable es pública: `NUXT_PUBLIC_API_BASE_URL`.
3. Mínima superficie: SPA estática, sin scripts ni fuentes de terceros, sin servidor propio.

## Controles implementados

| Área               | Control                                                                                                                                                                  | Evidencia                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| XSS                | Sin `v-html` (ESLint `vue/no-v-html` como error); todo dato de la API se interpola escapado; `changes` de auditoría y el contenido de eventos se muestran como texto     | `eslint.config.mjs`, D-022, D-053                             |
| Terceros           | Iconos Lucide en el bundle (sin Iconify remoto), sin fuentes remotas, sin analítica ni CDN                                                                               | `nuxt.config.ts` (`icon.provider: 'none'`, `ui.fonts: false`) |
| Tokens             | Acceso solo en memoria; refresh en `localStorage`; renovación de una en una                                                                                              | AUTHENTICATION.md, D-P03                                      |
| Redirecciones      | `safeRedirect` rechaza `//host` y `/\host`                                                                                                                               | `shared/auth/redirect.ts`, `utils.spec.ts`                    |
| Cache de datos     | La PWA no cachea la API (`runtimeCaching: []`); la cache de TanStack Query se vacía al cerrar sesión                                                                     | PWA_STRATEGY.md, `02.vue-query.ts`                            |
| Datos personales   | Datos bloqueados con motivo, solo en el modal y fuera de la cache (D-042); contraseña temporal mostrada una vez (D-047); anonimizar exige confirmación reforzada (D-046) | `features/orders`, `features/staff`, `features/customers`     |
| Acciones repetidas | Mutaciones sin reintento y sin cola sin conexión (D-057); `Idempotency-Key` en reintegros (D-041)                                                                        | `02.vue-query.ts`, `RestockModal.vue`                         |
| Indexación         | `<meta name="robots" content="noindex, nofollow">`                                                                                                                       | `nuxt.config.ts`                                              |
| Registros          | Sin `console.*` en `app/`; los errores muestran `correlationId`, no trazas                                                                                               | búsqueda en el código                                         |
| Archivos           | Imágenes y CSV se envían como `multipart/form-data`; tipo y tamaño los valida la API (413/415 con su mensaje)                                                            | D-027                                                         |
| Dependencias       | `npm audit` en la revisión; CI con `permissions: contents: read`                                                                                                         | QA_REPORT QA-05, `.github/workflows/ci.yml`                   |
| Source maps        | El build no publica `.map` del cliente                                                                                                                                   | `.output/public` sin `.map`                                   |

## Lo que depende del servidor (no existe todavía: G-07)

El MVP corre en local (D-035), así que estos controles no están aplicados en ningún ambiente. Deben configurarse donde se publique (DEPLOYMENT.md):

| Control                 | Valor recomendado                                                                                                                                                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTPS                   | Obligatorio (también lo exige el service worker)                                                                                                                                                                                                                                        |
| Content-Security-Policy | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: <origen de IMAGE_BASE_URL>; connect-src 'self' <origen de la API>; font-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` |
| Otros encabezados       | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` sin cámara, micrófono ni geolocalización                                                                                                                                    |
| CORS en el backend      | El origen exacto del backoffice en `CORS_ALLOWED_ORIGINS`                                                                                                                                                                                                                               |
| Caché                   | `sw.js`, `manifest.webmanifest` e `index.html` con `no-cache`; `/_nuxt/*` inmutable                                                                                                                                                                                                     |

`style-src 'unsafe-inline'` es necesario porque Nuxt UI y Vue aplican estilos en línea; la CSP final debe probarse con el build antes de activarla (pendiente en RELEASE_CHECKLIST.md).

## Riesgos aceptados

| Riesgo                                                | Motivo                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Refresh token accesible a JavaScript (`localStorage`) | La API no usa cookies; la alternativa (`sessionStorage`) revoca sesiones con pestañas duplicadas (D-P03) |
| `npm audit` con 11 altas en herramientas de build     | No llegan al bundle; Nuxt 4.5.2 es la última versión publicada (QA-05)                                   |

## Reglas para quien desarrolle

- Nunca `v-html`, `innerHTML` ni `eval` con datos de la API.
- Nunca guardar tokens, contraseñas temporales ni datos bloqueados en Pinia persistente, `localStorage` o la cache de TanStack Query.
- Nunca registrar tokens ni datos personales en consola.
- Nunca agregar scripts, fuentes o servicios externos sin actualizar la CSP y este documento.
- Ningún secreto en `.env`: todo `NUXT_PUBLIC_*` termina en el bundle.
