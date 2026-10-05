import type { LocationQuery } from 'vue-router'

export interface ListParamsOptions<K extends string> {
  /** Nombres de los filtros que se guardan en la URL. */
  filters: readonly K[]
  pageSize?: number
}

function firstString(value: LocationQuery[string] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value
  return typeof v === 'string' && v !== '' ? v : undefined
}

/**
 * Página, tamaño y filtros de un listado guardados en la URL (`?page=2&status=DRAFT`), para que
 * recargar o compartir el enlace conserve la vista (ARCHITECTURE_PROPOSAL §4).
 */
export function useListParams<K extends string>(options: ListParamsOptions<K>) {
  const route = useRoute()
  const router = useRouter()
  const defaultPageSize = options.pageSize ?? 20

  const page = computed(() => {
    const n = Number(firstString(route.query.page))
    return Number.isInteger(n) && n >= 1 ? n : 1
  })
  const pageSize = computed(() => {
    const n = Number(firstString(route.query.pageSize))
    return Number.isInteger(n) && n >= 1 && n <= 100 ? n : defaultPageSize
  })
  const filters = computed(() => {
    const out = {} as Record<K, string | undefined>
    for (const key of options.filters) out[key] = firstString(route.query[key])
    return out
  })

  function replaceQuery(next: Record<string, string | number | undefined>) {
    const query: Record<string, string> = {}
    for (const [key, value] of Object.entries({ ...route.query, ...next })) {
      if (value === undefined || value === null || value === '') continue
      query[key] = String(Array.isArray(value) ? value[0] : value)
    }
    if (query.page === '1') delete query.page
    if (query.pageSize === String(defaultPageSize)) delete query.pageSize
    return router.replace({ query })
  }

  /** Cambiar un filtro vuelve a la primera página. */
  function setFilter(key: K, value: string | null | undefined) {
    return replaceQuery({ [key]: value ?? undefined, page: undefined })
  }

  /** Varios filtros a la vez; los que no se nombran se conservan. */
  function setFilters(values: Partial<Record<K, string | null | undefined>>) {
    const next: Record<string, string | undefined> = { page: undefined }
    for (const [key, value] of Object.entries(values)) next[key] = (value as string) ?? undefined
    return replaceQuery(next)
  }

  function setPage(value: number) {
    return replaceQuery({ page: value })
  }

  function resetFilters() {
    const cleared = Object.fromEntries(options.filters.map((k) => [k, undefined]))
    return replaceQuery({ ...cleared, page: undefined })
  }

  return { page, pageSize, filters, setFilter, setFilters, setPage, resetFilters }
}
