<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui'
import { usePromotions } from '~/features/promotions/api'
import {
  APPLIES_TO_OPTIONS,
  CHANNEL_OPTIONS,
  KIND_OPTIONS,
  PROMOTION_CHANNEL,
  PROMOTION_SORT_OPTIONS,
  PROMOTION_STATUS,
  PROMOTION_STATUS_OPTIONS,
  discountLabel,
  usesLabel,
} from '~/features/promotions/status'
import type { PromotionChannel, PromotionSummary } from '~/features/promotions/types'
import { useListParams } from '~/shared/api/use-list-params'
import { useSessionStore } from '~/shared/auth/session.store'
import { formatDateTime } from '~/shared/utils/dates'
import { useDebounced } from '~/shared/utils/debounce'
import { formatMoney } from '~/shared/utils/money'

definePageMeta({ title: 'Promociones', permission: 'promotions.read' })

const session = useSessionStore()
const canManage = computed(() => session.can('promotions.manage'))
const list = useListParams({ filters: ['q', 'kind', 'status', 'channel', 'appliesTo', 'sort'] })
const filters = list.filters

const search = ref(filters.value.q ?? '')
const debouncedSearch = useDebounced(search)
watch(debouncedSearch, (q) => list.setFilter('q', q.trim() || undefined))

const { data, isPending, error, refetch, isFetching } = usePromotions(() => ({
  page: list.page.value,
  pageSize: list.pageSize.value,
  q: filters.value.q,
  kind: filters.value.kind,
  status: filters.value.status,
  channel: filters.value.channel,
  appliesTo: filters.value.appliesTo,
  sort: filters.value.sort ?? '-startsAt',
}))

const hasFilters = computed(
  () =>
    !!(
      filters.value.q ||
      filters.value.kind ||
      filters.value.status ||
      filters.value.channel ||
      filters.value.appliesTo
    ),
)
function clearFilters() {
  search.value = ''
  list.resetFilters()
}

const columns: TableColumn<PromotionSummary>[] = [
  { accessorKey: 'name', header: 'Promoción' },
  { id: 'discount', header: 'Descuento' },
  { id: 'channels', header: 'Canales' },
  { id: 'validity', header: 'Vigencia' },
  { accessorKey: 'status', header: 'Estado' },
  { id: 'uses', header: 'Usos' },
]

const channels = (p: PromotionSummary) =>
  p.channels.map((c) => PROMOTION_CHANNEL[c as PromotionChannel] ?? c).join(' y ')

function openRow(_: Event, row: TableRow<PromotionSummary>) {
  navigateTo(`/promociones/${row.original.id}`)
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end gap-2">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Nombre o código de cupón"
        aria-label="Buscar promociones"
        class="w-full sm:w-64"
      />
      <USelect
        :model-value="filters.kind"
        :items="KIND_OPTIONS"
        placeholder="Automáticas y cupones"
        aria-label="Filtrar por tipo"
        class="w-full sm:w-48"
        @update:model-value="(v) => list.setFilter('kind', v as string)"
      />
      <USelect
        :model-value="filters.status"
        :items="PROMOTION_STATUS_OPTIONS"
        placeholder="Todos los estados"
        aria-label="Filtrar por estado"
        class="w-full sm:w-40"
        @update:model-value="(v) => list.setFilter('status', v as string)"
      />
      <USelect
        :model-value="filters.channel"
        :items="CHANNEL_OPTIONS"
        placeholder="Todos los canales"
        aria-label="Filtrar por canal"
        class="w-full sm:w-40"
        @update:model-value="(v) => list.setFilter('channel', v as string)"
      />
      <USelect
        :model-value="filters.appliesTo"
        :items="APPLIES_TO_OPTIONS"
        placeholder="Cualquier alcance"
        aria-label="Filtrar por alcance"
        class="w-full sm:w-44"
        @update:model-value="(v) => list.setFilter('appliesTo', v as string)"
      />
      <USelect
        :model-value="filters.sort ?? '-startsAt'"
        :items="PROMOTION_SORT_OPTIONS"
        aria-label="Ordenar"
        class="w-full sm:w-52"
        @update:model-value="
          (v) => list.setFilter('sort', v === '-startsAt' ? undefined : (v as string))
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
      <div class="flex-1" />
      <UButton v-if="canManage" icon="i-lucide-plus" to="/promociones/nueva"
        >Nueva promoción</UButton
      >
    </div>

    <QueryState
      :loading="isPending"
      :error="error"
      :empty="data?.data.length === 0"
      empty-title="No hay promociones"
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
        <template #name-cell="{ row }">
          <NuxtLink
            :to="`/promociones/${row.original.id}`"
            class="font-medium hover:underline"
            @click.stop
            >{{ row.original.name }}</NuxtLink
          >
          <div class="text-xs text-muted">
            <template v-if="row.original.code"
              >Cupón <code>{{ row.original.code }}</code></template
            >
            <template v-else>Automática</template>
            ·
            {{
              row.original.targetCount ? `${row.original.targetCount} destinos` : 'Toda la compra'
            }}
          </div>
        </template>
        <template #discount-cell="{ row }">
          {{ discountLabel(row.original) }}
          <div v-if="row.original.minimumSubtotal" class="text-xs text-muted">
            Desde {{ formatMoney(row.original.minimumSubtotal) }}
          </div>
        </template>
        <template #channels-cell="{ row }">{{ channels(row.original) }}</template>
        <template #validity-cell="{ row }">
          <div class="text-sm">{{ formatDateTime(row.original.startsAt) }}</div>
          <div class="text-xs text-muted">
            hasta {{ row.original.endsAt ? formatDateTime(row.original.endsAt) : 'sin fin' }}
          </div>
        </template>
        <template #status-cell="{ row }">
          <StatusBadge :value="row.original.status" :styles="PROMOTION_STATUS" />
        </template>
        <template #uses-cell="{ row }">{{ usesLabel(row.original) }}</template>
      </UTable>
      <ListPagination class="mt-3" :meta="data?.meta" @update:page="list.setPage" />
    </QueryState>
  </div>
</template>
