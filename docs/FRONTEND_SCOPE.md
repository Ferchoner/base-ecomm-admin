# FRONTEND_SCOPE

**Última actualización:** 2026-10-05. Estado real del código en `main` más el PR de QA y PWA. Detalle de pantallas en SCREEN_INVENTORY.md; trazabilidad en TRACEABILITY.md.

## Incluido y construido

| Módulo          | Alcance construido                                                                                                                                             | Fase   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Acceso y cuenta | Login de staff, cambio de contraseña forzado y voluntario, recuperar y restablecer contraseña, Mi cuenta (datos, roles, permisos, preferencias), cerrar sesión | F0–F1  |
| Inicio          | Seis conteos de pendientes según permisos, con enlace al listado filtrado; accesos a las secciones permitidas                                                  | F6     |
| Catálogo        | Productos (alta en borrador, edición, publicar, archivar, reactivar), variantes, imágenes, categorías en árbol, marcas                                         | F2     |
| Precios         | Precio vigente por variante, programar, historial, cancelar programados, importación CSV con revisión previa                                                   | F3     |
| Inventario      | Existencias con filtros y stock bajo por usuario, entradas, ajustes, movimientos por cursor, datos del almacén                                                 | F3     |
| Pedidos         | Listado con filtros, detalle, registrar pago en tienda, cancelar, reintegrar stock, reintentar surtido, volver a comprar, datos bloqueados con motivo          | F4     |
| Pagos           | Listado, detalle con intentos y reembolsos, reembolso manual                                                                                                   | F4     |
| Envíos          | Listado, detalle, guía, despachar, entregar, entrega fallida, devolución; método de envío                                                                      | F4, F6 |
| Clientes        | Listado, detalle, suspender, reactivar, anonimizar, anonimizar pedidos de invitado                                                                             | F5     |
| Staff y roles   | Alta con contraseña temporal, roles, suspender, reactivar; roles con permisos                                                                                  | F5     |
| Auditoría       | Bitácora con filtros y cursor, detalle de cambios                                                                                                              | F6     |
| Eventos         | Entregas de eventos, reintentar una o todas las fallidas del filtro                                                                                            | F6     |
| PWA             | Instalable, shell sin conexión, aviso de versión nueva, franja sin conexión; nunca cachea la API                                                               | QA     |
| Accesibilidad   | WCAG 2.1 A/AA verificado con axe en todas las pantallas (claro y oscuro)                                                                                       | QA     |

Uso del contrato: 79 de las 80 operaciones `/v1/admin` más las de autenticación, cuenta y geografía que aplican al staff (API_FRONTEND_CONTRACT.md).

## Incluido pero limitado por la API

| Caso                                                      | Limitación                                                              | Referencia |
| --------------------------------------------------------- | ----------------------------------------------------------------------- | ---------- |
| Precio en el listado de productos                         | No se muestra (N+1); el precio está en Precios y en el detalle          | G-04       |
| Precios e inventario sin `catalog.read`                   | Solo importación CSV en Precios; no se buscan variantes sin existencias | G-12       |
| Quién hizo un cambio en historiales de pedido y pago      | Se muestra "Por el staff"; el nombre está en Auditoría                  | G-13       |
| Tablero                                                   | Solo conteos; sin ventas, ingresos ni tendencias                        | G-03       |
| Reintento masivo de eventos con tipo y manejador a la vez | Se asume que se combinan (ASSUMPTION)                                   | G-15       |

## Fuera de alcance

- Todo lo que no tiene API (PRODUCT_DEFINITION.md, "Fuera del producto").
- Reintento de reembolsos con el proveedor: `…/refunds/retry` está pendiente en el backend (T-192).
- Varios idiomas o monedas (D-036).
- Datos sin conexión, sincronización en segundo plano, notificaciones push (PWA_STRATEGY.md).
- Despliegue en hosting real (D-035): ver DEPLOYMENT.md para lo que ya está listo y lo que falta definir.

## Operaciones del contrato que no se usan

| Operación                                                                                                                             | Motivo                                                |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `GET /v1/admin/identity/roles/{roleId}`                                                                                               | El listado de roles ya trae cada rol completo (D-050) |
| `PATCH /v1/me`, `POST /v1/me/email`                                                                                                   | Solo para clientes (API_SPEC §9.11, §9.13)            |
| `/v1/me/cart/**`, `/v1/me/orders/**`, `/v1/me/addresses/**`, `/v1/auth/register`, verificación de email, catálogo y checkout públicos | Son de la tienda, no del backoffice                   |
