<script setup lang="ts">
import { formatMoney } from '~/shared/utils/money'
import { collectionMethodLabel, staffLabel } from '../status'
import type { CashDay } from '../types'

/** Las cifras de un día de un local (API_SPEC §15.9): las del momento o las guardadas al cerrar. */
const props = defineProps<{ day: CashDay; ownId?: string }>()

const tiles = computed(() => [
  {
    label: 'Ventas del día',
    value: formatMoney(props.day.placedAmount),
    hint: `${props.day.placedCount} ${props.day.placedCount === 1 ? 'venta' : 'ventas'}`,
  },
  {
    label: 'Cobrado',
    value: formatMoney(props.day.paymentAmount),
    hint: 'Todos los métodos',
  },
  {
    label: 'Reembolsado',
    value: formatMoney(props.day.refundAmount),
    hint: `${props.day.refundCount} ${props.day.refundCount === 1 ? 'reembolso' : 'reembolsos'}`,
  },
  {
    label: 'Efectivo esperado',
    value: formatMoney(props.day.expectedCash),
    hint: 'Efectivo cobrado menos reembolsos en efectivo',
  },
])
</script>

<template>
  <div class="space-y-4">
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div
        v-for="tile in tiles"
        :key="tile.label"
        class="rounded-md border border-default p-3"
        :aria-label="tile.label"
      >
        <div class="text-sm text-muted">{{ tile.label }}</div>
        <div class="text-xl font-semibold">{{ tile.value }}</div>
        <div class="text-xs text-muted">{{ tile.hint }}</div>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <div>
        <h3 class="mb-2 text-sm font-semibold">Cobrado por método</h3>
        <table class="w-full text-sm">
          <thead class="text-left text-muted">
            <tr>
              <th class="py-1 font-normal">Método</th>
              <th class="py-1 text-right font-normal">Cobros</th>
              <th class="py-1 text-right font-normal">Monto</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="row in day.payments" :key="String(row.method)">
              <td class="py-1">{{ collectionMethodLabel(row.method) }}</td>
              <td class="py-1 text-right">{{ row.count }}</td>
              <td class="py-1 text-right">{{ formatMoney(row.amount) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="day.cashRefundAmount.amount" class="mt-2 text-sm text-muted">
          Reembolsado en efectivo: {{ formatMoney(day.cashRefundAmount) }}.
        </p>
      </div>
      <div>
        <h3 class="mb-2 text-sm font-semibold">Por quién lo registró</h3>
        <p v-if="day.byStaff.length === 0" class="text-sm text-muted">Sin cobros ni reembolsos.</p>
        <table v-else class="w-full text-sm">
          <thead class="text-left text-muted">
            <tr>
              <th class="py-1 font-normal">Cuenta</th>
              <th class="py-1 text-right font-normal">Cobrado</th>
              <th class="py-1 text-right font-normal">Efectivo</th>
              <th class="py-1 text-right font-normal">Reembolsado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="row in day.byStaff" :key="String(row.staffId)">
              <td
                class="py-1"
                :class="row.staffId && row.staffId !== ownId ? 'font-mono text-xs break-all' : ''"
              >
                {{ staffLabel(row.staffId, ownId) }}
              </td>
              <td class="py-1 text-right">
                {{ formatMoney(row.paymentAmount) }}
                <span class="text-xs text-muted">({{ row.paymentCount }})</span>
              </td>
              <td class="py-1 text-right">{{ formatMoney(row.cashAmount) }}</td>
              <td class="py-1 text-right">{{ formatMoney(row.refundAmount) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <ul class="space-y-1 text-sm text-muted">
      <li v-if="day.pendingPaymentCount">
        {{ day.pendingPaymentCount }}
        {{ day.pendingPaymentCount === 1 ? 'venta sigue' : 'ventas siguen' }} sin cobrar.
      </li>
      <li v-if="day.cancelledCount">
        {{ day.cancelledCount }}
        {{ day.cancelledCount === 1 ? 'venta cancelada' : 'ventas canceladas' }}.
      </li>
      <li v-if="day.openPriceLineCount">
        {{ day.openPriceLineCount }}
        {{ day.openPriceLineCount === 1 ? 'artículo sin registrar' : 'artículos sin registrar' }}
        vendidos a precio libre por {{ formatMoney(day.openPriceAmount) }}.
      </li>
    </ul>
  </div>
</template>
