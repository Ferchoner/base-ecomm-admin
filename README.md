# base-ecomm-admin

Backoffice del e-commerce [base-shop](https://github.com/Ferchoner/base-shop): SPA en Nuxt 4 + Vue 3 + TypeScript que consume la API REST `/v1`.

## Requisitos

- Node.js 22 (`.nvmrc`)
- La API de base-shop en ejecución (ver su README; por defecto en `http://localhost:3000`) con el origen del backoffice en `CORS_ALLOWED_ORIGINS` (por ejemplo, `http://localhost:3001`).
- Una cuenta de staff (el primer superadministrador se crea con el script del backend).

## Puesta en marcha

```bash
npm install
cp .env.example .env        # ajusta NUXT_PUBLIC_API_BASE_URL si la API no está en localhost:3000
npm run dev -- --port 3001
```

## Scripts

| Script                            | Uso                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `npm run dev`                     | Servidor de desarrollo                                                         |
| `npm run build`                   | Build estático en `.output/public`                                             |
| `npm run typecheck`               | `vue-tsc` en modo estricto                                                     |
| `npm run lint` / `npm run format` | ESLint / Prettier                                                              |
| `npm test`                        | Pruebas unitarias (Vitest)                                                     |
| `npm run test:e2e`                | E2E con Playwright sobre el build (requiere `npm run build`); la API se simula |
| `npm run api:types`               | Regenera los tipos desde `openapi/v1.json`                                     |

## Variables de entorno

| Variable                   | Descripción                                                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `NUXT_PUBLIC_API_BASE_URL` | Base de la API sin `/v1`. **Se fija al construir**: el build estático no lee variables en ejecución, así que hay un build por ambiente. |

## Despliegue

`npm run build` genera archivos estáticos en `.output/public`. El servidor debe devolver `200.html` (o `index.html`) para cualquier ruta desconocida (fallback SPA). Se recomienda una CSP estricta con `connect-src` limitado al origen de la API.

## Documentación

- [Estado del proyecto](docs/PROJECT_STATE.md)
- [Arquitectura](docs/ARCHITECTURE_PROPOSAL.md) y [decisiones](docs/DECISIONS.md)
- [Fuente de verdad de la API](docs/API_SOURCE_OF_TRUTH.md), [gaps](docs/GAPS.md) y [trazabilidad](docs/TRACEABILITY.md)
