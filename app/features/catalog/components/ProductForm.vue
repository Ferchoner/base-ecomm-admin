<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { z } from 'zod'
import type { ApiProblem } from '~/shared/api/problem'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import { useDebounced } from '~/shared/utils/debounce'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { useBrands, useCategoryTree, useCreateProduct, useUpdateProduct } from '../api'
import { productSchema } from '../schemas'
import type { ProductForm } from '../schemas'
import { flattenTree } from '../tree'
import type { Product } from '../types'

/** Alta (sin `product`) o edición de los datos generales de un producto (API_SPEC §11.6). */
const props = defineProps<{ product?: Product; disabled?: boolean }>()
const emit = defineEmits<{ saved: [product: Product] }>()

const NO_BRAND = '__none__'
const FIELDS = ['title', 'slug', 'description', 'brandId', 'categoryIds'] as const

function initialState(p?: Product): ProductForm {
  return {
    title: p?.title ?? '',
    slug: p?.slug ?? '',
    description: p?.description ?? '',
    brandId: p?.brand?.id ?? null,
    categoryIds: p?.categories.map((c) => c.id) ?? [],
  }
}

const state = reactive<ProductForm>(initialState(props.product))
// Al recargar el producto (otra pestaña, conflicto de versión) el formulario muestra lo actual.
watch(
  () => props.product,
  (p) => Object.assign(state, initialState(p)),
)

const slugLocked = computed(() => !!props.product?.firstPublishedAt)
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const otherMessages = ref<string[]>([])
const toast = useToast()

// Marcas: búsqueda en la API, solo activas (una nueva debe estar activa); la actual se conserva.
const brandSearch = ref('')
const brandQuery = useDebounced(brandSearch)
const { data: brands, isFetching: brandsLoading } = useBrands(() => ({
  page: 1,
  pageSize: 50,
  status: 'ACTIVE',
  sort: 'name',
  q: brandQuery.value.trim() || undefined,
}))
const brandOptions = computed(() => {
  const options = (brands.value?.data ?? []).map((b) => ({ value: b.id, label: b.name }))
  const current = props.product?.brand
  if (current && !options.some((o) => o.value === current.id))
    options.unshift({ value: current.id, label: current.name })
  return [{ value: NO_BRAND, label: 'Sin marca' }, ...options]
})
const brandValue = computed({
  get: () => state.brandId ?? NO_BRAND,
  set: (v: string) => (state.brandId = v === NO_BRAND ? null : v),
})

// Categorías: activas, más las que el producto ya tenía aunque se hayan desactivado.
const { data: tree } = useCategoryTree()
const categoryOptions = computed(() => {
  const assigned = new Set(props.product?.categories.map((c) => c.id))
  return flattenTree(tree.value ?? [])
    .filter(({ node }) => node.status === 'ACTIVE' || assigned.has(node.id))
    .map(({ node, path }) => ({
      value: node.id,
      label: path.join(' › ') + (node.status === 'ACTIVE' ? '' : ' (inactiva)'),
    }))
})

const create = useCreateProduct()
const update = useUpdateProduct(() => props.product?.id ?? '')
const saving = computed(() => create.isPending.value || update.isPending.value)

function changes(data: z.output<typeof productSchema>, p: Product) {
  const sameCategories =
    data.categoryIds.length === p.categories.length &&
    data.categoryIds.every((id) => p.categories.some((c) => c.id === id))
  const description = data.description.trim() === '' ? null : data.description
  return {
    ...(data.title !== p.title && { title: data.title }),
    ...(!slugLocked.value && data.slug && data.slug !== p.slug && { slug: data.slug }),
    ...(description !== (p.description ?? null) && { description }),
    ...(data.brandId !== (p.brand?.id ?? null) && { brandId: data.brandId }),
    ...(!sameCategories && { categoryIds: data.categoryIds }),
  }
}

async function onSubmit(event: FormSubmitEvent<z.output<typeof productSchema>>) {
  problem.value = null
  otherMessages.value = []
  const data = event.data
  try {
    let saved: Product
    if (props.product) {
      const diff = changes(data, props.product)
      if (Object.keys(diff).length === 0) {
        toast.add({ title: 'No hay cambios que guardar', color: 'neutral', icon: 'i-lucide-info' })
        return
      }
      // Siempre la versión leída: un 409 indica que otro usuario guardó antes (API_SPEC §2.3).
      saved = await update.mutateAsync({ ...diff, version: props.product.version })
      notifySuccess(toast, 'Producto actualizado')
    } else {
      saved = await create.mutateAsync({
        title: data.title,
        ...(data.slug && { slug: data.slug }),
        ...(data.description.trim() && { description: data.description }),
        ...(data.brandId && { brandId: data.brandId }),
        categoryIds: data.categoryIds,
      })
      notifySuccess(
        toast,
        'Producto creado como borrador',
        'Agrega al menos una variante activa para publicarlo.',
      )
    }
    emit('saved', saved)
  } catch (error) {
    const p = error as ApiProblem
    if (p.type === 'version-conflict') return notifyProblem(toast, p)
    const { fieldErrors, otherMessages: rest } = problemFieldErrors(p, FIELDS)
    form.value?.setErrors(fieldErrors)
    otherMessages.value = rest
    if (fieldErrors.length === 0 || rest.length > 0) problem.value = p
  }
}
</script>

<template>
  <UForm
    ref="form"
    :schema="productSchema"
    :state="state"
    :disabled="disabled"
    class="max-w-3xl space-y-4"
    @submit="onSubmit"
  >
    <ProblemAlert v-if="problem" :problem="problem" :messages="otherMessages" />

    <UFormField label="Título" name="title" required>
      <UInput v-model="state.title" class="w-full" :autofocus="!product" />
    </UFormField>

    <UFormField
      label="Slug"
      name="slug"
      :help="
        slugLocked
          ? 'Fijo desde la primera publicación.'
          : product
            ? 'Se puede cambiar hasta la primera publicación.'
            : 'Opcional: si lo dejas vacío se genera del título.'
      "
    >
      <UInput v-model="state.slug" class="w-full" :disabled="disabled || slugLocked" />
    </UFormField>

    <UFormField label="Descripción" name="description">
      <UTextarea v-model="state.description" :rows="5" autoresize :maxrows="16" class="w-full" />
    </UFormField>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField label="Marca" name="brandId">
        <USelectMenu
          v-model="brandValue"
          v-model:search-term="brandSearch"
          :items="brandOptions"
          value-key="value"
          label-key="label"
          ignore-filter
          :loading="brandsLoading"
          :search-input="{ placeholder: 'Buscar marca' }"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Categorías" name="categoryIds" help="Hasta 10.">
        <USelectMenu
          v-model="state.categoryIds"
          :items="categoryOptions"
          value-key="value"
          label-key="label"
          multiple
          placeholder="Sin categorías"
          :search-input="{ placeholder: 'Buscar categoría' }"
          class="w-full"
        />
      </UFormField>
    </div>

    <div class="flex gap-2">
      <UButton v-if="!disabled" type="submit" :loading="saving">
        {{ product ? 'Guardar cambios' : 'Crear producto' }}
      </UButton>
      <slot name="actions" />
    </div>
  </UForm>
</template>
