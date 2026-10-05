# FRONTEND_ARCHITECTURE

**Última actualización:** 2026-10-05. Describe el código real. La propuesta aprobada es ARCHITECTURE_PROPOSAL.md; las diferencias están al final.

## Vista general

```
Navegador
 └─ SPA estática (Nuxt 4, ssr: false) ── service worker (solo shell y assets)
     ├─ pages/          rutas: componen features
     ├─ features/<x>/   un contexto del backend: api.ts, schemas.ts, types.ts, status.ts, components/
     ├─ components/     componentes de UI compartidos
     ├─ shared/         cliente API, sesión, preferencias, utilidades, navegación
     └─ plugins/        01.api (cliente + sesión), 02.vue-query (QueryClient)
           │
           ▼ HTTPS, Bearer
     API base-shop /v1  (otro origen; CORS)
```

Modelo aprobado (D-P17, opción 1): feature slices alineados a los contextos del backend, lenguaje de la API y SOLID como guía. Sin capa de dominio en el frontend: las reglas de negocio son de la API; el frontend solo refleja lo que el contrato documenta (transiciones por estado, límites de campos).

## Capas y dependencias

```
pages ─▶ features ─▶ shared
  │          │          ▲
  └──────────┴─▶ components (UI compartida) ─┘
```

| Capa               | Contenido                                                                                                                        | Puede importar                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `app/pages`        | Una página por ruta: `definePageMeta` (título, permiso), filtros en la URL, columnas de tabla, composición de features           | features, components, shared         |
| `app/features/<x>` | Queries y mutaciones, esquemas Zod, alias de tipos generados, estados y transiciones, componentes de la feature                  | shared, components                   |
| `app/components`   | Componentes genéricos sin conocimiento de una feature (`QueryState`, `StatusBadge`, `ReasonDialog`…)                             | shared                               |
| `app/shared`       | `api/` (cliente, Problem Details, tipos, geo, llaves raíz), `auth/`, `preferences/`, `status/`, `ui/`, `utils/`, `navigation.ts` | components (tipos y `ConfirmDialog`) |

**Regla:** una feature no importa a otra. ESLint lo impide (`no-restricted-imports` en `app/features/*/**`, D-022). Cuando dos features comparten algo, pasa a `shared` (D-031, D-039, D-055) o la página las compone (D-028, D-038).

## Features

| Feature     | Contexto del backend           | Pantallas que la usan                                           |
| ----------- | ------------------------------ | --------------------------------------------------------------- |
| `account`   | identity (cuenta propia)       | Recuperar y restablecer contraseña, Mi cuenta                   |
| `catalog`   | catalog                        | Productos, Categorías, Marcas; buscador en Precios e Inventario |
| `pricing`   | pricing                        | Precios                                                         |
| `inventory` | inventory                      | Existencias, Almacén; conteo de stock bajo                      |
| `orders`    | orders                         | Pedidos; conteos; pedidos de un cliente                         |
| `payments`  | payments                       | Pagos; panel de pago del pedido                                 |
| `shipping`  | shipping                       | Envíos, Método de envío; panel de envío del pedido; conteo      |
| `customers` | identity (clientes)            | Clientes                                                        |
| `staff`     | identity (staff y roles)       | Staff, Roles                                                    |
| `audit`     | audit                          | Auditoría                                                       |
| `events`    | entregas de eventos (ADR-0150) | Eventos; conteo de fallidas                                     |

Archivos por feature:

| Archivo       | Responsabilidad                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `api.ts`      | Llaves (`xxxKeys`, empiezan con `QUERY_ROOT` cuando otra feature debe invalidarlas), `useXxx` (queries) y `useXxxMutation` |
| `types.ts`    | Alias de `Schemas[...]` generados; tipos a mano solo con excepción documentada (G-10, G-11)                                |
| `schemas.ts`  | Zod de formularios con los límites de API_SPEC                                                                             |
| `status.ts`   | Etiquetas y colores de enums; qué acciones admite cada estado                                                              |
| `components/` | Componentes con lógica de la feature (formularios, acciones, paneles)                                                      |

## Estado

