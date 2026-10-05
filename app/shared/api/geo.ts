import { useQuery } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { ApiProblem } from './problem'
import type { Schemas } from './types'
import { useApi } from './use-api'

export type GeoState = Schemas['GeoStateDto']
export type GeoMunicipality = Schemas['GeoMunicipalityDto']

/**
 * Catálogo del INEGI (API_SPEC §10), público y casi fijo: lo usan todos los formularios de
 * dirección (`AddressInput`), por eso vive en la capa compartida.
 */
export function useGeoStates() {
  const api = useApi()
  return useQuery<GeoState[], ApiProblem>({
    queryKey: ['geo', 'states'],
    queryFn: async ({ signal }) =>
      (await api<{ data: GeoState[] }>('/v1/geo/states', { signal, auth: false })).data,
    staleTime: Infinity,
  })
}

export function useGeoMunicipalities(stateCode: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useQuery<GeoMunicipality[], ApiProblem>({
    queryKey: computed(() => ['geo', 'municipalities', toValue(stateCode)]),
    queryFn: async ({ signal }) =>
      (
        await api<{ data: GeoMunicipality[] }>(
          `/v1/geo/states/${toValue(stateCode)}/municipalities`,
          {
            signal,
            auth: false,
          },
        )
      ).data,
    enabled: computed(() => !!toValue(stateCode)),
    staleTime: Infinity,
  })
}
