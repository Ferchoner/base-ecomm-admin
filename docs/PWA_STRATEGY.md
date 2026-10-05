# PWA_STRATEGY

**Última actualización:** 2026-10-05 · Decisión: DECISIONS D-P13 (`@vite-pwa/nuxt`, online-first).

## Principio

El backoffice es **online-first**. Se puede instalar y abre su interfaz sin conexión, pero cada dato y cada operación vienen de la API en ese momento. Sin conexión no se muestra nada como vigente y no se guarda ni se encola ningún cambio: las operaciones administrativas (precios, stock, pedidos, pagos, reembolsos, staff) requieren la API actualizada.

## Qué incluye

| Capacidad            | Implementación                                                                                                                                                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instalación          | `manifest.webmanifest` generado por `@vite-pwa/nuxt`: nombre "Backoffice base-shop", `display: standalone`, `lang: es-MX`, `start_url` y `scope` en `/`, color `#4f46e5`. `installPrompt` desactivado: el navegador ofrece instalar con su propio botón.                          |
| Iconos               | `public/`: `icon.svg`, `favicon-32x32.png`, `apple-touch-icon-180x180.png`, `pwa-192x192.png`, `pwa-512x512.png` y `maskable-icon-512x512.png`, generados con `node scripts/generate-pwa-icons.mjs` a partir del glifo del sidebar.                                               |
| Service worker       | Workbox con `registerType: 'prompt'`. Precachea solo el shell (`index.html`) y los assets del build (JS, CSS, iconos, manifest). La navegación de cualquier ruta cae en el shell (`navigateFallback: '/'`).                                                                       |
| Caché de la API      | **Ninguna.** `runtimeCaching` está vacío y la API vive en otro origen (`NUXT_PUBLIC_API_BASE_URL`); el service worker no responde esas solicitudes. Se respeta el `Cache-Control` de la API.                                                                                      |
| Actualización        | Al publicar una versión nueva, el service worker la descarga y la app muestra un aviso persistente: "Hay una versión nueva del backoffice", con el botón Actualizar. Nunca se recarga sola, para no perder lo que el usuario esté editando. Se busca una versión nueva cada hora. |
| Pérdida de conexión  | Una franja fija abajo dice que no hay conexión, que lo visible puede estar desactualizado y que no se guardan cambios. Al volver la conexión desaparece y TanStack Query vuelve a consultar lo que está en pantalla.                                                              |
| Cambios sin conexión | Las mutaciones usan `networkMode: 'always'`: sin conexión fallan de inmediato con "Revisa tu conexión e inténtalo de nuevo." en lugar de quedar en pausa y enviarse solas al reconectar (QA_REPORT, hallazgo QA-01).                                                              |
| Sesión sin conexión  | El access token vive solo en memoria. Al abrir la app sin conexión no se puede renovar la sesión y se muestra el login con la franja de sin conexión; el refresh token se conserva para cuando vuelva la red.                                                                     |
| Responsive           | La misma interfaz en escritorio y móvil (sidebar plegable de Nuxt UI); todos los E2E corren en ambos tamaños.                                                                                                                                                                     |

## Qué no incluye (a propósito)

- Datos sin conexión, sincronización en segundo plano o colas de operaciones.
- Notificaciones push.
- Caché de imágenes de productos servidas por la API.

## Requisitos del despliegue

- Servir por HTTPS (o `localhost` en desarrollo); el service worker no se registra en HTTP.
- `sw.js` y `manifest.webmanifest` sin caché larga en el servidor (`Cache-Control: no-cache`), para que las versiones nuevas se detecten. Los archivos de `/_nuxt/` llevan hash y pueden cachearse por un año.
- El fallback SPA del servidor (`200.html`) sigue siendo necesario para la primera carga de una ruta profunda antes de que el service worker esté activo.

Ver DEPLOYMENT.md cuando exista (fase de release).

## Evidencia

`tests/e2e/pwa.spec.ts` (escritorio y móvil):

1. El manifest tiene nombre, idioma, `standalone`, `start_url` e iconos de 192 y 512 que responden como PNG.
2. El service worker se activa y su caché contiene el shell y ninguna URL de `/v1/`.
3. Sin conexión, abrir `/pedidos` muestra el shell (login) con la franja de sin conexión.
4. Sin conexión, guardar el método de envío muestra el error de red, y al reconectar no se envía ningún `PUT`. Esta prueba falla sin `networkMode: 'always'` (verificado).

Las demás pruebas E2E bloquean el service worker (`serviceWorkers: 'block'` en `playwright.config.ts`) para que no se interponga en la API simulada.
