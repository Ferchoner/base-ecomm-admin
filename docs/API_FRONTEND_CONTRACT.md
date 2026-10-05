# API_FRONTEND_CONTRACT

**Última actualización:** 2026-10-05 · **Contrato fijado:** `Ferchoner/base-shop` commit `a46829b` (API_SOURCE_OF_TRUTH.md). Copia local: `openapi/v1.json`; tipos: `app/shared/api/generated/openapi.d.ts` (`npm run api:types`).

Este documento dice qué partes del contrato usa el backoffice y con qué reglas. Cómo se llama a la API está en API_CLIENT_ARCHITECTURE.md.

## Resumen

| Grupo                                                                               | Operaciones en el contrato | Usadas         |
| ----------------------------------------------------------------------------------- | -------------------------- | -------------- |
| `/v1/admin/**`                                                                      | 80                         | 79             |
| Autenticación y cuenta del staff                                                    | 7                          | 7              |
| Geografía (`/v1/geo`)                                                               | 2                          | 2              |
| Tienda (carrito, checkout, pedidos y cuenta de cliente, catálogo público, webhooks) | resto                      | 0 (no aplican) |

Permiso por operación: `x-required-permissions` del OpenAPI. Se usa la ruta exacta del contrato; ningún endpoint, campo o parámetro se agrega a mano salvo las excepciones de la última sección.

## Autenticación, cuenta y geografía

| Operación                                       | Uso                                             | Feature / archivo             |
| ----------------------------------------------- | ----------------------------------------------- | ----------------------------- |
| `POST /v1/auth/login`                           | Iniciar sesión                                  | `shared/auth/auth-gateway.ts` |
| `POST /v1/auth/refresh`                         | Renovar (single-flight, también entre pestañas) | `shared/auth/auth-gateway.ts` |
| `POST /v1/auth/logout`                          | Cerrar sesión                                   | `shared/auth/auth-gateway.ts` |
| `GET /v1/me`                                    | Cuenta, roles, permisos y `mustChangePassword`  | `shared/auth/auth-gateway.ts` |
| `POST /v1/me/password`                          | Cambio de contraseña forzado o voluntario       | `shared/auth/auth-gateway.ts` |
| `POST /v1/auth/password-reset/request`          | Pedir enlace (202 exista o no la cuenta)        | `features/account`            |
| `POST /v1/auth/password-reset/confirm`          | Restablecer con `token` de la URL               | `features/account`            |
| `GET /v1/geo/states`                            | Estados del INEGI (sin token)                   | `shared/api/geo.ts`           |
| `GET /v1/geo/states/{stateCode}/municipalities` | Municipios                                      | `shared/api/geo.ts`           |

## Operaciones administrativas

### audit — Auditoría

| Operación             | Permiso      | Uso |
| --------------------- | ------------ | --- |
| `GET /v1/admin/audit` | `audit.read` | ✓   |

### catalog — Productos, Categorías, Marcas

| Operación                                                                      | Permiso         | Uso |
| ------------------------------------------------------------------------------ | --------------- | --- |
| `GET /v1/admin/catalog/brands`                                                 | `catalog.read`  | ✓   |
| `POST /v1/admin/catalog/brands`                                                | `catalog.write` | ✓   |
| `DELETE /v1/admin/catalog/brands/{brandId}`                                    | `catalog.write` | ✓   |
| `PATCH /v1/admin/catalog/brands/{brandId}`                                     | `catalog.write` | ✓   |
| `POST /v1/admin/catalog/brands/{brandId}/deactivate`                           | `catalog.write` | ✓   |
| `POST /v1/admin/catalog/brands/{brandId}/reactivate`                           | `catalog.write` | ✓   |
| `GET /v1/admin/catalog/categories`                                             | `catalog.read`  | ✓   |
| `POST /v1/admin/catalog/categories`                                            | `catalog.write` | ✓   |
| `DELETE /v1/admin/catalog/categories/{categoryId}`                             | `catalog.write` | ✓   |
| `PATCH /v1/admin/catalog/categories/{categoryId}`                              | `catalog.write` | ✓   |
| `POST /v1/admin/catalog/categories/{categoryId}/deactivate`                    | `catalog.write` | ✓   |
| `POST /v1/admin/catalog/categories/{categoryId}/reactivate`                    | `catalog.write` | ✓   |
| `GET /v1/admin/catalog/products`                                               | `catalog.read`  | ✓   |
| `POST /v1/admin/catalog/products`                                              | `catalog.write` | ✓   |
| `GET /v1/admin/catalog/products/{productId}`                                   | `catalog.read`  | ✓   |
| `PATCH /v1/admin/catalog/products/{productId}`                                 | `catalog.write` | ✓   |
| `POST /v1/admin/catalog/products/{productId}/archive`                          | `catalog.write` | ✓   |
| `POST /v1/admin/catalog/products/{productId}/images`                           | `catalog.write` | ✓   |
| `PUT /v1/admin/catalog/products/{productId}/images/order`                      | `catalog.write` | ✓   |
| `DELETE /v1/admin/catalog/products/{productId}/images/{imageId}`               | `catalog.write` | ✓   |
| `PATCH /v1/admin/catalog/products/{productId}/images/{imageId}`                | `catalog.write` | ✓   |
| `POST /v1/admin/catalog/products/{productId}/publish`                          | `catalog.write` | ✓   |
| `POST /v1/admin/catalog/products/{productId}/reactivate`                       | `catalog.write` | ✓   |
| `POST /v1/admin/catalog/products/{productId}/variants`                         | `catalog.write` | ✓   |
| `PATCH /v1/admin/catalog/products/{productId}/variants/{variantId}`            | `catalog.write` | ✓   |
| `POST /v1/admin/catalog/products/{productId}/variants/{variantId}/discontinue` | `catalog.write` | ✓   |
| `POST /v1/admin/catalog/products/{productId}/variants/{variantId}/reactivate`  | `catalog.write` | ✓   |

