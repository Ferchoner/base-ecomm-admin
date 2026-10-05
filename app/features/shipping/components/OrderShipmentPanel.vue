<script setup lang="ts">
import { SHIPMENT_STATUS } from '~/shared/status/sales'
import { formatDateTime } from '~/shared/utils/dates'
import type { OrderShipment } from '../types'

/** Envío dentro del detalle de la orden (`AdminOrder.shipment`, API_SPEC §8.9). */
defineProps<{ shipment: OrderShipment | null; canOpen: boolean }>()
</script>

<template>
  <div v-if="shipment" class="space-y-2 text-sm">
    <StatusBadge :value="shipment.status" :styles="SHIPMENT_STATUS" />
    <DetailList
      :items="
        shipment.ownDelivery
          ? [
              { label: 'Entrega', value: 'Propia' },
              { label: 'Despachado', value: formatDateTime(shipment.dispatchedAt) },
              { label: 'Entregado', value: formatDateTime(shipment.deliveredAt) },
            ]
          : [
              { label: 'Paquetería', value: shipment.carrierName },
              { label: 'Guía', value: shipment.trackingNumber },
              { label: 'Despachado', value: formatDateTime(shipment.dispatchedAt) },
              { label: 'Entregado', value: formatDateTime(shipment.deliveredAt) },
            ]
      "
    />
    <UButton
      v-if="canOpen"
      :to="`/envios/${shipment.id}`"
      color="neutral"
      variant="link"
      class="px-0"
      size="sm"
      >Ver el envío</UButton
    >
  </div>
  <p v-else class="text-sm text-muted">El envío se crea cuando el pedido queda pagado.</p>
</template>
