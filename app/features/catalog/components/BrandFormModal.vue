<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { z } from 'zod'
import type { ApiProblem } from '~/shared/api/problem'
import { notifySuccess } from '~/shared/api/feedback'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { useSaveBrand } from '../api'
import { brandSchema } from '../schemas'
import type { BrandForm } from '../schemas'
import type { Brand } from '../types'

const props = defineProps<{ brand?: Brand | null }>()
const open = defineModel<boolean>('open', { required: true })

const state = reactive<BrandForm>({ name: '', slug: '' })
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const otherMessages = ref<string[]>([])
const save = useSaveBrand()
const toast = useToast()

watch(open, (isOpen) => {
  if (!isOpen) return
  state.name = props.brand?.name ?? ''
  state.slug = props.brand?.slug ?? ''
  problem.value = null
  otherMessages.value = []
  save.reset()
})

async function onSubmit(event: FormSubmitEvent<z.output<typeof brandSchema>>) {
  problem.value = null
  const { name, slug } = event.data
  // En edición se envía solo lo que cambió; un slug vacío al crear lo genera la API.
  const input = props.brand
    ? {
        ...(name !== props.brand.name && { name }),
        ...(slug && slug !== props.brand.slug && { slug }),
      }
    : { name, ...(slug && { slug }) }
  try {
    await save.mutateAsync({ id: props.brand?.id, input })
    notifySuccess(toast, props.brand ? 'Marca actualizada' : 'Marca creada')
    open.value = false
  } catch (error) {
    const p = error as ApiProblem
    const { fieldErrors, otherMessages: rest } = problemFieldErrors(p, ['name', 'slug'])
    form.value?.setErrors(fieldErrors)
    otherMessages.value = rest
    if (fieldErrors.length === 0 || rest.length > 0) problem.value = p
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="brand ? 'Editar marca' : 'Nueva marca'">
    <template #body>
      <UForm
        id="brand-form"
        ref="form"
        :schema="brandSchema"
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
            brand
              ? 'Al cambiarlo, el enlace anterior de la tienda deja de funcionar.'
              : 'Opcional: si lo dejas vacío se genera del nombre.'
          "
        >
          <UInput v-model="state.slug" class="w-full" />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">Cancelar</UButton>
        <UButton type="submit" form="brand-form" :loading="save.isPending.value">Guardar</UButton>
      </div>
    </template>
  </UModal>
</template>
