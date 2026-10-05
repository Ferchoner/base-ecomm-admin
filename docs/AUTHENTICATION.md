# AUTHENTICATION

**Última actualización:** 2026-10-05 · Código: `app/shared/auth/`, `app/plugins/01.api.ts`, `app/middleware/auth.global.ts`. Contrato: API_SPEC §3, §9.5–9.12. Decisión: D-P03.

## Modelo de la API

- `POST /v1/auth/login` devuelve `AuthResult`: token de acceso JWT (15 min, `accessTokenExpiresIn`) y refresh token opaco (7 días).
- El refresh token **rota en cada uso**. Presentar uno ya usado revoca toda la sesión; dos renovaciones simultáneas cuentan como reutilización (§9.6).
- La API no usa cookies: el token de acceso va en `Authorization: Bearer`, el refresh en el cuerpo de `/refresh` y `/logout`.

## Dónde vive cada cosa

| Dato              | Dónde                                      | Por qué                                                                                                                                                                        |
| ----------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Token de acceso   | Memoria (store `session`)                  | Nunca se persiste; se pierde al recargar y se recupera con el refresh                                                                                                          |
| Refresh token     | `localStorage` (`backoffice.refreshToken`) | Compartido por las pestañas para que todas sigan una sola cadena de rotación (D-P03); `sessionStorage` haría que una pestaña duplicada rote la misma copia y revoque la sesión |
| Cuenta y permisos | Memoria (store `session`, de `GET /v1/me`) | Se vuelven a leer al entrar a Mi cuenta y tras un 403 `forbidden`                                                                                                              |

Si el almacenamiento está bloqueado (modo privado estricto), la sesión dura lo que la pestaña.

## Flujos

### Iniciar sesión

1. `POST /v1/auth/login` con email y contraseña (`auth: false`).
2. Se guarda el token de acceso en memoria, el refresh en `localStorage` y se programa la renovación.
3. `GET /v1/me`. Si `type !== 'STAFF'`, se cierra la sesión y se muestra "Esta cuenta no tiene acceso al backoffice".
4. Si `mustChangePassword`, el guard lleva a `/cambiar-contrasena`; si no, a `redirect` (solo rutas internas) o a `/`.

### Restaurar al abrir la app

El guard llama a `session.restore()` una vez por carga: si hay refresh token, renueva y lee `GET /v1/me`. Si la renovación responde `invalid-refresh-token`, se borra todo y se pide login. Si falla por red o error del servidor, se pide login **sin borrar** el refresh token, que puede seguir vigente (por ejemplo, al abrir la PWA sin conexión).

### Renovar

- **Proactiva:** 60 s antes de vencer el token de acceso (mínimo 5 s).
- **Reactiva:** ante un 401 de una llamada autenticada, el cliente renueva una vez y repite la solicitud.
- **De una en una:** dentro de la pestaña, todas las llamadas comparten la misma promesa de renovación; entre pestañas, la renovación corre dentro de un Web Lock (`backoffice.session-refresh`) y **lee el refresh token más reciente dentro del candado**, así nunca se presenta uno ya rotado. Sin Web Locks (navegadores antiguos) solo se serializa dentro de la pestaña.
- Si no hay refresh token al renovar (otra pestaña cerró sesión), la pestaña queda anónima.

### Cerrar sesión

`session.logout()` limpia memoria y `localStorage`, vacía la cache de TanStack Query y llama a `POST /v1/auth/logout` (si falla, la sesión local ya quedó cerrada). Las demás pestañas reciben el evento `storage` con el refresh token borrado, limpian su memoria y van a `/login`.

### Sesión vencida

Si una renovación falla con `invalid-refresh-token` o el reintento tras renovar vuelve a dar 401, el cliente llama a `onSessionExpired`: limpia la sesión local y lleva a `/login?redirect=<ruta actual>`.

### Contraseña temporal

Un staff creado o reactivado entra con contraseña temporal (`mustChangePassword`). La API solo le permite `GET /v1/me`, `POST /v1/me/password` y logout (§3.2). El guard lo lleva a `/cambiar-contrasena` (sin menú) y un 403 `password-change-required` en cualquier llamada hace lo mismo. Tras cambiarla, la sesión sigue con el mismo token y se vuelve a leer la cuenta (§9.12).

### Recuperar contraseña

1. `/recuperar-contrasena`: `POST /v1/auth/password-reset/request`. La respuesta es la misma exista o no la cuenta (§9.8).
2. La API envía un enlace `FRONTEND_BASE_URL/reset-password?token=…`. Por decisión del usuario, `FRONTEND_BASE_URL` apunta a este backoffice en el MVP (G-01, D-032).
3. `/reset-password`: `POST /v1/auth/password-reset/confirm`. Errores de política por campo; enlace vencido o inválido (`invalid-or-expired-token`) ofrece pedir otro. Al confirmar, la API revoca todas las sesiones.

La política de contraseña (longitud y reglas de API_SPEC) vive en `app/shared/auth/password-policy.ts` y se usa en los tres formularios.

## Seguridad del modelo

| Riesgo                                       | Mitigación                                                                                                                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XSS roba el refresh token de `localStorage`  | Sin `v-html` (regla de lint), Vue escapa el contenido, sin scripts de terceros, iconos y fuentes locales; CSP en el servidor (DEPLOYMENT.md). Riesgo aceptado en D-P03 |
| Renovaciones concurrentes revocan la sesión  | Single-flight en la pestaña y Web Lock entre pestañas                                                                                                                  |
| Redirección abierta con `?redirect=`         | `safeRedirect` solo acepta rutas que empiezan con una sola `/`                                                                                                         |
| Datos de otro usuario tras cambiar de cuenta | La cache se vacía al cerrar o expirar la sesión                                                                                                                        |
| Token en registros                           | El código no escribe tokens ni datos personales en consola                                                                                                             |

## Pruebas

- `tests/unit/shared/session.store.spec.ts`: login, rechazo de cliente, restauración, renovación single-flight y con el refresh más reciente, renovación proactiva, `invalid-refresh-token`, error de red al restaurar, logout aunque la API falle, cambio de contraseña.
- `tests/unit/shared/client.spec.ts`: 401 con renovación y sesión vencida.
- `tests/e2e/auth.spec.ts` y `account.spec.ts`: flujos completos en escritorio y móvil.
- Pendiente: renovación entre varias pestañas reales (solo revisión de código y unidad; QA_REPORT).
