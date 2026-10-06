# ROUTE_MAP

**Última actualización:** 2026-10-05 · Fuente: `app/pages/**` (`definePageMeta`) y `app/middleware/auth.global.ts`. 28 rutas.

## Reglas del guard (`auth.global.ts`)

1. Al entrar, se restaura la sesión con el refresh token guardado (una sola vez por carga).
2. Sin sesión: las rutas `public` se muestran; las demás llevan a `/login?redirect=<ruta pedida>`.
3. Con `mustChangePassword`: cualquier ruta lleva a `/cambiar-contrasena`.
4. Con sesión, `/login` lleva a `/`.
5. Con `meta.permission` y sin ese permiso: página de error 403 ("No tienes permiso para ver esta sección.").
6. `redirect` solo acepta rutas internas (`safeRedirect`), para evitar redirecciones abiertas.

El permiso de ruta es solo experiencia de usuario; la API vuelve a autorizar cada solicitud.

## Rutas públicas

| Ruta                    | Layout | Pantalla                                                          |
| ----------------------- | ------ | ----------------------------------------------------------------- |
| `/login`                | auth   | Iniciar sesión (`?redirect=` para volver a la ruta pedida)        |
| `/recuperar-contrasena` | auth   | Pedir enlace de recuperación                                      |
| `/reset-password`       | auth   | Elegir contraseña nueva (`?token=`; la ruta la fija la API, G-01) |

## Rutas con sesión

| Ruta                        | Permiso de ruta   | Parámetros en la URL                                                                                                                  | Pantalla                                              |
| --------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `/`                         | —                 | —                                                                                                                                     | Inicio                                                |
| `/cambiar-contrasena`       | —                 | —                                                                                                                                     | Cambiar contraseña (forzado o voluntario), sin layout |
| `/cuenta`                   | —                 | —                                                                                                                                     | Mi cuenta                                             |
| `/catalogo/productos`       | `catalog.read`    | `page`, `pageSize`, `q`, `status`, `brandId`, `categoryId`, `sort`                                                                    | Productos                                             |
| `/catalogo/productos/nuevo` | `catalog.write`   | —                                                                                                                                     | Nuevo producto                                        |
| `/catalogo/productos/[id]`  | `catalog.read`    | `tab` (`variantes`, `imagenes`; sin `tab` = Datos)                                                                                    | Producto                                              |
| `/catalogo/categorias`      | `catalog.read`    | `status`                                                                                                                              | Categorías                                            |
| `/catalogo/marcas`          | `catalog.read`    | `page`, `pageSize`, `q`, `status`, `sort`                                                                                             | Marcas                                                |
| `/precios`                  | `pricing.read`    | `product`                                                                                                                             | Precios                                               |
| `/inventario/stock`         | `inventory.read`  | `page`, `pageSize`, `q`, `warehouseId`, `availableMax`, `sort`                                                                        | Existencias                                           |
| `/inventario/almacenes`     | `inventory.read`  | —                                                                                                                                     | Almacenes                                             |
| `/pedidos`                  | `orders.read`     | `page`, `pageSize`, `q`, `status`, `guest`, `hasPendingRefund`, `customerId`, `placedFrom`, `placedTo`, `channel`, `placedBy`, `sort` | Pedidos                                               |
| `/pedidos/[id]`             | `orders.read`     | —                                                                                                                                     | Pedido                                                |
| `/pagos`                    | `orders.read`     | `page`, `pageSize`, `status`, `provider`, `orderId`, `capturedFrom`, `capturedTo`, `sort`                                             | Pagos                                                 |
| `/pagos/[id]`               | `orders.read`     | —                                                                                                                                     | Pago                                                  |
| `/envios`                   | `shipping.manage` | `page`, `pageSize`, `q`, `status`, `orderId`, `warehouseId`, `createdFrom`, `createdTo`, `sort`                                       | Envíos                                                |
| `/envios/[id]`              | `shipping.manage` | —                                                                                                                                     | Envío                                                 |
| `/clientes`                 | `customers.read`  | `page`, `pageSize`, `q`, `status`, `emailVerified`, `createdFrom`, `createdTo`, `sort`                                                | Clientes                                              |
| `/clientes/[id]`            | `customers.read`  | —                                                                                                                                     | Cliente                                               |
| `/staff`                    | `staff.manage`    | `page`, `pageSize`, `q`, `status`, `roleId`, `sort`                                                                                   | Staff                                                 |
| `/staff/[id]`               | `staff.manage`    | —                                                                                                                                     | Staff (detalle)                                       |
| `/roles`                    | `staff.manage`    | `page`, `pageSize`, `q`, `sort`                                                                                                       | Roles                                                 |
| `/configuracion/envio`      | `shipping.manage` | —                                                                                                                                     | Método de envío                                       |
| `/configuracion/pagos`      | `orders.read`     | —                                                                                                                                     | Pago en tienda (cambiar: `payments.configure`)        |
| `/auditoria`                | `audit.read`      | `action`, `actorType`, `actorId`, `result`, `resourceType`, `resourceId`, `from`, `to`                                                | Auditoría                                             |
| `/operacion/eventos`        | `events.manage`   | `page`, `pageSize`, `status`, `eventType`, `handler`, `sort`                                                                          | Eventos                                               |

`page=1` y el tamaño por defecto (20) no se escriben en la URL.

## Diferencias con la propuesta de arquitectura

ARCHITECTURE_PROPOSAL.md §2 proponía algunas rutas que se resolvieron de otra forma al construir:

| Propuesta                               | Implementado                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| `/inventario/stock/[id]`                | Panel lateral de movimientos dentro de `/inventario/stock`                        |
| `/clientes/anonimizar-invitado`         | Modal "Anonimizar invitado" en `/clientes`                                        |
| `/staff/nuevo`                          | Modal de alta en `/staff`                                                         |
| `/roles/[id]`                           | Modal de edición en `/roles`                                                      |
| Pestañas Precios y Stock en el producto | Precios e Inventario son secciones propias con buscador de producto (G-12, D-028) |
| `middleware/permission.ts`              | El permiso se valida en el mismo `auth.global.ts`                                 |

## Archivos estáticos generados

`nuxt generate` escribe un `index.html` por ruta estática, `200.html` y `404.html` en `.output/public`. Las rutas con `[id]` no se generan: el servidor debe devolver `200.html` (DEPLOYMENT.md). Con el service worker activo, toda navegación cae en el shell (`navigateFallback: '/'`).
