<script setup lang="ts">
import { formatMoney } from '~/shared/utils/money'
import type { AdminOrder } from '../types'

/** Líneas y totales de la orden (API_SPEC §8.7, §8.8). Montos con IVA incluido. */
const props = defineProps<{ order: AdminOrder }>()

function options(o: Record<string, unknown>) {
  return Object.entries(o)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(' · ')
}

const totals = computed(() => [
  { label: 'Subtotal', value: formatMoney(props.order.subtotal) },
  { label: 'Envío', value: formatMoney(props.order.shippingCost) },
  ...(props.order.discountTotal.amount
    ? [{ label: 'Descuento', value: `−${formatMoney(props.order.discountTotal)}` }]
    : []),
  { label: 'IVA incluido', value: formatMoney(props.order.taxTotal) },
])
</script>

<template>
  <div class="space-y-3">
    <div class="overflow-x-auto rounded-md border border-default">
      <table class="w-full text-sm">
        <caption class="sr-only">
          Líneas del pedido
        </caption>
        <thead class="bg-elevated/50 text-left text-muted">
          <tr>
            <th scope="col" class="p-2 font-medium">Producto</th>
            <th scope="col" class="p-2 text-right font-medium">Precio</th>
            <th scope="col" class="p-2 text-right font-medium">Cantidad</th>
            <th scope="col" class="p-2 text-right font-medium">Importe</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr v-for="line in order.lines" :key="line.id">
            <td class="p-2">
              <div class="font-medium">{{ line.productName }}</div>
              <div class="text-xs text-muted">
                {{ line.sku
                }}<span v-if="Object.keys(line.variantOptions).length">
                  · {{ options(line.variantOptions) }}</span
                >
              </div>
            </td>
            <td class="p-2 text-right">{{ formatMoney(line.unitPrice) }}</td>
            <td class="p-2 text-right">{{ line.quantity }}</td>
            <td class="p-2 text-right">{{ formatMoney(line.lineTotal) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <dl class="ml-auto grid w-full max-w-xs grid-cols-2 gap-1 text-sm">
      <template v-for="t in totals" :key="t.label">
        <dt class="text-muted">{{ t.label }}</dt>
        <dd class="text-right">{{ t.value }}</dd>
      </template>
      <dt class="font-semibold">Total</dt>
      <dd class="text-right font-semibold">{{ formatMoney(order.grandTotal) }}</dd>
    </dl>
  </div>
</template>
