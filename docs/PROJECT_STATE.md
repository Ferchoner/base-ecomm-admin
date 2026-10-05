# PROJECT_STATE

**Última actualización:** 2026-10-05
**Fase actual:** IMPLEMENT · F0 Bootstrap entregado en PR (pendiente de revisión).

## Proceso

| Fase                               | Estado                                 | Evidencia                                                   |
| ---------------------------------- | -------------------------------------- | ----------------------------------------------------------- |
| DISCOVER                           | ✅ Hecho                               | API_SOURCE_OF_TRUTH.md                                      |
| DEFINE                             | ✅ Hecho                               | GAPS.md, TRACEABILITY.md                                    |
| ARCHITECT                          | ✅ Aprobado 2026-10-05                 | ARCHITECTURE_PROPOSAL.md, DECISIONS.md (D-P01…D-P16)        |
| DESIGN                             | ○ Pendiente                            |                                                             |
| IMPLEMENT                          | ✱ F0 Bootstrap en PR; F1–F6 pendientes | Repo `Ferchoner/base-ecomm-admin`, rama `feat/f0-bootstrap` |
| TEST · REVIEW · DOCUMENT · DELIVER | ○ Pendiente                            |                                                             |

## Hallazgos clave

- La documentación de API no estaba en la carpeta "docs" del proyecto; está en el repo del backend `Ferchoner/base-shop` (`docs/API_SPEC.md` + `docs/openapi/v1.json`), fijada en el commit `a46829b`.
- Backend NestJS con contrato maduro: 126 operaciones, 80 administrativas en `/v1/admin`, permisos por operación, Problem Details, paginación y concurrencia optimista uniformes.
- Autenticación por Bearer + refresh token rotado en el cuerpo, sin cookies; renovaciones concurrentes revocan la sesión.
- No hay endpoint de métricas; el dashboard solo puede mostrar conteos operativos.

## F0 Bootstrap — entregado

- Nuxt 4 SPA (`ssr: false`, `nuxt generate`), TypeScript estricto (+ `noUncheckedIndexedAccess`), Nuxt UI 4 + Tailwind 4, Pinia, TanStack Query, Zod.
- Tipos generados del contrato (`openapi/v1.json` → `app/shared/api/generated/openapi.d.ts`).
- Cliente API: Bearer, renovación ante 401, Problem Details → `ApiProblem`, `Idempotency-Key`, timeout, filtros por coma.
- Sesión: token en memoria, refresh token en `localStorage`, renovación single-flight entre pestañas (Web Locks), renovación proactiva, cierre sincronizado entre pestañas, rechazo de cuentas de cliente.
- Guards: login obligatorio, cambio de contraseña forzado, permiso por página.
- Pantallas: login, cambio de contraseña (forzado y voluntario), inicio con secciones según permisos, layout con sidebar responsive, página de error 403/404.
- Calidad: ESLint + Prettier, 33 pruebas unitarias, 7 E2E × 2 viewports (escritorio y móvil), CI en GitHub Actions.
- **Pendiente para F1:** perfil (`/cuenta`), recuperación de contraseña (depende de G-01).

## Pendiente del usuario

1. Elegir opción para G-01 (enlace de recuperación de staff) y G-02 (indicador de pago manual), o aceptarlos como limitación.
2. Informar dominios/hosting previstos (G-07).

## Siguiente paso

Revisión y merge del PR de F0; después F1 Auth y cuenta, y F2 Catálogo.
