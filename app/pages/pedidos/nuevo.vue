<script setup lang="ts">
import StoreOrderForm from '~/features/orders/components/StoreOrderForm.vue'

definePageMeta({ title: 'Vender en tienda', permission: 'orders.place' })
</script>

<template>
  <div class="space-y-4">
    <p class="max-w-2xl text-sm text-muted">
      Coloca un pedido a nombre de un cliente presente. Queda por cobrar; el pago se registra en su
      detalle y, en una venta de mostrador, se entrega al pagarse.
    </p>
    <StoreOrderForm />
  </div>
</template>
