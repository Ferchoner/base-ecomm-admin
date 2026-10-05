import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { ApiProblem } from '~/shared/api/problem'
import { useApi } from '~/shared/api/use-api'
import type {
  Brand,
  BrandInput,
  BrandListParams,
  BrandPage,
  Category,
  CategoryInput,
  CategoryNode,
  ImageUpdateInput,
  Product,
  ProductCreateInput,
  ProductImage,
  ProductListParams,
  ProductPage,
  ProductUpdateInput,
  VariantCreateInput,
  VariantUpdateInput,
} from './types'

const BASE = '/v1/admin/catalog'

export const catalogKeys = {
  all: ['catalog'] as const,
  brands: () => [...catalogKeys.all, 'brands'] as const,
  brandList: (params: BrandListParams) => [...catalogKeys.brands(), params] as const,
  categories: () => [...catalogKeys.all, 'categories'] as const,
  categoryTree: (status?: string) => [...catalogKeys.categories(), status ?? 'all'] as const,
  products: () => [...catalogKeys.all, 'products'] as const,
  productList: (params: ProductListParams) => [...catalogKeys.products(), 'list', params] as const,
  product: (id: string) => [...catalogKeys.products(), 'detail', id] as const,
}

// ── Marcas ─────────────────────────────────────────────────────────────────────

export function useBrands(params: MaybeRefOrGetter<BrandListParams>) {
  const api = useApi()
  return useQuery<BrandPage, ApiProblem>({
    queryKey: computed(() => catalogKeys.brandList(toValue(params))),
    queryFn: ({ signal }) =>
      api<BrandPage>(`${BASE}/brands`, { query: { ...toValue(params) }, signal }),
    placeholderData: keepPreviousData,
  })
}

/** Marcas por cambio que invalidan los listados (también los selectores del producto). */
function useBrandMutation<V>(fn: (vars: V) => Promise<Brand | undefined>) {
  const qc = useQueryClient()
  return useMutation<Brand | undefined, ApiProblem, V>({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogKeys.brands() }),
  })
}

export function useSaveBrand() {
  const api = useApi()
  return useBrandMutation(({ id, input }: { id?: string; input: Partial<BrandInput> }) =>
    id
      ? api<Brand>(`${BASE}/brands/${id}`, { method: 'PATCH', body: input })
      : api<Brand>(`${BASE}/brands`, { method: 'POST', body: input }),
  )
}

export function useBrandAction() {
  const api = useApi()
  return useBrandMutation(
    ({ id, action }: { id: string; action: 'deactivate' | 'reactivate' | 'delete' }) =>
      action === 'delete'
        ? api<undefined>(`${BASE}/brands/${id}`, { method: 'DELETE' })
        : api<Brand>(`${BASE}/brands/${id}/${action}`, { method: 'POST' }),
  )
}

// ── Categorías ─────────────────────────────────────────────────────────────────

export function useCategoryTree(status?: MaybeRefOrGetter<string | undefined>) {
  const api = useApi()
  return useQuery<CategoryNode[], ApiProblem>({
    queryKey: computed(() => catalogKeys.categoryTree(toValue(status))),
    queryFn: async ({ signal }) =>
      (
        await api<{ data: CategoryNode[] }>(`${BASE}/categories`, {
          query: { status: toValue(status) },
          signal,
        })
      ).data,
  })
}

function useCategoryMutation<V>(fn: (vars: V) => Promise<Category | undefined>) {
  const qc = useQueryClient()
  return useMutation<Category | undefined, ApiProblem, V>({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogKeys.categories() }),
  })
}

export function useSaveCategory() {
  const api = useApi()
  return useCategoryMutation(({ id, input }: { id?: string; input: Partial<CategoryInput> }) =>
    id
      ? api<Category>(`${BASE}/categories/${id}`, { method: 'PATCH', body: input })
      : api<Category>(`${BASE}/categories`, { method: 'POST', body: input }),
  )
}

export function useCategoryAction() {
  const api = useApi()
  return useCategoryMutation(
    ({ id, action }: { id: string; action: 'deactivate' | 'reactivate' | 'delete' }) =>
      action === 'delete'
        ? api<undefined>(`${BASE}/categories/${id}`, { method: 'DELETE' })
        : api<Category>(`${BASE}/categories/${id}/${action}`, { method: 'POST' }),
  )
}

// ── Productos ──────────────────────────────────────────────────────────────────

export function useProducts(params: MaybeRefOrGetter<ProductListParams>) {
  const api = useApi()
  return useQuery<ProductPage, ApiProblem>({
    queryKey: computed(() => catalogKeys.productList(toValue(params))),
    queryFn: ({ signal }) =>
      api<ProductPage>(`${BASE}/products`, { query: { ...toValue(params) }, signal }),
    placeholderData: keepPreviousData,
  })
}

