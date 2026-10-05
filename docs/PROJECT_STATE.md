# PROJECT_STATE

**Última actualización:** 2026-10-05
**Fase actual:** IMPLEMENT · F0 fusionado (PR #1); F1 Auth y cuenta en PR #2; F2 Catálogo en PR.

## Proceso

| Fase                               | Estado                                          | Evidencia                                            |
| ---------------------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| DISCOVER                           | ✅ Hecho                                        | API_SOURCE_OF_TRUTH.md                               |
| DEFINE                             | ✅ Hecho                                        | GAPS.md, TRACEABILITY.md                             |
| ARCHITECT                          | ✅ Aprobado 2026-10-05                          | ARCHITECTURE_PROPOSAL.md, DECISIONS.md (D-P01…D-P16) |
| DESIGN                             | ○ Pendiente                                     |                                                      |
| IMPLEMENT                          | ✱ F0 fusionado; F1 y F2 en PR; F3–F6 pendientes | Repo `Ferchoner/base-ecomm-admin`                    |
| TEST · REVIEW · DOCUMENT · DELIVER | ○ Pendiente                                     |                                                      |

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

## F1 Auth y cuenta — en PR

- `/cuenta`: datos, roles y permisos de `GET /v1/me` (se vuelven a leer al entrar), cambiar contraseña y cerrar sesión.
- `/recuperar-contrasena`: solicitud con mensaje único exista o no la cuenta (API_SPEC §9.8).
- `/reset-password?token=…`: la ruta que fija la API; errores de política por campo y enlace vencido con opción de pedir otro. El enlace solo llega al backoffice si se resuelve G-01.
- Política de contraseña compartida (`app/shared/auth/password-policy.ts`).
- Calidad: 35 pruebas unitarias, 12 E2E × 2 viewports.

## F2 Catálogo — en PR

- Marcas (`/catalogo/marcas`): listado con búsqueda, estado y orden en la URL; alta, edición, desactivar, reactivar y eliminar.
- Categorías (`/catalogo/categorias`): árbol con sangría y ruta; alta, subcategoría, mover (sin ofrecer destinos que formarían ciclo ni padres inactivos), desactivar, reactivar, eliminar.
- Productos (`/catalogo/productos`): listado con búsqueda por título o SKU, filtros de estado, marca y categoría, orden y paginación en la URL; visibilidad en tienda (`storeVisibility`).
- Alta en borrador y detalle con pestañas Datos, Variantes e Imágenes; publicar, archivar y reactivar con confirmación; slug, SKU y opciones bloqueados tras la primera publicación.
- Variantes: alta y edición (SKU, hasta 3 opciones con los mismos nombres en todas, peso y medidas), descontinuar y reactivar.
- Imágenes: subir (JPEG/PNG/WebP), texto alternativo, variante, reordenar y eliminar; mensajes de 413/415/409 del contrato.
- Toda edición de producto envía la `version` leída; un 409 `version-conflict` recarga el producto y avisa, sin reenviar (D-024).
- Permisos: lectura con `catalog.read`; acciones solo con `catalog.write`.
- Calidad: 45 pruebas unitarias, 19 E2E × 2 viewports.

## Pendiente del usuario

1. Elegir opción para G-01 (enlace de recuperación de staff) y G-02 (indicador de pago manual), o aceptarlos como limitación.
2. Informar dominios/hosting previstos (G-07).

## Siguiente paso

Revisión y merge de los PR de F1 y F2; después F3 Precios + Inventario.
