<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { z } from 'zod'
import { toApiProblem } from '~/shared/api/problem'
import type { ApiProblem } from '~/shared/api/problem'
import {
  NEW_PASSWORD_HELP,
  newPasswordField,
  PASSWORDS_MISMATCH,
  passwordsMatch,
} from '~/shared/auth/password-policy'
import { useSessionStore } from '~/shared/auth/session.store'
import { splitFieldErrors } from '~/shared/utils/form-errors'

definePageMeta({ layout: false, title: 'Cambiar contraseña' })

const session = useSessionStore()
const toast = useToast()
const forced = computed(() => session.mustChangePassword)

// ChangePasswordDto; la política de la contraseña nueva está en password-policy.ts.
const schema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'Escribe tu contraseña actual.')
      .max(256, 'Máximo 256 caracteres.'),
    newPassword: newPasswordField,
    confirmPassword: z.string(),
  })
  .refine(passwordsMatch, PASSWORDS_MISMATCH)
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const otherMessages = ref<string[]>([])
const submitting = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  problem.value = null
  otherMessages.value = []
  submitting.value = true
  try {
    await session.changePassword({
      currentPassword: event.data.currentPassword,
      newPassword: event.data.newPassword,
    })
    toast.add({
      title: 'Contraseña actualizada',
      description: 'Se cerraron tus otras sesiones.',
      color: 'success',
    })
    await navigateTo('/')
  } catch (error) {
    const p = toApiProblem(error)
    if (p.type === 'invalid-credentials') {
      form.value?.setErrors([
        { name: 'currentPassword', message: 'La contraseña actual no es correcta.' },
      ])
    } else if (p.type === 'validation-error' || p.type === 'password-policy-violation') {
      const { fieldErrors, otherMessages: rest } = splitFieldErrors(p, [
        'currentPassword',
        'newPassword',
      ])
      form.value?.setErrors(fieldErrors)
      otherMessages.value = rest
      if (rest.length > 0) problem.value = p
    } else {
      problem.value = p
    }
  } finally {
    submitting.value = false
  }
}

async function logout() {
  await session.logout()
  await navigateTo('/login')
}
</script>

<template>
  <NuxtLayout :name="forced ? 'auth' : 'default'">
    <UCard :class="forced ? '' : 'max-w-md'">
      <template #header>
        <h1 class="text-lg font-semibold">Cambiar contraseña</h1>
        <p v-if="forced" class="text-sm text-muted">
          Tu cuenta tiene una contraseña temporal. Elige una nueva para continuar.
        </p>
      </template>

      <UForm ref="form" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <ProblemAlert v-if="problem" :problem="problem" :messages="otherMessages" />

        <UFormField
          :label="forced ? 'Contraseña temporal' : 'Contraseña actual'"
          name="currentPassword"
          required
        >
          <UInput
            v-model="state.currentPassword"
            type="password"
            autocomplete="current-password"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Contraseña nueva" name="newPassword" :help="NEW_PASSWORD_HELP" required>
          <UInput
            v-model="state.newPassword"
            type="password"
            autocomplete="new-password"
            class="w-full"
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

        <div class="flex flex-col gap-2">
          <UButton type="submit" block :loading="submitting">Guardar contraseña</UButton>
          <UButton v-if="forced" color="neutral" variant="ghost" block @click="logout"
            >Cerrar sesión</UButton
          >
        </div>
      </UForm>
    </UCard>
  </NuxtLayout>
</template>
