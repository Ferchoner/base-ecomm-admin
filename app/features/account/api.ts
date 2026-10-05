import { useMutation } from '@tanstack/vue-query'
import type { ApiProblem } from '~/shared/api/problem'
import { useApi } from '~/shared/api/use-api'

/**
 * `POST /v1/auth/password-reset/request` (API_SPEC §9.8): 202 exista o no el email,
 * así que la pantalla siempre muestra el mismo mensaje.
 */
export function usePasswordResetRequest() {
  const api = useApi()
  return useMutation<undefined, ApiProblem, { email: string }>({
    mutationFn: (body) =>
      api<undefined>('/v1/auth/password-reset/request', { method: 'POST', body, auth: false }),
  })
}

/** `POST /v1/auth/password-reset/confirm` (API_SPEC §9.9): 204; revoca todas las sesiones. */
export function usePasswordResetConfirm() {
  const api = useApi()
  return useMutation<undefined, ApiProblem, { token: string; newPassword: string }>({
    mutationFn: (body) =>
      api<undefined>('/v1/auth/password-reset/confirm', { method: 'POST', body, auth: false }),
  })
}
