<script setup lang="ts">
import WorkOrderForm from '~/features/work-orders/components/WorkOrderForm.vue'
import type { WorkOrder } from '~/features/work-orders/types'

definePageMeta({ title: 'Recibir equipo', permission: 'work-orders.manage' })

// Al recibirlo se abre su detalle con la invitación a imprimir la nota para la firma del cliente.
function onSaved(w: WorkOrder) {
  navigateTo({ path: `/ordenes-trabajo/${w.id}`, query: { recibida: '1' } }, { replace: true })
}
</script>

<template>
  <div class="space-y-4">
    <UButton
      to="/ordenes-trabajo"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      size="sm"
      >Órdenes de trabajo</UButton
    >
    <p class="max-w-2xl text-sm text-muted">
      Registra el equipo que deja el cliente. Al recibirlo se le da un folio; imprime la nota de
      servicio para que la firme.
    </p>
    <WorkOrderForm @saved="onSaved">
      <template #actions>
        <UButton to="/ordenes-trabajo" color="neutral" variant="ghost">Cancelar</UButton>
      </template>
    </WorkOrderForm>
  </div>
</template>
