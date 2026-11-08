<script setup lang="ts">
import { useCashClosings, useCashSummary } from '~/features/cash-closings/api'
import CashClosingCard from '~/features/cash-closings/components/CashClosingCard.vue'
import CashDayFigures from '~/features/cash-closings/components/CashDayFigures.vue'
import CloseCashForm from '~/features/cash-closings/components/CloseCashForm.vue'
import { differenceTone, staffLabel } from '~/features/cash-closings/status'
import { useTransfers, useWarehouses } from '~/features/inventory/api'
import { useSessionStore } from '~/shared/auth/session.store'
import { useDeviceWarehouse } from '~/shared/device/device-warehouse'
import { formatCalendarDate, formatDateTime, mexicoDate } from '~/shared/utils/dates'
import { formatMoney } from '~/shared/utils/money'

definePageMeta({ title: 'Corte de caja', permission: 'cash-closings.read' })

/**
 * El corte de caja de un local (UC-ORD-16 y 17, D-099): empieza en el local de este equipo y en hoy
 * de la Ciudad de México; el local y el día van en la URL para compartir o volver a un día.
 */
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const device = useDeviceWarehouse()
const canClose = computed(() => session.can('cash-closings.manage'))
const ownId = computed(() => session.account?.id)

const warehouses = useWarehouses({ enabled: computed(() => session.can('inventory.read')) })
const warehouseOptions = computed(() =>
  (warehouses.data.value ?? []).map((w) => ({
    value: w.id,
    label: `${w.name} (${w.code})${w.status === 'ACTIVE' ? '' : ' · desactivado'}`,
  })),
)
const warehouseName = computed(
  () => warehouseOptions.value.find((o) => o.value === warehouseId.value)?.label ?? '',
)

const today = mexicoDate()
const DATE = /^\d{4}-\d{2}-\d{2}$/
const queryText = (key: string) => (typeof route.query[key] === 'string' ? route.query[key] : '')
const warehouseId = computed({
  get: () => queryText('local'),
  set: (local: string) => void router.replace({ query: { ...route.query, local } }),
})
const date = computed({
  get: () => (DATE.test(queryText('dia')) ? queryText('dia') : today),
  set: (dia: string) => void router.replace({ query: { ...route.query, dia } }),
})
watch(
  () => warehouses.data.value,
  (list) => {
    if (warehouseId.value || !list) return
    const initial = device.initial(list.filter((w) => w.status === 'ACTIVE').map((w) => w.id))
    if (initial) warehouseId.value = initial
  },
  { immediate: true },
)

const summary = useCashSummary(() => ({ warehouseId: warehouseId.value, date: date.value }))
const history = useCashClosings(() => ({ warehouseId: warehouseId.value, pageSize: 31 }))
const future = computed(() => date.value > today)

// Préstamos para mostrar sin cerrar que salen de este local o llegan a él (ADR-0172 de base-shop): se
// avisa antes del corte, sin impedirlo, por si el producto prestado ya se vendió en el otro local.
const openLoans = useTransfers(
  () => ({ page: 1, pageSize: 1, kind: 'LOAN', status: 'OPEN', warehouseId: warehouseId.value }),
  { enabled: computed(() => !!warehouseId.value && session.can('inventory.read')) },
)
const openLoanCount = computed(() => openLoans.data.value?.meta.totalItems ?? 0)
</script>

