# GAPS

Comparación del contrato real (API_SOURCE_OF_TRUTH.md, commit `a46829b`) con las necesidades de un backoffice e-commerce.

Clasificación: AVAILABLE · PARTIAL · GAP · UNKNOWN. Marcadores: NO DOCUMENTADO · ASSUMPTION · BLOCKER.

## Cobertura por capacidad

| Capacidad                                                                            | Estado    | Endpoints                                                                | Nota                                                        |
| ------------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Login / logout / refresh de staff                                                    | AVAILABLE | `/v1/auth/login`, `/refresh`, `/logout`                                  |                                                             |
| Perfil y permisos del usuario                                                        | AVAILABLE | `GET /v1/me`                                                             |                                                             |
| Cambio de contraseña (incluido obligatorio)                                          | AVAILABLE | `POST /v1/me/password`                                                   |                                                             |
| Recuperar contraseña de staff                                                        | PARTIAL   | `/v1/auth/password-reset/request`, `/confirm`                            | Ver G-01                                                    |
| Productos, variantes, imágenes                                                       | AVAILABLE | `/v1/admin/catalog/products/**`                                          |                                                             |
| Categorías (árbol) y marcas                                                          | AVAILABLE | `/v1/admin/catalog/categories`, `/brands`                                | Sin GET individual; el detalle sale del árbol/listado       |
| Precios por variante, programados, importación CSV                                   | AVAILABLE | `/v1/admin/pricing/**`                                                   | Solo lista `GENERAL`; sin alta/edición de listas (ADR-0039) |
| Precio visible en listado de productos                                               | GAP       | —                                                                        | Ver G-04                                                    |
| Stock, movimientos, entradas, ajustes, almacén                                       | AVAILABLE | `/v1/admin/inventory/**`                                                 | Un solo almacén (ADR-0081)                                  |
| Pedidos: listado, detalle, cancelar, reintentar surtido, reintegro, datos bloqueados | AVAILABLE | `/v1/admin/orders/**`                                                    |                                                             |
| Pago manual (captura)                                                                | AVAILABLE | `POST /v1/admin/orders/{id}/manual-capture`                              | Ver G-02                                                    |
| Pagos: listado, detalle, reembolso manual                                            | AVAILABLE | `/v1/admin/payments/**`                                                  |                                                             |
| Reintentar reembolso con proveedor                                                   | GAP       | `…/refunds/retry` documentado como pendiente (T-192), ausente en OpenAPI | No se construye UI                                          |
| Envíos: listado, detalle, guía, despachar, entregar, fallo, devolución               | AVAILABLE | `/v1/admin/shipping/shipments/**`                                        |                                                             |
| Método de envío                                                                      | AVAILABLE | `GET/PUT /v1/admin/shipping/method`                                      |                                                             |
| Clientes: listado, detalle, suspender, reactivar, anonimizar                         | AVAILABLE | `/v1/admin/identity/customers/**`                                        |                                                             |
| Anonimizar invitado                                                                  | AVAILABLE | `POST /v1/admin/identity/guest-anonymizations`                           |                                                             |
| Staff y roles                                                                        | AVAILABLE | `/v1/admin/identity/staff/**`, `/roles/**`, `/permissions`               |                                                             |
| Auditoría                                                                            | AVAILABLE | `GET /v1/admin/audit` (cursor, 3 meses)                                  |                                                             |
| Entregas de eventos fallidas                                                         | AVAILABLE | `/v1/admin/event-deliveries/**`                                          |                                                             |
| Dashboard / KPIs                                                                     | PARTIAL   | — (solo conteos derivados de listados)                                   | Ver G-03                                                    |
| Reportes de ventas / exportaciones                                                   | GAP       | —                                                                        | Ver G-05                                                    |
| Promociones / cupones / descuentos                                                   | GAP       | — (`discountTotal` existe pero sin gestión)                              | Fuera de alcance                                            |
| Notificaciones / plantillas de correo                                                | GAP       | —                                                                        | Fuera de alcance                                            |
| Edición de pedidos, pedidos creados por staff, notas internas                        | GAP       | —                                                                        | Fuera de alcance                                            |
| Reseñas, contenido CMS, banners                                                      | GAP       | —                                                                        | Fuera de alcance                                            |

## Detalle de GAPs abiertos

### G-01 · Enlace de recuperación de contraseña del staff apunta al frontend de tienda — GAP