| Tipo                     | Dónde                                                | Regla                                                                                                                                           |
| ------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Server state             | TanStack Query                                       | Nunca se copia a Pinia. `staleTime` 30 s; lecturas: 1 reintento solo en red, timeout o 5xx; mutaciones: sin reintento y `networkMode: 'always'` |
| Sesión                   | Pinia `session` (`app/shared/auth/session.store.ts`) | Token de acceso en memoria, cuenta y permisos de `GET /v1/me`, estado de la sesión                                                              |
| Preferencias             | Pinia `preferences`                                  | Umbral de stock bajo por cuenta en `localStorage` (D-034)                                                                                       |
| Vista (filtros, página)  | URL (`useListParams`)                                | `router.replace`; `page=1` y tamaño por defecto se omiten (D-025)                                                                               |
| Datos sensibles efímeros | Estado local del modal                               | Contraseña temporal y datos bloqueados: ni cache ni store; se pierden al cerrar (D-042, D-047)                                                  |

Al cerrar sesión (o expirar en otra pestaña) se vacía la cache de TanStack Query (`02.vue-query.ts`).

## Invalidación entre contextos

Algunas acciones cambian datos de otro contexto (cancelar un pedido inicia un reembolso y cancela el envío). Como una feature no importa las llaves de otra, las llaves de pedidos, pagos, envíos, inventario, clientes y staff empiezan con una raíz común (`QUERY_ROOT`) e `invalidateRoots(qc, now, later)` invalida:

- `now`: lo que la respuesta ya refleja.
- `later`: lo que cambia por un evento en segundo plano, 2.5 s después, con el aviso "El estado del pedido puede tardar unos segundos en actualizarse" (API_SPEC §2.5, D-040).

Las mutaciones que devuelven el recurso actualizado lo escriben en la cache (`setQueryData`) además de invalidar el listado.

## Flujo de una pantalla

1. El guard valida sesión, contraseña forzada y permiso de ruta.
2. La página lee filtros de la URL y llama a `useXxx(params)` de la feature.
3. La query usa `useApi()` (cliente con Bearer y renovación) y devuelve datos tipados por el OpenAPI.
4. `QueryState` muestra carga, error o vacío; la tabla o el detalle muestran datos.
5. Una acción abre un modal con `UForm` + Zod; la mutación envía la `version` leída si el recurso es versionado.
6. Éxito: toast e invalidación. Error: `notifyProblem` (toast) o errores por campo; `version-conflict` recarga y avisa; `forbidden` vuelve a leer permisos; `password-change-required` lleva al cambio forzado.

## Principios SOLID aplicados

| Principio | Dónde                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| SRP       | `api.ts` solo habla con la API; `status.ts` solo mapea estados; componentes de acción separados de los de lectura                           |
| OCP       | Estados como mapas (`Record<Status, StatusStyle>`); un valor nuevo de la API cae en neutro sin tocar código                                 |
| DIP       | La sesión recibe `AuthGateway`, `TokenStorage` y `RunExclusive` por `init()`; el cliente API recibe sus dependencias. Se prueban con dobles |
| ISP       | `RequestOptions` mínimo; `AuthGateway` solo con las operaciones de autenticación                                                            |

## Pruebas

Ver TESTING_STRATEGY.md. Unidad en `tests/unit/<feature>`, E2E por módulo en `tests/e2e/<módulo>.spec.ts` con su `mock-<módulo>.ts`.

## Diferencias con ARCHITECTURE_PROPOSAL.md

| Propuesta                                           | Implementado                                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `shared/ui/` con DataTable, PageHeader, MoneyText…  | `app/components/` con los componentes de la tabla de DESIGN_SYSTEM.md; tablas con `UTable` directo |
| `shared/auth/permissions.ts` con `can()`            | `can()` en el store de sesión                                                                      |
| `shared/api/pagination.ts`, `query-keys.ts`         | `use-list-params.ts` y `query-roots.ts`; las llaves viven en cada feature                          |
| Plugins `*.client.ts`                               | `01.api.ts` y `02.vue-query.ts` (la app ya es solo cliente)                                        |
| `middleware/permission.ts`                          | Permiso en `auth.global.ts`                                                                        |
| Feature `dashboard`                                 | El Inicio (`pages/index.vue`) compone queries de `orders`, `shipping`, `inventory` y `events`      |
| `tests/integration/`                                | Las pruebas con MSW viven en `tests/unit/shared/`                                                  |
| Ventana de refetch de 2 s durante 20 s (ASSUMPTION) | Una sola invalidación a los 2.5 s (D-040)                                                          |
| Páginas "finas, sin lógica"                         | Las páginas de listado tienen columnas y filtros (hasta 293 líneas); ver FINAL_TECHNICAL_REVIEW.md |
