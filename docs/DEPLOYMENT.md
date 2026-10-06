# DEPLOYMENT

**Última actualización:** 2026-10-05.

> **Estado:** por decisión del usuario, el MVP corre **solo en ambientes locales**, sin dominios ni hosting real (G-07, D-035). No existe ningún ambiente publicado ni infraestructura definida. Este documento describe lo que el build necesita para publicarse y cómo correrlo en local; el proveedor, los dominios y el pipeline de despliegue quedan **NO DOCUMENTADOS** hasta que se decidan.

## Qué se despliega

Una SPA estática. No hay servidor de aplicación, base de datos ni secretos.

```bash
npm ci
NUXT_PUBLIC_API_BASE_URL=<base de la API sin /v1> npm run build
# Resultado: .output/public (≈ 2.3 MB; JS ≈ 436 KB comprimido con gzip en 124 archivos)
```

| Archivo o carpeta                  | Qué es                                               |
| ---------------------------------- | ---------------------------------------------------- |
| `index.html` y `<ruta>/index.html` | Shell por cada ruta estática                         |
| `200.html`                         | Fallback SPA para rutas dinámicas (`/pedidos/<id>`…) |
| `404.html`                         | Página de no encontrado                              |
| `_nuxt/`                           | JS y CSS con hash en el nombre                       |
| `sw.js`, `workbox-*.js`            | Service worker de la PWA                             |
| `manifest.webmanifest`, iconos     | Instalación de la PWA                                |

## Configuración por ambiente

| Variable                             | Cuándo se lee            | Valor                                                                                                              |
| ------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `NUXT_PUBLIC_API_BASE_URL`           | **Al construir** (D-019) | Base de la API sin `/v1` ni barra final. Local: `http://localhost:3000`                                            |
| `NUXT_PUBLIC_PRIVACY_NOTICE_VERSION` | **Al construir**         | Versión vigente del aviso de privacidad, la misma de la tienda (G-19). Vacía, Vender en tienda no acepta invitados |

Como el build es estático, **cada ambiente necesita su propio build**. No hay secretos.

Del lado del backend, en cada ambiente:

| Variable del backend   | Valor                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `CORS_ALLOWED_ORIGINS` | Debe incluir el origen exacto del backoffice (esquema, host y puerto)                                    |
| `FRONTEND_BASE_URL`    | El origen del backoffice, para que los enlaces de recuperación lleguen a `/reset-password` (G-01, D-032) |
| `IMAGE_BASE_URL`       | Origen de las imágenes; debe permitirse en `img-src` de la CSP                                           |

## Ejecución local (el único ambiente del MVP)

| Modo           | Comando                                     | URL                     |
| -------------- | ------------------------------------------- | ----------------------- |
| Desarrollo     | `npm run dev -- --port 3001`                | `http://localhost:3001` |
| Build local    | `npm run build && npm run preview`          | la que indique Nuxt     |
| Build como E2E | `npm run build && node tests/e2e/serve.mjs` | `http://localhost:4173` |

`localhost` cuenta como origen seguro: el service worker funciona sin HTTPS. Recuerda poner el origen elegido en `CORS_ALLOWED_ORIGINS` del backend (DEVELOPER_ONBOARDING.md).

## Requisitos para un servidor real (cuando se decida)

Cualquier servidor de archivos estáticos sirve. Lo que debe cumplir:

1. **HTTPS** obligatorio.
2. **Fallback SPA:** una ruta que no existe como archivo devuelve `200.html` con estado 200.
3. **Caché:**
   - `/_nuxt/*`: `Cache-Control: public, max-age=31536000, immutable`.
   - `index.html`, `200.html`, `sw.js`, `manifest.webmanifest`: `Cache-Control: no-cache`, para que una versión nueva se detecte (PWA_STRATEGY.md).
4. **Tipos MIME:** `.webmanifest` como `application/manifest+json`, `.js` como `text/javascript`.
5. **Encabezados de seguridad y CSP:** los de FRONTEND_SECURITY.md, con el origen real de la API y de las imágenes. Probar la CSP con el build antes de activarla.
6. **Sin indexación:** el HTML ya trae `noindex, nofollow`; opcionalmente `X-Robots-Tag: noindex`.

## Publicar una versión

1. Gate completo en verde (RELEASE_CHECKLIST.md) y CI verde en `main`.
2. Build con la `NUXT_PUBLIC_API_BASE_URL` del ambiente.
3. Subir `.output/public` completo y reemplazar el anterior (los archivos de `_nuxt/` llevan hash; los viejos pueden quedarse un tiempo para pestañas abiertas).
4. Los usuarios con la app abierta ven "Hay una versión nueva del backoffice" y actualizan cuando quieren; no se recarga sola.

## Revertir

Volver a publicar el `.output/public` de la versión anterior (o reconstruir desde su tag). El service worker detecta el cambio igual que una versión nueva.

## NO DOCUMENTADO (pendiente de decisión)

- Proveedor de hosting, dominios y certificados de staging y producción.
- Pipeline de despliegue (CI solo valida; no publica).
- URLs de la API por ambiente.
- Monitoreo de errores del frontend.