export function useProduct(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useQuery<Product, ApiProblem>({
    queryKey: computed(() => catalogKeys.product(toValue(id))),
    queryFn: ({ signal }) => api<Product>(`${BASE}/products/${toValue(id)}`, { signal }),
  })
}

export function useCreateProduct() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<Product, ApiProblem, ProductCreateInput>({
    mutationFn: (input) => api<Product>(`${BASE}/products`, { method: 'POST', body: { ...input } }),
    onSuccess: (product) => {
      qc.setQueryData(catalogKeys.product(product.id), product)
      return qc.invalidateQueries({ queryKey: [...catalogKeys.products(), 'list'] })
    },
  })
}

/**
 * Cambios sobre un producto que responden el `AdminProduct` actualizado (datos, estado y variantes):
 * la respuesta reemplaza el detalle en cache y los listados se vuelven a pedir. Ante un 409
 * `version-conflict` se recarga el detalle para que el usuario vea la versión actual.
 */
function useProductMutation<V>(
  productId: MaybeRefOrGetter<string>,
  fn: (id: string, vars: V) => Promise<Product>,
) {
  const qc = useQueryClient()
  return useMutation<Product, ApiProblem, V>({
    mutationFn: (vars) => fn(toValue(productId), vars),
    onSuccess: (product) => {
      qc.setQueryData(catalogKeys.product(product.id), product)
      return qc.invalidateQueries({ queryKey: [...catalogKeys.products(), 'list'] })
    },
    onError: (error) => {
      if (error.type === 'version-conflict' || error.type === 'invalid-state-transition')
        return qc.invalidateQueries({ queryKey: catalogKeys.product(toValue(productId)) })
    },
  })
}

export function useUpdateProduct(productId: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useProductMutation(productId, (id, input: ProductUpdateInput) =>
    api<Product>(`${BASE}/products/${id}`, { method: 'PATCH', body: { ...input } }),
  )
}

export type ProductAction = 'publish' | 'archive' | 'reactivate'

export function useProductAction(productId: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useProductMutation(
    productId,
    (id, { action, version }: { action: ProductAction; version: number }) =>
      api<Product>(`${BASE}/products/${id}/${action}`, { method: 'POST', body: { version } }),
  )
}

export function useSaveVariant(productId: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useProductMutation(
    productId,
    (id, vars: { variantId?: string; input: VariantCreateInput | VariantUpdateInput }) =>
      vars.variantId
        ? api<Product>(`${BASE}/products/${id}/variants/${vars.variantId}`, {
            method: 'PATCH',
            body: { ...vars.input },
          })
        : api<Product>(`${BASE}/products/${id}/variants`, {
            method: 'POST',
            body: { ...vars.input },
          }),
  )
}

export function useVariantAction(productId: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useProductMutation(
    productId,
    (id, vars: { variantId: string; action: 'discontinue' | 'reactivate'; version: number }) =>
      api<Product>(`${BASE}/products/${id}/variants/${vars.variantId}/${vars.action}`, {
        method: 'POST',
        body: { version: vars.version },
      }),
  )
}

// ── Imágenes (sin `version`, API_SPEC §11.8) ───────────────────────────────────

/** Las imágenes no responden el producto: tras cada cambio se vuelve a pedir el detalle. */
function useImageMutation<R, V>(
  productId: MaybeRefOrGetter<string>,
  fn: (id: string, vars: V) => Promise<R>,
) {
  const qc = useQueryClient()
  return useMutation<R, ApiProblem, V>({
    mutationFn: (vars) => fn(toValue(productId), vars),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: catalogKeys.product(toValue(productId)) }),
        qc.invalidateQueries({ queryKey: [...catalogKeys.products(), 'list'] }),
      ]),
  })
}

export function useUploadImage(productId: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useImageMutation(
    productId,
    (id, vars: { file: File; altText?: string; variantId?: string | null }) => {
      const form = new FormData()
      form.append('file', vars.file)
      if (vars.altText) form.append('altText', vars.altText)
      if (vars.variantId) form.append('variantId', vars.variantId)
      return api<ProductImage>(`${BASE}/products/${id}/images`, { method: 'POST', body: form })
    },
  )
}

export function useUpdateImage(productId: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useImageMutation(productId, (id, vars: { imageId: string; input: ImageUpdateInput }) =>
    api<ProductImage>(`${BASE}/products/${id}/images/${vars.imageId}`, {
      method: 'PATCH',
      body: { ...vars.input },
    }),
  )
}

export function useReorderImages(productId: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useImageMutation(productId, (id, imageIds: string[]) =>
    api<{ data: ProductImage[] }>(`${BASE}/products/${id}/images/order`, {
      method: 'PUT',
      body: { imageIds },
    }),
  )
}

export function useDeleteImage(productId: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useImageMutation(productId, (id, imageId: string) =>
    api<undefined>(`${BASE}/products/${id}/images/${imageId}`, { method: 'DELETE' }),
  )
}
