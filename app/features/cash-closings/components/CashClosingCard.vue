<script setup lang="ts">
import { formatDateTime } from '~/shared/utils/dates'
import { formatMoney } from '~/shared/utils/money'
import { differenceTone, staffLabel } from '../status'
import type { CashClosing, CashSummary } from '../types'

/** Un cierre de caja (UC-ORD-17): no se edita; lo que llegó después se muestra aparte. */
const props = defineProps<{
  closing: CashClosing
  afterClosing?: CashSummary['afterClosing']
  ownId?: string
}>()

const tone = computed(() => differenceTone(props.closing.difference.amount))
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="font-semibold">Caja cerrada</h3>
        <UBadge :color="tone.color" variant="subtle">{{ tone.label }}</UBadge>
      </div>
    </template>
    <div class="space-y-3">
      <DetailList
        :items="[
          { label: 'Efectivo esperado', value: formatMoney(closing.expectedCash) },
          { label: 'Efectivo contado', value: formatMoney(closing.countedCash) },
          { label: 'Diferencia', value: formatMoney(closing.difference) },
          { label: 'Nota', value: closing.note },
          {
            label: 'Cerró',
            value: staffLabel(closing.closedBy, ownId),
            mono: closing.closedBy !== ownId,
          },
          { label: 'Cuándo', value: formatDateTime(closing.closedAt) },
        ]"
      />
      <UAlert
        v-if="afterClosing && (afterClosing.paymentCount || afterClosing.refundCount)"
        color="warning"
        variant="subtle"
        icon="i-lucide-clock-alert"
        title="Hubo movimientos después del cierre"
        :description="`${afterClosing.paymentCount} cobros por ${formatMoney(afterClosing.paymentAmount)} (${formatMoney(afterClosing.cashAmount)} en efectivo) y ${afterClosing.refundCount} reembolsos por ${formatMoney(afterClosing.refundAmount)}. Ya van en las cifras del día, no en las del cierre.`"
      />
    </div>
  </UCard>
</template>
