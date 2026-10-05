<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ApiProblem } from '~/shared/api/problem'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { useCreateStaff } from '../api'
import { staffSchema } from '../schemas'
import type { StaffForm } from '../schemas'
import type { StaffWithPassword } from '../types'
import { useRoleGrant } from '../use-role-grant'

/** Alta de staff (API_SPEC §9.17). La contraseña temporal la muestra quien la recibe en `created`. */
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ created: [StaffWithPassword] }>()

const state = reactive<StaffForm>({ email: '', firstNames: '', lastNames: '', roleIds: [] })
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const create = useCreateStaff()
const { options } = useRoleGrant()

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(state, { email: '', firstNames: '', lastNames: '', roleIds: [] })
  problem.value = null
})

const hints = computed(() =>
  problem.value?.type === 'forbidden' ? ['Solo puedes dar roles cuyos permisos tienes tú.'] : [],
)

async function onSubmit(event: FormSubmitEvent<StaffForm>) {
  problem.value = null
  try {
    const result = await create.mutateAsync(event.data)
    open.value = false
    emit('created', result)
  } catch (e) {
    const p = e as ApiProblem
    const { fieldErrors, otherMessages } = problemFieldErrors(p, [
      'email',
      'firstNames',
      'lastNames',
      'roleIds',
    ])
    form.value?.setErrors(fieldErrors)
    if (fieldErrors.length === 0 || otherMessages.length > 0) problem.value = p
  }
}
</script>

<template>
  <UModal v-model:open="open" title="Nuevo staff">
    <template #body>
      <UForm
        id="staff-form"
        ref="form"
        :schema="staffSchema"
        :state="state"
        :validate-on="['input', 'change']"
        class="space-y-4"
        @submit="onSubmit"
      >
        <ProblemAlert v-if="problem" :problem="problem" :messages="hints" />
        <UFormField label="Email" name="email" required>
          <UInput v-model="state.email" type="email" autocomplete="off" class="w-full" />
        </UFormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Nombres" name="firstNames" required>
            <UInput v-model="state.firstNames" :maxlength="100" class="w-full" />
          </UFormField>
          <UFormField label="Apellidos" name="lastNames" required>
            <UInput v-model="state.lastNames" :maxlength="100" class="w-full" />
          </UFormField>
        </div>
        <UFormField
          label="Roles"
          name="roleIds"
          required
          help="Solo puedes dar roles cuyos permisos tienes."
        >
          <USelectMenu
            v-model="state.roleIds"
            :items="options()"
            value-key="value"
            label-key="label"
            multiple
            placeholder="Elige uno o más roles"
            class="w-full"
          />
        </UFormField>
        <p class="text-sm text-muted">
          La API genera una contraseña temporal que verás una sola vez.
        </p>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">Cancelar</UButton>
        <UButton type="submit" form="staff-form" :loading="create.isPending.value"
          >Crear staff</UButton
        >
      </div>
    </template>
  </UModal>
</template>
