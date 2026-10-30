<script setup lang="ts">
import type { DocumentFormat } from '~/shared/print/formats'
import { PAYMENT_METHOD, PAYMENT_STATUS, promotionLabel } from '~/shared/status/sales'
import { formatDateTime } from '~/shared/utils/dates'
import { formatMoney } from '~/shared/utils/money'
import type { AdminOrder, StoreProfile } from '../types'

/**
 * Ticket de un pedido (PLAN_API_1.7 §3.2, API_SPEC §15.8): datos de la tienda, líneas, descuentos,
 * totales con IVA incluido, pago y el código público en Code 128, que se escanea en Pedidos. En
 * térmica cada línea va en dos renglones; en carta, en tabla. No es comprobante fiscal.
 */
const props = defineProps<{ order: AdminOrder; profile: StoreProfile; format: DocumentFormat }>()

const narrow = computed(() => props.format !== 'letter')
const options = (o: Record<string, unknown>) => Object.values(o).map(String).join(' / ')

const payment = computed(() => {
  const p = props.order.payment
  if (props.order.paidAt && p)
    return [p.method ? PAYMENT_METHOD[p.method] : null, PAYMENT_STATUS[p.status]?.label ?? p.status]
      .filter(Boolean)
      .join(' · ')
  return 'Pendiente de pago'
})

const totals = computed(() => {
  const o = props.order
  return [
    { label: 'Subtotal', value: formatMoney(o.subtotal) },
    ...(o.discountTotal.amount
      ? [
          {
            label: o.promotion ? `Descuento (${promotionLabel(o.promotion)})` : 'Descuento',
            value: `−${formatMoney(o.discountTotal)}`,
          },
        ]
      : []),
    ...(o.fulfillment === 'SHIPPING' || o.shippingCost.amount
      ? [{ label: 'Envío', value: formatMoney(o.shippingCost) }]
      : []),
  ]
})
</script>

<template>
  <article
    :class="[
      'bg-white text-black',
      narrow ? 'mx-auto font-mono text-[11px] leading-snug' : 'mx-auto max-w-[190mm] text-sm',
      format === 'thermal58' && 'w-[48mm]',
      format === 'thermal80' && 'w-[72mm]',
    ]"
    aria-label="Ticket"
  >
    <header
      :class="narrow ? 'text-center' : 'flex justify-between gap-6 border-b border-black pb-3'"
    >
      <div>
        <p :class="['font-bold', narrow ? 'text-sm' : 'text-lg']">{{ profile.name }}</p>
        <p v-if="profile.address">{{ profile.address }}</p>
        <p v-if="profile.taxId">RFC {{ profile.taxId }}</p>
        <p v-if="profile.phone">Tel. {{ profile.phone }}</p>
      </div>
      <div :class="narrow ? 'mt-2' : 'text-right'">
        <p class="font-bold">Pedido {{ order.publicCode }}</p>
        <p>{{ formatDateTime(order.placedAt) }}</p>
        <p v-if="order.fulfilledFrom">{{ order.fulfilledFrom.name }}</p>
      </div>
    </header>

    <div v-if="narrow" class="my-2 border-y border-dashed border-black py-1">
      <div v-for="line in order.lines" :key="line.id" class="py-1">
        <p>
          {{ line.productName
          }}<template v-if="Object.keys(line.variantOptions).length">
            ({{ options(line.variantOptions) }})</template
          >
        </p>
        <p class="flex justify-between gap-2">
          <span>{{ line.quantity }} × {{ formatMoney(line.unitPrice) }}</span>
          <span>{{ formatMoney(line.lineTotal) }}</span>
        </p>
        <p v-if="line.discountAmount.amount" class="flex justify-between gap-2">
          <span>Descuento</span><span>−{{ formatMoney(line.discountAmount) }}</span>
        </p>
      </div>
    </div>
    <table v-else class="my-4 w-full border-collapse">
      <caption class="sr-only">
        Productos
      </caption>
      <thead>
        <tr class="border-b border-black text-left">
          <th scope="col" class="py-1">Producto</th>
          <th scope="col" class="py-1">SKU</th>
          <th scope="col" class="py-1 text-right">Cantidad</th>
          <th scope="col" class="py-1 text-right">Precio</th>
          <th scope="col" class="py-1 text-right">Descuento</th>
          <th scope="col" class="py-1 text-right">Importe</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="line in order.lines" :key="line.id" class="border-b border-gray-300">
          <td class="py-1">
            {{ line.productName
            }}<template v-if="Object.keys(line.variantOptions).length">
              ({{ options(line.variantOptions) }})</template
            >
          </td>
          <td class="py-1">{{ line.sku }}</td>
          <td class="py-1 text-right">{{ line.quantity }}</td>
          <td class="py-1 text-right">{{ formatMoney(line.unitPrice) }}</td>
          <td class="py-1 text-right">
            {{ line.discountAmount.amount ? `−${formatMoney(line.discountAmount)}` : '—' }}
          </td>
          <td class="py-1 text-right">{{ formatMoney(line.lineTotal) }}</td>
        </tr>
      </tbody>
    </table>

    <dl :class="['grid grid-cols-[1fr_auto] gap-x-3', !narrow && 'ml-auto w-72']">
      <template v-for="t in totals" :key="t.label">
        <dt>{{ t.label }}</dt>
        <dd class="text-right">{{ t.value }}</dd>
      </template>
      <dt class="font-bold">Total</dt>
      <dd class="text-right font-bold">{{ formatMoney(order.grandTotal) }}</dd>
      <dt>IVA incluido</dt>
      <dd class="text-right">{{ formatMoney(order.taxTotal) }}</dd>
      <dt>Pago</dt>
      <dd class="text-right">{{ payment }}</dd>
    </dl>

    <div :class="['mt-3 flex flex-col items-center', !narrow && 'items-start']">
      <BarcodeSvg
        bcid="code128"
        :text="order.publicCode.replace('-', '')"
        :height="8"
        :max-width="narrow ? 46 : 60"
        :class="narrow ? 'h-[12mm]' : 'h-[14mm]'"
      />
      <p class="mt-1">{{ order.publicCode }}</p>
    </div>
    <p :class="['mt-3 whitespace-pre-line', narrow && 'text-center']">
      {{ profile.ticketFooter }}
    </p>
  </article>
</template>
