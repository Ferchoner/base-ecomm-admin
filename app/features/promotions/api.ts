import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { ApiProblem } from '~/shared/api/problem'
import type { Page, Schemas } from '~/shared/api/types'
import { useApi } from '~/shared/api/use-api'
import type {
  Promotion,
  PromotionCreateInput,
  PromotionListParams,
  PromotionPage,
  PromotionUpdateInput,
  TargetOption,
} from './types'

const BASE = '/v1/admin/promotions'

export const promotionKeys = {
  all: ['promotions'] as const,
  list: (params: PromotionListParams) => [...promotionKeys.all, 'list', params] as const,
  detail: (id: string) => [...promotionKeys.all, 'detail', id] as const,
  targets: (type: string, q: string) => [...promotionKeys.all, 'targets', type, q] as const,
}

export function usePromotions(params: MaybeRefOrGetter<PromotionListParams>) {
  const api = useApi()
  return useQuery<PromotionPage, ApiProblem>({
    queryKey: computed(() => promotionKeys.list(toValue(params))),
    queryFn: ({ signal }) => api<PromotionPage>(BASE, { query: { ...toValue(params) }, signal }),
    placeholderData: keepPreviousData,
  })
}

export function usePromotion(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useQuery<Promotion, ApiProblem>({
    queryKey: computed(() => promotionKeys.detail(toValue(id))),
    queryFn: ({ signal }) => api<Promotion>(`${BASE}/${toValue(id)}`, { signal }),
    enabled: computed(() => !!toValue(id)),
  })
}

function usePromotionMutation<V>(fn: (vars: V) => Promise<Promotion>) {
  const qc = useQueryClient()
  return useMutation<Promotion, ApiProblem, V>({
    mutationFn: fn,
    onSuccess: (p) => {
      qc.setQueryData(promotionKeys.detail(p.id), p)
      return qc.invalidateQueries({ queryKey: [...promotionKeys.all, 'list'] })
    },
  })
}

export function useCreatePromotion() {
  const api = useApi()
  return usePromotionMutation((input: PromotionCreateInput) =>
    api<Promotion>(BASE, { method: 'POST', body: { ...input } }),
  )
}

export function useUpdatePromotion(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return usePromotionMutation((input: PromotionUpdateInput) =>
    api<Promotion>(`${BASE}/${toValue(id)}`, { method: 'PATCH', body: { ...input } }),
  )
}

/** Terminar es irreversible (API_SPEC §26.6): deja de aplicar ahora o ya no empieza. */
export function useEndPromotion(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return usePromotionMutation((version: number) =>
    api<Promotion>(`${BASE}/${toValue(id)}/end`, { method: 'POST', body: { version } }),
  )
}

// ── Destinos: productos, categorías y marcas del catálogo (`catalog.read`) ──────────────────────
// La feature no importa la de catálogo (D-P17): consulta las mismas rutas con sus propias llaves.

type CategoryNode = Schemas['AdminCategoryNodeDto']

function flatten(nodes: readonly CategoryNode[], parents: string[] = []): TargetOption[] {
  return nodes.flatMap((n) => {
    const path = [...parents, n.name]
    return [
      { type: 'CATEGORY' as const, id: n.id, name: path.join(' › ') },
      ...flatten(n.children, path),
    ]
  })
}

/**
 * Productos, categorías o marcas que se pueden elegir: un producto no archivado y una categoría o
 * marca activa (API_SPEC §26.2). Las categorías salen del árbol completo y se filtran aquí.
 */
export function useTargetOptions(
  type: MaybeRefOrGetter<TargetOption['type']>,
  q: MaybeRefOrGetter<string>,
) {
  const api = useApi()
  return useQuery<TargetOption[], ApiProblem>({
    queryKey: computed(() =>
      promotionKeys.targets(toValue(type), toValue(type) === 'CATEGORY' ? '' : toValue(q)),
    ),
    queryFn: async ({ signal }) => {
      const query = toValue(q).trim() || undefined
      switch (toValue(type)) {
        case 'PRODUCT': {
          const page = await api<Page<Schemas['AdminProductDto']>>('/v1/admin/catalog/products', {
            query: { q: query, status: 'DRAFT,PUBLISHED', sort: 'title', pageSize: 20 },
            signal,
          })
          return page.data.map((p) => ({ type: 'PRODUCT' as const, id: p.id, name: p.title }))
        }
        case 'BRAND': {
          const page = await api<Page<Schemas['AdminBrandDto']>>('/v1/admin/catalog/brands', {
            query: { q: query, status: 'ACTIVE', sort: 'name', pageSize: 50 },
            signal,
          })
          return page.data.map((b) => ({ type: 'BRAND' as const, id: b.id, name: b.name }))
        }
        default: {
          const tree = await api<{ data: CategoryNode[] }>('/v1/admin/catalog/categories', {
            query: { status: 'ACTIVE' },
            signal,
          })
          return flatten(tree.data)
        }
      }
    },
    placeholderData: keepPreviousData,
  })
}
