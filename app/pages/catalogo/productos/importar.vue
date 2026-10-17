<script setup lang="ts">
import ProductImportCard from '~/features/catalog/components/ProductImportCard.vue'

definePageMeta({ title: 'Cargar productos', permission: 'catalog.write' })
</script>

<template>
  <div class="max-w-3xl space-y-4">
    <UButton
      to="/catalogo/productos"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      size="sm"
      >Productos</UButton
    >
    <ProductImportCard />
    <p class="text-sm text-muted">
      Después de cargar: los precios se cargan en Precios y las existencias en Inventario › Cargar
      entradas; las imágenes y la publicación, producto por producto.
    </p>
  </div>
</template>
