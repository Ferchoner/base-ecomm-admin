# CLAUDE.md

## Proyecto

Frontend administrativo (backoffice) del e-commerce `base-shop`.

## Stack aprobado

- Nuxt 4 (SPA, `ssr: false`) + Vue 3 + TypeScript estricto
- Nuxt UI 4 + Tailwind CSS 4 · TanStack Query (server state) · Pinia (solo sesión) · Zod
- Vitest + MSW · Playwright

## Fuente de verdad

Documentación oficial de la API: `docs/API_SPEC.md` y `docs/openapi/v1.json` del repo `Ferchoner/base-shop`, en el commit fijado en `docs/API_SOURCE_OF_TRUTH.md`. Copia del OpenAPI en `openapi/v1.json`; tipos con `npm run api:types`.

## Reglas

- No inventar endpoints, campos, roles, permisos, respuestas, estados ni reglas. Lo que falte se registra en `docs/GAPS.md` como NO DOCUMENTADO, ASSUMPTION, GAP o BLOCKER.
- La autorización definitiva es de la API; el frontend solo oculta acciones según `permissions` de `GET /v1/me`.
- No duplicar server state en Pinia.
- Recursos versionados: enviar siempre la `version` leída. Transiciones de estado por su acción, nunca por PATCH.
- No reintentar mutaciones automáticamente.

## Arquitectura (DECISIONS D-P15, D-P17)

- `app/pages`: rutas finas, sin lógica.
- `app/features/<feature>`: `api.ts` (queries/mutations), `schemas.ts`, `types.ts`, `status.ts`, `components/`. Una feature no importa a otra (regla de lint).
- `app/shared`: cliente API, sesión, utilidades, navegación. Dependencias: pages → features → shared.

## Estado

Consultar `docs/PROJECT_STATE.md`, `docs/GAPS.md`, `docs/DECISIONS.md`, `docs/TRACEABILITY.md`.

## Seguridad

Sin secretos, tokens reales ni credenciales. Sin `v-html` con datos de la API.

## Calidad

`npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run test:e2e` antes de cerrar una fase.

## Git

Ramas, commits y PR en inglés con Conventional Commits, como en `base-shop`.
