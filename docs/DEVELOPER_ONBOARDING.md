# DEVELOPER_ONBOARDING

**Última actualización:** 2026-10-05. Guía para empezar a trabajar en `base-ecomm-admin`. Lee primero `CLAUDE.md` (reglas del proyecto) y FRONTEND_ARCHITECTURE.md.

## 1. Requisitos

| Herramienta            | Versión                           | Para qué                                                     |
| ---------------------- | --------------------------------- | ------------------------------------------------------------ |
| Node.js                | 22 (`.nvmrc`)                     | Todo                                                         |
| npm                    | el de Node 22                     | Dependencias (`package-lock.json` versionado)                |
| Docker + Compose       | reciente                          | Levantar la API de `base-shop` en local                      |
| Chromium de Playwright | `npx playwright install chromium` | E2E (o una ruta propia con `PLAYWRIGHT_CHROMIUM_EXECUTABLE`) |
| Git                    | —                                 | Ramas y PR en inglés con Conventional Commits                |

## 2. Levantar la API en local

En el repo `Ferchoner/base-shop` (ver su README):

```bash
cp .env.example .env
# En .env del backend:
#   CORS_ALLOWED_ORIGINS=http://localhost:3001     # origen del backoffice
#   FRONTEND_BASE_URL=http://localhost:3001        # enlaces de recuperación al backoffice (G-01)
#   MANUAL_PAYMENTS_ENABLED=true                   # solo si vas a probar pagos manuales (G-02)
docker compose up --build
docker compose exec api npm run db:migrate:deploy
docker compose exec api node dist/scripts/import-geo-catalog.js data/inegi/municipios-2026-06.csv
docker compose exec -e SUPERADMIN_EMAIL=tu@correo.test -e SUPERADMIN_FIRST_NAMES=Nombre \
  -e SUPERADMIN_LAST_NAMES=Apellido api node dist/scripts/create-first-superadmin.js
```

El último comando muestra una contraseña temporal una sola vez. La API queda en `http://localhost:3000`, Swagger en `/docs/v1` y los correos (recuperación de contraseña) en Mailpit, `http://localhost:8025`.

## 3. Levantar el backoffice

```bash
npm install
cp .env.example .env          # NUXT_PUBLIC_API_BASE_URL=http://localhost:3000
npm run dev -- --port 3001
```

Abre `http://localhost:3001`, entra con el superadministrador y cambia la contraseña temporal. Para dar acceso a otras personas, crea staff en **Staff**.

## 4. Scripts

| Script                                | Uso                                                                                                   |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run dev`                         | Servidor de desarrollo con recarga                                                                    |
| `npm run build`                       | Build estático (`nuxt generate`) en `.output/public`                                                  |
| `npm run preview`                     | Sirve el build                                                                                        |
| `npm run lint`                        | ESLint (incluye la regla entre features y `vue/no-v-html`)                                            |
| `npm run format` / `format:check`     | Prettier                                                                                              |
| `npm run typecheck`                   | `vue-tsc` estricto                                                                                    |
| `npm test`                            | Vitest (unidad, componentes y cliente con MSW)                                                        |
| `npm run test:e2e`                    | Playwright sobre `.output/public`, escritorio y móvil, con la API simulada (requiere `npm run build`) |
| `npm run api:types`                   | Regenera `app/shared/api/generated/openapi.d.ts` desde `openapi/v1.json`                              |
| `node scripts/generate-pwa-icons.mjs` | Regenera los iconos de `public/`                                                                      |

**Gate antes de abrir un PR** (el mismo que corre CI):

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run test:e2e
```

## 5. Mapa del código

