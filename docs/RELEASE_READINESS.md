# RELEASE_READINESS

**Fecha:** 2026-10-05 · **Versión candidata:** `0.1.0` (sin publicar) · **Ambiente objetivo:** solo local (G-07, D-035).

## Veredicto

| Uso                                                          | Estado                                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Desarrollo y demostración en local con la API simulada (E2E) | ✅ Listo                                                                             |
| Pruebas de aceptación en local con la API real               | ✅ Listo para empezar                                                                |
| Uso operativo en local con datos reales                      | ⚠️ Después de la prueba contra la API real (FTR-01)                                  |
| Producción                                                   | ❌ **No listo**: no hay ambiente, controles de servidor ni prueba contra la API real |

No se declara production-ready: no hay evidencia de un ambiente publicado ni de una corrida contra el backend real.

## Evidencia

| Criterio                                 | Evidencia                                                                           | Estado |
| ---------------------------------------- | ----------------------------------------------------------------------------------- | ------ |
| Alcance aprobado construido (F0–F6)      | PR #1–#9 fusionados; TRACEABILITY.md (88 operaciones DONE, 1 UNAVAILABLE en la API) | ✅     |
| QA y PWA                                 | PR #10 fusionado; QA_REPORT.md; PWA_STRATEGY.md                                     | ✅     |
| Lint, formato, typecheck estricto        | Gate local y CI                                                                     | ✅     |
| Pruebas unitarias                        | 80 de 80 (Vitest)                                                                   | ✅     |
| E2E escritorio y móvil                   | Playwright sobre el build con la API simulada                                       | ✅     |
| Accesibilidad WCAG 2.1 A/AA (automática) | axe sin violaciones en login, 19 pantallas (claro y oscuro) y 3 diálogos            | ✅     |
| Revisión técnica                         | FINAL_TECHNICAL_REVIEW.md: 0 CRITICAL, 1 HIGH, 3 MEDIUM                             | ⚠️     |
| Prueba contra la API real                | No realizada                                                                        | ❌     |
| Ambiente publicado con HTTPS y CSP       | No existe (G-07)                                                                    | ❌     |
| Documentación                            | Docs sincronizados con el código; onboarding, despliegue, checklist, handover       | ✅     |

## Pendientes

| Pendiente                                                                     | Clasificación                | Responsable sugerido    | Referencia                    |
| ----------------------------------------------------------------------------- | ---------------------------- | ----------------------- | ----------------------------- |
| Revisar y fusionar el PR de documentación y release                           | BLOCKER                      | Usuario                 | PR de documentación y release |
| Probar contra la API real de `base-shop` en local (RELEASE_CHECKLIST §3)      | REQUIRED                     | Equipo / QA             | FTR-01                        |
| Endpoints para consultar y activar el pago manual, y su pantalla              | REQUIRED para pagos manuales | Backend, luego frontend | G-02, D-033, FTR-04           |
| Definir hosting, dominios, URLs de la API y pipeline de despliegue            | REQUIRED para producción     | Usuario                 | G-07, DEPLOYMENT.md           |
| Aplicar HTTPS, CSP y encabezados de seguridad en ese ambiente                 | REQUIRED para producción     | Quien despliegue        | FTR-03, FRONTEND_SECURITY.md  |
| Corregir `CursorMetaDto` y `quantity` de `AdjustmentDto` en el OpenAPI        | RECOMMENDED                  | Backend                 | G-10, G-11                    |
| Revisión manual con lector de pantalla                                        | RECOMMENDED                  | QA                      | QA_REPORT, G-14               |
| Actualizar Nuxt cuando corrija las vulnerabilidades de build                  | RECOMMENDED                  | Frontend                | FTR-02, QA-05                 |
| Prueba de renovación con varias pestañas                                      | RECOMMENDED                  | QA                      | FTR-06                        |
| Ocultar "Reintentar" en un 404 de detalle                                     | OPTIONAL                     | Frontend                | FTR-07                        |
| Sacar tablas y filtros de las páginas de listado a componentes de feature     | OPTIONAL                     | Frontend                | FTR-05                        |
| Firefox y WebKit en Playwright                                                | OPTIONAL                     | Frontend                | FTR-09                        |
| Respuestas del backend a G-13 (nombre del actor) y G-15 (reintento combinado) | OPTIONAL                     | Backend                 | GAPS.md                       |
| Monitoreo de errores del frontend                                             | OPTIONAL                     | Usuario                 | FTR-15                        |

## Riesgos conocidos

| Riesgo                                                   | Impacto                             | Mitigación actual                                         |
| -------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------- |
| Diferencias no vistas entre el OpenAPI y el backend real | Errores 400 o pantallas incompletas | Mocks con las formas del OpenAPI; prueba manual pendiente |
| Pago manual apagado en el backend                        | "Registrar pago" responde 403       | Mensaje claro que pide a un superadministrador activarlo  |
| XSS en un ambiente sin CSP                               | Robo del refresh token              | Sin `v-html`, sin terceros; CSP pendiente del hosting     |
| Vulnerabilidades en herramientas de build                | Máquinas de desarrollo o CI         | No llegan al bundle; revisión por release                 |