### event-deliveries — Eventos, Inicio

| Operación                                            | Permiso         | Uso |
| ---------------------------------------------------- | --------------- | --- |
| `GET /v1/admin/event-deliveries`                     | `events.manage` | ✓   |
| `POST /v1/admin/event-deliveries/retry`              | `events.manage` | ✓   |
| `POST /v1/admin/event-deliveries/{deliveryId}/retry` | `events.manage` | ✓   |

### identity — Clientes, Staff, Roles

| Operación                                               | Permiso            | Uso               |
| ------------------------------------------------------- | ------------------ | ----------------- |
| `GET /v1/admin/identity/customers`                      | `customers.read`   | ✓                 |
| `GET /v1/admin/identity/customers/{userId}`             | `customers.read`   | ✓                 |
| `POST /v1/admin/identity/customers/{userId}/anonymize`  | `customers.manage` | ✓                 |
| `POST /v1/admin/identity/customers/{userId}/reactivate` | `customers.manage` | ✓                 |
| `POST /v1/admin/identity/customers/{userId}/suspend`    | `customers.manage` | ✓                 |
| `POST /v1/admin/identity/guest-anonymizations`          | `customers.manage` | ✓                 |
| `GET /v1/admin/identity/permissions`                    | `staff.manage`     | ✓                 |
| `GET /v1/admin/identity/roles`                          | `staff.manage`     | ✓                 |
| `POST /v1/admin/identity/roles`                         | `staff.manage`     | ✓                 |
| `DELETE /v1/admin/identity/roles/{roleId}`              | `staff.manage`     | ✓                 |
| `GET /v1/admin/identity/roles/{roleId}`                 | `staff.manage`     | No se usa (D-050) |
| `PATCH /v1/admin/identity/roles/{roleId}`               | `staff.manage`     | ✓                 |
| `GET /v1/admin/identity/staff`                          | `staff.manage`     | ✓                 |
| `POST /v1/admin/identity/staff`                         | `staff.manage`     | ✓                 |
| `GET /v1/admin/identity/staff/{userId}`                 | `staff.manage`     | ✓                 |
| `POST /v1/admin/identity/staff/{userId}/reactivate`     | `staff.manage`     | ✓                 |
| `PUT /v1/admin/identity/staff/{userId}/roles`           | `staff.manage`     | ✓                 |
| `POST /v1/admin/identity/staff/{userId}/suspend`        | `staff.manage`     | ✓                 |

### inventory — Existencias, Almacén, Inicio, Pedido (reintegro)

| Operación                                                     | Permiso           | Uso |
| ------------------------------------------------------------- | ----------------- | --- |
| `POST /v1/admin/inventory/adjustments`                        | `inventory.write` | ✓   |
| `POST /v1/admin/inventory/receipts`                           | `inventory.write` | ✓   |
| `GET /v1/admin/inventory/stock-items`                         | `inventory.read`  | ✓   |
| `GET /v1/admin/inventory/stock-items/{stockItemId}/movements` | `inventory.read`  | ✓   |
| `GET /v1/admin/inventory/warehouses`                          | `inventory.read`  | ✓   |
| `PATCH /v1/admin/inventory/warehouses/{warehouseId}`          | `inventory.write` | ✓   |

