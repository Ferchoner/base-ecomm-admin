<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { z } from 'zod'
import { toApiProblem } from '~/shared/api/problem'
import type { ApiProblem } from '~/shared/api/problem'
import { safeRedirect } from '~/shared/auth/redirect'
import { useSessionStore } from '~/shared/auth/session.store'
import { splitFieldErrors } from '~/shared/utils/form-errors'

definePageMeta({ layout: 'auth', public: true, title: 'Iniciar sesión' })

// Límites de LoginDto (openapi/v1.json): email ≤ 254, contraseña ≤ 256 tal como se escribe.
const schema = z.object({
  email: z.email('Escribe un email válido.').max(254, 'Máximo 254 caracteres.'),
  password: z.string().min(1, 'Escribe tu contraseña.').max(256, 'Máximo 256 caracteres.'),
})
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({ email: '', password: '' })
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const otherMessages = ref<string[]>([])
const submitting = ref(false)

const session = useSessionStore()
const route = useRoute()

async function onSubmit(event: FormSubmitEvent<Schema>) {
  problem.value = null
  otherMessages.value = []
  submitting.value = true
  try {
    await session.login(event.data)
    await navigateTo(safeRedirect(route.query.redirect))
  } catch (error) {
    const p = toApiProblem(error)
    if (p.type === 'validation-error') {
      const { fieldErrors, otherMessages: rest } = splitFieldErrors(p, ['email', 'password'])
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
</script>

<template>
  <UCard>
    <template #header>
      <h1 class="text-lg font-semibold">Iniciar sesión</h1>
      <p class="text-sm text-muted">Acceso solo para el staff de la tienda.</p>
    </template>

    <UForm ref="form" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
      <ProblemAlert v-if="problem" :problem="problem" :messages="otherMessages" />

      <UFormField label="Email" name="email" required>
        <UInput
          v-model="state.email"
          type="email"
          autocomplete="username"
          class="w-full"
          autofocus
        />
      </UFormField>

      <UFormField label="Contraseña" name="password" required>
        <UInput
          v-model="state.password"
          type="password"
          autocomplete="current-password"
          class="w-full"
        />
      </UFormField>

      <UButton type="submit" block :loading="submitting">Entrar</UButton>
    </UForm>
  </UCard>
</template>
