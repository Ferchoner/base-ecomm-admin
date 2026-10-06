import { useInfiniteQuery } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { ApiProblem } from '~/shared/api/problem'
import { useApi } from '~/shared/api/use-api'
import type { AuditFilters, AuditPage } from './types'

export const auditKeys = {
  all: ['audit'] as const,
  list: (filters: AuditFilters) => [...auditKeys.all, 'list', filters] as const,
}

/**
 * Auditoría con paginación por cursor (API_SPEC §5.2), de la más reciente a la más antigua.
 */
export function useAuditLog(filters: MaybeRefOrGetter<AuditFilters>) {
  const api = useApi()
  return useInfiniteQuery<AuditPage, ApiProblem>({
    queryKey: computed(() => auditKeys.list(toValue(filters))),
    queryFn: ({ pageParam, signal }) =>
      api<AuditPage>('/v1/admin/audit', {
        query: { ...toValue(filters), limit: 50, cursor: pageParam as string | undefined },
        signal,
      }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  })
}
