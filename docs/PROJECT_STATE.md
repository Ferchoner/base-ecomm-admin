# PROJECT_STATE

**Última actualización:** 2026-10-05
**Fase actual:** IMPLEMENT · F0, F1 y F2 fusionados (PR #1, #2, #3/#4); F3 Precios e Inventario en PR.

## Proceso

| Fase                               | Estado                                         | Evidencia                                            |
| ---------------------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| DISCOVER                           | ✅ Hecho                                       | API_SOURCE_OF_TRUTH.md                               |
| DEFINE                             | ✅ Hecho                                       | GAPS.md, TRACEABILITY.md                             |
| ARCHITECT                          | ✅ Aprobado 2026-10-05                         | ARCHITECTURE_PROPOSAL.md, DECISIONS.md (D-P01…D-P16) |
| DESIGN                             | ○ Pendiente                                    |                                                      |
| IMPLEMENT                          | ✱ F0–F2 fusionados; F3 en PR; F4–F6 pendientes | Repo `Ferchoner/base-ecomm-admin`                    |
| TEST · REVIEW · DOCUMENT · DELIVER | ○ Pendiente                                    |                                                      |

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

## F3 Precios e Inventario — en PR

- Precios (`/precios`): lista general con IVA incluido; buscar un producto y ver el precio vigente de cada variante (una llamada por variante, G-04); por variante, precio desde ahora, programado (fecha futura), precio "antes", historial y cancelar programados.
- Importación CSV: "Revisar archivo" (`dryRun=true`) y luego "Importar"; errores por línea (`rows[n].columna`); todo o nada.
- Inventario (`/inventario/stock`): existencias con búsqueda, "Disponibles hasta N", atajo "Stock bajo (≤ N)" con el umbral de cada usuario (G-06, editable en Mi cuenta, inicial 5) y orden en la URL; entrada y ajuste (motivos que solo restan, nota obligatoria con Otro, vista previa de unidades); movimientos con filtros y "Cargar más" por cursor; registrar movimiento de una variante sin existencias.
- Almacén (`/inventario/almacen`): nombre y dirección con estados y municipios del INEGI.
- Sin `catalog.read`, Precios ofrece solo la importación CSV (G-12). `quantity` del ajuste se envía según API_SPEC aunque el OpenAPI no la declare (G-11).
- Calidad: 53 pruebas unitarias, 26 E2E × 2 viewports.

## Decisiones del usuario (2026-10-05)

G-01, G-06, G-07, G-09 resueltos; G-02 y G-10 quedan como cambios del backend (DECISIONS D-032…D-037).

## Pendiente del backend

1. Endpoints para consultar y activar o desactivar el pago manual, solo superadministrador (G-02).
2. Declarar `CursorMetaDto` y los parámetros `cursor`/`limit` en el OpenAPI (G-10) y `quantity` en `AdjustmentDto` (G-11).

## Siguiente paso

Revisión y merge del PR de F3; después F4 Pedidos + Pagos + Envíos.
