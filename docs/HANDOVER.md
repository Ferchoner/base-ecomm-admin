# HANDOVER

**Fecha:** 2026-10-05 · **Repositorio:** `Ferchoner/base-ecomm-admin` · **Backend:** `Ferchoner/base-shop` (contrato fijado en `a46829b`).

Entrega técnica del backoffice para quien lo mantenga. Empieza por la sección 1 y sigue los enlaces.

## 1. En una página

- **Qué es:** SPA estática (Nuxt 4, Vue 3, TypeScript estricto, Nuxt UI 4) instalable como PWA, para que el staff opere la tienda `base-shop` a través de su API REST `/v1`. Sin servidor ni base de datos propios.
- **Estado:** alcance aprobado F0–F6, QA y PWA construidos y fusionados (PR #1–#10); documentación y release en revisión. **No está en producción ni lista para ella** (RELEASE_READINESS.md).
- **Ambiente:** solo local por decisión del usuario (D-035).
- **Primer paso para quien llega:** DEVELOPER_ONBOARDING.md (levantar API y backoffice) y RELEASE_CHECKLIST.md §3 (prueba contra la API real, la tarea más importante pendiente).

## 2. Documentación

| Documento                                                                    | Para qué                                                                      |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `CLAUDE.md`                                                                  | Reglas del proyecto (fuente de verdad, arquitectura, seguridad, calidad, Git) |
| PROJECT_STATE.md                                                             | Estado por fase y qué entregó cada PR                                         |
| PRODUCT_DEFINITION.md, FRONTEND_SCOPE.md                                     | Qué es el producto, qué incluye y qué no                                      |
| INFORMATION_ARCHITECTURE.md, ROUTE_MAP.md, SCREEN_INVENTORY.md               | Navegación, rutas y pantallas                                                 |
| DESIGN_SYSTEM.md                                                             | Nuxt UI, colores, formatos y componentes compartidos                          |
| TECHNOLOGY_DECISION.md, FRONTEND_ARCHITECTURE.md                             | Stack y arquitectura reales                                                   |
| ARCHITECTURE_PROPOSAL.md                                                     | Propuesta aprobada (histórica; diferencias en FRONTEND_ARCHITECTURE.md)       |
| API_SOURCE_OF_TRUTH.md, API_FRONTEND_CONTRACT.md, API_CLIENT_ARCHITECTURE.md | Contrato fijado, qué se usa y cómo se llama a la API                          |
| AUTHENTICATION.md, AUTHORIZATION_MATRIX.md, FRONTEND_SECURITY.md             | Sesión, permisos y seguridad                                                  |
| TESTING_STRATEGY.md, TEST_CASE_MATRIX.md, QA_REPORT.md                       | Pruebas y resultados de QA                                                    |
| PWA_STRATEGY.md                                                              | Qué hace y qué no hace la PWA                                                 |
| DEVELOPER_ONBOARDING.md, DEPLOYMENT.md, RELEASE_CHECKLIST.md, `CHANGELOG.md` | Trabajar, publicar y versionar                                                |
| FINAL_TECHNICAL_REVIEW.md, RELEASE_READINESS.md                              | Hallazgos y qué falta para cada uso                                           |
| GAPS.md, DECISIONS.md, TRACEABILITY.md                                       | Huecos del contrato, decisiones y trazabilidad endpoint → pantalla            |

## 3. Arquitectura en breve

- `pages → features → shared`; una feature no importa a otra (lint). Once features alineadas a los contextos del backend.
- Server state solo en TanStack Query; Pinia para sesión y preferencias; filtros en la URL.
- Cliente propio sobre ofetch: Bearer, renovación ante 401, `ApiProblem` para todo error.
- Token de acceso en memoria, refresh en `localStorage`, renovación de una en una también entre pestañas (Web Locks).
- Mutaciones nunca se reintentan solas; sin conexión fallan de inmediato.
- PWA online-first: precachea solo el shell; nunca la API.

## 4. Decisiones que no se deben revertir sin entenderlas

| Decisión                                                    | Por qué importa                                                          | Ref.          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ | ------------- |
| Refresh token en `localStorage`, no `sessionStorage`        | Pestañas duplicadas rotarían la misma copia y la API revocaría la sesión | D-P03         |
| Renovar dentro del Web Lock leyendo el token más reciente   | Dos renovaciones con el mismo refresh revocan toda la sesión             | API_SPEC §9.6 |
| `mutations.networkMode: 'always'` y `retry: false`          | Evita enviar cambios administrativos sin que el usuario lo vea           | D-057         |
| `runtimeCaching: []` en la PWA                              | La API nunca se sirve desde cache                                        | D-056         |
| TypeScript `~5.9`                                           | TS 7 rompe `openapi-typescript` y `vue-tsc`                              | D-018         |
| `NUXT_PUBLIC_API_BASE_URL` al construir                     | Un build por ambiente                                                    | D-019         |
| Datos bloqueados y contraseñas temporales fuera de la cache | Privacidad y auditoría                                                   | D-042, D-047  |
| PATCH solo con campos cambiados + `version`                 | Evita `field-locked` y sobrescribir cambios ajenos                       | D-024         |

## 5. Pendientes

Lista clasificada (BLOCKER, REQUIRED, RECOMMENDED, OPTIONAL) en RELEASE_READINESS.md. Lo principal:

1. **BLOCKER:** revisar y fusionar el PR de documentación y release.
2. **REQUIRED:** prueba contra la API real (FTR-01).
3. **REQUIRED para pagos manuales:** endpoints del backend para el indicador de pago manual (G-02).
4. **REQUIRED para producción:** hosting, dominios, HTTPS y CSP (G-07, FTR-03).

## 6. Dependencias con el backend

| Tema                                | Qué se espera del backend                                                 | GAP                      |
| ----------------------------------- | ------------------------------------------------------------------------- | ------------------------ |
| Pago manual                         | Endpoint para consultarlo y otro para activarlo (solo superadministrador) | G-02                     |
| OpenAPI                             | Declarar `CursorMetaDto`, `cursor`/`limit` y `quantity` del ajuste        | G-10, G-11               |
| Reintento masivo de eventos         | Aclarar si tipo y manejador se combinan                                   | G-15                     |
| Nombre del actor en historiales     | Opcional                                                                  | G-13                     |
| Enlace de recuperación por frontend | URL propia para la tienda cuando exista                                   | G-01                     |
| Cada cambio de contrato             | Nuevo commit fijado → `npm run api:types` → revisar features              | API_FRONTEND_CONTRACT.md |

## 7. Accesos y operación

- Sin secretos ni credenciales en el repo. La única configuración es `NUXT_PUBLIC_API_BASE_URL` (pública).
- Las cuentas se crean en el backend (primer superadministrador por script) y luego en **Staff**.
- CI: `.github/workflows/ci.yml` en cada PR y en `main` (lint, formato, typecheck, unidad, build, E2E). No publica nada.
- Ramas y PR en inglés con Conventional Commits; documentación en español en `docs/`.

## 8. Contacto con el contexto

- Hilo del proyecto donde se aprobaron arquitectura, fases y decisiones de GAPS (2026-10-05).
- Las decisiones del usuario están registradas en DECISIONS.md (D-P01…D-P17, D-032…D-037).
