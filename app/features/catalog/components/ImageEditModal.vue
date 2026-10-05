<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { z } from 'zod'
import type { ApiProblem } from '~/shared/api/problem'
import { notifySuccess } from '~/shared/api/feedback'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { useUpdateImage } from '../api'
import { imageSchema } from '../schemas'
import type { ImageForm } from '../schemas'
import type { Product, ProductImage } from '../types'

const props = defineProps<{ product: Product; image: ProductImage | null }>()
const open = defineModel<boolean>('open', { required: true })

const ALL = '__product__'
const state = reactive<ImageForm>({ altText: '', variantId: null })
const variantValue = computed({
  get: () => state.variantId ?? ALL,
  set: (v: string) => (state.variantId = v === ALL ? null : v),
})
const variantOptions = computed(() => [
  { value: ALL, label: 'Todo el producto' },
  ...props.product.variants.map((v) => ({ value: v.id, label: v.sku })),
])
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const update = useUpdateImage(() => props.product.id)
const toast = useToast()

watch(open, (isOpen) => {
  if (!isOpen || !props.image) return
  state.altText = props.image.altText ?? ''
  state.variantId = props.image.variantId
  problem.value = null
})

async function onSubmit(event: FormSubmitEvent<z.output<typeof imageSchema>>) {
  if (!props.image) return
  problem.value = null
  const altText = event.data.altText.trim() === '' ? null : event.data.altText.trim()
  try {
    await update.mutateAsync({
      imageId: props.image.id,
      input: { altText, variantId: event.data.variantId },
    })
    notifySuccess(toast, 'Imagen actualizada')
    open.value = false
  } catch (error) {
    const p = error as ApiProblem
    const { fieldErrors } = problemFieldErrors(p, ['altText', 'variantId'])
    form.value?.setErrors(fieldErrors)
    if (fieldErrors.length === 0) problem.value = p
  }
}
</script>

<template>
  <UModal v-model:open="open" title="Editar imagen">
    <template #body>
      <UForm
        id="image-form"
        ref="form"
        :schema="imageSchema"
        :state="state"
        :validate-on="['input', 'change']"
        class="space-y-4"
        @submit="onSubmit"
      >
        <ProblemAlert v-if="problem" :problem="problem" />
        <img
          v-if="image"
          :src="image.url"
          :alt="image.altText ?? ''"
          class="mx-auto max-h-48 rounded-md object-contain"
        />
        <UFormField
          label="Texto alternativo"
          name="altText"
          help="Describe la imagen para lectores de pantalla."
        >
          <UInput v-model="state.altText" :maxlength="200" class="w-full" />
        </UFormField>
        <UFormField label="Muestra" name="variantId">
          <USelect v-model="variantValue" :items="variantOptions" class="w-full" />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">Cancelar</UButton>
        <UButton type="submit" form="image-form" :loading="update.isPending.value">Guardar</UButton>
      </div>
    </template>
  </UModal>
</template>
