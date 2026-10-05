<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { z } from 'zod'
import type { ApiProblem } from '~/shared/api/problem'
import { notifySuccess } from '~/shared/api/feedback'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { useSaveCategory } from '../api'
import { categorySchema } from '../schemas'
import type { CategoryForm } from '../schemas'
import { descendantIds, flattenTree } from '../tree'
import type { CategoryNode } from '../types'

const props = defineProps<{
  /** Categoría a editar; sin ella se crea una nueva. */
  category?: CategoryNode | null
  /** Padre propuesto al crear una subcategoría. */
  parentId?: string | null
  tree: CategoryNode[]
}>()
const open = defineModel<boolean>('open', { required: true })

const ROOT = '__root__'
const state = reactive<CategoryForm>({ name: '', slug: '', parentId: null, position: 0 })
const parentValue = computed({
  get: () => state.parentId ?? ROOT,
  set: (v: string) => (state.parentId = v === ROOT ? null : v),
})
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const otherMessages = ref<string[]>([])
const save = useSaveCategory()
const toast = useToast()

// Padres posibles: activos (la API rechaza uno inactivo) y, al mover, ni ella ni sus descendientes.
const parentOptions = computed(() => {
  const excluded = props.category ? descendantIds(props.category) : new Set<string>()
  const options = flattenTree(props.tree)
    .filter(({ node }) => !excluded.has(node.id))
    .filter(({ node }) => node.status === 'ACTIVE' || node.id === props.category?.parentId)
    .map(({ node, path }) => ({ value: node.id, label: path.join(' › ') }))
  return [{ value: ROOT, label: 'Sin padre (raíz)' }, ...options]
})

watch(open, (isOpen) => {
  if (!isOpen) return
  state.name = props.category?.name ?? ''
  state.slug = props.category?.slug ?? ''
  state.parentId = props.category ? props.category.parentId : (props.parentId ?? null)
  state.position = props.category?.position ?? 0
  problem.value = null
  otherMessages.value = []
  save.reset()
})

async function onSubmit(event: FormSubmitEvent<z.output<typeof categorySchema>>) {
  problem.value = null
  const { name, slug, parentId, position } = event.data
  const c = props.category
  const input = c
    ? {
        ...(name !== c.name && { name }),
        ...(slug && slug !== c.slug && { slug }),
        ...(parentId !== c.parentId && { parentId }),
        ...(position !== c.position && { position }),
      }
    : { name, ...(slug && { slug }), parentId, position }
  try {
    await save.mutateAsync({ id: c?.id, input })
    notifySuccess(toast, c ? 'Categoría actualizada' : 'Categoría creada')
    open.value = false
  } catch (error) {
    const p = error as ApiProblem
    const { fieldErrors, otherMessages: rest } = problemFieldErrors(p, [
      'name',
      'slug',
      'parentId',
      'position',
    ])
    form.value?.setErrors(fieldErrors)
    otherMessages.value = rest
    if (fieldErrors.length === 0 || rest.length > 0) problem.value = p
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="category ? 'Editar categoría' : 'Nueva categoría'">
    <template #body>
      <UForm
        id="category-form"
        ref="form"
        :schema="categorySchema"
        :state="state"
        :validate-on="['input', 'change']"
        class="space-y-4"
        @submit="onSubmit"
      >
        <ProblemAlert v-if="problem" :problem="problem" :messages="otherMessages" />
        <UFormField label="Nombre" name="name" required>
          <UInput v-model="state.name" class="w-full" autofocus />
        </UFormField>
        <UFormField
          label="Slug"
          name="slug"
          :help="
            category
              ? 'Al cambiarlo, el enlace anterior de la tienda deja de funcionar.'
              : 'Opcional: si lo dejas vacío se genera del nombre.'
          "
        >
          <UInput v-model="state.slug" class="w-full" />
        </UFormField>
        <UFormField label="Categoría padre" name="parentId">
          <USelectMenu
            v-model="parentValue"
            :items="parentOptions"
            value-key="value"
            label-key="label"
            class="w-full"
            :search-input="{ placeholder: 'Buscar categoría' }"
          />
        </UFormField>
        <UFormField
          label="Posición"
          name="position"
          help="Orden entre sus hermanas; los empates van por nombre."
        >
          <UInputNumber v-model="state.position" :min="0" :max="10000" class="w-full" />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">Cancelar</UButton>
        <UButton type="submit" form="category-form" :loading="save.isPending.value"
          >Guardar</UButton
        >
      </div>
    </template>
  </UModal>
</template>
