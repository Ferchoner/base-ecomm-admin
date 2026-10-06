# PROJECT_STATE

**Última actualización:** 2026-10-06
**Fase actual:** DELIVER · F0 a F6, QA/PWA y documentación fusionados (PR #1 a #11); prueba contra la API real hecha, con sus correcciones en revisión.
**Release:** versión candidata `0.1.0`, sin publicar. **No está lista para producción** (RELEASE_READINESS.md).

## Proceso

| Fase      | Estado                            | Evidencia                                                          |
| --------- | --------------------------------- | ------------------------------------------------------------------ |
| DISCOVER  | ✅ Hecho                          | API_SOURCE_OF_TRUTH.md                                             |
| DEFINE    | ✅ Hecho                          | GAPS.md, TRACEABILITY.md                                           |
| ARCHITECT | ✅ Aprobado 2026-10-05            | ARCHITECTURE_PROPOSAL.md, DECISIONS.md (D-P01…D-P16)               |
| DESIGN    | ✅ Nuxt UI como sistema de diseño | DESIGN_SYSTEM.md, INFORMATION_ARCHITECTURE.md, SCREEN_INVENTORY.md |
| IMPLEMENT | ✅ F0–F6 fusionados               | Repo `Ferchoner/base-ecomm-admin`                                  |
| TEST      | ✅ QA y PWA fusionados            | TESTING_STRATEGY.md, QA_REPORT.md, PWA_STRATEGY.md                 |
| REVIEW    | ✅ Hecho                          | FINAL_TECHNICAL_REVIEW.md: 0 CRITICAL, 0 HIGH, 4 MEDIUM            |
| DOCUMENT  | ✅ Hecho                          | Docs sincronizados con el código; HANDOVER.md                      |
| DELIVER   | ⚠️ Solo local                     | RELEASE_READINESS.md, DEPLOYMENT.md, RELEASE_CHECKLIST.md          |

## Hallazgos clave

- La documentación de API no estaba en la carpeta "docs" del proyecto; está en el repo del backend `Ferchoner/base-shop` (`docs/API_SPEC.md` + `docs/openapi/v1.json`), fijada en el commit `a46829b`.
- Backend NestJS con contrato maduro: 126 operaciones, 80 administrativas en `/v1/admin`, permisos por operación, Problem Details, paginación y concurrencia optimista uniformes.
- Autenticación por Bearer + refresh token rotado en el cuerpo, sin cookies; renovaciones concurrentes revocan la sesión.
- No hay endpoint de métricas; el dashboard solo puede mostrar conteos operativos.

## F0 Bootstrap — fusionado (PR #1, 2026-10-05)

- Nuxt 4 SPA (`ssr: false`, `nuxt generate`), TypeScript estricto (+ `noUncheckedIndexedAccess`), Nuxt UI 4 + Tailwind 4, Pinia, TanStack Query, Zod.
- Tipos generados del contrato (`openapi/v1.json` → `app/shared/api/generated/openapi.d.ts`).
- Cliente API: Bearer, renovación ante 401, Problem Details → `ApiProblem`, `Idempotency-Key`, timeout, filtros por coma.
- Sesión: token en memoria, refresh token en `localStorage`, renovación single-flight entre pestañas (Web Locks), renovación proactiva, cierre sincronizado entre pestañas, rechazo de cuentas de cliente.
- Guards: login obligatorio, cambio de contraseña forzado, permiso por página.
- Pantallas: login, cambio de contraseña (forzado y voluntario), inicio con secciones según permisos, layout con sidebar responsive, página de error 403/404.
- Calidad: ESLint + Prettier, 33 pruebas unitarias, 7 E2E × 2 viewports (escritorio y móvil), CI en GitHub Actions.

## F1 Auth y cuenta — fusionado (PR #2)

- `/cuenta`: datos, roles y permisos de `GET /v1/me` (se vuelven a leer al entrar), cambiar contraseña y cerrar sesión.
- `/recuperar-contrasena`: solicitud con mensaje único exista o no la cuenta (API_SPEC §9.8).
- `/reset-password?token=…`: la ruta que fija la API; errores de política por campo y enlace vencido con opción de pedir otro. El enlace solo llega al backoffice si se resuelve G-01.
- Política de contraseña compartida (`app/shared/auth/password-policy.ts`).
- Calidad: 35 pruebas unitarias, 12 E2E × 2 viewports.

## F2 Catálogo — fusionado (PR #3 en la rama del F1 y PR #4 a `main`)

- Marcas (`/catalogo/marcas`): listado con búsqueda, estado y orden en la URL; alta, edición, desactivar, reactivar y eliminar.
- Categorías (`/catalogo/categorias`): árbol con sangría y ruta; alta, subcategoría, mover (sin ofrecer destinos que formarían ciclo ni padres inactivos), desactivar, reactivar, eliminar.
- Productos (`/catalogo/productos`): listado con búsqueda por título o SKU, filtros de estado, marca y categoría, orden y paginación en la URL; visibilidad en tienda (`storeVisibility`).
- Alta en borrador y detalle con pestañas Datos, Variantes e Imágenes; publicar, archivar y reactivar con confirmación; slug, SKU y opciones bloqueados tras la primera publicación.
- Variantes: alta y edición (SKU, hasta 3 opciones con los mismos nombres en todas, peso y medidas), descontinuar y reactivar.
- Imágenes: subir (JPEG/PNG/WebP), texto alternativo, variante, reordenar y eliminar; mensajes de 413/415/409 del contrato.
- Toda edición de producto envía la `version` leída; un 409 `version-conflict` recarga el producto y avisa, sin reenviar (D-024).
- Permisos: lectura con `catalog.read`; acciones solo con `catalog.write`.
- Calidad: 45 pruebas unitarias, 19 E2E × 2 viewports.

## F3 Precios e Inventario — fusionado (PR #5 y #6)

- Precios (`/precios`): lista general con IVA incluido; buscar un producto y ver el precio vigente de cada variante (una llamada por variante, G-04); por variante, precio desde ahora, programado (fecha futura), precio "antes", historial y cancelar programados.
- Importación CSV: "Revisar archivo" (`dryRun=true`) y luego "Importar"; errores por línea (`rows[n].columna`); todo o nada.
- Inventario (`/inventario/stock`): existencias con búsqueda, "Disponibles hasta N", atajo "Stock bajo (≤ N)" con el umbral de cada usuario (G-06, editable en Mi cuenta, inicial 5) y orden en la URL; entrada y ajuste (motivos que solo restan, nota obligatoria con Otro, vista previa de unidades); movimientos con filtros y "Cargar más" por cursor; registrar movimiento de una variante sin existencias.
- Almacén (`/inventario/almacen`): nombre y dirección con estados y municipios del INEGI.
- Sin `catalog.read`, Precios ofrece solo la importación CSV (G-12). `quantity` del ajuste se envía según API_SPEC aunque el OpenAPI no la declare (G-11).
- Calidad: 53 pruebas unitarias, 26 E2E × 2 viewports.

## F4 Pedidos, Pagos y Envíos — fusionado (PR #7)

- Pedidos (`/pedidos`): búsqueda por número, código o email; estado, clientes o invitados, fechas, reembolso pendiente y orden en la URL. Los datos bloqueados o anonimizados no se muestran.
- Detalle del pedido: líneas y totales, comprador y dirección, historial, pago, envío y fechas. Acciones según estado y permisos: registrar pago en tienda, reintentar surtido, cancelar (avisa del reembolso; reintegro opcional en PAID con `inventory.write`), reintegrar stock por línea con `Idempotency-Key`, volver a comprar y ver datos bloqueados con motivo.
- Pagos (`/pagos`): listado con estado, medio, fechas de cobro y orden; detalle con intentos y reembolsos; registrar reembolso manual con la `version` del pago.
- Envíos (`/envios`): por defecto los pendientes; capturar, cambiar o quitar la guía; despachar por paquetería o entrega propia; entregar, entrega fallida y devolución con nota.
- Lo que cambia en segundo plano (pago manual, despacho, entrega, reembolso) avisa de la demora y se vuelve a consultar (D-040). El 403 de pago manual deshabilitado se explica (G-02).
- Calidad: 62 pruebas unitarias, 33 E2E × 2 viewports.

## F5 Clientes, Staff y Roles — fusionado (PR #8)

- Clientes (`/clientes`): búsqueda por email o nombre, estado, verificación, fechas de registro y orden en la URL. Detalle con cuenta, direcciones y conteo de pedidos con enlace a Pedidos. Suspender y reactivar con motivo; anonimizar con referencia ARCO y confirmación, explicando los pedidos sin concluir. Anonimizar pedidos de invitado con email y código.
- Staff (`/staff`): búsqueda, estado, rol y orden. Alta con roles; la contraseña temporal se muestra una sola vez con botón de copiar. Detalle con cambio de roles, suspender (no a uno mismo) y reactivar (nueva contraseña temporal).
- Roles (`/roles`): alta y edición con permisos agrupados por área; solo se agregan permisos propios y el superadministrador conserva todos. Eliminar solo roles sin usuarios.
- Calidad: 69 pruebas unitarias, 39 E2E × 2 viewports.

## F6 Auditoría, Eventos, Método de envío y Dashboard — fusionado (PR #9)

- Inicio: conteos de lo pendiente según los permisos (pedidos por cobrar, esperando surtido y con reembolso pendiente; envíos por despachar; variantes con stock bajo con el umbral de cada usuario; entregas de eventos fallidas). Cada tarjeta abre el listado con el mismo filtro (D-054).
- Método de envío (`/configuracion/envio`): nombre, costo fijo con IVA, envío gratis opcional a partir de un monto y plazo en días hábiles. Solo lectura sin `shipping.configure`; un 409 recarga los datos.
- Eventos (`/operacion/eventos`): entregas fallidas por defecto, filtros de estado, tipo de evento y manejador, y orden en la URL; detalle con el último error y el evento; reintentar una o todas las fallidas del filtro, con confirmación (G-15).
- Auditoría (`/auditoria`): filtros de acción (código o prefijo `.*`), tipo de actor, resultado, recurso y fechas en la URL; "Cargar más" por cursor; detalle con cambios, motivo, IP y correlación; ver lo que hizo un actor o el historial de un recurso.
- Calidad: 79 pruebas unitarias, 45 E2E × 2 viewports.

## QA y PWA — fusionado (PR #10)

- PWA online-first: instalable (manifest e iconos), shell disponible sin conexión, aviso de versión nueva que el usuario aplica, franja de sin conexión. Nunca cachea la API (PWA_STRATEGY.md).
- Sin conexión una mutación falla de inmediato y no se envía al reconectar (QA-01, D-057).
- Accesibilidad: axe sin violaciones WCAG 2.1 A/AA en login, 19 pantallas (tema claro y oscuro) y 3 diálogos; navegación con teclado. Se corrigió el contraste de color (QA-02) y una región con scroll sin teclado (QA-03).
- Documentos: TESTING_STRATEGY.md, TEST_CASE_MATRIX.md, QA_REPORT.md, PWA_STRATEGY.md.
- Calidad: 79 pruebas unitarias; 161 ejecuciones E2E (incluye accesibilidad y PWA) en escritorio y móvil.

## Documentación, revisión y release — fusionado (PR #11)

- Documentación sincronizada con el código real: PRODUCT_DEFINITION, FRONTEND_SCOPE, INFORMATION_ARCHITECTURE, ROUTE_MAP, SCREEN_INVENTORY, DESIGN_SYSTEM, TECHNOLOGY_DECISION, FRONTEND_ARCHITECTURE, API_FRONTEND_CONTRACT, API_CLIENT_ARCHITECTURE, AUTHENTICATION, AUTHORIZATION_MATRIX, FRONTEND_SECURITY (D-061).
- DEVELOPER_ONBOARDING, DEPLOYMENT (solo local; hosting NO DOCUMENTADO, D-062), RELEASE_CHECKLIST, `CHANGELOG.md`, HANDOVER.
- FINAL_TECHNICAL_REVIEW: 0 CRITICAL, 1 HIGH (falta probar contra la API real), 3 MEDIUM (dependencias de build, controles de servidor sin ambiente, pago manual G-02), 5 LOW y 4 INFO abiertos. Se corrigieron dos: referencia de soporte en toasts de error 5xx y el indicador "Próximamente" sobrante (D-064).
- RELEASE_READINESS: listo para pruebas de aceptación en local; no listo para producción.
- Calidad: 80 pruebas unitarias; E2E, accesibilidad y PWA en escritorio y móvil.

## Prueba contra la API real — fusionado (PR #12, 2026-10-06)

- `base-shop` `a46829b` en local con PostgreSQL 18 y Mailpit; recorrido completo de RELEASE_CHECKLIST.md §3 (QA_REPORT.md).
- Todos los módulos funcionan contra la API real; G-11 confirmado como conflicto solo del OpenAPI.
- Corregido: formulario de producto que borraba cambios sin guardar (D-065), renovación cada 5 s con TTL corto (D-066), doble punto en el aviso de precio programado.
- Nuevos: G-17 (cantidades reintegradas en `AdminOrder`) y G-18 (renovación interrumpida revoca la sesión; FTR-16).
- Calidad: 83 pruebas unitarias; E2E, accesibilidad y PWA en escritorio y móvil.

## API 1.1–1.3: varios almacenes y ventas en tienda — en PR (2026-10-06)

- Plan aprobado (PLAN_API_1.2.md, D-068). Contrato fijado en `base-shop` `ff10406`.
- PR #13: contrato nuevo y pedidos de tienda en listados y detalle. PR #14: Almacenes, existencias por almacén y transferencia (G-20). PR #15: Pago en tienda (G-02 resuelto) y método del cobro. PR #16: Vender en tienda (`/pedidos/nuevo`) y "Entregar en tienda".
- Nuevos: G-19 (versión del aviso de privacidad por configuración), G-20, G-21.
- Calidad: 89 pruebas unitarias; E2E, accesibilidad y PWA en escritorio y móvil.

## Decisiones del usuario (2026-10-05)

G-01, G-06, G-07, G-09 resueltos; G-02 y G-10 quedan como cambios del backend (DECISIONS D-032…D-037).

## Pendiente del backend

1. Exponer la versión vigente del aviso de privacidad (G-19).
2. Opcional: transferencia atómica entre almacenes (G-20) y nombre de quien colocó una orden de tienda (G-21).
3. Margen de gracia para el refresh token recién rotado (G-18).
4. Opcional: cantidades ya reintegradas por línea en `AdminOrder` (G-17).

## Siguiente paso

1. Revisar y fusionar los PR #13 a #16 en orden; cada uno parte del anterior.
2. Fijar `NUXT_PUBLIC_PRIVACY_NOTICE_VERSION` con el valor de la tienda para vender a invitados (G-19).
3. Con el backend: versión del aviso de privacidad (G-19) y margen de gracia de la renovación (G-18).
4. Opcional: reintentar una entrega de eventos fallida con la API real cuando haya una.
5. Para producción: decidir hosting, dominios y pipeline (G-07) y aplicar HTTPS y CSP (FTR-03).

Pendientes clasificados en RELEASE_READINESS.md.
