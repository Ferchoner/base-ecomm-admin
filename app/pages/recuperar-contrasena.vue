<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { z } from 'zod'
import { usePasswordResetRequest } from '~/features/account/api'

definePageMeta({ layout: 'auth', public: true, title: 'Recuperar contraseña' })

// PasswordResetRequestDto: email ≤ 254.
const schema = z.object({
  email: z.email('Escribe un email válido.').max(254, 'Máximo 254 caracteres.'),
})
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({ email: '' })
const request = usePasswordResetRequest()

function onSubmit(event: FormSubmitEvent<Schema>) {
  request.mutate(event.data)
}
</script>

<template>
  <UCard>
    <template #header>
      <h1 class="text-lg font-semibold">Recuperar contraseña</h1>
      <p class="text-sm text-muted">Te enviaremos un enlace para elegir una contraseña nueva.</p>
    </template>

    <div v-if="request.isSuccess.value" class="space-y-4">
      <!-- La API responde igual exista o no la cuenta (API_SPEC §9.8): el mensaje no lo revela. -->
      <UAlert
        color="success"
        variant="subtle"
        icon="i-lucide-mail-check"
        title="Revisa tu correo"
        description="Si el email pertenece a una cuenta activa, recibirás un enlace válido por 30 minutos. Puede tardar unos minutos en llegar."
        role="status"
      />
      <UButton to="/login" color="neutral" variant="outline" block
        >Volver al inicio de sesión</UButton
      >
    </div>

    <UForm v-else :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
      <ProblemAlert v-if="request.error.value" :problem="request.error.value" />

      <UFormField label="Email" name="email" required>
        <UInput
          v-model="state.email"
          type="email"
          autocomplete="username"
          class="w-full"
          autofocus
        />
      </UFormField>

      <UButton type="submit" block :loading="request.isPending.value">Enviar enlace</UButton>
      <UButton to="/login" color="neutral" variant="ghost" block
        >Volver al inicio de sesión</UButton
      >
    </UForm>
  </UCard>
</template>
