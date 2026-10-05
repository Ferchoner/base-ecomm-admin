<script setup lang="ts">
import ProductForm from '~/features/catalog/components/ProductForm.vue'
import type { Product } from '~/features/catalog/types'

definePageMeta({ title: 'Nuevo producto', permission: 'catalog.write' })

function onSaved(product: Product) {
  navigateTo(`/catalogo/productos/${product.id}?tab=variantes`, { replace: true })
}
</script>

<template>
  <div class="space-y-4">
    <UButton
      to="/catalogo/productos"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      size="sm"
      >Productos</UButton
    >
    <p class="text-sm text-muted">Se crea como borrador. Después agregas variantes e imágenes.</p>
    <ProductForm @saved="onSaved">
      <template #actions>
        <UButton to="/catalogo/productos" color="neutral" variant="ghost">Cancelar</UButton>
      </template>
    </ProductForm>
  </div>
</template>
