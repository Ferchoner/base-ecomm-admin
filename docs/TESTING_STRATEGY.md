# TESTING_STRATEGY

**Última actualización:** 2026-10-05 · Fuente de verdad del comportamiento: API_SPEC + `openapi/v1.json` del commit `a46829b` de `Ferchoner/base-shop`.

## Objetivo

Probar que el backoffice usa el contrato de la API tal como está documentado, que cada usuario solo ve y hace lo que sus permisos permiten, y que los errores de la API llegan al usuario con un mensaje útil. No se prueba la API real: las pruebas simulan sus respuestas con las formas del OpenAPI.

## Niveles

| Nivel                       | Herramienta                                  | Qué cubre                                                                                                                                     | Dónde                    |
| --------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Unidad                      | Vitest + happy-dom                           | Esquemas Zod (límites de API_SPEC), transiciones por estado, utilidades (dinero, fechas, filtros), cliente API, sesión y renovación de tokens | `tests/unit/**`          |
| Componente                  | Vitest + Vue Test Utils (`@nuxt/test-utils`) | Componentes con lógica propia (por ejemplo, `StatusBadge` con valores desconocidos)                                                           | `tests/unit/**`          |
| Integración del cliente API | Vitest + MSW                                 | Bearer, renovación ante 401, `Idempotency-Key`, Problem Details → `ApiProblem`, errores de red                                                | `tests/unit/shared/`     |
| Extremo a extremo           | Playwright sobre el build estático           | Flujos completos por pantalla con la API simulada en `page.route` (`tests/e2e/mock-*.ts`), en escritorio (Desktop Chrome) y móvil (Pixel 7)   | `tests/e2e/*.spec.ts`    |
| Accesibilidad automática    | `@axe-core/playwright` (WCAG 2.1 A y AA)     | Cada pantalla con datos, tres diálogos y la navegación solo con teclado                                                                       | `tests/e2e/a11y.spec.ts` |
| PWA                         | Playwright con service worker permitido      | Manifest e iconos, precache solo del shell, apertura sin conexión, cambios sin conexión que no se envían solos                                | `tests/e2e/pwa.spec.ts`  |

## Prioridad: flujos críticos

1. **Autenticación y sesión:** login, rechazo de cuentas de cliente, contraseña temporal forzada, recuperación de contraseña, renovación single-flight, restauración al recargar, regreso a la ruta pedida.
2. **Autorización:** navegación y acciones según `permissions` de `GET /v1/me`; páginas protegidas por permiso; reacción a 403.
3. **Dinero y stock:** precios en centavos, importación CSV con revisión previa, entradas y ajustes, reintegros con `Idempotency-Key` y sin superar lo vendido.
4. **Pedidos, pagos y envíos:** acciones por estado, cancelación con reembolso, pago y reembolso manual, guía y transiciones de envío.
5. **Datos personales:** datos bloqueados solo con motivo, anonimización con confirmación, contraseña temporal mostrada una sola vez.
6. **Concurrencia:** `version` en cada recurso versionado; un 409 `version-conflict` recarga y avisa, nunca reenvía solo.

## Reglas

- Las pruebas no se modifican para ocultar un defecto: si una falla, se clasifica (ver QA_REPORT) y se corrige la causa.
- Una prueba nunca depende de otra; cada una arma su API simulada con lo que necesita.
- Los mocks responden con las formas de `openapi/v1.json`; un campo que no está en el contrato no se agrega a un mock.
- Errores de la API: se prueba al menos un caso por tipo relevante de Problem Details en cada módulo (`validation-error` por campo, `version-conflict`, `duplicate-value`, `invalid-state-transition`, 403 y los específicos del módulo).
- Formularios: se prueban los límites del contrato en unidad (Zod) y el camino feliz más un error por campo en E2E.
- Responsive: todos los E2E corren en escritorio y en móvil.
- Accesibilidad: axe no debe reportar ninguna violación A/AA. axe no detecta todo; la revisión manual con lector de pantalla queda como pendiente (QA_REPORT).

## Ejecución

```bash
npm run lint && npm run format:check && npm run typecheck   # estático
npm test                                                     # unidad, componente e integración
npm run build && npm run test:e2e                            # E2E, accesibilidad y PWA sobre el build
```

En entornos con Chromium ya instalado: `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/ruta/a/chromium npm run test:e2e`. CI (`.github/workflows/ci.yml`) corre la misma secuencia en cada PR.

## Fuera de alcance

- Pruebas contra la API real (no hay ambiente compartido: G-07, solo local).
- Pruebas de carga o rendimiento.
- Navegadores distintos de Chromium.
