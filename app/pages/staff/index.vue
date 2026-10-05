<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui'
import { useAllRoles, useStaffList } from '~/features/staff/api'
import StaffFormModal from '~/features/staff/components/StaffFormModal.vue'
import TemporaryPasswordDialog from '~/features/staff/components/TemporaryPasswordDialog.vue'
import {
  STAFF_SORT_OPTIONS,
  STAFF_STATUS,
  STAFF_STATUS_OPTIONS,
  staffName,
} from '~/features/staff/status'
import type { StaffUser, StaffWithPassword } from '~/features/staff/types'
import { useListParams } from '~/shared/api/use-list-params'
import { formatDateTime } from '~/shared/utils/dates'
import { useDebounced } from '~/shared/utils/debounce'

definePageMeta({ title: 'Staff', permission: 'staff.manage' })

const list = useListParams({ filters: ['q', 'status', 'roleId', 'sort'] })
const filters = list.filters

const search = ref(filters.value.q ?? '')
const debouncedSearch = useDebounced(search)
watch(debouncedSearch, (q) => list.setFilter('q', q.trim() || undefined))

const { data, isPending, error, refetch, isFetching } = useStaffList(() => ({
  page: list.page.value,
  pageSize: list.pageSize.value,
  q: filters.value.q,
  status: filters.value.status,
  roleId: filters.value.roleId,
  sort: filters.value.sort ?? '-createdAt',
}))
const { data: roles } = useAllRoles()
const roleOptions = computed(() =>
  (roles.value?.data ?? []).map((r) => ({ value: r.id, label: r.name })),
)

const hasFilters = computed(() =>
  Object.entries(filters.value).some(([k, v]) => k !== 'sort' && v !== undefined),
)
function clearFilters() {
  search.value = ''
  list.resetFilters()
}

const showCreate = ref(false)
const created = ref<StaffWithPassword | null>(null)

const columns: TableColumn<StaffUser>[] = [
  { id: 'name', header: 'Staff' },
  { accessorKey: 'status', header: 'Estado' },
  { id: 'roles', header: 'Roles' },
  { accessorKey: 'lastLoginAt', header: 'Último acceso' },
  { accessorKey: 'createdAt', header: 'Alta' },
]

function openRow(_: Event, row: TableRow<StaffUser>) {
  navigateTo(`/staff/${row.original.id}`)
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end gap-2">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Email o nombre"
        aria-label="Buscar staff"
        class="w-full sm:w-64"
      />
      <USelect
        :model-value="filters.status"
        :items="STAFF_STATUS_OPTIONS"
        placeholder="Todos los estados"
        aria-label="Filtrar por estado"
        class="w-full sm:w-40"
        @update:model-value="(v) => list.setFilter('status', v as string)"
      />
      <USelect
        :model-value="filters.roleId"
        :items="roleOptions"
        placeholder="Todos los roles"
        aria-label="Filtrar por rol"
        class="w-full sm:w-48"
        @update:model-value="(v) => list.setFilter('roleId', v as string)"
      />
      <USelect
        :model-value="filters.sort ?? '-createdAt'"
        :items="STAFF_SORT_OPTIONS"
        aria-label="Ordenar"
        class="w-full sm:w-48"
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
      <UButton icon="i-lucide-plus" @click="showCreate = true">Nuevo staff</UButton>
    </div>

    <QueryState
      :loading="isPending"
      :error="error"
      :empty="data?.data.length === 0"
      empty-title="No hay staff"
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
            :to="`/staff/${row.original.id}`"
            class="font-medium hover:underline"
            @click.stop
            >{{ staffName(row.original) }}</NuxtLink
          >
          <div class="text-xs text-muted">{{ row.original.email }}</div>
        </template>
        <template #status-cell="{ row }">
          <div class="flex flex-wrap gap-1">
            <StatusBadge :value="row.original.status" :styles="STAFF_STATUS" />
            <UBadge v-if="row.original.mustChangePassword" color="neutral" variant="outline"
              >Contraseña temporal</UBadge
            >
          </div>
        </template>
        <template #roles-cell="{ row }">{{
          row.original.roles.map((r) => r.name).join(', ')
        }}</template>
        <template #lastLoginAt-cell="{ row }">{{
          formatDateTime(row.original.lastLoginAt)
        }}</template>
        <template #createdAt-cell="{ row }">{{ formatDateTime(row.original.createdAt) }}</template>
      </UTable>
      <ListPagination class="mt-3" :meta="data?.meta" @update:page="list.setPage" />
    </QueryState>

    <StaffFormModal v-model:open="showCreate" @created="(r) => (created = r)" />
    <TemporaryPasswordDialog
      :email="created?.user.email ?? ''"
      :password="created?.temporaryPassword ?? null"
      @close="created = null"
    />
  </div>
</template>