- **Funcionalidad:** "Olvidé mi contraseña" del staff.
- **Evidencia:** el enlace se construye como `FRONTEND_BASE_URL/reset-password?token=…` (API_SPEC §9.8); hay una sola URL base (`.env.example`: `FRONTEND_BASE_URL=http://localhost:5173`), pensada para la tienda.
- **Impacto:** un staff que pide recuperación recibe un enlace a la tienda, no al backoffice.
- **Workaround:** (a) que la tienda implemente `/reset-password` y sirva a ambos tipos de cuenta; (b) que el backend añada una URL base para staff; (c) el backoffice implementa `/reset-password` y se despliega en el dominio de `FRONTEND_BASE_URL` (no recomendado).
- **Bloqueo:** no bloquea el MVP; la pantalla de solicitud y la de confirmación pueden existir, pero el enlace no llegará al backoffice.
- **Pregunta pendiente:** ¿qué opción se adopta?

### G-02 · No hay forma de saber si el pago manual está habilitado — UNKNOWN

- **Evidencia:** `MANUAL_PAYMENTS_ENABLED=false` por defecto; las acciones responden 403 `manual-payments-disabled`. Ningún endpoint lo expone.
- **Impacto:** el botón "Registrar pago" puede mostrarse y fallar.
- **Workaround:** mostrar la acción según permiso `payments.manage` y manejar el 403 con un mensaje claro.
- **Pregunta pendiente:** ¿se agrega al backend un indicador (por ejemplo, en `GET /v1/me` o un endpoint de configuración)?

### G-03 · Sin endpoint de métricas para dashboard — PARTIAL

- **Evidencia:** ningún endpoint de estadísticas o agregados.
- **Lo que sí se puede mostrar sin inventar** (conteos con `meta.totalItems` y `pageSize=1`): órdenes por cobrar (`status=PENDING_PAYMENT`), en espera de surtido (`AWAITING_MANUAL_FULFILLMENT`), con reembolso pendiente (`hasPendingRefund=true`), envíos pendientes (defecto `PENDING`), entregas de eventos fallidas (defecto `FAILED`), stock bajo (`availableMax=N`).
- **Lo que no:** ventas, ingresos, ticket promedio, tendencias, productos más vendidos.
- **Resuelto:** dashboard de conteos operativos aprobado (DECISIONS D-P04).

### G-04 · Precio no incluido en `AdminProduct` — GAP

- **Evidencia:** `AdminProduct`/`AdminVariant` no traen precio; el precio vive en `GET …/price-lists/{id}/variants/{variantId}/periods`.
- **Impacto:** el listado de productos no puede mostrar precio sin una llamada por variante (N+1).
- **Workaround:** precio solo en el detalle del producto (una llamada por variante, máximo razonable); `storeVisibility = HIDDEN_NO_PRICE` alerta de productos sin precio.

### G-05 · Sin reportes ni exportaciones — GAP

- Fuera del MVP. Requiere backend.

### G-06 · Umbral de "stock bajo" — NO DOCUMENTADO

- `availableMax` existe como filtro, pero no hay umbral de negocio.
- **ASSUMPTION propuesta:** umbral configurable en preferencias del usuario (cliente), valor inicial 5. Requiere aprobación.

### G-07 · Ambientes y despliegue del backoffice — NO DOCUMENTADO

- URLs de staging/producción de la API, dominio del backoffice e infraestructura de hosting no están documentados.
- **Requisito conocido:** el origen del backoffice debe añadirse a `CORS_ALLOWED_ORIGINS` del backend en cada ambiente.
- **Pregunta pendiente:** dominios y hosting previstos.

### G-08 · Repositorio del frontend — RESUELTO

- `Ferchoner/base-ecomm-admin` confirmado por el usuario el 2026-10-05 (DECISIONS D-P01).

### G-09 · Idioma y localización — ASSUMPTION

- API en español (mensajes de error en español, moneda MXN, geografía de México). ASSUMPTION: UI solo en español (es-MX), sin módulo i18n en el MVP.

### G-10 · `CursorMetaDto` vacío en el OpenAPI — DOCUMENTATION CONFLICT menor

- **Evidencia:** en `openapi/v1.json`, `CursorMetaDto` no declara propiedades; API_SPEC §5.2 define `{ limit, nextCursor }`.
- **Resolución:** por prioridad de fuentes, se usa API_SPEC §5.2 (tipo `CursorMeta` declarado a mano en `app/shared/api/types.ts`). Afecta auditoría y movimientos de stock.
- **Pregunta pendiente:** ¿se corrige el DTO en el backend para que el OpenAPI lo declare?

## Comportamientos que el frontend debe respetar (no son gaps)

- Tolerar enumeraciones desconocidas (mostrar el valor crudo con badge neutro).
- Renovar el token de una en una (single-flight, también entre pestañas).
- No reintentar mutaciones automáticamente; `restocks` siempre con `Idempotency-Key`.
- Avisar de la demora en efectos en segundo plano y volver a consultar.
- Un recurso ajeno o inexistente es 404, nunca 403.
