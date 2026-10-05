# AUTHORIZATION_MATRIX

**Última actualización:** 2026-10-05 · Fuentes: `x-required-permissions` de `openapi/v1.json`, roles iniciales del backend (base-shop `docs/DECISIONS.md`, ADR-0043, ADR-0075, ADR-0150, ADR-0152) y el código (`session.can()`, `meta.permission`).

## Principio

La API autoriza cada solicitud. El frontend solo **oculta** lo que el usuario no puede hacer, según `permissions` de `GET /v1/me` (D-004). No se decide nunca por el nombre de un rol. Si los permisos cambian mientras hay sesión, la siguiente solicitud lo refleja: un 403 `forbidden` hace que se vuelva a leer `GET /v1/me`.

## Roles iniciales del backend

Son editables; un superadministrador puede crear otros. SA = Superadministrador, Adm = Administrador, Op = Operador.

| Permiso               | SA  | Adm | Op  | Qué habilita en el backoffice                                                          |
| --------------------- | --- | --- | --- | -------------------------------------------------------------------------------------- |
| `catalog.read`        | ✓   | ✓   | ✓   | Productos, Categorías, Marcas; buscador de productos en Precios e Inventario           |
| `catalog.write`       | ✓   | ✓   | ✓   | Crear y editar productos, variantes, imágenes, categorías y marcas; publicar, archivar |
| `pricing.read`        | ✓   | ✓   | ✓   | Precios: ver precio vigente e historial                                                |
| `pricing.write`       | ✓   | ✓   | ✓   | Fijar, programar y cancelar precios; importar CSV                                      |
| `inventory.read`      | ✓   | ✓   | ✓   | Existencias, movimientos, Almacén; conteo de stock bajo; umbral en Mi cuenta           |
| `inventory.write`     | ✓   | ✓   | ✓   | Entradas, ajustes, editar almacén; reintegro de stock en el pedido                     |
| `orders.read`         | ✓   | ✓   | ✓   | Pedidos, Pagos; conteos de pedidos; pedidos de un cliente                              |
| `orders.manage`       | ✓   | ✓   |     | Cancelar pedido, reintentar surtido, volver a comprar                                  |
| `orders.read-blocked` | ✓   | ✓   |     | Ver datos personales bloqueados de un pedido, con motivo                               |
| `payments.manage`     | ✓   | ✓   |     | Registrar pago en tienda; reembolso manual                                             |
| `shipping.manage`     | ✓   | ✓   | ✓   | Envíos y sus acciones; ver Método de envío; conteo de envíos por despachar             |
| `shipping.configure`  | ✓   | ✓   |     | Editar Método de envío                                                                 |
| `customers.read`      | ✓   | ✓   | ✓   | Clientes y su detalle                                                                  |
| `customers.manage`    | ✓   | ✓   |     | Suspender, reactivar, anonimizar clientes; anonimizar pedidos de invitado              |
| `staff.manage`        | ✓   |     |     | Staff y Roles                                                                          |
| `audit.read`          | ✓   | ✓   |     | Auditoría                                                                              |
| `events.manage`       | ✓   | ✓   |     | Eventos (ver y reintentar entregas); conteo de fallidas                                |

## Rutas

| Ruta                                                                                          | Permiso de ruta   |
| --------------------------------------------------------------------------------------------- | ----------------- |
| `/`, `/cuenta`, `/cambiar-contrasena`                                                         | sesión            |
| `/catalogo/productos`, `/catalogo/productos/[id]`, `/catalogo/categorias`, `/catalogo/marcas` | `catalog.read`    |
| `/catalogo/productos/nuevo`                                                                   | `catalog.write`   |
| `/precios`                                                                                    | `pricing.read`    |
| `/inventario/stock`, `/inventario/almacen`                                                    | `inventory.read`  |
| `/pedidos`, `/pedidos/[id]`, `/pagos`, `/pagos/[id]`                                          | `orders.read`     |
| `/envios`, `/envios/[id]`, `/configuracion/envio`                                             | `shipping.manage` |
| `/clientes`, `/clientes/[id]`                                                                 | `customers.read`  |
| `/staff`, `/staff/[id]`, `/roles`                                                             | `staff.manage`    |
| `/auditoria`                                                                                  | `audit.read`      |
| `/operacion/eventos`                                                                          | `events.manage`   |

Sin el permiso de ruta: la sección no aparece en el menú ni en el Inicio, y entrar por URL muestra la página 403.

## Acciones dentro de las pantallas

