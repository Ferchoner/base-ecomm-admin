<script setup lang="ts">
import AccountProfile from '~/features/account/components/AccountProfile.vue'
import { useSessionStore } from '~/shared/auth/session.store'

definePageMeta({ title: 'Mi cuenta' })

const session = useSessionStore()
const refreshing = ref(false)

// Los roles pueden cambiar mientras la sesión sigue abierta: se vuelven a leer al entrar.
onMounted(async () => {
  refreshing.value = true
  await session.loadAccount().catch(() => undefined)
  refreshing.value = false
})

async function logout() {
  await session.logout()
  await navigateTo('/login')
}
</script>

<template>
  <div class="space-y-6">
    <AccountProfile v-if="session.account" :account="session.account" />
    <div class="flex flex-wrap gap-2">
      <UButton to="/cambiar-contrasena" icon="i-lucide-key-round">Cambiar contraseña</UButton>
      <UButton color="neutral" variant="outline" icon="i-lucide-log-out" @click="logout"
        >Cerrar sesión</UButton
      >
      <UIcon
        v-if="refreshing"
        name="i-lucide-loader-circle"
        class="size-5 animate-spin self-center text-muted"
        aria-label="Actualizando"
      />
    </div>
  </div>
</template>
