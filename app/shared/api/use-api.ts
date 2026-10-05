import type { ApiClient } from './client'

/** Cliente de la API autenticado, creado en plugins/01.api.ts. */
export function useApi(): ApiClient {
  return useNuxtApp().$api
}
