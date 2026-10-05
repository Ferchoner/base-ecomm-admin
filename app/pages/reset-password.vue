<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { z } from 'zod'
import { usePasswordResetConfirm } from '~/features/account/api'
import {
  NEW_PASSWORD_HELP,
  newPasswordField,
  PASSWORDS_MISMATCH,
  passwordsMatch,
} from '~/shared/auth/password-policy'
import { splitFieldErrors } from '~/shared/utils/form-errors'

// La ruta la fija la API: el correo enlaza a FRONTEND_BASE_URL/reset-password?token=… (API_SPEC §9.8, GAPS G-01).
definePageMeta({ layout: 'auth', public: true, title: 'Elegir contraseña nueva' })

const route = useRoute()
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))

const schema = z
  .object({ newPassword: newPasswordField, confirmPassword: z.string() })
  .refine(passwordsMatch, PASSWORDS_MISMATCH)
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({ newPassword: '', confirmPassword: '' })
const form = useTemplateRef('form')
const otherMessages = ref<string[]>([])
const confirm = usePasswordResetConfirm()

const expired = computed(() => confirm.error.value?.type === 'invalid-or-expired-token')
const generalProblem = computed(() => {
  const p = confirm.error.value
  if (!p || p.type === 'invalid-or-expired-token') return null
  if (
    (p.type === 'password-policy-violation' || p.type === 'validation-error') &&
    otherMessages.value.length === 0
  ) {
    return null
  }
  return p
})

function onSubmit(event: FormSubmitEvent<Schema>) {
  otherMessages.value = []
  confirm.mutate(
    { token: token.value, newPassword: event.data.newPassword },
    {
      onError: (p) => {
        if (p.type !== 'password-policy-violation' && p.type !== 'validation-error') return
        const { fieldErrors, otherMessages: rest } = splitFieldErrors(p, ['newPassword'])
        form.value?.setErrors(fieldErrors)
        otherMessages.value = rest
      },
    },
  )
}
</script>

<template>
  <UCard>
    <template #header>
      <h1 class="text-lg font-semibold">Elegir contraseña nueva</h1>
    </template>

    <div v-if="confirm.isSuccess.value" class="space-y-4">
      <UAlert
        color="success"
        variant="subtle"
        icon="i-lucide-circle-check"
        title="Contraseña actualizada"
        description="Se cerraron todas tus sesiones. Inicia sesión con tu contraseña nueva."
        role="status"
      />
      <UButton to="/login" block>Iniciar sesión</UButton>
    </div>

    <div v-else-if="!token || expired" class="space-y-4">
      <UAlert
        color="warning"
        variant="subtle"
        icon="i-lucide-link-2-off"
        title="El enlace no es válido"
        description="El enlace ya se usó, venció o fue reemplazado por uno más reciente. Pide otro."
        role="alert"
      />
      <UButton to="/recuperar-contrasena" block>Pedir otro enlace</UButton>
    </div>

    <UForm v-else ref="form" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
      <ProblemAlert v-if="generalProblem" :problem="generalProblem" :messages="otherMessages" />

      <UFormField label="Contraseña nueva" name="newPassword" :help="NEW_PASSWORD_HELP" required>
        <UInput
          v-model="state.newPassword"
          type="password"
          autocomplete="new-password"
          class="w-full"
          autofocus
        />
      </UFormField>

      <UFormField label="Confirma la contraseña nueva" name="confirmPassword" required>
        <UInput
          v-model="state.confirmPassword"
          type="password"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>

      <UButton type="submit" block :loading="confirm.isPending.value">Guardar contraseña</UButton>
    </UForm>
  </UCard>
</template>
