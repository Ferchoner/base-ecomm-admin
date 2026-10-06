# PLAN_API_1.2 · Actualizar el backoffice a base-shop 1.2.0

Fecha: 2026-10-06. Estado: **APROBADO** por el usuario el 2026-10-06, con las tres recomendaciones de §4 (DECISIONS D-068). Contrato fijado al final en `ff10406`, que suma T-194 (G-02) a la 1.2.0.

Contrato actual del backoffice: `base-shop@a46829b` (2026-10-05).
Contrato nuevo: `base-shop@5777b2b` (`chore: release 1.2.0`), que incluye las versiones 1.1.0 (varios almacenes, ADR-0160) y 1.2.0 (ventas asistidas en la tienda física, ADR-0161). OpenAPI: 126 → 131 operaciones, 165 → 170 esquemas. Sin operaciones eliminadas.

## 1. Qué cambió en la API

### 1.1 Varios almacenes (v1.1.0, ADR-0160, reemplaza ADR-0081)

| Cambio                                                                                                                                                                                           | Contrato                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| `Warehouse.priority` (1–1000, 1 primero, obligatorio en la respuesta)                                                                                                                            | §13; `WarehouseDto`           |
| `GET …/inventory/warehouses` ordena por prioridad y código                                                                                                                                       | §13                           |
| **Nuevo** `POST /v1/admin/inventory/warehouses` `{ code, name, address?, priority }` → 201; 409 `duplicate-value` (`code`)                                                                       | `inventory.write`, UC-INV-10  |
| **Nuevo** `POST …/warehouses/{id}/deactivate` (sin cuerpo, irreversible) → 200; 409 `resource-in-use` (reservas); 409 `invalid-state-transition` (ya inactivo o `reason: last-active-warehouse`) | `inventory.write`, UC-INV-11  |
| `PATCH …/warehouses/{id}` acepta `priority`                                                                                                                                                      | `UpdateWarehouseDto`          |
| Entradas: cualquier almacén **activo**. Ajustes: cualquier almacén, **también inactivo**                                                                                                         | §13                           |
| Motivo de ajuste nuevo `WAREHOUSE_TRANSFER` (suma o resta; la transferencia son dos ajustes)                                                                                                     | `StockMovementDto.reasonCode` |
| Reintegro `POST …/orders/{id}/restocks` acepta `warehouseId` opcional (por defecto, el almacén del que salió cada línea)                                                                         | `RestockOrderDto`             |
| `AdminOrder.shipment.warehouseId`; `GET …/shipping/shipments` filtra por `warehouseId`                                                                                                           | §15.7, §17                    |
| `insufficient-stock` y `canFulfill` de la cotización: las líneas que le faltan al almacén más cercano                                                                                            | §6, §8.7                      |

### 1.2 Órdenes desde el backoffice (v1.2.0, ADR-0161)

| Cambio                                                                                                                                                                                                                                          | Contrato                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Permiso nuevo `orders.place`; rol sembrado **Vendedor** (`catalog.read`, `inventory.read`, `orders.read`, `orders.place`, `customers.read`); el Administrador recibe `orders.place`                                                             | §3.3                      |
| **Nuevo** `POST /v1/admin/orders/quote` `{ lines[{variantId, quantity}], warehouseId, fulfillment? }` → 200 `CheckoutQuote`                                                                                                                     | `orders.place`, UC-ORD-12 |
| **Nuevo** `POST /v1/admin/orders` `{ lines, warehouseId, fulfillment?, customerId \| contactEmail + privacyNoticeVersion, addressId \| shippingAddress, expectedTotal }` → 201 `AdminOrder`; exige `Idempotency-Key`; 30 por cuenta cada 10 min | `orders.place`, UC-ORD-13 |
| **Nuevo** `POST /v1/admin/orders/{id}/hand-over` `{ version }`: PAID → DELIVERED de una orden `IN_STORE`                                                                                                                                        | `orders.place`, UC-ORD-14 |
| `AdminOrder` y su resumen: `channel` (`ONLINE`/`STORE`), `fulfillment` (`SHIPPING`/`IN_STORE`), `placedBy`, `warehouseId`                                                                                                                       | §8.9                      |
| En `IN_STORE`: `shippingAddress` y `estimatedDelivery` son `null`, `shippingCost` 0, nunca hay `shipment`; venta de mostrador puede tener `contactEmail` `null` **sin** estar anonimizada                                                       | §8.8                      |
| `GET /v1/admin/orders` filtra por `channel` y `placedBy`                                                                                                                                                                                        | §15.7                     |
| Captura manual acepta `method` opcional (`CASH`, `CARD_TERMINAL`, `TRANSFER`); `AdminOrder.payment.method` y `AdminPayment.attempts[].method`                                                                                                   | §16.3, §16.4              |
| Captura manual deja de ser "solo pruebas"; sigue encendida por `MANUAL_PAYMENTS_ENABLED` (por defecto `false`)                                                                                                                                  | §16.4                     |