### orders — Pedidos, Pedido, Cliente, Inicio

| Operación                                           | Permiso               | Uso |
| --------------------------------------------------- | --------------------- | --- |
| `GET /v1/admin/orders`                              | `orders.read`         | ✓   |
| `GET /v1/admin/orders/{orderId}`                    | `orders.read`         | ✓   |
| `POST /v1/admin/orders/{orderId}/blocked-data`      | `orders.read-blocked` | ✓   |
| `POST /v1/admin/orders/{orderId}/cancel`            | `orders.manage`       | ✓   |
| `POST /v1/admin/orders/{orderId}/manual-capture`    | `payments.manage`     | ✓   |
| `POST /v1/admin/orders/{orderId}/reorder`           | `orders.manage`       | ✓   |
| `POST /v1/admin/orders/{orderId}/restocks`          | `inventory.write`     | ✓   |
| `POST /v1/admin/orders/{orderId}/retry-fulfillment` | `orders.manage`       | ✓   |

### payments — Pagos, Pago

| Operación                                            | Permiso           | Uso |
| ---------------------------------------------------- | ----------------- | --- |
| `GET /v1/admin/payments`                             | `orders.read`     | ✓   |
| `GET /v1/admin/payments/{paymentId}`                 | `orders.read`     | ✓   |
| `POST /v1/admin/payments/{paymentId}/refunds/manual` | `payments.manage` | ✓   |

### pricing — Precios

| Operación                                                                                    | Permiso         | Uso |
| -------------------------------------------------------------------------------------------- | --------------- | --- |
| `GET /v1/admin/pricing/price-lists`                                                          | `pricing.read`  | ✓   |
| `POST /v1/admin/pricing/price-lists/{priceListId}/imports`                                   | `pricing.write` | ✓   |
| `GET /v1/admin/pricing/price-lists/{priceListId}/variants/{variantId}/periods`               | `pricing.read`  | ✓   |
| `POST /v1/admin/pricing/price-lists/{priceListId}/variants/{variantId}/periods`              | `pricing.write` | ✓   |
| `DELETE /v1/admin/pricing/price-lists/{priceListId}/variants/{variantId}/periods/{periodId}` | `pricing.write` | ✓   |

### shipping — Envíos, Envío, Método de envío, Inicio

| Operación                                                         | Permiso              | Uso |
| ----------------------------------------------------------------- | -------------------- | --- |
| `GET /v1/admin/shipping/method`                                   | `shipping.manage`    | ✓   |
| `PUT /v1/admin/shipping/method`                                   | `shipping.configure` | ✓   |
| `GET /v1/admin/shipping/shipments`                                | `shipping.manage`    | ✓   |
| `GET /v1/admin/shipping/shipments/{shipmentId}`                   | `shipping.manage`    | ✓   |
| `PATCH /v1/admin/shipping/shipments/{shipmentId}`                 | `shipping.manage`    | ✓   |
| `POST /v1/admin/shipping/shipments/{shipmentId}/deliver`          | `shipping.manage`    | ✓   |
| `POST /v1/admin/shipping/shipments/{shipmentId}/delivery-failure` | `shipping.manage`    | ✓   |
| `POST /v1/admin/shipping/shipments/{shipmentId}/dispatch`         | `shipping.manage`    | ✓   |
| `POST /v1/admin/shipping/shipments/{shipmentId}/return`           | `shipping.manage`    | ✓   |

## Reglas del contrato que el frontend cumple

