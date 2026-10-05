<script setup lang="ts">
import { z } from 'zod'
import { notifyProblem } from '~/shared/api/feedback'
import type { ApiProblem } from '~/shared/api/problem'
import { problemFieldErrors } from '~/shared/utils/form-errors'

/**
 * Acción que pide un motivo (API_SPEC §9.17, §9.18). El motivo queda en la auditoría, así que no
 * debe llevar datos personales. `submit` lanza el ApiProblem si la API rechaza la acción.
 */
const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    confirmLabel: string
    color?: 'primary' | 'error' | 'warning'
    maxLength?: number
    reasonHelp?: string
    /** Texto de una casilla que el usuario debe marcar (acciones irreversibles). */
    acknowledge?: string
    hints?: Partial<Record<string, string>>
    submit: (reason: string) => Promise<void>
  }>(),
  {
    color: 'primary',
    maxLength: 500,
    description: undefined,
    reasonHelp: undefined,
    acknowledge: undefined,
    hints: () => ({}),
  },
)
const open = defineModel<boolean>('open', { required: true })

const schema = computed(() =>
  z.object({
    reason: z
      .string()
      .trim()
      .min(1, 'Escribe el motivo.')
      .max(props.maxLength, `Máximo ${props.maxLength} caracteres.`),
    acknowledged: props.acknowledge
      ? z.boolean().refine((v) => v, 'Confirma que entiendes que no se puede deshacer.')
      : z.boolean(),
  }),
)
const state = reactive({ reason: '', acknowledged: false })
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const saving = ref(false)
const toast = useToast()

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(state, { reason: '', acknowledged: false })
  problem.value = null
})

const extra = computed(() => {
  const hint = problem.value && props.hints[problem.value.type]
  return hint ? [hint] : []
})

async function onSubmit() {
  problem.value = null
  saving.value = true
  try {
    await props.submit(state.reason.trim())
    open.value = false
  } catch (e) {
    const p = e as ApiProblem
    if (p.type === 'version-conflict') {
      notifyProblem(toast, p)
      open.value = false
      return
    }
    const { fieldErrors, otherMessages } = problemFieldErrors(p, ['reason'])
    form.value?.setErrors(fieldErrors)
    if (fieldErrors.length === 0 || otherMessages.length > 0) problem.value = p
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="title" :description="description">
    <template #body>
      <UForm
        id="reason-form"
        ref="form"
        :schema="schema"
        :state="state"
        :validate-on="['input', 'change']"
        class="space-y-4"
        @submit="onSubmit"
      >
        <ProblemAlert v-if="problem" :problem="problem" :messages="extra" />
        <slot />
        <UFormField
          label="Motivo"
          name="reason"
          required
          :help="
            reasonHelp ??
            `Hasta ${maxLength} caracteres, sin datos personales. Queda en la auditoría.`
          "
        >
          <UTextarea v-model="state.reason" :maxlength="maxLength" autoresize class="w-full" />
        </UFormField>
        <UFormField v-if="acknowledge" name="acknowledged">
          <UCheckbox v-model="state.acknowledged" :label="acknowledge" />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">Volver</UButton>
        <UButton type="submit" form="reason-form" :color="color" :loading="saving">{{
          confirmLabel
        }}</UButton>
      </div>
    </template>
  </UModal>
</template>
