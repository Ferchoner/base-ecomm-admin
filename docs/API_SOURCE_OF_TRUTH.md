# API_SOURCE_OF_TRUTH

Fuente de verdad del backend para el backoffice. Fecha de lectura: 2026-10-05; actualizada el 2026-10-06 a `ff10406`.

## Fuentes localizadas

| Prioridad | Fuente                                | Ubicación                                                                                        | Versión fijada                |
| --------- | ------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------- |
| 1         | Documentación oficial de la API       | `docs/API_SPEC.md` del repo `Ferchoner/base-shop` (estado: aprobado, ADR-0071)                   | commit `ff10406` (2026-10-06) |
| 2         | OpenAPI 3.0 generado desde NestJS     | `docs/openapi/v1.json` del mismo repo (133 operaciones, 172 esquemas)                            | commit `ff10406`              |
| —         | Contexto complementario (no contrato) | `docs/BUSINESS_RULES.md`, `REQUIREMENTS.md`, `SECURITY.md`, `DECISIONS.md` (ADRs) del mismo repo | commit `ff10406`              |

La carpeta de contexto "docs" del proyecto solo contiene los prompts de gobierno (00–08); no contiene documentación de API. La documentación se encontró en el repositorio del backend.

Relación entre fuentes: `API_SPEC.md` declara que el OpenAPI versionado debe coincidir con la especificación y que una prueba de contrato lo verifica en cada CI (ADR-0155). No se detectaron contradicciones (DOCUMENTATION CONFLICT) entre ambas en lo revisado. La única diferencia es esperada: `POST /v1/admin/payments/{paymentId}/refunds/retry` figura en la especificación como **pendiente (T-192)** y no existe en el OpenAPI → se trata como NO DISPONIBLE.

## Cambios desde `a46829b` (2026-10-06)

`ff10406` es `main` de base-shop después de la versión 1.2.0, con T-194 (versión 1.3 sin publicar). Detalle y plan en PLAN_API_1.2.md.

