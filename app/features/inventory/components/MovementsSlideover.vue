<script setup lang="ts">
import { formatDateTime } from '~/shared/utils/dates'
import { useStockMovements } from '../api'
import { MOVEMENT_TYPE, MOVEMENT_TYPE_OPTIONS, REASON_LABEL } from '../status'
import type { StockItem } from '../types'

/** Movimientos de un stock item, del más reciente al más antiguo, con paginación por cursor. */
const props = defineProps<{ item: StockItem }>()
const open = defineModel<boolean>('open', { required: true })

const types = ref<string[]>([])
const from = ref('')
const to = ref('')
const filters = computed(() => ({
  type: types.value.length ? types.value.join(',') : undefined,
  from: from.value || undefined,
  to: to.value || undefined,
}))

const { data, isPending, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
  useStockMovements(() => props.item.id, filters)
const movements = computed(() => data.value?.pages.flatMap((p) => p.data) ?? [])
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="`Movimientos de ${item.sku}`"
    :description="item.productTitle"
  >
    <template #body>
      <div class="space-y-4">
        <div class="grid gap-2 sm:grid-cols-3">
          <USelectMenu
            v-model="types"
            :items="MOVEMENT_TYPE_OPTIONS"
            value-key="value"
            label-key="label"
            multiple
            placeholder="Todos los tipos"
            aria-label="Filtrar por tipo"
          />
          <UInput v-model="from" type="date" aria-label="Desde" />
          <UInput v-model="to" type="date" aria-label="Hasta" />
        </div>

        <QueryState
          :loading="isPending"
          :error="error"
          :empty="movements.length === 0"
          empty-title="Sin movimientos"
          @retry="refetch()"
        >
          <ul
            class="divide-y divide-default rounded-md border border-default"
            aria-label="Movimientos"
          >
            <li
              v-for="m in movements"
              :key="m.id"
              class="flex items-start justify-between gap-3 p-3 text-sm"
            >
              <div class="space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <StatusBadge :value="m.type" :styles="MOVEMENT_TYPE" />
                  <span v-if="m.reasonCode" class="text-muted">{{
                    REASON_LABEL[m.reasonCode] ?? m.reasonCode
                  }}</span>
                </div>
                <p v-if="m.note" class="break-words">{{ m.note }}</p>
                <p class="text-xs text-muted">
                  {{ formatDateTime(m.createdAt) }}{{ m.actorId === null ? ' · Sistema' : '' }}
                </p>
              </div>
              <div class="text-right whitespace-nowrap">
                <p :class="['font-semibold', m.quantity > 0 ? 'text-success' : 'text-error']">
                  {{ m.quantity > 0 ? '+' : '' }}{{ m.quantity }}
                </p>
                <p class="text-xs text-muted">Quedan {{ m.onHandAfter }}</p>
              </div>
            </li>
          </ul>
          <UButton
            v-if="hasNextPage"
            class="mt-3"
            block
            color="neutral"
            variant="outline"
            :loading="isFetchingNextPage"
            @click="fetchNextPage()"
            >Cargar más</UButton
          >
        </QueryState>
      </div>
    </template>
  </USlideover>
</template>