<template>
  <div class="space-y-4">
    <p class="max-w-3xl text-sm text-muted">
      Lo vendido y cobrado en la tienda física de un local en un día de la Ciudad de México, y el
      cierre con el efectivo contado. Los pedidos en línea pagados en la tienda no entran: no tienen
      local.
    </p>

    <div class="flex flex-wrap items-end gap-3">
      <UFormField label="Local">
        <USelect
          v-model="warehouseId"
          :items="warehouseOptions"
          :loading="warehouses.isPending.value"
          placeholder="Elige el local"
          aria-label="Local"
          class="w-72"
        />
      </UFormField>
      <UFormField label="Día">
        <UInput v-model="date" type="date" :max="today" aria-label="Día" class="w-44" />
      </UFormField>
      <UButton
        v-if="date !== today"
        color="neutral"
        variant="ghost"
        icon="i-lucide-calendar-check"
        @click="date = today"
        >Hoy</UButton
      >
    </div>
    <p v-if="!session.can('inventory.read')" class="text-sm text-muted">
      Elegir el local requiere el permiso para consultar el inventario.
    </p>
    <p v-else-if="!warehouseId" class="text-sm text-muted">Elige el local para ver su corte.</p>

    <template v-if="warehouseId">
      <UAlert
        v-if="openLoanCount > 0"
        color="warning"
        variant="subtle"
        icon="i-lucide-package-open"
        :title="
          openLoanCount === 1
            ? 'Hay 1 préstamo para mostrar sin cerrar en este local'
            : `Hay ${openLoanCount} préstamos para mostrar sin cerrar en este local`
        "
        description="Puedes hacer el corte, pero ciérralos con lo que regresó para que las existencias de cada local cuadren."
        :actions="[
          {
            label: 'Ver los préstamos',
            to: { path: '/inventario/traslados', query: { view: 'loans', warehouseId } },
            color: 'warning',
            variant: 'outline',
          },
        ]"
      />
      <UAlert
        v-if="future"
        color="neutral"
        variant="subtle"
        icon="i-lucide-calendar-clock"
        title="Ese día todavía no llega"
      />
      <QueryState
        v-else
        :loading="summary.isPending.value"
        :error="summary.error.value"
        @retry="summary.refetch()"
      >
        <div v-if="summary.data.value" class="space-y-4">
          <UCard>
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h2 class="font-semibold">
                  {{ warehouseName }} · {{ formatCalendarDate(summary.data.value.date) }}
                </h2>
                <UButton
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-refresh-cw"
                  :loading="summary.isFetching.value"
                  @click="summary.refetch()"
                  >Actualizar</UButton
                >
              </div>
            </template>
            <CashDayFigures :day="summary.data.value" :own-id="ownId" />
          </UCard>

          <CashClosingCard
            v-if="summary.data.value.closing"
            :closing="summary.data.value.closing"
            :after-closing="summary.data.value.afterClosing"
            :own-id="ownId"
          />
          <CloseCashForm
            v-else-if="canClose"
            :key="`${warehouseId}-${date}`"
            :warehouse-id="warehouseId"
            :warehouse-name="warehouseName"
            :date="date"
            :expected-cash="summary.data.value.expectedCash"
          />
          <p v-else class="text-sm text-muted">
            El día sigue abierto. Cerrar la caja requiere el permiso de corte de caja.
          </p>
        </div>
      </QueryState>

      <UCard>
        <template #header><h2 class="font-semibold">Cierres anteriores</h2></template>
        <QueryState
          :loading="history.isPending.value"
          :error="history.error.value"
          @retry="history.refetch()"
        >
          <p v-if="history.data.value?.data.length === 0" class="text-sm text-muted">
            Este local todavía no tiene cierres.
          </p>
          <table v-else class="w-full text-sm">
            <thead class="text-left text-muted">
              <tr>
                <th class="py-1 font-normal">Día</th>
                <th class="py-1 text-right font-normal">Esperado</th>
                <th class="py-1 text-right font-normal">Contado</th>
                <th class="py-1 text-right font-normal">Diferencia</th>
                <th class="py-1 font-normal">Cerró</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-for="c in history.data.value?.data ?? []" :key="c.id">
                <td class="py-1">
                  <UButton variant="link" class="px-0" @click="date = c.date">{{
                    formatCalendarDate(c.date)
                  }}</UButton>
                </td>
                <td class="py-1 text-right">{{ formatMoney(c.expectedCash) }}</td>
                <td class="py-1 text-right">{{ formatMoney(c.countedCash) }}</td>
                <td class="py-1 text-right">
                  <UBadge :color="differenceTone(c.difference.amount).color" variant="subtle">{{
                    formatMoney(c.difference)
                  }}</UBadge>
                </td>
                <td class="py-1">
                  <span
                    :class="c.closedBy !== ownId ? 'font-mono text-xs break-all' : ''"
                    :title="formatDateTime(c.closedAt)"
                    >{{ staffLabel(c.closedBy, ownId) }}</span
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </QueryState>
      </UCard>
    </template>
  </div>
</template>
