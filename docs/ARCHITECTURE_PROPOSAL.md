# ARCHITECTURE_PROPOSAL — Backoffice base-shop

**Estado:** PROPUESTA, pendiente de aprobación. No se implementan módulos de negocio hasta aprobarla.
**Contrato:** API_SOURCE_OF_TRUTH.md (base-shop `a46829b`). Decisiones referidas: DECISIONS.md (D-Pxx).

## 1. Producto

- **Usuarios:** cuentas STAFF de la API. Roles iniciales sembrados por el backend (editables): Superadministrador (todo), Administrador (todo menos `staff.manage`), Operador (catálogo, precios, inventario, `orders.read`, `shipping.manage`, `customers.read`). El frontend **no codifica roles**: decide solo por `permissions` de `GET /v1/me`.
- **Objetivo:** operar el e-commerce existente: catálogo, precios, inventario, pedidos, pagos manuales, envíos, clientes, staff, auditoría.
- **Fuera de alcance (sin API):** reportes de ventas, promociones, plantillas de correo, edición de pedidos, CMS, PayPal, reintento de reembolso con proveedor (GAPS).

## 2. Mapa de navegación y rutas (Nuxt, `app/pages`)

Cada sección se muestra en el menú solo si el usuario tiene el permiso de lectura indicado.

| Sección         | Rutas                                                                                                     | Permiso para ver                    | Acciones (permiso)                                                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acceso          | `/login`, `/recuperar-contrasena`, `/cambiar-contrasena` (forzada)                                        | público / token                     | —                                                                                                                                                           |
| Inicio          | `/`                                                                                                       | cualquiera (tarjetas según permiso) | —                                                                                                                                                           |
| Productos       | `/catalogo/productos`, `/nuevo`, `/[id]` (pestañas: datos, variantes, imágenes, precios, stock)           | `catalog.read`                      | crear/editar/publicar/archivar/reactivar, variantes, imágenes (`catalog.write`)                                                                             |
| Categorías      | `/catalogo/categorias` (árbol)                                                                            | `catalog.read`                      | crear/editar/mover/desactivar/borrar (`catalog.write`)                                                                                                      |
| Marcas          | `/catalogo/marcas`                                                                                        | `catalog.read`                      | `catalog.write`                                                                                                                                             |
| Precios         | `/precios` (lista GENERAL + importación CSV con dry-run); periodos por variante en el detalle de producto | `pricing.read`                      | fijar/programar/cancelar, importar (`pricing.write`)                                                                                                        |
| Inventario      | `/inventario/stock`, `/inventario/stock/[id]` (movimientos), `/inventario/almacen`                        | `inventory.read`                    | entradas, ajustes, editar almacén (`inventory.write`)                                                                                                       |
| Pedidos         | `/pedidos`, `/pedidos/[id]`                                                                               | `orders.read`                       | cancelar, reintentar surtido (`orders.manage`); registrar pago (`payments.manage`); reintegro (`inventory.write`); datos bloqueados (`orders.read-blocked`) |
| Pagos           | `/pagos`, `/pagos/[id]`                                                                                   | `orders.read`                       | reembolso manual (`payments.manage`)                                                                                                                        |
| Envíos          | `/envios`, `/envios/[id]`                                                                                 | `shipping.manage`                   | guía, despachar, entregar, fallo, devolución (`shipping.manage`)                                                                                            |
| Método de envío | `/configuracion/envio`                                                                                    | `shipping.manage`                   | editar (`shipping.configure`)                                                                                                                               |
| Clientes        | `/clientes`, `/clientes/[id]`, `/clientes/anonimizar-invitado`                                            | `customers.read`                    | suspender, reactivar, anonimizar (`customers.manage`)                                                                                                       |
| Staff           | `/staff`, `/staff/nuevo`, `/staff/[id]`                                                                   | `staff.manage`                      | todo `staff.manage`                                                                                                                                         |
| Roles           | `/roles`, `/roles/[id]`                                                                                   | `staff.manage`                      | `staff.manage`                                                                                                                                              |
| Auditoría       | `/auditoria`                                                                                              | `audit.read`                        | —                                                                                                                                                           |
| Eventos         | `/operacion/eventos`                                                                                      | `events.manage`                     | reintentar                                                                                                                                                  |
| Mi cuenta       | `/cuenta` (perfil, cambiar contraseña, cerrar sesión)                                                     | token                               | —                                                                                                                                                           |

Layouts: `auth` (pantallas de acceso) y `default` (sidebar colapsable, header con usuario, breadcrumbs; en móvil, sidebar en drawer).

## 3. Estructura de código

```
app/
  app.vue · app.config.ts · error.vue
  layouts/            default.vue, auth.vue
  pages/              rutas finas: componen componentes de features, sin lógica
  middleware/         auth.global.ts (sesión, mustChangePassword, cuenta STAFF), permission.ts (meta.permission)
  plugins/            vue-query.client.ts, api.client.ts, session.client.ts
  shared/
    api/              client.ts (ofetch + refresh single-flight), problem.ts (ApiProblem tipado),
                      pagination.ts, query-keys.ts, generated/openapi.d.ts
    auth/             session.store.ts (Pinia), token-storage.ts, permissions.ts (can())
    ui/               DataTable, PageHeader, StatusBadge, MoneyText, DateText, ConfirmDialog
                      (con motivo), ProblemAlert, EmptyState, ErrorState, FilterBar
    utils/            money.ts, dates.ts, form-errors.ts (errors[].field → UForm)
  features/
    catalog/ pricing/ inventory/ orders/ payments/ shipping/ customers/ staff/ audit/ events/ dashboard/ account/
      api.ts          composables useXxxQuery / useXxxMutation (TanStack Query)
      schemas.ts      Zod de formularios, alineado al contrato
      types.ts        alias de tipos generados
      status.ts       etiquetas y colores de enums (con fallback para valores desconocidos)
      components/
tests/
  unit/ · integration/ (MSW) · e2e/ (Playwright)
openapi/v1.json       copia fijada del contrato
```

