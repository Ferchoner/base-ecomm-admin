<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui'
import { useEventDeliveries, useRetryDeliveries } from '~/features/events/api'
import DeliveryDetailSlideover from '~/features/events/components/DeliveryDetailSlideover.vue'
import RetryDeliveryButton from '~/features/events/components/RetryDeliveryButton.vue'
import {
  DELIVERY_SORT_OPTIONS,
  DELIVERY_STATUS,
  DELIVERY_STATUS_FILTER,
  MAX_ATTEMPTS,
  bulkRetryScope,
  canRetryDelivery,
  deliveryMoment,
  deliveryStatusQuery,
} from '~/features/events/status'
import type { EventDelivery } from '~/features/events/types'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import { useListParams } from '~/shared/api/use-list-params'
import { useConfirm } from '~/shared/ui/use-confirm'
import { formatDateTime } from '~/shared/utils/dates'
import { useDebounced } from '~/shared/utils/debounce'

definePageMeta({ title: 'Eventos', permission: 'events.manage' })

const list = useListParams({ filters: ['status', 'eventType', 'handler', 'sort'] })
const filters = list.filters

const eventType = ref(filters.value.eventType ?? '')
const handler = ref(filters.value.handler ?? '')
const debouncedEventType = useDebounced(eventType)
const debouncedHandler = useDebounced(handler)
watch(debouncedEventType, (v) => list.setFilter('eventType', v.trim() || undefined))
watch(debouncedHandler, (v) => list.setFilter('handler', v.trim() || undefined))

const { data, isPending, error, refetch, isFetching } = useEventDeliveries(() => ({
  page: list.page.value,
  pageSize: list.pageSize.value,
  status: deliveryStatusQuery(filters.value.status),
  eventType: filters.value.eventType,
  handler: filters.value.handler,
  sort: filters.value.sort ?? '-occurredAt',
}))

const hasFilters = computed(() =>
  Object.entries(filters.value).some(([k, v]) => k !== 'sort' && v !== undefined),
)
function clearFilters() {
  eventType.value = ''
  handler.value = ''
  list.resetFilters()
}

const selected = ref<EventDelivery | null>(null)
const detailOpen = computed({
  get: () => selected.value !== null,
  set: (open) => {
    if (!open) selected.value = null
  },
})

const confirm = useConfirm()
const toast = useToast()
const retryAll = useRetryDeliveries()

/** Reintenta las fallidas que coinciden con los filtros de evento y manejador (API_SPEC §22.3). */
async function onRetryAll() {
  const scope = {
    eventType: filters.value.eventType,
    handler: filters.value.handler,
  }
  const ok = await confirm({
    title: 'Reintentar entregas fallidas',
    description: `Se reintentan ${bulkRetryScope(scope)}. Hazlo después de corregir lo que las hizo fallar: cada una vuelve a tener ${MAX_ATTEMPTS} intentos.`,
    confirmLabel: 'Reintentar',
    color: 'warning',
  })
  if (!ok) return
  try {
    const { retried } = await retryAll.mutateAsync(scope)
    if (retried === 0) notifySuccess(toast, 'No había entregas fallidas que reintentar')
    else
      notifySuccess(
        toast,
        retried === 1 ? 'Se reactivó 1 entrega' : `Se reactivaron ${retried} entregas`,
        'El sistema las reintenta en el siguiente minuto.',
      )
  } catch (e) {
    notifyProblem(toast, e)
  }
}

const columns: TableColumn<EventDelivery>[] = [
  { accessorKey: 'eventType', header: 'Evento' },
  { accessorKey: 'handler', header: 'Manejador' },
  { accessorKey: 'status', header: 'Estado' },
  { accessorKey: 'attempts', header: 'Intentos' },
  { id: 'when', header: 'Próximo intento o entrega' },
  { id: 'actions', header: () => h('span', { class: 'sr-only' }, 'Acciones') },
]

function openRow(_: Event, row: TableRow<EventDelivery>) {
  selected.value = row.original
}
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-muted">
      Entregas de los eventos internos a sus manejadores (correos, cambios de estado y otros
      efectos). Una entrega queda fallida después de {{ MAX_ATTEMPTS }} intentos.
    </p>

    <div class="flex flex-wrap items-end gap-2">
      <USelect
        :model-value="filters.status ?? 'FAILED'"
        :items="DELIVERY_STATUS_FILTER"
        aria-label="Filtrar por estado"
        class="w-full sm:w-44"
        @update:model-value="
          (v) => list.setFilter('status', v === 'FAILED' ? undefined : (v as string))
        "
      />
      <UInput
        v-model="eventType"
        icon="i-lucide-zap"
        placeholder="Tipo de evento"
        aria-label="Filtrar por tipo de evento"
        :maxlength="100"
        class="w-full sm:w-60"
      />
      <UInput
        v-model="handler"
        icon="i-lucide-cog"
        placeholder="Manejador"
        aria-label="Filtrar por manejador"
        :maxlength="200"
        class="w-full sm:w-60"
      />
      <USelect
        :model-value="filters.sort ?? '-occurredAt'"
        :items="DELIVERY_SORT_OPTIONS"
        aria-label="Ordenar"
        class="w-full sm:w-56"
        @update:model-value="
          (v) => list.setFilter('sort', v === '-occurredAt' ? undefined : (v as string))
        "
      />
      <UButton
        v-if="hasFilters"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        @click="clearFilters"
        >Limpiar</UButton
      >
      <UButton
        class="sm:ms-auto"
        color="warning"
        variant="soft"
        icon="i-lucide-rotate-ccw"
        :loading="retryAll.isPending.value"
        @click="onRetryAll"
        >Reintentar fallidas</UButton
      >
    </div>

    <QueryState
      :loading="isPending"
      :error="error"
      :empty="data?.data.length === 0"
      :empty-title="filters.status ? 'No hay entregas' : 'No hay entregas fallidas'"
      :empty-description="hasFilters ? 'Prueba con otros filtros.' : undefined"
      @retry="refetch()"
    >
      <UTable
        :data="data?.data ?? []"
        :columns="columns"
        :loading="isFetching"
        class="rounded-md border border-default"
        :ui="{ tr: 'cursor-pointer' }"
        @select="openRow"
      >
        <template #eventType-cell="{ row }">
          <button
            type="button"
            class="font-medium hover:underline"
            @click.stop="selected = row.original"
          >
            {{ row.original.eventType }}
          </button>
          <div class="text-xs text-muted">{{ formatDateTime(row.original.occurredAt) }}</div>
        </template>
        <template #handler-cell="{ row }">
          <code class="text-xs break-all">{{ row.original.handler }}</code>
        </template>
        <template #status-cell="{ row }">
          <StatusBadge :value="row.original.status" :styles="DELIVERY_STATUS" />
        </template>
        <template #attempts-cell="{ row }">{{ row.original.attempts }}/{{ MAX_ATTEMPTS }}</template>
        <template #when-cell="{ row }">
          <span v-if="deliveryMoment(row.original).at">{{
            formatDateTime(deliveryMoment(row.original).at)
          }}</span>
          <span v-else class="text-muted">Sin reintentos automáticos</span>
        </template>
        <template #actions-cell="{ row }">
          <RetryDeliveryButton
            v-if="canRetryDelivery(row.original.status)"
            :delivery-id="row.original.id"
            size="xs"
          />
        </template>
      </UTable>
      <ListPagination class="mt-3" :meta="data?.meta" @update:page="list.setPage" />
    </QueryState>

    <DeliveryDetailSlideover v-if="selected" v-model:open="detailOpen" :delivery="selected" />
  </div>
</template>