### 1.3 Correcciones del contrato que cierran gaps

- **G-10 cerrado:** `CursorMetaDto` ya declara `nextCursor` y `limit`; auditoría y movimientos declaran `cursor` y `limit` (base-shop #100).
- **G-11 cerrado:** `AdjustmentDto.quantity` ya está en el OpenAPI.
- **G-02 resuelto en `ff10406` (T-194, ADR-0162):** `GET /v1/admin/payment-settings` (`orders.read`) y `PUT` (`payments.configure`, solo superadministrador, con `version`). `MANUAL_PAYMENTS_ENABLED` deja de existir; `GET /v1/admin/identity/permissions` agrega `superadminOnly`.

## 2. Qué del backoffice actual se rompe o queda desactualizado

| #   | Severidad                 | Dónde                                                                                                                     | Problema                                                                                                                                                                                                                        |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-1 | **ALTA** (falla al abrir) | `app/pages/pedidos/[id].vue:94-97`                                                                                        | Lee `order.estimatedDelivery.minBusinessDays` y pasa `shippingAddress` sin comprobar `null`. Una orden `IN_STORE` rompe el detalle.                                                                                             |
| R-2 | MEDIA                     | `pedidos/[id].vue:92`, `pedidos/index.vue:67`                                                                             | Una venta de mostrador sin comprador (`contactEmail` `null`, sin anonimizar) se muestra vacía, sin explicar por qué.                                                                                                            |
| R-3 | MEDIA                     | `features/inventory/api.ts:49-91` (`useActiveWarehouse`), `pages/inventario/stock.vue`, `pages/inventario/almacen.vue:25` | Asume un solo almacén (`data[0]`): entradas, ajustes y stock usan siempre el primero, y la pantalla dice que no se pueden crear otros. Con dos almacenes, el stock y las entradas del segundo no se ven ni se pueden registrar. |
| R-4 | BAJA                      | `features/orders/components/OrderActions.vue`                                                                             | El estado PAID de una orden `IN_STORE` no ofrece "Entregar en tienda", y las acciones de envío no aplican.                                                                                                                      |
| R-5 | BAJA                      | `ManualCaptureModal.vue`, detalle de pago                                                                                 | No pide ni muestra `method`.                                                                                                                                                                                                    |
| R-6 | BAJA                      | Etiquetas de enumeraciones                                                                                                | Falta la etiqueta de `WAREHOUSE_TRANSFER`, `orders.place`, `channel`, `fulfillment` y `method` (hoy se mostraría el valor crudo, que el contrato permite).                                                                      |
| R-7 | BAJA                      | Documentación (`PRODUCT_DEFINITION.md:53`, `GAPS.md:19`, `API_SOURCE_OF_TRUTH.md`)                                        | Dicen "un solo almacén" y apuntan a `a46829b`.                                                                                                                                                                                  |

Los tipos generados (`openapi.d.ts`) volverán a compilar con los campos nuevos obligatorios: `npm run typecheck` señalará cualquier otro uso que asuma no nulos.

## 3. Plan propuesto

Cuatro PR pequeños, en este orden. Cada uno pasa la puerta de calidad de `CLAUDE.md` y se prueba contra la API real 1.2.0 en el contenedor, como se hizo con #12.

### PR A · Contrato 1.2.0 y compatibilidad (sin pantallas nuevas)

1. Fijar `base-shop@5777b2b` en `API_SOURCE_OF_TRUTH.md`, copiar `openapi/v1.json`, `npm run api:types`.
2. Corregir R-1 y R-2: el detalle muestra "Entrega en tienda" cuando `fulfillment = IN_STORE` y "Venta de mostrador sin datos del comprador" cuando `contactEmail` es `null` sin anonimizar ni bloquear.
3. Mostrar `channel`, `fulfillment`, `placedBy` y `warehouseId` en el detalle; columna "Canal" y filtros `channel`/`placedBy` en el listado de pedidos.
4. Etiquetas nuevas (R-6), `orders.place` en el editor de roles.
5. Quitar del código el soporte provisional de G-10 y G-11 si lo hubo; cerrar G-10 y G-11 en `GAPS.md`.

### PR B · Varios almacenes (Inventario)

1. Página **Almacenes** (reemplaza "Almacén"): lista por prioridad con estado; crear (`code`, `name`, `address`, `priority`); editar nombre, dirección y prioridad; **desactivar** con confirmación fuerte (irreversible), manejando `resource-in-use` y `last-active-warehouse`.
2. Quitar `useActiveWarehouse`: selector de almacén en Stock (filtro `warehouseId` existente), Entradas (solo activos) y Ajustes (todos, inactivos marcados).
3. **Transferencia entre almacenes** como ayuda de interfaz: dos ajustes `WAREHOUSE_TRANSFER` (−N origen, +N destino). La API no es atómica aquí; si el segundo falla, se avisa con el primero ya aplicado y no se reintenta solo (regla de no reintentar mutaciones). Ver decisión D-2.
4. Reintegro: selector opcional de almacén destino (solo activos; por defecto, el de origen).
5. Envíos: filtro y columna de almacén; almacén de salida en el detalle de pedido.

### PR C · Pagos en tienda

1. `method` opcional en el modal de captura manual (Efectivo, Terminal bancaria, Transferencia).
2. Mostrar `method` en el detalle de pedido y en los intentos del pago.
3. G-02: pantalla de configuración del pago en tienda (lee con `orders.read`, cambia con `payments.configure` y `version`); "Registrar pago" avisa cuando está deshabilitado. El editor de roles no ofrece permisos `superadminOnly`.

### PR D · Crear pedido en la tienda física (feature nueva)

Ruta `/pedidos/nuevo`, visible con `orders.place`. Pasos de un solo formulario:

1. **Almacén** (activos, por prioridad; por defecto el primero) y **tipo**: Envío o Venta de mostrador.
2. **Productos:** buscar por SKU o título en el stock del almacén elegido (`GET …/inventory/stock-items?warehouseId&q`, `inventory.read`, que el Vendedor tiene; da `variantId` y disponible), con el detalle del producto (`catalog.read`) para mostrar las opciones de la variante; elegir cantidades (1–30 por variante, 1–100 líneas, sin repetir).
3. **Cotizar** con `POST /v1/admin/orders/quote` cada vez que cambian líneas, almacén o tipo; mostrar totales y marcar líneas con `canFulfill: false`.
4. **Comprador:** cliente registrado (buscar en `GET …/identity/customers`, `customers.read`; avisar si no está verificado: `email-not-verified`) o invitado (`contactEmail` + aviso de privacidad, ver D-3). En mostrador, también "sin datos".
5. **Dirección** (solo Envío): una guardada del cliente (`AdminCustomer.addresses` → `addressId`) o una nueva (`shippingAddress`).
6. **Colocar** con `expectedTotal = grandTotal.amount` e `Idempotency-Key` generada al abrir la confirmación y conservada si el usuario vuelve a enviar el mismo pedido. Errores: `total-mismatch` (recotizar y pedir confirmar el total nuevo), `insufficient-stock`, `variant-not-sellable`, 429 con `Retry-After`.
7. Al crear, ir al detalle del pedido (PENDING_PAYMENT). Ahí: "Registrar pago" (`payments.manage`, ya existe) y, en `IN_STORE` pagada, **"Entregar en tienda"** (`hand-over`, `orders.place`, con `version`).
8. Atajo "Mis ventas": listado filtrado por `placedBy` = mi cuenta.

Nota de permisos: el Vendedor **no** tiene `payments.manage`; coloca el pedido pero otra persona registra el cobro (ADR-0161). La interfaz lo deja claro en el detalle.

### Cierre

Actualizar `TRACEABILITY.md` (UC-INV-10, UC-INV-11, UC-ORD-12 a 14), `SCREEN_INVENTORY.md`, `ROUTE_MAP.md`, `AUTHORIZATION_MATRIX.md` (rol Vendedor), `PRODUCT_DEFINITION.md`, `CHANGELOG.md`, `RELEASE_READINESS.md`, y nuevas decisiones en `DECISIONS.md`.

## 4. Decisiones que necesito del usuario

| #   | Pregunta                                                                                                                                 | Recomendación                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1 | ¿Cuatro PR (A→D) o uno solo?                                                                                                             | **Cuatro**: A arregla lo que hoy falla y puede salir primero.                                                                                                           |
| D-2 | ¿Ofrecer "Transferir entre almacenes" como dos ajustes desde la interfaz, o esperar a la operación propia del backend (T-163, DEFERRED)? | **Ofrecerlo**, con aviso claro si el segundo ajuste falla. Alternativa: solo ajustes sueltos con el motivo.                                                             |
| D-3 | ¿De dónde sale `privacyNoticeVersion` para invitados? La API no expone la versión vigente.                                               | **Constante de configuración del backoffice** (`NUXT_PUBLIC_PRIVACY_NOTICE_VERSION`, mismo valor que la tienda), registrada como GAP para pedir un endpoint al backend. |

## 5. Gaps nuevos a registrar

- **G-19 · Versión vigente del aviso de privacidad no expuesta** — GAP (D-3).
- **G-20 · Transferencia entre almacenes no atómica** — ASSUMPTION/GAP (D-2; T-163 en backend).
- **G-21 · `placedBy` es un id** — relacionado con G-13: mostrar el nombre requiere `staff.manage`, que el Vendedor no tiene. Se mostrará "Tú" cuando sea la cuenta actual y el id corto en otro caso.
- **G-02** queda resuelto con `ff10406`.
