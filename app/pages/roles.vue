<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useDeleteRole, useRoles } from '~/features/staff/api'
import RoleFormModal from '~/features/staff/components/RoleFormModal.vue'
import { ROLE_SORT_OPTIONS } from '~/features/staff/status'
import type { Role } from '~/features/staff/types'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import { useListParams } from '~/shared/api/use-list-params'
import { useConfirm } from '~/shared/ui/use-confirm'
import { formatDateTime } from '~/shared/utils/dates'
import { useDebounced } from '~/shared/utils/debounce'

definePageMeta({ title: 'Roles', permission: 'staff.manage' })

const list = useListParams({ filters: ['q', 'sort'] })
const filters = list.filters
const search = ref(filters.value.q ?? '')
const debouncedSearch = useDebounced(search)
watch(debouncedSearch, (q) => list.setFilter('q', q.trim() || undefined))

const { data, isPending, error, refetch, isFetching } = useRoles(() => ({
  page: list.page.value,
  pageSize: list.pageSize.value,
  q: filters.value.q,
  sort: filters.value.sort ?? 'name',
}))

const editing = ref<Role | null>(null)
const showForm = ref(false)
function openForm(role: Role | null) {
  editing.value = role
  showForm.value = true
}

const remove = useDeleteRole()
const confirm = useConfirm()
const toast = useToast()
async function deleteRole(role: Role) {
  const ok = await confirm({
    title: `¿Eliminar el rol "${role.name}"?`,
    description: 'No se puede deshacer.',
    confirmLabel: 'Eliminar',
    color: 'error',
  })
  if (!ok) return
  try {
    await remove.mutateAsync(role.id)
    notifySuccess(toast, 'Rol eliminado')
  } catch (e) {
    notifyProblem(toast, e)
  }
}

const columns: TableColumn<Role>[] = [
  { accessorKey: 'name', header: 'Rol' },
  { id: 'permissions', header: 'Permisos' },
  { accessorKey: 'userCount', header: 'Usuarios' },
  { accessorKey: 'updatedAt', header: 'Modificado' },
  { id: 'actions', header: '' },
]
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end gap-2">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Nombre del rol"
        aria-label="Buscar roles"
        class="w-full sm:w-64"
      />
      <USelect
        :model-value="filters.sort ?? 'name'"
        :items="ROLE_SORT_OPTIONS"
        aria-label="Ordenar"
        class="w-full sm:w-44"
        @update:model-value="
          (v) => list.setFilter('sort', v === 'name' ? undefined : (v as string))
        "
      />
      <div class="flex-1" />
      <UButton icon="i-lucide-plus" @click="openForm(null)">Nuevo rol</UButton>
    </div>

    <QueryState
      :loading="isPending"
      :error="error"
      :empty="data?.data.length === 0"
      empty-title="No hay roles"
      @retry="refetch()"
    >
      <UTable
        :data="data?.data ?? []"
        :columns="columns"
        :loading="isFetching"
        class="rounded-md border border-default"
      >
        <template #name-cell="{ row }">
          <div class="flex items-center gap-2 font-medium">
            {{ row.original.name }}
            <UBadge v-if="row.original.isSuperadmin" color="primary" variant="subtle" size="sm"
              >Superadministrador</UBadge
            >
          </div>
          <div v-if="row.original.description" class="text-xs text-muted">
            {{ row.original.description }}
          </div>
        </template>
        <template #permissions-cell="{ row }">{{
          row.original.isSuperadmin ? 'Todos' : row.original.permissions.length
        }}</template>
        <template #updatedAt-cell="{ row }">{{ formatDateTime(row.original.updatedAt) }}</template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-1">
            <UButton
              size="sm"
              color="neutral"
              variant="ghost"
              icon="i-lucide-pencil"
              :aria-label="`Editar ${row.original.name}`"
              @click="openForm(row.original)"
            />
            <UButton
              v-if="!row.original.isSuperadmin"
              size="sm"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              :aria-label="`Eliminar ${row.original.name}`"
              :disabled="row.original.userCount > 0"
              :title="row.original.userCount > 0 ? 'Tiene usuarios asignados' : undefined"
              @click="deleteRole(row.original)"
            />
          </div>
        </template>
      </UTable>
      <ListPagination class="mt-3" :meta="data?.meta" @update:page="list.setPage" />
    </QueryState>

    <RoleFormModal v-model:open="showForm" :role="editing" />
  </div>
</template>
