<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const copy = computed(() => {
  switch (props.error.statusCode) {
    case 403:
      return {
        title: 'Sin permiso',
        description: props.error.statusMessage || 'No tienes permiso para ver esta sección.',
      }
    case 404:
      return { title: 'Página no encontrada', description: 'La dirección no existe o se movió.' }
    default:
      return {
        title: 'Algo salió mal',
        description: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
      }
  }
})

useHead({ title: copy.value.title })
</script>

<template>
  <UApp>
    <main class="flex min-h-screen items-center justify-center p-4">
      <UEmpty
        icon="i-lucide-triangle-alert"
        :title="copy.title"
        :description="copy.description"
        :actions="[
          {
            label: 'Ir al inicio',
            icon: 'i-lucide-house',
            onClick: () => clearError({ redirect: '/' }),
          },
        ]"
      />
    </main>
  </UApp>
</template>