| Pantalla           | Acción                                                     | Permiso (además del de ruta)                                           | Condición de estado (API_SPEC)                                                                                     | Código                                    |
| ------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Productos          | Nuevo producto                                             | `catalog.write`                                                        | —                                                                                                                  | `pages/catalogo/productos/index.vue`      |
| Producto           | Editar, variantes, imágenes, publicar, archivar, reactivar | `catalog.write`                                                        | Por estado (`catalog/status.ts`)                                                                                   | `pages/catalogo/productos/[id].vue`       |
| Categorías, Marcas | Alta, edición, desactivar, reactivar, eliminar             | `catalog.write`                                                        | Por estado                                                                                                         | `pages/catalogo/*.vue`                    |
| Precios            | Buscar producto y precios por variante                     | `catalog.read`                                                         | —                                                                                                                  | `pages/precios.vue`                       |
| Precios            | Fijar, programar, cancelar, importar CSV                   | `pricing.write`                                                        | Solo periodos futuros se cancelan                                                                                  | `pages/precios.vue`                       |
| Existencias        | Entrada, ajuste                                            | `inventory.write`                                                      | —                                                                                                                  | `pages/inventario/stock.vue`              |
| Existencias        | Movimiento de una variante sin existencias                 | `inventory.write` + `catalog.read`                                     | —                                                                                                                  | `pages/inventario/stock.vue`              |
| Almacén            | Editar                                                     | `inventory.write`                                                      | —                                                                                                                  | `pages/inventario/almacen.vue`            |
| Pedido             | Registrar pago en tienda                                   | `payments.manage`                                                      | `PENDING_PAYMENT` o `EXPIRED`                                                                                      | `orders/components/OrderActions.vue`      |
| Pedido             | Cancelar, reintentar surtido, volver a comprar             | `orders.manage`                                                        | Por estado (`orders/status.ts`)                                                                                    | `orders/components/OrderActions.vue`      |
| Pedido             | Reintegrar stock (y reintegro al cancelar)                 | `inventory.write`                                                      | Cancelado o reembolsado con pago, o envío devuelto; sin superar lo vendido                                         | `orders/components/OrderActions.vue`      |
| Pedido             | Ver datos bloqueados                                       | `orders.read-blocked`                                                  | Pedido con datos bloqueados                                                                                        | `orders/components/OrderActions.vue`      |
| Pedido             | Enlace al envío                                            | `shipping.manage`                                                      | —                                                                                                                  | `pages/pedidos/[id].vue`                  |
| Pago               | Reembolso manual                                           | `payments.manage`                                                      | Por estado del pago                                                                                                | `pages/pagos/[id].vue`                    |
| Envío              | Guía, despachar, entregar, fallo, devolución               | `shipping.manage` (ruta)                                               | Por estado (`shipping/status.ts`)                                                                                  | `shipping/components/ShipmentActions.vue` |
| Envío              | Enlace al pedido                                           | `orders.read`                                                          | —                                                                                                                  | `pages/envios/[id].vue`                   |
| Método de envío    | Editar (sin permiso, solo lectura)                         | `shipping.configure`                                                   | —                                                                                                                  | `pages/configuracion/envio.vue`           |
| Clientes           | Anonimizar invitado                                        | `customers.manage`                                                     | —                                                                                                                  | `pages/clientes/index.vue`                |
| Cliente            | Suspender, reactivar, anonimizar                           | `customers.manage`                                                     | Por estado (`customers/status.ts`)                                                                                 | `pages/clientes/[id].vue`                 |
| Cliente            | Conteo y enlace a pedidos                                  | `orders.read`                                                          | —                                                                                                                  | `pages/clientes/[id].vue`                 |
| Staff, Roles       | Todas                                                      | `staff.manage` (ruta)                                                  | No suspenderse a sí mismo; solo dar roles y permisos propios (BR-USR-20, D-048); roles con usuarios no se eliminan | `features/staff`                          |
| Eventos            | Reintentar una o todas las fallidas                        | `events.manage` (ruta)                                                 | Solo `FAILED`                                                                                                      | `features/events`                         |
| Auditoría          | Solo lectura                                               | `audit.read` (ruta)                                                    | —                                                                                                                  | `pages/auditoria.vue`                     |
| Mi cuenta          | Umbral de stock bajo                                       | `inventory.read`                                                       | —                                                                                                                  | `pages/cuenta.vue`                        |
| Inicio             | Conteos de pedidos · envíos · stock bajo · eventos         | `orders.read` · `shipping.manage` · `inventory.read` · `events.manage` | —                                                                                                                  | `pages/index.vue`                         |

## Casos especiales

- **Contraseña temporal** (`mustChangePassword`): la API solo admite `GET /v1/me`, `POST /v1/me/password` y logout; el guard solo deja `/cambiar-contrasena`.
- **Cuenta de cliente**: el login la rechaza aunque las credenciales sean válidas.
- **Pago manual deshabilitado** en el backend: la acción se muestra con `payments.manage` y el 403 `manual-payments-disabled` se explica (G-02).
- **Superadministrador**: se considera superadministrador a quien tiene un rol marcado como tal en `GET /v1/me`; su rol conserva todos los permisos y solo otro superadministrador lo asigna (D-048).

## Evidencia

`tests/e2e/*.spec.ts` prueba en cada módulo que las acciones desaparecen sin permiso (por ejemplo, Catálogo con solo `catalog.read`, Método de envío sin `shipping.configure`, conteos del Inicio sin permiso). `tests/unit/shared/utils.spec.ts` prueba el filtrado del menú.
