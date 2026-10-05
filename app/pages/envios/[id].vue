<script setup lang="ts">
import { useShipment } from '~/features/shipping/api'
import ShipmentActions from '~/features/shipping/components/ShipmentActions.vue'
import TrackingCard from '~/features/shipping/components/TrackingCard.vue'
import { useSessionStore } from '~/shared/auth/session.store'
import { SHIPMENT_STATUS } from '~/shared/status/sales'
import { formatDateTime } from '~/shared/utils/dates'

definePageMeta({ title: 'Envío', permission: 'shipping.manage' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const session = useSessionStore()
const { data: shipment, isPending, error, refetch } = useShipment(id)

const dates = computed(() => {
  const s = shipment.value
  if (!s) return []
  return [
    { label: 'Creado', value: formatDateTime(s.createdAt) },
    { label: 'Despachado', value: formatDateTime(s.dispatchedAt) },
    { label: 'Entregado', value: formatDateTime(s.deliveredAt) },
    ...(s.failedAt ? [{ label: 'Entrega fallida', value: formatDateTime(s.failedAt) }] : []),
    ...(s.returnedAt ? [{ label: 'Devuelto', value: formatDateTime(s.returnedAt) }] : []),
    ...(s.cancelledAt ? [{ label: 'Cancelado', value: formatDateTime(s.cancelledAt) }] : []),
  ]
})
</script>

<template>
  <div class="space-y-4">
    <UButton to="/envios" icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm"
      >Envíos</UButton
    >

    <QueryState :loading="isPending" :error="error" @retry="refetch()">
      <template v-if="shipment">
        <header class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-1">
            <h2 class="text-xl font-semibold">Envío del pedido {{ shipment.orderCode }}</h2>
            <StatusBadge :value="shipment.status" :styles="SHIPMENT_STATUS" />
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="session.can('orders.read')"
              :to="`/pedidos/${shipment.orderId}`"
              color="neutral"
              variant="outline"
              icon="i-lucide-shopping-cart"
              >Ver el pedido</UButton
            >
            <ShipmentActions :shipment="shipment" />
          </div>
        </header>

        <UAlert
          v-if="shipment.status === 'RETURNED'"
          color="info"
          variant="subtle"
          icon="i-lucide-package-plus"
          title="Envío devuelto"
          description="Para que las piezas vuelvan a venderse, reintegra el stock desde el pedido."
        />

        <div class="grid gap-4 lg:grid-cols-3">
          <UCard class="lg:col-span-2">
            <template #header><h3 class="font-semibold">Piezas</h3></template>
            <ul class="divide-y divide-default text-sm">
              <li
                v-for="item in shipment.items"
                :key="item.orderLineId"
                class="flex justify-between gap-3 py-2"
              >
                <div>
                  <div class="font-medium">{{ item.productName }}</div>
                  <div class="text-xs text-muted">{{ item.sku }}</div>
                </div>
                <span>× {{ item.quantity }}</span>
              </li>
            </ul>
          </UCard>
          <div class="space-y-4">
            <UCard>
              <template #header><h3 class="font-semibold">Destino</h3></template>
              <PostalAddress :address="shipment.destination" />
            </UCard>
            <UCard>
              <template #header><h3 class="font-semibold">Paquetería</h3></template>
              <TrackingCard :shipment="shipment" :can-write="session.can('shipping.manage')" />
            </UCard>
            <UCard>
              <template #header><h3 class="font-semibold">Fechas</h3></template>
              <DetailList :items="dates" />
              <p v-if="shipment.failureNote" class="mt-2 text-sm">
                Entrega fallida: {{ shipment.failureNote }}
              </p>
              <p v-if="shipment.returnNote" class="mt-2 text-sm">
                Devolución: {{ shipment.returnNote }}
              </p>
            </UCard>
          </div>
        </div>
      </template>
    </QueryState>
  </div>
</template>
