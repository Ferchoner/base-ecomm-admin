# INFORMATION_ARCHITECTURE

**Última actualización:** 2026-10-05 · Fuente: `app/shared/navigation.ts`, `app/layouts/` y `app/pages/`.

## Estructura de navegación

El menú lateral (`app/layouts/default.vue`) agrupa las secciones como en el código (`NAVIGATION`). Cada sección aparece solo si el usuario tiene su permiso de lectura y los grupos sin secciones visibles desaparecen (`visibleNavigation`).

```
Inicio                                (cualquier staff)
Catálogo
  ├─ Productos        catalog.read
  ├─ Categorías       catalog.read
  ├─ Marcas           catalog.read
  ├─ Precios          pricing.read
  └─ Inventario       inventory.read     (pestañas: Existencias · Almacén)
Ventas
  ├─ Pedidos          orders.read
  ├─ Pagos            orders.read
  ├─ Envíos           shipping.manage
  └─ Clientes         customers.read
Administración
  ├─ Staff            staff.manage
  ├─ Roles            staff.manage
  ├─ Método de envío  shipping.manage    (edición con shipping.configure)
  ├─ Auditoría        audit.read
  └─ Eventos          events.manage
Menú de usuario (pie del sidebar)
  ├─ Mi cuenta
  ├─ Cambiar contraseña
  └─ Cerrar sesión
```

Las secciones siguen los contextos del backend (catalog, pricing, inventory, orders, payments, shipping, identity, audit, events) con nombres en el lenguaje del staff.

## Layouts

| Layout    | Pantallas                                           | Contenido                                                                                                                                     |
| --------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`    | Login, recuperar contraseña, restablecer contraseña | Tarjeta centrada, sin navegación                                                                                                              |
| `default` | Todas las pantallas con sesión                      | `UDashboardGroup`: sidebar plegable y redimensionable (cajón en móvil), encabezado con el título de la página (`meta.title`), menú de usuario |
| ninguno   | Cambiar contraseña                                  | Pantalla propia: sirve también al cambio forzado, cuando no se debe ver el menú                                                               |

`PwaStatus` (franja sin conexión y aviso de versión nueva) vive en `app.vue`, por encima de cualquier layout.

## Patrones de pantalla

| Patrón               | Estructura                                                                                                  | Ejemplos                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Listado              | Búsqueda + filtros + orden (en la URL) → tabla → paginación; estados de carga, vacío y error (`QueryState`) | Productos, Pedidos, Clientes, Staff                                          |
| Listado por cursor   | Filtros en la URL → tabla → "Cargar más"                                                                    | Auditoría, movimientos de stock                                              |
| Detalle              | Encabezado con estado y acciones permitidas → tarjetas de datos (`DetailList`) → paneles relacionados       | Pedido, Pago, Envío, Cliente, Staff                                          |
| Detalle con pestañas | Pestañas en la URL (`?tab=`)                                                                                | Producto (Datos, Variantes, Imágenes)                                        |
| Panel lateral        | `USlideover` para ver o editar sin salir del listado                                                        | Precio de una variante, movimientos, entrega de evento, entrada de auditoría |
| Formulario modal     | `UModal` + `UForm` + Zod; errores de la API por campo                                                       | Marca, categoría, variante, rol, staff                                       |
| Acción con motivo    | `ReasonDialog`: motivo obligatorio y, si es irreversible, casilla "Entiendo que no se puede deshacer"       | Suspender, reactivar, anonimizar                                             |
| Confirmación         | `ConfirmDialog` / `useConfirm`                                                                              | Publicar, archivar, eliminar, reintentar                                     |

## Estado en la URL

Todo lo que define la vista vive en la URL para poder recargar o compartir el enlace sin perderla (D-025): página, tamaño, búsqueda, filtros, orden, pestaña del producto y producto elegido en Precios. Se usa `router.replace`, así que filtrar no llena el historial. Detalle por ruta en ROUTE_MAP.md.

## Relación entre secciones

- Las tarjetas del Inicio abren el listado con el mismo filtro que cuentan (D-054).
- Un pedido muestra sus paneles de pago y envío (features `payments` y `shipping`) y enlaza a ellos.
- El detalle de un cliente cuenta sus pedidos y enlaza a Pedidos filtrado por `customerId` (con `orders.read`).
- Auditoría permite ver todo lo que hizo un actor o el historial de un recurso desde una entrada.
- Precios e Inventario usan el buscador de productos del catálogo (`ProductPicker`), compuesto desde la página (D-028).
