<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui'
import { useCustomers } from '~/features/customers/api'
import GuestAnonymizationModal from '~/features/customers/components/GuestAnonymizationModal.vue'
import {
  CUSTOMER_SORT_OPTIONS,
  CUSTOMER_STATUS,
  CUSTOMER_STATUS_OPTIONS,
  EMAIL_VERIFIED_OPTIONS,
  customerName,
} from '~/features/customers/status'
import type { AdminCustomer } from '~/features/customers/types'
import { useListParams } from '~/shared/api/use-list-params'
import { useSessionStore } from '~/shared/auth/session.store'
import { formatDateTime } from '~/shared/utils/dates'
import { useDebounced } from '~/shared/utils/debounce'

definePageMeta({ title: 'Clientes', permission: 'customers.read' })

const session = useSessionStore()
const list = useListParams({
  filters: ['q', 'status', 'emailVerified', 'createdFrom', 'createdTo', 'sort'],
})
const filters = list.filters

const search = ref(filters.value.q ?? '')
const debouncedSearch = useDebounced(search)
watch(debouncedSearch, (q) => list.setFilter('q', q.trim() || undefined))

const { data, isPending, error, refetch, isFetching } = useCustomers(() => ({
  page: list.page.value,
  pageSize: list.pageSize.value,
  q: filters.value.q,
  status: filters.value.status,
  emailVerified:
    filters.value.emailVerified === undefined ? undefined : filters.value.emailVerified === 'true',
  createdFrom: filters.value.createdFrom,
  createdTo: filters.value.createdTo,
  sort: filters.value.sort ?? '-createdAt',
}))

const hasFilters = computed(() =>
  Object.entries(filters.value).some(([k, v]) => k !== 'sort' && v !== undefined),
)
function clearFilters() {
  search.value = ''
  list.resetFilters()
}
const showGuest = ref(false)

const columns: TableColumn<AdminCustomer>[] = [
  { id: 'name', header: 'Cliente' },
  { accessorKey: 'status', header: 'Estado' },
  { accessorKey: 'emailVerified', header: 'Email' },
  { accessorKey: 'createdAt', header: 'Registro' },
  { accessorKey: 'lastLoginAt', header: 'Último acceso' },
]

function openRow(_: Event, row: TableRow<AdminCustomer>) {
  navigateTo(`/clientes/${row.original.id}`)
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end gap-2">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Email, nombres o apellidos"
        aria-label="Buscar clientes"
        class="w-full sm:w-64"
      />
      <USelect
        :model-value="filters.status"
        :items="CUSTOMER_STATUS_OPTIONS"
        placeholder="Todos los estados"
        aria-label="Filtrar por estado"
        class="w-full sm:w-40"
        @update:model-value="(v) => list.setFilter('status', v as string)"
      />
      <USelect
        :model-value="filters.emailVerified"
        :items="EMAIL_VERIFIED_OPTIONS"
        placeholder="Verificado o no"
        aria-label="Filtrar por verificación del email"
        class="w-full sm:w-44"
        @update:model-value="(v) => list.setFilter('emailVerified', v as string)"
      />
      <DateRangeFilter
        label="Registrados"
        :from="filters.createdFrom"
        :to="filters.createdTo"
        @update:from="(v) => list.setFilter('createdFrom', v)"
        @update:to="(v) => list.setFilter('createdTo', v)"
      />
      <USelect
        :model-value="filters.sort ?? '-createdAt'"
        :items="CUSTOMER_SORT_OPTIONS"
        aria-label="Ordenar"
        class="w-full sm:w-52"
        @update:model-value="
          (v) => list.setFilter('sort', v === '-createdAt' ? undefined : (v as string))
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
      <UButton
        v-if="session.can('customers.manage')"
        color="neutral"
        variant="outline"
        icon="i-lucide-eraser"
        @click="showGuest = true"
        >Anonimizar invitado</UButton
      >
    </div>

    <QueryState
      :loading="isPending"
      :error="error"
      :empty="data?.data.length === 0"
      empty-title="No hay clientes"
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
            :to="`/clientes/${row.original.id}`"
            class="font-medium hover:underline"
            @click.stop
            >{{ customerName(row.original) }}</NuxtLink
          >
          <div class="text-xs text-muted">{{ row.original.email ?? 'Sin email' }}</div>
        </template>
        <template #status-cell="{ row }">
          <StatusBadge :value="row.original.status" :styles="CUSTOMER_STATUS" />
        </template>
        <template #emailVerified-cell="{ row }">{{
          row.original.emailVerified ? 'Verificado' : 'Sin verificar'
        }}</template>
        <template #createdAt-cell="{ row }">{{ formatDateTime(row.original.createdAt) }}</template>
        <template #lastLoginAt-cell="{ row }">{{
          formatDateTime(row.original.lastLoginAt)
        }}</template>
      </UTable>
      <ListPagination class="mt-3" :meta="data?.meta" @update:page="list.setPage" />
    </QueryState>

    <GuestAnonymizationModal v-model:open="showGuest" />
  </div>
</template>
