<script setup lang="ts">
import StoreOrderForm from '~/features/orders/components/StoreOrderForm.vue'

definePageMeta({ title: 'Vender en tienda', permission: 'orders.place' })

// Venta para cobrar una orden de trabajo (`?ordenTrabajo=<id>&folio=<folio>`): al colocarla se vuelve
// a esa orden para ligarla. Solo se acepta un ID, nunca una ruta.
const route = useRoute()
const workOrderId = computed(() => {
  const v = route.query.ordenTrabajo
  return typeof v === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(v) ? v : null
})
const folio = computed(() => {
  const v = route.query.folio
  return typeof v === 'string' && /^[A-Za-z0-9-]{1,20}$/.test(v) ? v : null
})
</script>

<template>
  <div class="space-y-4">
    <p class="max-w-2xl text-sm text-muted">
      Coloca un pedido a nombre de un cliente presente. Queda por cobrar; el pago se registra en su
      detalle y, en una venta de mostrador, se entrega al pagarse.
    </p>
    <UAlert
      v-if="workOrderId"
      color="info"
      variant="subtle"
      icon="i-lucide-wrench"
      :title="`Venta para la orden de trabajo ${folio ?? ''}`.trim()"
      description="Al colocarla vuelves a la orden para ligarla."
      :actions="[
        {
          label: 'Volver a la orden',
          color: 'neutral',
          variant: 'outline',
          to: `/ordenes-trabajo/${workOrderId}`,
        },
      ]"
    />
    <StoreOrderForm :return-to="workOrderId ? `/ordenes-trabajo/${workOrderId}` : undefined" />
  </div>
</template>
