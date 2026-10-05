<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import { useCategoryAction, useCategoryTree } from '~/features/catalog/api'
import CategoryFormModal from '~/features/catalog/components/CategoryFormModal.vue'
import { ACTIVE_STATUS, ACTIVE_STATUS_OPTIONS } from '~/features/catalog/status'
import { flattenTree } from '~/features/catalog/tree'
import type { FlatCategory } from '~/features/catalog/tree'
import type { CategoryNode } from '~/features/catalog/types'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import { useListParams } from '~/shared/api/use-list-params'
import { useSessionStore } from '~/shared/auth/session.store'
import { useConfirm } from '~/shared/ui/use-confirm'

definePageMeta({ title: 'Categorías', permission: 'catalog.read' })

const session = useSessionStore()
const canWrite = computed(() => session.can('catalog.write'))
const list = useListParams({ filters: ['status'] })

// Con `status`, la API incluye también los ancestros que llevan a esas categorías (API_SPEC §11.9).
const { data, isPending, error, refetch } = useCategoryTree(() => list.filters.value.status)
// El árbol completo alimenta el selector de padre aunque la vista esté filtrada.
const { data: fullTree } = useCategoryTree()
const rows = computed(() => flattenTree(data.value ?? []))

const formOpen = ref(false)
const editing = ref<CategoryNode | null>(null)
const newParentId = ref<string | null>(null)
function openForm(category: CategoryNode | null, parentId: string | null = null) {
  editing.value = category
  newParentId.value = parentId
  formOpen.value = true
}

const action = useCategoryAction()
const confirm = useConfirm()
const toast = useToast()

async function run(category: CategoryNode, kind: 'deactivate' | 'reactivate' | 'delete') {
  if (kind === 'delete') {
    const ok = await confirm({
      title: `¿Eliminar la categoría "${category.name}"?`,
      description:
        'No se puede deshacer. Si tiene productos o subcategorías, la API no la eliminará: desactívala.',
      confirmLabel: 'Eliminar',
      color: 'error',
    })
    if (!ok) return
  }
  if (kind === 'deactivate' && category.childCount > 0) {
    const ok = await confirm({
      title: `¿Desactivar "${category.name}"?`,
      description:
        'La tienda deja de mostrar sus subcategorías mientras esté inactiva. Al reactivarla, las subcategorías no se reactivan solas.',
      confirmLabel: 'Desactivar',
      color: 'warning',
    })
    if (!ok) return
  }
  try {
    await action.mutateAsync({ id: category.id, action: kind })
    notifySuccess(
      toast,
      {
        deactivate: 'Categoría desactivada',
        reactivate: 'Categoría reactivada',
        delete: 'Categoría eliminada',
      }[kind],
    )
  } catch (e) {
    notifyProblem(toast, e)
  }
}

function rowActions(category: CategoryNode): DropdownMenuItem[] {
  return [
    { label: 'Editar', icon: 'i-lucide-pencil', onSelect: () => openForm(category) },
    ...(category.status === 'ACTIVE'
      ? [
          {
            label: 'Agregar subcategoría',
            icon: 'i-lucide-folder-plus',
            onSelect: () => openForm(null, category.id),
          },
        ]
      : []),
    category.status === 'INACTIVE'
      ? {
          label: 'Reactivar',
          icon: 'i-lucide-rotate-ccw',
          onSelect: () => run(category, 'reactivate'),
        }
      : {
          label: 'Desactivar',
          icon: 'i-lucide-circle-pause',
          onSelect: () => run(category, 'deactivate'),
        },
    {
      label: 'Eliminar',
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect: () => run(category, 'delete'),
    },
  ]
}

const columns = computed<TableColumn<FlatCategory>[]>(() => [
  { id: 'name', header: 'Nombre' },
  { id: 'slug', header: 'Slug' },
  { id: 'status', header: 'Estado' },
  { id: 'position', header: 'Posición' },
  { id: 'products', header: 'Productos' },
  ...(canWrite.value ? [{ id: 'actions', header: '' }] : []),
])
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end gap-2">
      <USelect
        :model-value="list.filters.value.status"
        :items="ACTIVE_STATUS_OPTIONS"
        placeholder="Todos los estados"
        aria-label="Filtrar por estado"
        class="w-full sm:w-44"
        @update:model-value="(v) => list.setFilter('status', v as string)"
      />
      <UButton
        v-if="list.filters.value.status"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        @click="list.resetFilters()"
        >Limpiar</UButton
      >
      <div class="flex-1" />
      <UButton v-if="canWrite" icon="i-lucide-plus" @click="openForm(null)"
        >Nueva categoría</UButton
      >
    </div>

    <QueryState
      :loading="isPending"
      :error="error"
      :empty="rows.length === 0"
      empty-title="No hay categorías"
      @retry="refetch()"
    >
      <UTable :data="rows" :columns="columns" class="rounded-md border border-default">
        <template #name-cell="{ row }">
          <span
            class="flex items-center gap-1.5"
            :style="{ paddingInlineStart: `${row.original.depth * 1.25}rem` }"
            :aria-label="row.original.path.join(' › ')"
          >
            <UIcon
              :name="row.original.node.children.length ? 'i-lucide-folder-open' : 'i-lucide-folder'"
              class="size-4 shrink-0 text-muted"
            />
            <span class="font-medium">{{ row.original.node.name }}</span>
          </span>
        </template>
        <template #slug-cell="{ row }">
          <code class="text-xs">{{ row.original.node.slug }}</code>
        </template>
        <template #status-cell="{ row }">
          <StatusBadge :value="row.original.node.status" :styles="ACTIVE_STATUS" />
        </template>
        <template #position-cell="{ row }">{{ row.original.node.position }}</template>
        <template #products-cell="{ row }">{{ row.original.node.productCount }}</template>
        <template #actions-cell="{ row }">
          <div class="text-right">
            <UDropdownMenu :items="rowActions(row.original.node)">
              <UButton
                icon="i-lucide-ellipsis-vertical"
                color="neutral"
                variant="ghost"
                :aria-label="`Acciones de ${row.original.node.name}`"
              />
            </UDropdownMenu>
          </div>
        </template>
      </UTable>
    </QueryState>

    <CategoryFormModal
      v-model:open="formOpen"
      :category="editing"
      :parent-id="newParentId"
      :tree="fullTree ?? []"
    />
  </div>
</template>
