<script setup lang="ts">
import { useSessionStore } from '~/shared/auth/session.store'

/** Navegación entre las pantallas de inventario. */
const session = useSessionStore()
const links = computed(() => [
  { label: 'Existencias', icon: 'i-lucide-boxes', to: '/inventario/stock' },
  { label: 'Almacenes', icon: 'i-lucide-warehouse', to: '/inventario/almacenes' },
  ...(session.can('inventory.write')
    ? [{ label: 'Cargar entradas', icon: 'i-lucide-file-up', to: '/inventario/cargar-entradas' }]
    : []),
])
</script>

<template>
  <UNavigationMenu
    :items="links"
    highlight
    class="border-b border-default"
    aria-label="Secciones de inventario"
  />
</template>
