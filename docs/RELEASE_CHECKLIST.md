# RELEASE_CHECKLIST

**Última actualización:** 2026-10-05. Lista para cada versión. Estado de la versión actual en RELEASE_READINESS.md.

## 1. Código y calidad

- [ ] Rama al día con `main`; PR revisado y fusionado.
- [ ] CI verde en `main` (lint, formato, typecheck, unidad, build, E2E).
- [ ] Gate local en verde: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run test:e2e`.
- [ ] axe sin violaciones (incluido en `test:e2e`).
- [ ] `npm audit` revisado; hallazgos nuevos clasificados en QA_REPORT.md.
- [ ] Sin `v-html`, secretos, tokens reales ni `console.*` con datos (lint + búsqueda).

## 2. Contrato

- [ ] Commit del backend fijado en API_SOURCE_OF_TRUTH.md igual al que corre en el ambiente.
- [ ] `openapi/v1.json` copiado de ese commit y `npm run api:types` sin cambios pendientes.
- [ ] GAPS.md al día; ningún BLOCKER abierto que afecte lo que se publica.

## 3. Prueba contra la API real

Última corrida: 2026-10-06 con `base-shop` `a46829b`, resultados en QA_REPORT.md.

- [ ] API de `base-shop` del commit fijado levantada (local, G-07) con el origen del backoffice en `CORS_ALLOWED_ORIGINS`.
- [ ] Login de staff, cambio de contraseña temporal y cierre de sesión.
- [ ] Recuperar contraseña con el enlace de Mailpit (`FRONTEND_BASE_URL` apuntando al backoffice).
- [ ] Un flujo por módulo: producto con variante e imagen publicado; precio programado; entrada de stock; pedido de prueba de la tienda cobrado en tienda (con `MANUAL_PAYMENTS_ENABLED=true`), despachado y entregado; reembolso manual; cliente suspendido y reactivado; staff creado con rol; auditoría con las acciones anteriores; reintento de una entrega de eventos fallida.
- [ ] Un usuario Operador no ve acciones de Administrador.
- [ ] Renovación de sesión con dos pestañas abiertas más de 15 minutos sin cerrar sesión.

## 4. Build del ambiente

- [ ] `NUXT_PUBLIC_API_BASE_URL` correcto para el ambiente.
- [ ] `.output/public` contiene `200.html`, `sw.js` y `manifest.webmanifest`.
- [ ] Servidor con HTTPS, fallback a `200.html`, caché y encabezados de DEPLOYMENT.md.
- [ ] CSP probada con el build (sin errores en consola al navegar todas las secciones).
- [ ] Backend del ambiente con `CORS_ALLOWED_ORIGINS`, `FRONTEND_BASE_URL` e `IMAGE_BASE_URL` correctos.

## 5. Después de publicar

- [ ] Abrir la URL, iniciar sesión y recorrer el Inicio y una sección por grupo.
- [ ] Instalar la PWA y abrirla sin conexión: aparece el login con la franja de sin conexión.
- [ ] Con una pestaña abierta en la versión anterior aparece "Hay una versión nueva" y "Actualizar" funciona.

## 6. Documentación

- [ ] CHANGELOG.md con la versión y la fecha.
- [ ] PROJECT_STATE.md, RELEASE_READINESS.md y TRACEABILITY.md actualizados.
- [ ] Tag de la versión en Git (`vX.Y.Z`) sobre el commit publicado.