| Regla (API_SPEC)                                           | Cómo se cumple                                                                                                 | Dónde                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Bearer en `Authorization`; la API no usa cookies (§3.1)    | El cliente agrega el token de memoria                                                                          | `shared/api/client.ts`                         |
| Renovar de una en una (§9.6)                               | Promesa compartida en la pestaña y Web Lock entre pestañas                                                     | `shared/auth/session.store.ts`, `exclusive.ts` |
| Errores Problem Details; decidir por `type` (§6)           | `ApiProblem` con `type`, `status`, `title`, `detail`, `correlationId`, `errors[]`, extensiones y `Retry-After` | `shared/api/problem.ts`                        |
| `errors[].field` en notación de ruta (§6.3)                | Se lleva al campo del formulario; lo que no tiene campo va a la alerta                                         | `shared/utils/form-errors.ts`                  |
| Paginación por página: `page`, `pageSize` 1–100 (§5.1)     | `useListParams` y `ListPagination`; tamaño por defecto 20                                                      | `shared/api/use-list-params.ts`                |
| Paginación por cursor en auditoría y movimientos (§5.2)    | `cursor` y `limit`; "Cargar más" con `meta.nextCursor`                                                         | `features/audit`, `features/inventory`         |
| Listas por coma y sin parámetros vacíos (§5.3)             | `toQuery` quita vacíos y une listas con coma                                                                   | `shared/api/client.ts`                         |
| `version` en recursos versionados (§2.3)                   | Se envía la versión leída; `version-conflict` recarga y avisa, nunca reenvía                                   | features con versión, `feedback.ts`            |
| Transiciones por subruta de acción, nunca por PATCH (§2.2) | Cada acción es su `POST`; los PATCH solo envían campos editables que cambiaron (D-024)                         | `api.ts` de cada feature                       |
| `Idempotency-Key` en reintegros (§4, §15.7)                | Una llave por solicitud; se conserva al reintentar lo mismo (D-041)                                            | `orders/components/RestockModal.vue`           |
| Consistencia eventual (§2.5)                               | Aviso y nueva consulta a los 2.5 s (D-040)                                                                     | `shared/api/query-roots.ts`                    |
| Enumeraciones desconocidas (§2.1)                          | `StatusBadge` muestra el valor crudo en neutro                                                                 | `components/StatusBadge.vue`                   |
| Dinero en centavos `MXN` (§8.1)                            | Se muestra con `Intl`; se escribe en pesos y se convierte sin coma flotante                                    | `shared/utils/money.ts`                        |
| Fechas ISO UTC (§2.1)                                      | Se muestran en hora local; filtros de fecha enviados en ISO                                                    | `shared/utils/dates.ts`                        |
| Campos desconocidos en el cuerpo → 400 (§2.1)              | Los cuerpos se arman campo por campo desde los tipos generados                                                 | `api.ts` de cada feature                       |
| 429 con `Retry-After` (§7)                                 | Se muestra la espera; ninguna mutación se reintenta sola                                                       | `ProblemAlert.vue`, `02.vue-query.ts`          |
| Cuenta con `mustChangePassword` (§3.2)                     | El guard solo deja `/cambiar-contrasena`; un 403 `password-change-required` también lleva ahí                  | `middleware/auth.global.ts`, `02.vue-query.ts` |
| Recurso ajeno o inexistente es 404 (§6)                    | El detalle muestra el error de la API con `ProblemAlert` (sin pantalla propia de "no encontrado"; FTR-07)      | `QueryState.vue`                               |

## Excepciones documentadas (prioridad API_SPEC > OpenAPI)

| Caso                                                        | Qué hace el frontend                                                     | GAP  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ | ---- |
| `CursorMetaDto` sin propiedades en el OpenAPI               | Tipo `CursorMeta { limit, nextCursor }` a mano en `shared/api/types.ts`  | G-10 |
| `cursor` y `limit` no declarados en movimientos y auditoría | Se envían según API_SPEC §5.2                                            | G-10 |
| `AdjustmentDto` sin `quantity`                              | Se envía `quantity` (`AdjustmentInput` en `features/inventory/types.ts`) | G-11 |
| `nextAttemptAt` obligatorio en entregas fallidas            | Solo se muestra en PENDING                                               | G-16 |
| Reintento masivo con tipo y manejador a la vez              | Se envían los dos (ASSUMPTION)                                           | G-15 |

## Lo que el contrato no tiene y el backoffice no inventa

Endpoints para consultar o activar el pago manual (G-02, acordado con el backend: D-033), reintento de reembolsos con el proveedor (T-192), métricas de ventas (G-03), reportes (G-05), nombre del actor en historiales (G-13) y precio en el listado de productos (G-04).

## Cuando cambie el contrato

1. Actualizar el commit en API_SOURCE_OF_TRUTH.md y copiar `docs/openapi/v1.json` del backend a `openapi/v1.json`.
2. `npm run api:types` y `npm run typecheck`: los errores señalan lo que cambió.
3. Si G-10 o G-11 se corrigieron, retirar los tipos a mano y cerrar el GAP.
4. Revisar API_SPEC para reglas nuevas, actualizar mocks E2E (`tests/e2e/mock-*.ts`) y este documento.
