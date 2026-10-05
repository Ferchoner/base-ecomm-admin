<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import { useBrandAction, useBrands } from '~/features/catalog/api'
import BrandFormModal from '~/features/catalog/components/BrandFormModal.vue'
import { ACTIVE_STATUS, ACTIVE_STATUS_OPTIONS } from '~/features/catalog/status'
import type { Brand } from '~/features/catalog/types'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import { useListParams } from '~/shared/api/use-list-params'
import { useSessionStore } from '~/shared/auth/session.store'
import { useConfirm } from '~/shared/ui/use-confirm'
import { formatDateTime } from '~/shared/utils/dates'
import { useDebounced } from '~/shared/utils/debounce'

definePageMeta({ title: 'Marcas', permission: 'catalog.read' })

const session = useSessionStore()
const canWrite = computed(() => session.can('catalog.write'))
const list = useListParams({ filters: ['q', 'status', 'sort'] })

const search = ref(list.filters.value.q ?? '')
const debouncedSearch = useDebounced(search)
watch(debouncedSearch, (q) => list.setFilter('q', q.trim() || undefined))

const { data, isPending, error, refetch, isFetching } = useBrands(() => ({
  page: list.page.value,
  pageSize: list.pageSize.value,
  q: list.filters.value.q,
  status: list.filters.value.status,
  sort: list.filters.value.sort ?? 'name',
}))

const formOpen = ref(false)
const editing = ref<Brand | null>(null)
function openForm(brand: Brand | null) {
  editing.value = brand
  formOpen.value = true
}

const action = useBrandAction()
const confirm = useConfirm()
const toast = useToast()

async function run(brand: Brand, kind: 'deactivate' | 'reactivate' | 'delete') {
  if (kind === 'delete') {
    const ok = await confirm({
      title: `¿Eliminar la marca "${brand.name}"?`,
      description:
        'No se puede deshacer. Si la usa algún producto, la API no la eliminará: desactívala.',
      confirmLabel: 'Eliminar',
      color: 'error',
    })
    if (!ok) return
  }
  try {
    await action.mutateAsync({ id: brand.id, action: kind })
    notifySuccess(
      toast,
      {
        deactivate: 'Marca desactivada',
        reactivate: 'Marca reactivada',
        delete: 'Marca eliminada',
      }[kind],
    )
  } catch (e) {
    notifyProblem(toast, e)
  }
}

function rowActions(brand: Brand): DropdownMenuItem[] {
  return [
    { label: 'Editar', icon: 'i-lucide-pencil', onSelect: () => openForm(brand) },
    brand.status === 'INACTIVE'
      ? {
          label: 'Reactivar',
          icon: 'i-lucide-rotate-ccw',
          onSelect: () => run(brand, 'reactivate'),
        }
      : {
          label: 'Desactivar',
          icon: 'i-lucide-circle-pause',
          onSelect: () => run(brand, 'deactivate'),
        },
    {
      label: 'Eliminar',
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect: () => run(brand, 'delete'),
    },
  ]
}

const columns = computed<TableColumn<Brand>[]>(() => [
  { accessorKey: 'name', header: 'Nombre' },
  { accessorKey: 'slug', header: 'Slug' },
  { accessorKey: 'status', header: 'Estado' },
  { accessorKey: 'productCount', header: 'Productos' },
  { accessorKey: 'updatedAt', header: 'Actualizada' },
  ...(canWrite.value ? [{ id: 'actions', header: '' }] : []),
])
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end gap-2">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Buscar por nombre"
        aria-label="Buscar marcas"
        class="w-full sm:w-64"
      />
      <USelect
        :model-value="list.filters.value.status"
        :items="ACTIVE_STATUS_OPTIONS"
        placeholder="Todos los estados"
        aria-label="Filtrar por estado"
        class="w-full sm:w-44"
        @update:model-value="(v) => list.setFilter('status', v as string)"
      />
      <USelect
        :model-value="list.filters.value.sort ?? 'name'"
        :items="[
          { value: 'name', label: 'Nombre (A–Z)' },
          { value: '-name', label: 'Nombre (Z–A)' },
        ]"
        aria-label="Ordenar"
        class="w-full sm:w-40"
        @update:model-value="
          (v) => list.setFilter('sort', v === 'name' ? undefined : (v as string))
        "
      />
      <UButton
        v-if="list.filters.value.status || list.filters.value.q"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        @click="((search = ''), list.resetFilters())"
        >Limpiar</UButton
      >
      <div class="flex-1" />
      <UButton v-if="canWrite" icon="i-lucide-plus" @click="openForm(null)">Nueva marca</UButton>
    </div>

    <QueryState
      :loading="isPending"
      :error="error"
      :empty="data?.data.length === 0"
      empty-title="No hay marcas"
      :empty-description="
        list.filters.value.q || list.filters.value.status ? 'Prueba con otros filtros.' : undefined
      "
      @retry="refetch()"
    >
      <UTable
        :data="data?.data ?? []"
        :columns="columns"
        :loading="isFetching"
        class="rounded-md border border-default"
      >
        <template #slug-cell="{ row }">
          <code class="text-xs">{{ row.original.slug }}</code>
        </template>
        <template #status-cell="{ row }">
          <StatusBadge :value="row.original.status" :styles="ACTIVE_STATUS" />
        </template>
        <template #updatedAt-cell="{ row }">{{ formatDateTime(row.original.updatedAt) }}</template>
        <template #actions-cell="{ row }">
          <div class="text-right">
            <UDropdownMenu :items="rowActions(row.original)">
              <UButton
                icon="i-lucide-ellipsis-vertical"
                color="neutral"
                variant="ghost"
                :aria-label="`Acciones de ${row.original.name}`"
              />
            </UDropdownMenu>
          </div>
        </template>
      </UTable>
      <ListPagination class="mt-3" :meta="data?.meta" @update:page="list.setPage" />
    </QueryState>

    <BrandFormModal v-model:open="formOpen" :brand="editing" />
  </div>
</template>
