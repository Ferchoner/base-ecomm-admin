<script setup lang="ts">
import { useWarehouses } from '~/features/inventory/api'
import WarehouseForm from '~/features/inventory/components/WarehouseForm.vue'
import { useSessionStore } from '~/shared/auth/session.store'

definePageMeta({ title: 'Almacén', permission: 'inventory.read' })

const session = useSessionStore()
const { data, isPending, error, refetch } = useWarehouses()
</script>

<template>
  <div class="space-y-4">
    <InventoryTabs />
    <QueryState
      :loading="isPending"
      :error="error"
      :empty="data?.length === 0"
      empty-title="Sin almacén"
      @retry="refetch()"
    >
      <div v-for="warehouse in data" :key="warehouse.id" class="space-y-3">
        <p class="text-sm text-muted">
          Código <code>{{ warehouse.code }}</code
          >. La tienda opera con un solo almacén; no se pueden crear otros.
        </p>
        <WarehouseForm :warehouse="warehouse" :disabled="!session.can('inventory.write')" />
      </div>
    </QueryState>
  </div>
</template>
