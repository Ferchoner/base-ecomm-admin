<script setup lang="ts">
import { es } from '@nuxt/ui/locale'
</script>

<template>
  <UApp :locale="es">
    <NuxtPwaManifest />
    <PwaStatus />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