- **1.1.0, varios almacenes (ADR-0160):** `Warehouse.priority`; crear y desactivar almacenes; ajustes en almacenes inactivos y motivo `WAREHOUSE_TRANSFER`; reintegro con `warehouseId`; `AdminOrder.shipment.warehouseId` y filtro `warehouseId` en envíos.
- **1.2.0, ventas en la tienda física (ADR-0161):** permiso `orders.place` y rol Vendedor; `POST /v1/admin/orders/quote`, `POST /v1/admin/orders` (con `Idempotency-Key`) y `POST …/{orderId}/hand-over`; `channel`, `fulfillment`, `placedBy` y `warehouseId` en `AdminOrder`; en `IN_STORE`, `shippingAddress` y `estimatedDelivery` son `null`; `method` en la captura manual.
- **1.3 (sin publicar), pago manual desde la API (ADR-0162):** `GET`/`PUT /v1/admin/payment-settings` y permiso `payments.configure`, solo del superadministrador; `superadminOnly` en el catálogo de permisos. Resuelve G-02.
- **Correcciones del OpenAPI (#100):** `CursorMetaDto`, `cursor`/`limit` y `AdjustmentDto.quantity`. Resuelven G-10 y G-11.

## Resumen del contrato relevante para el backoffice

| Tema                     | Contrato                                                                                                                                                                                                                         | Referencia     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Base                     | `/v1`, JSON UTF-8, camelCase, UUID en rutas                                                                                                                                                                                      | API_SPEC §2.1  |
| Autenticación            | `POST /v1/auth/login` → JWT de acceso (15 min) + refresh token opaco (7 días, rotado en cada uso). Acceso en `Authorization: Bearer`; refresh en el cuerpo de `/v1/auth/refresh` y `/v1/auth/logout`. **La API no usa cookies.** | §3.1, ADR-0023 |
| Reutilización de refresh | Presentar un refresh ya rotado revoca toda la sesión. Dos renovaciones simultáneas cuentan como reutilización: el cliente debe renovar de una en una.                                                                            | §9.6           |
| Autorización             | Rutas `/v1/admin/*` exigen cuenta STAFF activa + permiso. Permiso por operación en `x-required-permissions` del OpenAPI. 17 permisos en catálogo.                                                                                | §3.2, §3.3     |
| Permisos del usuario     | `GET /v1/me` → `Account { type, roles[], permissions[], mustChangePassword }`. Los permisos se leen en cada request: un cambio de roles aplica desde la siguiente solicitud.                                                     | §8.10, §3.1    |
| Cambio obligatorio       | Staff con `mustChangePassword`: solo `GET /v1/me`, `POST /v1/me/password`, `POST /v1/auth/logout`; el resto 403 `password-change-required`.                                                                                      | §3.2           |
| Errores                  | Problem Details (RFC 9457), `application/problem+json`; decidir por `type`; `correlationId` siempre; `errors[]` en validación con `field` en notación de ruta. 35 tipos catalogados.                                             | §6             |
| Paginación               | Por página: `page`, `pageSize` (1–100, defecto 20) → `{ data, meta: { page, pageSize, totalItems, totalPages } }`. Por cursor solo en auditoría y movimientos de stock: `cursor`, `limit` → `meta.nextCursor`.                   | §5             |
| Orden y filtros          | `sort=campo,-campo`; listas por coma; rangos `From`/`To`. Parámetro no declarado → 400.                                                                                                                                          | §5.3           |
| Concurrencia             | Recursos versionados exigen `version` en PATCH y acciones; desactualizada → 409 `version-conflict` con `currentVersion`. Categorías y marcas sin `version`.                                                                      | §2.3           |
| Transiciones             | Nunca por PATCH de `status`: cada transición es un `POST` a subruta de acción con su permiso.                                                                                                                                    | §2.2           |
| Idempotencia             | `Idempotency-Key` obligatoria en el backoffice solo en `POST /v1/admin/orders/{orderId}/restocks`.                                                                                                                               | §4             |
| Consistencia eventual    | Captura manual, despacho, entrega y reembolso tienen efectos en segundo plano: la respuesta llega antes. El cliente debe avisar y volver a consultar.                                                                            | §2.5           |
| Rate limiting            | 100/min por IP general; login 20 fallidos por IP en 15 min. 429 con `Retry-After`. **Cuenta por IP del cliente.**                                                                                                                | §7             |
| CORS                     | Solo orígenes en `CORS_ALLOWED_ORIGINS` (vacía por defecto); permite `Authorization`, `Content-Type`, `Idempotency-Key`; expone `Location`, `Retry-After`, `X-Correlation-Id`.                                                   | §2.4, ADR-0085 |
| Dinero                   | `Money { amount (centavos), currency: "MXN" }`; solicitudes en centavos enteros.                                                                                                                                                 | §8.1           |
| Fechas                   | ISO 8601 UTC con milisegundos.                                                                                                                                                                                                   | §2.1           |
| Enumeraciones            | MAYÚSCULAS; **los clientes deben tolerar valores desconocidos**.                                                                                                                                                                 | §2.1           |
| Opcionales               | Se devuelven como `null`, no se omiten. Campos desconocidos en el cuerpo → 400.                                                                                                                                                  | §2.1           |
| Imágenes                 | `multipart/form-data`, JPEG/PNG/WebP, 5 MB, 20 por producto; URL absoluta en `Image.url`.                                                                                                                                        | §11.8          |
| Swagger                  | Solo en entorno local (`/docs/v1`). Para el frontend se usará la copia versionada `docs/openapi/v1.json`.                                                                                                                        | §24            |

## Ambientes

- Local del backend: `PORT=3000`, `IMAGE_BASE_URL=http://localhost:3000/media`, `docker-compose.yml` disponible (ver README del backend).
- Staging / producción: NO DOCUMENTADO (ver GAPS.md G-07).

## Regla

Ante cualquier cambio del backend, se actualiza el commit fijado aquí y se regeneran los tipos desde el OpenAPI antes de tocar features.
