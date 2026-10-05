<script setup lang="ts">
import { PAYMENT_PROVIDER, PAYMENT_STATUS, REFUND_STATUS } from '~/shared/status/sales'
import { formatDateTime } from '~/shared/utils/dates'
import { formatMoney } from '~/shared/utils/money'
import type { OrderPayment } from '../types'

/** Pago dentro del detalle de la orden (`AdminOrder.payment`, API_SPEC §8.9). */
defineProps<{ payment: OrderPayment | null }>()
</script>

<template>
  <div v-if="payment" class="space-y-2 text-sm">
    <div class="flex flex-wrap items-center gap-2">
      <StatusBadge :value="payment.status" :styles="PAYMENT_STATUS" />
      <span class="text-muted">{{ PAYMENT_PROVIDER[payment.provider] ?? payment.provider }}</span>
    </div>
    <DetailList
      :items="[
        { label: 'Monto', value: formatMoney(payment.amount) },
        { label: 'Cobrado', value: formatMoney(payment.capturedAmount) },
        { label: 'Reembolsado', value: formatMoney(payment.refundedAmount) },
        { label: 'Fecha de cobro', value: formatDateTime(payment.capturedAt) },
      ]"
    />
    <ul v-if="payment.refunds.length" class="space-y-1">
      <li v-for="r in payment.refunds" :key="r.id" class="flex flex-wrap items-center gap-2">
        <StatusBadge :value="r.status" :styles="REFUND_STATUS" />
        <span>{{ formatMoney(r.amount) }}</span>
      </li>
    </ul>
    <UButton :to="`/pagos/${payment.id}`" color="neutral" variant="link" class="px-0" size="sm"
      >Ver el pago</UButton
    >
  </div>
  <p v-else class="text-sm text-muted">El comprador todavía no inicia el pago.</p>
</template>