## 4. Flujos transversales

**Autenticación (D-P03).** Login → `AuthResult`. Access token en memoria; refresh en `localStorage`. Al iniciar la app: si hay refresh, se renueva y se carga `GET /v1/me`. Si `type !== STAFF` → cierre de sesión con mensaje "Esta cuenta no tiene acceso al backoffice". Si `mustChangePassword` → solo `/cambiar-contrasena`. Renovación proactiva antes del vencimiento (`accessTokenExpiresIn`) y reactiva ante 401, siempre single-flight con `navigator.locks` para que dos pestañas nunca renueven a la vez. `invalid-refresh-token` → logout local y redirección a `/login?redirect=…`.

**Autorización de interfaz.** `can('orders.manage')`. Rutas con `definePageMeta({ permission })`. Acciones sin permiso no se muestran. Ante 403 `forbidden` se recarga `GET /v1/me` (los roles pudieron cambiar) y se muestra aviso.

**Errores (Problem Details).** Un único `ApiProblem { type, status, title, detail, correlationId, errors?, ...ext }`.

| Caso                                                 | Comportamiento                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 400 `validation-error` / `password-policy-violation` | Errores por campo en el formulario; los que no tienen campo, en alerta             |
| 401                                                  | Un intento de refresh y repetir; si falla, logout                                  |
| 403 `password-change-required`                       | Redirige a cambio obligatorio                                                      |
| 403 `forbidden` / `manual-payments-disabled`         | Aviso; recarga de permisos                                                         |
| 404                                                  | Estado "no encontrado" en la página                                                |
| 409 `version-conflict`                               | Diálogo: "Otro usuario modificó este registro" → recargar                          |
| 409 otros                                            | `title`/`detail` del backend + datos de la extensión (`lines`, `fields`, `limit`…) |
| 413 / 415                                            | Mensaje de archivo (tamaño `maxBytes`, formato)                                    |
| 429                                                  | Mensaje con `Retry-After`; sin reintento automático de mutaciones                  |
| 5xx / red                                            | Error genérico con `correlationId` copiable para soporte                           |

**Server state.** TanStack Query: claves por recurso y filtros; filtros y paginación en la URL (`?page=&status=`); `placeholderData` para no parpadear; GET con 1 reintento solo en red/5xx; mutaciones sin reintento; invalidación del recurso y su listado al éxito. Las acciones devuelven el recurso actualizado: se escribe en cache con `setQueryData`.

**Concurrencia.** Todo formulario o acción sobre recurso versionado envía la `version` leída; nunca la del cache "más reciente" a escondidas.

**Consistencia eventual.** Tras captura manual, despacho, entrega o reembolso: aviso "El estado de la orden puede tardar unos segundos en actualizarse" y `refetchInterval` corto sobre la orden durante una ventana limitada (ASSUMPTION: 2 s durante 20 s).

**Acciones con motivo.** Suspender, reactivar, anonimizar, cancelar, datos bloqueados: diálogo de confirmación con campo `reason` y advertencia de "sin datos personales". Anonimizar exige confirmación reforzada (irreversible).

**Contraseñas temporales.** Al crear o reactivar staff, se muestran una sola vez con botón copiar; no se guardan en cache ni en estado persistente.

**Estados visuales.** Toda pantalla de datos tiene loading (skeleton), empty, error (con reintentar) y success (toast tras mutación).

## 5. Seguridad

Sin secretos en el repo; única variable pública `NUXT_PUBLIC_API_BASE_URL`. CSP estricta en el hosting, sin `v-html` con datos de la API. No se registran tokens ni datos personales en consola. `Cache-Control` de la API se respeta; la PWA no cachea `/v1/**`. El origen del backoffice debe estar en `CORS_ALLOWED_ORIGINS` del backend.

## 6. Plan por fases

| Fase                                                 | Contenido                                                                                                                | Sale con                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| F0 Bootstrap                                         | Nuxt 4 SPA, TS estricto, Nuxt UI, lint, Vitest, Playwright, CI, cliente API, tipos generados, layouts, manejo de errores | typecheck + lint + tests + build verdes |
| F1 Auth y cuenta                                     | Login, refresh multi-pestaña, cambio obligatorio, logout, perfil, cambio de contraseña, guards                           | E2E de login/logout/forzado             |
| F2 Catálogo                                          | Productos (variantes, imágenes, ciclo de vida), categorías, marcas; patrón CRUD reutilizable                             |                                         |
| F3 Precios + Inventario                              | Periodos por variante, importación CSV, stock, movimientos, entradas, ajustes, almacén                                   |                                         |
| F4 Pedidos + Pagos + Envíos                          | Listados, detalle, cancelar, pago manual, reembolso, reintegro, surtido, envíos                                          |                                         |
| F5 Clientes + Staff/Roles                            |                                                                                                                          |                                         |
| F6 Auditoría + Eventos + Método de envío + Dashboard |                                                                                                                          |                                         |
| Después                                              | QA completo, PWA, documentación, release, handover (prompts 50–82)                                                       |                                         |

Cada fase actualiza TRACEABILITY.md y PROJECT_STATE.md, y cierra con typecheck, lint, tests y build.
