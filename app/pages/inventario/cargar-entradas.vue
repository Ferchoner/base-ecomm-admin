<script setup lang="ts">
import ReceiptImportCard from '~/features/inventory/components/ReceiptImportCard.vue'

definePageMeta({ title: 'Inventario', permission: 'inventory.write' })
</script>

<template>
  <div class="space-y-4">
    <InventoryTabs />
    <ReceiptImportCard class="max-w-3xl" />
  </div>
</template>
