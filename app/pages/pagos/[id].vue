<script setup lang="ts">
import { usePayment } from '~/features/payments/api'
import ManualRefundModal from '~/features/payments/components/ManualRefundModal.vue'
import { canRegisterManualRefund } from '~/features/payments/status'
import { useSessionStore } from '~/shared/auth/session.store'
import { PAYMENT_PROVIDER, PAYMENT_STATUS, REFUND_STATUS } from '~/shared/status/sales'
import { formatDateTime } from '~/shared/utils/dates'
import { formatMoney } from '~/shared/utils/money'

definePageMeta({ title: 'Pago', permission: 'orders.read' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const session = useSessionStore()
const { data: payment, isPending, error, refetch } = usePayment(id)
const showRefund = ref(false)
const offerRefund = computed(
  () => !!payment.value && session.can('payments.manage') && canRegisterManualRefund(payment.value),
)
</script>

<template>
  <div class="space-y-4">
    <UButton to="/pagos" icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm"
      >Pagos</UButton
    >

    <QueryState :loading="isPending" :error="error" @retry="refetch()">
      <template v-if="payment">
        <header class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-1">
            <h2 class="text-xl font-semibold">Pago del pedido {{ payment.orderCode }}</h2>
            <div class="flex flex-wrap items-center gap-2">
              <StatusBadge :value="payment.status" :styles="PAYMENT_STATUS" />
              <span class="text-sm text-muted">{{
                PAYMENT_PROVIDER[payment.provider] ?? payment.provider
              }}</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="session.can('orders.read')"
              :to="`/pedidos/${payment.orderId}`"
              color="neutral"
              variant="outline"
              icon="i-lucide-shopping-cart"
              >Ver el pedido</UButton
            >
            <UButton v-if="offerRefund" icon="i-lucide-undo-2" @click="showRefund = true"
              >Registrar reembolso</UButton
            >
          </div>
        </header>

        <div class="grid gap-4 lg:grid-cols-3">
          <UCard>
            <template #header><h3 class="font-semibold">Montos</h3></template>
            <DetailList
              :items="[
                { label: 'Monto', value: formatMoney(payment.amount) },
                { label: 'Cobrado', value: formatMoney(payment.capturedAmount) },
                { label: 'Reembolsado', value: formatMoney(payment.refundedAmount) },
                { label: 'Fecha de cobro', value: formatDateTime(payment.capturedAt) },
                { label: 'Referencia del proveedor', value: payment.providerPaymentId },
                { label: 'Iniciado', value: formatDateTime(payment.createdAt) },
              ]"
            />
          </UCard>
          <UCard class="lg:col-span-2">
            <template #header><h3 class="font-semibold">Intentos</h3></template>
            <ol class="space-y-2 text-sm" aria-label="Intentos de pago">
              <li
                v-for="(a, i) in payment.attempts"
                :key="i"
                class="flex flex-wrap items-center gap-2"
              >
                <StatusBadge :value="a.status" :styles="PAYMENT_STATUS" />
                <span class="text-muted">{{ formatDateTime(a.createdAt) }}</span>
                <span v-if="a.providerReference">Comprobante: {{ a.providerReference }}</span>
                <span v-if="a.failureCode" class="text-error">{{ a.failureCode }}</span>
                <span v-if="a.registeredBy" class="text-xs text-muted"
                  >Registrado por el staff</span
                >
              </li>
            </ol>
          </UCard>
        </div>

        <UCard>
          <template #header><h3 class="font-semibold">Reembolsos</h3></template>
          <p v-if="payment.refunds.length === 0" class="text-sm text-muted">Sin reembolsos.</p>
          <ul v-else class="divide-y divide-default text-sm">
            <li
              v-for="r in payment.refunds"
              :key="r.id"
              class="flex flex-wrap items-center gap-x-4 gap-y-1 py-2"
            >
              <StatusBadge :value="r.status" :styles="REFUND_STATUS" />
              <span class="font-medium">{{ formatMoney(r.amount) }}</span>
              <span class="text-muted">Iniciado {{ formatDateTime(r.createdAt) }}</span>
              <span v-if="r.completedAt" class="text-muted"
                >Completado {{ formatDateTime(r.completedAt) }}</span
              >
              <span v-if="r.providerRefundId">Comprobante: {{ r.providerRefundId }}</span>
            </li>
          </ul>
          <p
            v-if="
              payment.provider !== 'MANUAL' && payment.refunds.some((r) => r.status === 'FAILED')
            "
            class="mt-3 text-sm text-muted"
          >
            Reintentar un reembolso con el proveedor todavía no está disponible en la API.
          </p>
        </UCard>

        <ManualRefundModal v-model:open="showRefund" :payment="payment" />
      </template>
    </QueryState>
  </div>
</template>
