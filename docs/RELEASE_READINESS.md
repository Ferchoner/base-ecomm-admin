# RELEASE_READINESS

**Fecha:** 2026-10-05, actualizado el 2026-10-06 con la prueba contra la API real y la API 1.1–1.3 · **Versión candidata:** `0.1.0` (sin publicar) · **Ambiente objetivo:** solo local (G-07, D-035).

## Veredicto

| Uso                                                          | Estado                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Desarrollo y demostración en local con la API simulada (E2E) | ✅ Listo                                                                        |
| Pruebas de aceptación en local con la API real               | ✅ Hechas el 2026-10-06; todos los módulos funcionan (QA_REPORT.md)             |
| Uso operativo en local con datos reales                      | ✅ Listo, con el riesgo de sesión de FTR-16 (vuelve al login, sin perder datos) |
| Producción                                                   | ❌ **No listo**: no hay ambiente ni controles de servidor                       |

No se declara production-ready: no hay evidencia de un ambiente publicado con HTTPS y CSP.

## Evidencia

| Criterio                                 | Evidencia                                                                           | Estado |
| ---------------------------------------- | ----------------------------------------------------------------------------------- | ------ |
| Alcance aprobado construido (F0–F6)      | PR #1–#9 fusionados; TRACEABILITY.md (95 operaciones DONE, 1 UNAVAILABLE en la API) | ✅     |
| QA y PWA                                 | PR #10 fusionado; QA_REPORT.md; PWA_STRATEGY.md                                     | ✅     |
| Lint, formato, typecheck estricto        | Gate local y CI                                                                     | ✅     |
| Pruebas unitarias                        | 89 de 89 (Vitest)                                                                   | ✅     |
| E2E escritorio y móvil                   | Playwright sobre el build con la API simulada                                       | ✅     |
| Accesibilidad WCAG 2.1 A/AA (automática) | axe sin violaciones en login, 21 vistas (claro y oscuro) y 3 diálogos               | ✅     |
| Revisión técnica                         | FINAL_TECHNICAL_REVIEW.md: 0 CRITICAL, 0 HIGH, 4 MEDIUM                             | ⚠️     |
| Prueba contra la API real                | 2026-10-06, `base-shop` `a46829b` en local; QA_REPORT.md (QA-08 a QA-14)            | ✅     |
| Ambiente publicado con HTTPS y CSP       | No existe (G-07)                                                                    | ❌     |
| Documentación                            | Docs sincronizados con el código; onboarding, despliegue, checklist, handover       | ✅     |

## Pendientes

| Pendiente                                                                     | Clasificación            | Responsable sugerido | Referencia                   |
| ----------------------------------------------------------------------------- | ------------------------ | -------------------- | ---------------------------- |
| Revisar y fusionar los PR #13 a #16 (API 1.1–1.3), en orden                   | BLOCKER                  | Usuario              | PLAN_API_1.2.md              |
| Fijar `NUXT_PUBLIC_PRIVACY_NOTICE_VERSION` para vender a invitados            | REQUIRED para invitados  | Usuario              | G-19, DEPLOYMENT.md          |
| Exponer la versión vigente del aviso de privacidad                            | RECOMMENDED              | Backend              | G-19                         |
| Transferencia atómica entre almacenes                                         | OPTIONAL                 | Backend              | G-20                         |
| Margen de gracia para el refresh token recién rotado                          | RECOMMENDED              | Backend              | G-18, FTR-16                 |
| Cantidades ya reintegradas por línea en `AdminOrder`                          | OPTIONAL                 | Backend              | G-17                         |
| Definir hosting, dominios, URLs de la API y pipeline de despliegue            | REQUIRED para producción | Usuario              | G-07, DEPLOYMENT.md          |
| Aplicar HTTPS, CSP y encabezados de seguridad en ese ambiente                 | REQUIRED para producción | Quien despliegue     | FTR-03, FRONTEND_SECURITY.md |
| Corregir `CursorMetaDto` y `quantity` de `AdjustmentDto` en el OpenAPI        | RECOMMENDED              | Backend              | G-10, G-11                   |
| Revisión manual con lector de pantalla                                        | RECOMMENDED              | QA                   | QA_REPORT, G-14              |
| Actualizar Nuxt cuando corrija las vulnerabilidades de build                  | RECOMMENDED              | Frontend             | FTR-02, QA-05                |
| Ocultar "Reintentar" en un 404 de detalle                                     | OPTIONAL                 | Frontend             | FTR-07                       |
| Sacar tablas y filtros de las páginas de listado a componentes de feature     | OPTIONAL                 | Frontend             | FTR-05                       |
| Firefox y WebKit en Playwright                                                | OPTIONAL                 | Frontend             | FTR-09                       |
| Respuestas del backend a G-13 (nombre del actor) y G-15 (reintento combinado) | OPTIONAL                 | Backend              | GAPS.md                      |
| Monitoreo de errores del frontend                                             | OPTIONAL                 | Usuario              | FTR-15                       |

## Riesgos conocidos

| Riesgo                                                   | Impacto                                                   | Mitigación actual                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Renovación interrumpida por recargar o cerrar la pestaña | La sesión se revoca y todas las pestañas vuelven al login | Ventana de milisegundos con el TTL por defecto; G-18 pide un margen de gracia al backend |
| Pago manual apagado                                      | No se puede registrar el cobro en tienda                  | "Registrar pago" avisa antes de abrir; un superadministrador lo activa en Pago en tienda |
| Transferencia a medias entre almacenes                   | Unidades que salieron del origen sin entrar al destino    | El diálogo lo explica y ofrece repetir solo la entrada (G-20)                            |
| XSS en un ambiente sin CSP                               | Robo del refresh token                                    | Sin `v-html`, sin terceros; CSP pendiente del hosting                                    |
| Vulnerabilidades en herramientas de build                | Máquinas de desarrollo o CI                               | No llegan al bundle; revisión por release                                                |
