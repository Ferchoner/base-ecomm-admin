# API_CLIENT_ARCHITECTURE

**Última actualización:** 2026-10-05 · Código: `app/shared/api/`, `app/plugins/01.api.ts`, `app/plugins/02.vue-query.ts`.

## Piezas

```
componente / página
   │ useXxx() / useXxxMutation()            features/<x>/api.ts (TanStack Query)
   ▼
useApi()  ── ApiClient                       shared/api/use-api.ts → nuxtApp.$api
   │
   ▼
createApiClient(deps)                        shared/api/client.ts (ofetch)
   ├─ getAccessToken()   ← session.accessToken (memoria)
   ├─ refreshSession()   ← session.refresh() (single-flight + Web Lock)
   └─ onSessionExpired() ← session.clearLocal() + /login?redirect=
   │
   ▼  errores → toApiProblem() → ApiProblem  shared/api/problem.ts
API /v1
```

## Cliente HTTP (`createApiClient`)

| Aspecto        | Comportamiento                                                                                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base           | `runtimeConfig.public.apiBaseUrl` (`NUXT_PUBLIC_API_BASE_URL`, sin `/v1`, fijado al construir)                                                                                                |
| Encabezados    | `Accept: application/json`; `Authorization: Bearer <token>` si `auth !== false`; `Idempotency-Key` si se pasa                                                                                 |
| Timeout        | 30 s; al vencer, `ApiProblem` de tipo local `timeout`                                                                                                                                         |
| Reintentos     | Ninguno en el cliente (`retry: 0`); las lecturas las reintenta TanStack Query                                                                                                                 |
| Query string   | `toQuery`: omite `undefined`, `null` y `''`; listas unidas por coma (API_SPEC §5.3)                                                                                                           |
| Cuerpo         | Objeto JSON o `FormData` (imágenes, CSV)                                                                                                                                                      |
| Cancelación    | `signal` de TanStack Query: al cambiar filtros o salir de la pantalla se aborta la consulta                                                                                                   |
| 401            | Si la llamada lleva token: renueva una vez y repite la solicitud (seguro: un 401 se responde antes de procesar). Si no se puede renovar o el reintento vuelve a dar 401: `onSessionExpired()` |
| Rutas públicas | `auth: false` (login, refresh, recuperación, geografía): sin token y sin renovar                                                                                                              |

Las operaciones de autenticación pasan por `AuthGateway` (`shared/auth/auth-gateway.ts`), que lleva el token de forma explícita con `auth: false` para que la renovación nunca se llame a sí misma.

## Errores (`ApiProblem`)

Toda falla llega como `ApiProblem`:

| Campo             | Origen                                                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`            | Último segmento del `type` de Problem Details (`/problems/version-conflict` → `version-conflict`); `internal-error` en 5xx sin cuerpo; `network-error` o `timeout` locales |
| `status`          | HTTP; `0` sin respuesta                                                                                                                                                    |
| `title`, `detail` | Del cuerpo; textos genéricos en español si faltan                                                                                                                          |
| `correlationId`   | Del cuerpo o del encabezado `X-Correlation-Id`                                                                                                                             |
| `errors[]`        | `FieldError` válidos de `errors`                                                                                                                                           |
| `extensions`      | El resto del cuerpo (`currentVersion`, `lines`, `fields`, `field`, `limit`, `maxBytes`…)                                                                                   |
| `retryAfter`      | Encabezado `Retry-After` en segundos                                                                                                                                       |

La interfaz decide siempre por `type`, nunca por el texto.

## TanStack Query (`02.vue-query.ts`)

| Opción                         | Valor                                        | Motivo                                                            |
| ------------------------------ | -------------------------------------------- | ----------------------------------------------------------------- |
| `queries.staleTime`            | 30 s                                         | Evita repetir lecturas al navegar                                 |
| `queries.retry`                | 1 vez, solo `network-error`, `timeout` o 5xx | Un 4xx no cambia al repetir                                       |
| `queries.refetchOnWindowFocus` | `true`                                       | Datos al día al volver a la pestaña                               |
| `mutations.retry`              | `false`                                      | No reintentar mutaciones (CLAUDE.md)                              |
| `mutations.networkMode`        | `'always'`                                   | Sin conexión fallan de inmediato y no se envían al volver (D-057) |

Reacciones globales (`QueryCache` y `MutationCache`):

- `password-change-required` → recarga la cuenta y lleva a `/cambiar-contrasena`.
- `forbidden` → recarga `GET /v1/me` (los roles pudieron cambiar).
- Al cerrar sesión, expirar o cerrarse en otra pestaña → `queryClient.clear()`.

## Patrón de una feature (`api.ts`)

```ts
const BASE = '/v1/admin/payments'

export const paymentKeys = {
  all: [QUERY_ROOT.payments] as const,
  list: (params: ListParams) => [...paymentKeys.all, 'list', params] as const,
  detail: (id: string) => [...paymentKeys.all, 'detail', id] as const,
}

export function usePayment(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => paymentKeys.detail(toValue(id))),
    queryFn: ({ signal }) => api<AdminPayment>(`${BASE}/${toValue(id)}`, { signal }),
  })
}
```

Mutaciones: `useMutation` con el cuerpo armado campo por campo desde los tipos generados; en `onSuccess`, `setQueryData` del recurso devuelto e `invalidateRoots` de lo afectado (FRONTEND_ARCHITECTURE.md). Los errores se muestran con `notifyProblem` (toast; con referencia de soporte en 5xx) o por campo con `problemFieldErrors`.

## Mensajes por tipo de error

| Caso                                            | Presentación                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| `validation-error`, `password-policy-violation` | Mensajes en sus campos; los que no tienen campo, en la alerta o el toast |
| `duplicate-value`, `field-locked`               | En el campo indicado por `field` / `fields`                              |
| `version-conflict`                              | Toast "Otro usuario modificó este registro", recarga del recurso         |
| `manual-payments-disabled`                      | Explica que un superadministrador debe activarlo (G-02)                  |
| Otros 4xx de negocio                            | `title` y `detail` de la API                                             |
| 429                                             | Espera de `Retry-After`                                                  |
| 5xx                                             | Error genérico con referencia (`correlationId`)                          |
| Red o timeout                                   | "Revisa tu conexión e inténtalo de nuevo."                               |

## Pruebas

`tests/unit/shared/client.spec.ts` (MSW, entorno Node: D-021) cubre Bearer, renovación ante 401, sesión expirada, `Idempotency-Key`, Problem Details, red y filtros. `problem.spec.ts` cubre la normalización y `notifyProblem`.
