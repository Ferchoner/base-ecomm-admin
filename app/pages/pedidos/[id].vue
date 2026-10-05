<script setup lang="ts">
import { useOrder } from '~/features/orders/api'
import OrderActions from '~/features/orders/components/OrderActions.vue'
import OrderHistory from '~/features/orders/components/OrderHistory.vue'
import OrderLines from '~/features/orders/components/OrderLines.vue'
import OrderPaymentPanel from '~/features/payments/components/OrderPaymentPanel.vue'
import OrderShipmentPanel from '~/features/shipping/components/OrderShipmentPanel.vue'
import { useSessionStore } from '~/shared/auth/session.store'
import { ORDER_STATUS } from '~/shared/status/sales'
import { formatDateTime } from '~/shared/utils/dates'

definePageMeta({ title: 'Pedido', permission: 'orders.read' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const session = useSessionStore()
const { data: order, isPending, error, refetch } = useOrder(id)

const dates = computed(() => {
  const o = order.value
  if (!o) return []
  return [
    { label: 'Colocado', value: formatDateTime(o.placedAt) },
    ...(o.paymentDueAt ? [{ label: 'Vence el pago', value: formatDateTime(o.paymentDueAt) }] : []),
    ...(o.paidAt ? [{ label: 'Pagado', value: formatDateTime(o.paidAt) }] : []),
    ...(o.shippedAt ? [{ label: 'Enviado', value: formatDateTime(o.shippedAt) }] : []),
    ...(o.deliveredAt ? [{ label: 'Entregado', value: formatDateTime(o.deliveredAt) }] : []),
    ...(o.cancelledAt ? [{ label: 'Cancelado', value: formatDateTime(o.cancelledAt) }] : []),
    ...(o.expiredAt ? [{ label: 'Vencido', value: formatDateTime(o.expiredAt) }] : []),
    ...(o.refundedAt ? [{ label: 'Reembolsado', value: formatDateTime(o.refundedAt) }] : []),
  ]
})
</script>

<template>
  <div class="space-y-4">
    <UButton to="/pedidos" icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm"
      >Pedidos</UButton
    >

    <QueryState :loading="isPending" :error="error" @retry="refetch()">
      <template v-if="order">
        <header class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-1">
            <h2 class="text-xl font-semibold">Pedido {{ order.publicCode }}</h2>
            <div class="flex flex-wrap items-center gap-2">
              <StatusBadge :value="order.status" :styles="ORDER_STATUS" />
              <span class="text-xs text-muted">N.º {{ order.orderNumber }}</span>
            </div>
          </div>
          <OrderActions :order="order" />
        </header>

        <UAlert
          v-if="order.status === 'AWAITING_MANUAL_FULFILLMENT'"
          color="error"
          variant="subtle"
          icon="i-lucide-package-search"
          title="Pagado sin stock apartado"
          description="El pago llegó después de vencer la reserva. Reintenta el surtido cuando haya existencias, o cancélalo para reembolsar."
        />
        <UAlert
          v-else-if="order.status === 'EXPIRED'"
          color="neutral"
          variant="subtle"
          icon="i-lucide-clock"
          title="Pedido vencido"
          description="La reserva venció sin pago. Si el comprador paga en tienda, todavía puedes registrar el pago."
        />

        <div class="grid gap-4 lg:grid-cols-3">
          <div class="space-y-4 lg:col-span-2">
            <UCard>
              <template #header><h3 class="font-semibold">Productos</h3></template>
              <OrderLines :order="order" />
            </UCard>
            <UCard>
              <template #header><h3 class="font-semibold">Historial</h3></template>
              <OrderHistory :history="order.statusHistory" />
            </UCard>
          </div>
          <div class="space-y-4">
            <UCard>
              <template #header><h3 class="font-semibold">Comprador</h3></template>
              <div class="space-y-3 text-sm">
                <p v-if="order.anonymizedAt" class="text-muted">
                  Anonimizado el {{ formatDateTime(order.anonymizedAt) }}.
                </p>
                <p v-else-if="order.blockedAt" class="text-muted">
                  Datos personales bloqueados desde el {{ formatDateTime(order.blockedAt) }}.
                </p>
                <p v-else>{{ order.contactEmail }}</p>
                <p class="text-muted">{{ order.customerId ? 'Cliente registrado' : 'Invitado' }}</p>
                <PostalAddress :address="order.shippingAddress" />
                <p class="text-muted">
                  Entrega estimada: {{ order.estimatedDelivery.minBusinessDays }} a
                  {{ order.estimatedDelivery.maxBusinessDays }} días hábiles tras el pago.
                </p>
              </div>
            </UCard>
            <UCard>
              <template #header><h3 class="font-semibold">Pago</h3></template>
              <OrderPaymentPanel :payment="order.payment" />
            </UCard>
            <UCard>
              <template #header><h3 class="font-semibold">Envío</h3></template>
              <OrderShipmentPanel
                :shipment="order.shipment"
                :can-open="session.can('shipping.manage')"
              />
            </UCard>
            <UCard>
              <template #header><h3 class="font-semibold">Fechas</h3></template>
              <DetailList :items="dates" />
            </UCard>
          </div>
        </div>
      </template>
    </QueryState>
  </div>
</template>
