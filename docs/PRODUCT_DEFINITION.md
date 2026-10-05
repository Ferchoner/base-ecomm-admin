# PRODUCT_DEFINITION

**Última actualización:** 2026-10-05 · **Contrato:** API_SPEC + `openapi/v1.json` de `Ferchoner/base-shop`, commit `a46829b` (API_SOURCE_OF_TRUTH.md).

## Qué es

El backoffice de `base-shop`: una aplicación web (SPA instalable como PWA) donde el staff opera la tienda en línea. Consume solo la API REST `/v1` del backend; no tiene servidor ni base de datos propios.

## Para quién

Cuentas de tipo `STAFF` de la API. Las cuentas de cliente no pueden entrar: el login las rechaza con "Esta cuenta no tiene acceso al backoffice".

El backend siembra tres roles editables (API_SPEC §3.3). El frontend **no conoce roles**: decide qué mostrar solo con `permissions` de `GET /v1/me` (17 permisos, AUTHORIZATION_MATRIX.md).

| Rol sembrado       | Uso típico                                                                        |
| ------------------ | --------------------------------------------------------------------------------- |
| Superadministrador | Todo, incluido staff y roles (`staff.manage`)                                     |
| Administrador      | Todo menos `staff.manage`                                                         |
| Operador           | Catálogo, precios, inventario, `orders.read`, `shipping.manage`, `customers.read` |

Además de estos, un superadministrador puede crear roles propios con cualquier combinación de permisos.

## Problemas que resuelve

| Necesidad del staff                                                                                | Dónde                        |
| -------------------------------------------------------------------------------------------------- | ---------------------------- |
| Saber qué hay pendiente hoy (cobros, surtido, reembolsos, despachos, stock bajo, eventos fallidos) | Inicio (conteos por permiso) |
| Mantener el catálogo: productos, variantes, imágenes, categorías y marcas                          | Catálogo                     |
| Fijar y programar precios, también en masa por CSV                                                 | Precios                      |
| Registrar entradas y ajustes de stock y ver sus movimientos                                        | Inventario                   |
| Atender pedidos: cobro en tienda, cancelación, reintegro de stock, surtido                         | Pedidos, Pagos               |
| Despachar y dar seguimiento a envíos                                                               | Envíos, Método de envío      |
| Atender clientes y solicitudes ARCO (suspender, anonimizar)                                        | Clientes                     |
| Dar acceso al equipo con roles y permisos                                                          | Staff, Roles                 |
| Saber quién hizo qué y recuperar integraciones fallidas                                            | Auditoría, Eventos           |

## Principios del producto

1. **La API manda.** No se inventan endpoints, campos, estados ni reglas. Lo que falta está en GAPS.md.
2. **Solo se ofrece lo que se puede hacer.** Las acciones se ocultan sin permiso o en un estado que no las admite; la API decide al final.
3. **Nada se supone ni se repite solo.** Ningún cambio se reintenta automáticamente; lo que cambia en segundo plano se vuelve a consultar con aviso; un conflicto de versión recarga y avisa.
4. **Datos personales con cuidado.** Lo bloqueado se pide con motivo y no se guarda; las contraseñas temporales se muestran una vez.
5. **Online-first.** Sin conexión se puede abrir la interfaz, pero no se muestra nada como vigente ni se guarda ningún cambio.
6. **En español y en pesos.** es-MX y MXN (D-036).

## Fuera del producto (sin API)

Reportes de ventas e ingresos, exportaciones, promociones y cupones, plantillas de correo, edición de pedidos o pedidos creados por staff, CMS, reseñas y reintento de reembolso con el proveedor. Detalle en GAPS.md (G-03, G-05 y tabla de cobertura).

## Restricciones del MVP

- Solo ambientes locales, sin dominios ni hosting real (G-07, D-035).
- Un solo almacén y una sola lista de precios (`GENERAL`), como el backend.
- El pago manual depende de `MANUAL_PAYMENTS_ENABLED` del backend; no hay forma de consultarlo ni cambiarlo desde el backoffice hasta que existan los endpoints acordados (G-02, D-033).
