<script setup lang="ts">
/** Navegación entre las pantallas de inventario. */
const links = [
  { label: 'Existencias', icon: 'i-lucide-boxes', to: '/inventario/stock' },
  { label: 'Almacén', icon: 'i-lucide-warehouse', to: '/inventario/almacen' },
]
</script>

<template>
  <UNavigationMenu
    :items="links"
    highlight
    class="border-b border-default"
    aria-label="Secciones de inventario"
  />
</template>
