<script setup lang="ts">
import { useAuditLog } from '~/features/audit/api'
import AuditEntrySlideover from '~/features/audit/components/AuditEntrySlideover.vue'
import {
  AUDIT_ACTOR_TYPE,
  AUDIT_ACTOR_TYPE_OPTIONS,
  AUDIT_RESULT,
  AUDIT_RESULT_OPTIONS,
  AUDIT_RETENTION_MONTHS,
  isValidActionFilter,
} from '~/features/audit/status'
import type { AuditEntry, AuditFilters } from '~/features/audit/types'
import { useListParams } from '~/shared/api/use-list-params'
import { formatDateTime } from '~/shared/utils/dates'
import { useDebounced } from '~/shared/utils/debounce'

definePageMeta({ title: 'Auditoría', permission: 'audit.read' })

const list = useListParams({
  filters: ['action', 'actorType', 'actorId', 'result', 'resourceType', 'resourceId', 'from', 'to'],
})
const filters = list.filters

const action = ref(filters.value.action ?? '')
const resourceType = ref(filters.value.resourceType ?? '')
const resourceId = ref(filters.value.resourceId ?? '')
const actionError = computed(() =>
  action.value.trim() && !isValidActionFilter(action.value.trim())
    ? 'Escribe un código exacto, como orders.cancel, o un prefijo terminado en .*, como orders.*'
    : undefined,
)
const debouncedAction = useDebounced(action)
const debouncedResourceType = useDebounced(resourceType)
const debouncedResourceId = useDebounced(resourceId)
watch(debouncedAction, (v) => {
  if (!actionError.value) list.setFilter('action', v.trim() || undefined)
})
watch(debouncedResourceType, (v) => list.setFilter('resourceType', v.trim() || undefined))
watch(debouncedResourceId, (v) => list.setFilter('resourceId', v.trim() || undefined))

// Los cambios de la URL (botones "Ver lo que hizo…", "Limpiar") se reflejan en los campos.
watch(
  () => [filters.value.action, filters.value.resourceType, filters.value.resourceId] as const,
  ([a, t, id]) => {
    if ((a ?? '') !== action.value.trim() && !actionError.value) action.value = a ?? ''
    if ((t ?? '') !== resourceType.value.trim()) resourceType.value = t ?? ''
    if ((id ?? '') !== resourceId.value.trim()) resourceId.value = id ?? ''
  },
)

const query = computed<AuditFilters>(() => ({ ...filters.value }))
const { data, isPending, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
  useAuditLog(query)
const entries = computed(() => data.value?.pages.flatMap((p) => p.data) ?? [])

const hasFilters = computed(() => Object.values(filters.value).some((v) => v !== undefined))
function clearFilters() {
  action.value = ''
  resourceType.value = ''
  resourceId.value = ''
  list.resetFilters()
}

const selected = ref<AuditEntry | null>(null)
const detailOpen = computed({
  get: () => selected.value !== null,
  set: (open) => {
    if (!open) selected.value = null
  },
})

/** Muestra lo que hizo un actor o el historial de un recurso, sin los demás filtros de texto. */
function filterBy(key: 'actorId' | 'resource', entry: AuditEntry) {
  selected.value = null
  const cleared = {
    action: undefined,
    actorType: undefined,
    result: undefined,
    actorId: undefined,
    resourceType: undefined,
    resourceId: undefined,
  }
  void list.setFilters(
    key === 'actorId'
      ? { ...cleared, actorId: entry.actorId }
      : { ...cleared, resourceType: entry.resourceType, resourceId: entry.resourceId },
  )
}
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-muted">
      Quién hizo qué y cuándo, del más reciente al más antiguo. Se consultan los últimos
      {{ AUDIT_RETENTION_MONTHS }} meses; los registros anteriores están archivados fuera del
      sistema.
    </p>

    <div class="flex flex-wrap items-start gap-2">
      <UFormField :error="actionError" class="w-full sm:w-64">
        <UInput
          v-model="action"
          icon="i-lucide-search"
          placeholder="Acción, como orders.*"
          aria-label="Filtrar por acción"
          class="w-full"
        />
      </UFormField>
      <USelect
        :model-value="filters.actorType"
        :items="AUDIT_ACTOR_TYPE_OPTIONS"
        placeholder="Cualquier actor"
        aria-label="Filtrar por tipo de actor"
        class="w-full sm:w-40"
        @update:model-value="(v) => list.setFilter('actorType', v as string)"
      />
      <USelect
        :model-value="filters.result"
        :items="AUDIT_RESULT_OPTIONS"
        placeholder="Cualquier resultado"
        aria-label="Filtrar por resultado"
        class="w-full sm:w-40"
        @update:model-value="(v) => list.setFilter('result', v as string)"
      />
      <UInput
        v-model="resourceType"
        placeholder="Tipo de recurso, como order"
        aria-label="Filtrar por tipo de recurso"
        :maxlength="100"
        class="w-full sm:w-52"
      />
      <UInput
        v-model="resourceId"
        placeholder="ID del recurso"
        aria-label="Filtrar por ID del recurso"
        :maxlength="200"
        class="w-full sm:w-64"
      />
      <DateRangeFilter
        label="Fecha"
        :from="filters.from"
        :to="filters.to"
        @update:from="(v) => list.setFilter('from', v)"
        @update:to="(v) => list.setFilter('to', v)"
      />
      <UButton
        v-if="hasFilters"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        @click="clearFilters"
        >Limpiar</UButton
      >
    </div>

    <div v-if="filters.actorId" class="flex flex-wrap items-center gap-2 text-sm">
      <span class="text-muted">Actor:</span>
      <code class="text-xs break-all">{{ filters.actorId }}</code>
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        aria-label="Quitar el filtro de actor"
        @click="list.setFilter('actorId', undefined)"
      />
    </div>

    <QueryState
      :loading="isPending"
      :error="error"
      :empty="entries.length === 0"
      empty-title="Sin registros"
      :empty-description="hasFilters ? 'Prueba con otros filtros.' : undefined"
      @retry="refetch()"
    >
      <ul class="divide-y divide-default rounded-md border border-default" aria-label="Registros">
        <li v-for="entry in entries" :key="entry.id">
          <button
            type="button"
            class="flex w-full flex-col gap-1 p-3 text-left text-sm hover:bg-elevated/50 sm:flex-row sm:items-center sm:gap-4"
            @click="selected = entry"
          >
            <span class="w-40 shrink-0 text-xs text-muted">{{
              formatDateTime(entry.occurredAt)
            }}</span>
            <span class="min-w-0 flex-1">
              <span class="font-mono font-medium break-all">{{ entry.action }}</span>
              <span v-if="entry.resourceType" class="block text-xs text-muted break-all">
                {{ entry.resourceType }}{{ entry.resourceId ? ` · ${entry.resourceId}` : '' }}
              </span>
            </span>
            <span class="text-xs text-muted">{{
              AUDIT_ACTOR_TYPE[entry.actorType] ?? entry.actorType
            }}</span>
            <StatusBadge :value="entry.result" :styles="AUDIT_RESULT" />
          </button>
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

    <AuditEntrySlideover
      v-if="selected"
      v-model:open="detailOpen"
      :entry="selected"
      @filter="filterBy"
    />
  </div>
</template>
