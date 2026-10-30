<script setup lang="ts">
import type { DocumentFormat } from '~/shared/print/formats'
import { formatDateTime } from '~/shared/utils/dates'
import { formatMoney } from '~/shared/utils/money'
import { WORK_ORDER_STATUS, equipmentLabel } from '../status'
import type { ServiceNote } from '../types'

/**
 * Nota de servicio de una orden de trabajo (API_SPEC §25.9, ADR-0165): la tienda, el folio en
 * Code 128, el cliente, el equipo, la falla, el diagnóstico, el costo estimado, las ventas que la
 * cobran, las condiciones y la línea de firma del cliente. La firma no se guarda.
 */
const props = defineProps<{ note: ServiceNote; format: DocumentFormat }>()

const narrow = computed(() => props.format !== 'letter')
const w = computed(() => props.note.workOrder)

const customer = computed(() => [
  { label: 'Cliente', value: w.value.customerName },
  { label: 'Teléfono', value: w.value.customerPhone },
  ...(w.value.customerEmail ? [{ label: 'Email', value: w.value.customerEmail }] : []),
])
const equipment = computed(() => [
  { label: 'Equipo', value: equipmentLabel(w.value) },
  { label: 'N.º de serie', value: w.value.serialNumber },
  { label: 'Accesorios', value: w.value.accessories },
  { label: 'Estado', value: w.value.equipmentCondition },
])
const service = computed(() => [
  { label: 'Falla reportada', value: w.value.reportedFault },
  ...(w.value.diagnosis ? [{ label: 'Diagnóstico', value: w.value.diagnosis }] : []),
  ...(w.value.workPerformed ? [{ label: 'Trabajo realizado', value: w.value.workPerformed }] : []),
  {
    label: 'Costo estimado',
    value: w.value.estimatedCost ? formatMoney(w.value.estimatedCost) : 'Por definir',
  },
])
const hidden = computed(() => !!(w.value.blockedAt || w.value.anonymizedAt))
</script>

<template>
  <article
    :class="[
      'bg-white text-black',
      narrow ? 'mx-auto font-mono text-[11px] leading-snug' : 'mx-auto max-w-[190mm] text-sm',
      format === 'thermal58' && 'w-[48mm]',
      format === 'thermal80' && 'w-[72mm]',
    ]"
    aria-label="Nota de servicio"
  >
    <header
      :class="narrow ? 'text-center' : 'flex justify-between gap-6 border-b border-black pb-3'"
    >
      <div>
        <p :class="['font-bold', narrow ? 'text-sm' : 'text-lg']">{{ note.store.name }}</p>
        <p v-if="note.store.address">{{ note.store.address }}</p>
        <p v-if="note.store.taxId">RFC {{ note.store.taxId }}</p>
        <p v-if="note.store.phone">Tel. {{ note.store.phone }}</p>
      </div>
      <div :class="narrow ? 'mt-2' : 'text-right'">
        <p class="font-bold">Nota de servicio {{ w.folio }}</p>
        <p>Recibido {{ formatDateTime(w.receivedAt) }}</p>
        <p>{{ WORK_ORDER_STATUS[w.status].label }}</p>
      </div>
    </header>

    <p v-if="hidden" class="mt-2 italic">Los datos del cliente ya no se conservan.</p>

    <section
      v-for="(group, i) in [customer, equipment, service]"
      :key="i"
      :class="narrow ? 'my-2 border-t border-dashed border-black pt-1' : 'my-3'"
    >
      <dl :class="narrow ? 'space-y-0.5' : 'grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1'">
        <template v-for="item in group" :key="item.label">
          <dt :class="narrow ? 'font-bold' : 'font-medium'">{{ item.label }}</dt>
          <dd class="whitespace-pre-line">{{ item.value ?? '—' }}</dd>
        </template>
      </dl>
    </section>

    <section
      v-if="w.sales.length"
      :class="narrow ? 'my-2 border-t border-dashed border-black pt-1' : 'my-3'"
    >
      <p class="font-bold">Ventas</p>
      <p v-for="s in w.sales" :key="s.orderId" class="flex justify-between gap-2">
        <span>{{ s.publicCode }} · {{ s.paid ? 'pagada' : 'por cobrar' }}</span>
        <span>{{ formatMoney(s.grandTotal) }}</span>
      </p>
      <dl :class="['mt-1 grid grid-cols-[1fr_auto] gap-x-3', !narrow && 'ml-auto w-72']">
        <dt>Cobrado</dt>
        <dd class="text-right">{{ formatMoney(w.paidTotal) }}</dd>
        <dt>Por cobrar</dt>
        <dd class="text-right">{{ formatMoney(w.unpaidTotal) }}</dd>
      </dl>
    </section>

    <div :class="['mt-3 flex flex-col items-center', !narrow && 'items-start']">
      <BarcodeSvg
        bcid="code128"
        :text="w.folio"
        :height="8"
        :max-width="narrow ? 46 : 60"
        :class="narrow ? 'h-[12mm]' : 'h-[14mm]'"
      />
      <p class="mt-1">{{ w.folio }}</p>
    </div>

    <p v-if="note.terms.trim()" :class="['mt-3 whitespace-pre-line', narrow && 'text-center']">
      {{ note.terms }}
    </p>

    <div :class="['mt-10 break-inside-avoid', narrow ? 'text-center' : 'w-80']">
      <div class="border-t border-black" />
      <p class="mt-1">Firma del cliente</p>
    </div>
  </article>
</template>