```
app/
  pages/            una página por ruta (ROUTE_MAP.md)
  features/<x>/     api.ts · schemas.ts · types.ts · status.ts · components/
  components/       UI compartida (DESIGN_SYSTEM.md)
  shared/           api/ (cliente, errores, tipos generados) · auth/ · preferences/ · status/ · ui/ · utils/ · navigation.ts
  plugins/          01.api.ts (cliente y sesión) · 02.vue-query.ts
  middleware/       auth.global.ts (sesión, contraseña forzada, permiso de ruta)
openapi/v1.json     copia fijada del contrato
tests/unit/         Vitest por feature y shared
tests/e2e/          <módulo>.spec.ts + mock-<módulo>.ts, a11y.spec.ts, pwa.spec.ts
docs/               documentación del proyecto (índice en HANDOVER.md)
```

## 6. Cómo agregar una pantalla o acción

1. **Confirma el contrato.** Busca la operación en API_SPEC y en `openapi/v1.json` del commit fijado. Si falta algo, no lo inventes: regístralo en `docs/GAPS.md`.
2. **Tipos:** alias en `features/<x>/types.ts` desde `Schemas[...]`.
3. **API:** query o mutación en `features/<x>/api.ts`; llaves con la raíz de la feature (`QUERY_ROOT` si otra feature debe invalidarla); envía la `version` leída en recursos versionados; acciones de estado por su `POST`, nunca por PATCH.
4. **Formulario:** esquema Zod en `schemas.ts` con los límites de API_SPEC; errores de la API con `problemFieldErrors`.
5. **Estados:** etiquetas y transiciones permitidas en `status.ts`.
6. **Página:** `definePageMeta({ title, permission })`; filtros con `useListParams`; carga, vacío y error con `QueryState`; acciones ocultas sin `session.can(...)`.
7. **Navegación:** si es una sección nueva, agrégala a `app/shared/navigation.ts` con su permiso de lectura.
8. **Pruebas:** unidad para esquemas y transiciones; E2E con su mock (formas del OpenAPI, sin campos inventados), un caso de permisos y al menos un error de la API; agrega la pantalla a `PAGES` en `a11y.spec.ts`.
9. **Docs:** TRACEABILITY.md, SCREEN_INVENTORY.md, ROUTE_MAP.md, AUTHORIZATION_MATRIX.md y, si decidiste algo, DECISIONS.md.

## 7. Convenciones

- Interfaz en español (es-MX); código, ramas, commits y PR en inglés (Conventional Commits).
- Una feature no importa a otra; lo común va a `shared` o lo compone la página.
- Nada de server state en Pinia; nada de reintentos automáticos de mutaciones.
- Sin `v-html`, sin secretos, sin `console.*` con datos.
- Comentarios en español, solo donde explican el porqué (normalmente una regla de API_SPEC o una decisión).

## 8. Problemas frecuentes

| Síntoma                                                 | Causa y solución                                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| "No se pudo conectar con la API" en el login            | API apagada, URL distinta en `.env` o el origen no está en `CORS_ALLOWED_ORIGINS` del backend           |
| Cambié `.env` y no se nota en el build                  | `NUXT_PUBLIC_API_BASE_URL` se fija al construir (D-019): vuelve a correr `npm run build`                |
| "Esta cuenta no tiene acceso al backoffice"             | Es una cuenta de cliente; usa una de staff                                                              |
| Registrar pago responde 403 "pago manual deshabilitado" | `MANUAL_PAYMENTS_ENABLED=false` en el backend (G-02)                                                    |
| El enlace de recuperación abre otra URL                 | `FRONTEND_BASE_URL` del backend no apunta al backoffice (G-01)                                          |
| `npm run api:types` falla con TypeScript 7              | TS está fijado en `~5.9` (D-018); no lo actualices                                                      |
| E2E: `ENOENT` en `test-results` o trazas perdidas       | Dos corridas de Playwright a la vez comparten `test-results`; corre una sola                            |
| E2E sin Chromium descargado                             | `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/ruta/a/chromium npm run test:e2e`                                      |
| `USelect` lanza error con una opción de valor `''`      | Nuxt UI no admite valor vacío en un item: usa `placeholder` y deja la opción "Todos" fuera de los items |
| Un cambio no se guarda tras perder la conexión          | Es lo esperado (D-057): reintenta a mano al volver la red                                               |
