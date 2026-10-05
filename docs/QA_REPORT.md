# QA_REPORT

**Fecha:** 2026-10-05 · **Rama:** `feat/qa-pwa` sobre `main` con F0–F6 fusionados · **Estrategia:** TESTING_STRATEGY.md · **Casos:** TEST_CASE_MATRIX.md

## Resultado de la ejecución

| Verificación                       | Resultado                                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| `npm run lint`                     | ✅ sin errores                                                                     |
| `npm run format:check`             | ✅ sin diferencias                                                                 |
| `npm run typecheck` (TS estricto)  | ✅ 0 errores                                                                       |
| `npm test` (Vitest)                | ✅ 79 de 79                                                                        |
| `npm run build` (`nuxt generate`)  | ✅ SPA estática + service worker (136 archivos precacheados)                       |
| `npm run test:e2e` (Playwright)    | ✅ 161 ejecuciones pasan; 19 omitidas a propósito (tema oscuro solo en escritorio) |
| Accesibilidad (axe, WCAG 2.1 A/AA) | ✅ 0 violaciones en login, 19 pantallas (tema claro y oscuro) y 3 diálogos         |
| `npm audit`                        | ⚠️ 11 altas y 1 baja, todas en herramientas de build (QA-05)                       |

Los E2E corren cada caso en escritorio (Desktop Chrome) y móvil (Pixel 7) contra el build estático, con la API simulada según `openapi/v1.json`.

## Hallazgos

Clasificación: frontend bug · API mismatch · configuración · test defect · documentación insuficiente.

| ID    | Clase                      | Severidad | Hallazgo                                                                                                                                                                                                                                                           | Estado                                                                                                                                                 |
| ----- | -------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| QA-01 | frontend bug               | HIGH      | Sin conexión, una mutación de TanStack Query quedaba en pausa (`networkMode: 'online'` por defecto) y se enviaba sola al volver la red. Contradice "no reintentar mutaciones" y la regla de que las operaciones críticas requieren API al día.                     | ✅ Corregido: `mutations.networkMode: 'always'` en `app/plugins/02.vue-query.ts`. `tests/e2e/pwa.spec.ts` falla sin el cambio y pasa con él.           |
| QA-02 | frontend bug               | MEDIUM    | Contraste insuficiente (axe `color-contrast`, serious): en el tema claro, placeholders, texto atenuado, iniciales del avatar, badges sutiles de éxito y advertencia (4.32:1) y alertas de advertencia, en 19 de 20 pantallas; en el oscuro, placeholders (3.74:1). | ✅ Corregido con tokens de color en `app/assets/css/main.css` (DECISIONS D-059).                                                                       |
| QA-03 | frontend bug               | MEDIUM    | El contenido del evento en el detalle de una entrega era una región con scroll horizontal sin acceso por teclado (axe `scrollable-region-focusable`).                                                                                                              | ✅ Corregido: `tabindex="0"` y `role="region"` con nombre en `DeliveryDetailSlideover.vue`.                                                            |
| QA-04 | API mismatch               | LOW       | Conflictos entre API_SPEC y el OpenAPI: `CursorMetaDto` vacío y sin `cursor`/`limit` (G-10), `AdjustmentDto` sin `quantity` (G-11), `nextAttemptAt` obligatorio en entregas fallidas (G-16).                                                                       | Mitigado en el frontend según la prioridad de fuentes; las correcciones del contrato dependen del backend.                                             |
| QA-05 | configuración              | MEDIUM    | `npm audit`: 11 vulnerabilidades altas y 1 baja en dependencias de desarrollo y build (`node-forge` vía `listhen` y `@nuxt/cli`; `braces`/`micromatch` vía `fast-glob`; `esbuild` en Windows). Ninguna llega al bundle estático publicado.                         | Abierto: actualizar Nuxt cuando publique versiones que las resuelvan. `npm audit fix --force` cambiaría versiones mayores y no se aplica sin revisión. |
| QA-06 | documentación insuficiente | LOW       | API_SPEC §22.3 no dice qué pasa si el reintento masivo de entregas recibe tipo de evento y manejador a la vez (G-15).                                                                                                                                              | Abierto: se asume que se combinan; pregunta registrada para el backend.                                                                                |
| QA-07 | documentación insuficiente | LOW       | No existen todavía los endpoints para consultar y activar el pago manual (G-02, decisión del usuario D-033).                                                                                                                                                       | Abierto: el frontend explica el 403 `manual-payments-disabled`; la pantalla se construye cuando el contrato los incluya.                               |

No hubo test defects: ninguna prueba se modificó para ocultar un fallo. Las pruebas nuevas de esta fase (accesibilidad y PWA) se escribieron primero y fallaron por los hallazgos QA-01 a QA-03 antes de su corrección.

## Pendientes de QA

| Pendiente                                                 | Motivo                                                                                | Prioridad   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------- |
| Prueba contra la API real de `base-shop` en local         | Los E2E simulan la API; falta una corrida manual con el backend levantado (G-07)      | REQUIRED    |
| Revisión manual con lector de pantalla (NVDA o VoiceOver) | axe no detecta todo; G-14 (opciones deshabilitadas sin `aria-disabled`) sigue abierto | RECOMMENDED |
| Renovación de sesión con varias pestañas abiertas         | Cubierta por revisión de código y unidad, no por E2E                                  | OPTIONAL    |
| Otros navegadores (Firefox, Safari)                       | Solo se prueba Chromium                                                               | OPTIONAL    |
