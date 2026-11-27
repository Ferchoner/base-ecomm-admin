<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import { useCancelTransfer, useTransfers, useWarehouses } from '~/features/inventory/api'
import CloseLoanModal from '~/features/inventory/components/CloseLoanModal.vue'
import {
  canCancelNow,
  TRANSFER_REASON,
  OVERDUE_STYLE,
  TRANSFER_STATUS,
} from '~/features/inventory/status'
import type { Transfer, TransferKind, TransferStatus } from '~/features/inventory/types'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import { useListParams } from '~/shared/api/use-list-params'
import { useSessionStore } from '~/shared/auth/session.store'
import { useConfirm } from '~/shared/ui/use-confirm'
import { formatDateTime } from '~/shared/utils/dates'

definePageMeta({ title: 'Traslados', permission: 'inventory.read' })

/**
 * Traslados y préstamos para mostrar entre almacenes (UC-INV-13 a 16, ADR-0172). Se registran desde
 * Existencias; aquí se consultan, se cancelan en sus primeros 10 minutos y se cierran los préstamos.
 */
const session = useSessionStore()
const canTransfer = computed(() => session.can('inventory.transfer'))
const list = useListParams({ filters: ['view', 'warehouseId', 'status'] })
const filters = list.filters

const VIEWS = [
  { value: 'loans', label: 'Préstamos abiertos' },
  { value: 'overdue', label: 'Préstamos vencidos' },
  { value: 'all', label: 'Todos' },
  { value: 'transfers', label: 'Solo traslados' },
  { value: 'allLoans', label: 'Todos los préstamos' },
]
const view = computed(() => filters.value.view ?? 'loans')
const params = computed(() => {
  const base = {
    page: list.page.value,
    pageSize: list.pageSize.value,
    warehouseId: filters.value.warehouseId,
  }
  switch (view.value) {
    case 'loans':
      return { ...base, kind: 'LOAN' as TransferKind, status: 'OPEN' as TransferStatus }
    case 'overdue':
      return { ...base, overdue: true }
    case 'transfers':
      return {
        ...base,
        kind: 'TRANSFER' as TransferKind,
        status: statusFilter.value,
      }
    case 'allLoans':
      return {
        ...base,
        kind: 'LOAN' as TransferKind,
        status: statusFilter.value,
      }
    default:
      return { ...base, status: statusFilter.value }
  }
})
const statusFilter = computed(() => filters.value.status as TransferStatus | undefined)
const showStatusFilter = computed(() => !['loans', 'overdue'].includes(view.value))
const statusOptions = computed(() =>
  (Object.keys(TRANSFER_STATUS) as TransferStatus[])
    .filter((s) =>
      view.value === 'transfers'
        ? ['COMPLETED', 'CANCELLED'].includes(s)
        : view.value === 'allLoans'
          ? s !== 'COMPLETED'
          : true,
    )
    .map((value) => ({ value, label: TRANSFER_STATUS[value].label })),
)

const { data, isPending, error, refetch, isFetching } = useTransfers(params)
const { data: warehouses } = useWarehouses()
const warehouseById = computed(() => new Map((warehouses.value ?? []).map((w) => [w.id, w])))
const warehouseOptions = computed(() =>
  (warehouses.value ?? []).map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })),
)
function warehouseName(id: string) {
  const w = warehouseById.value.get(id)
  return w ? w.name : id
}

// Una vez por minuto, para que "Cancelar" desaparezca a los 10 minutos sin recargar.
const now = ref(Date.now())
const timer = setInterval(() => (now.value = Date.now()), 60_000)
onBeforeUnmount(() => clearInterval(timer))

const STATUS_STYLES = { ...TRANSFER_STATUS, OVERDUE: OVERDUE_STYLE }

const confirm = useConfirm()
const cancel = useCancelTransfer()
const toast = useToast()
async function cancelTransfer(t: Transfer) {
  const ok = await confirm({
    title: `¿Cancelar ${t.folio}?`,
    description: `Las unidades regresan a ${warehouseName(t.fromWarehouseId)}. Después de los primeros 10 minutos ya no se puede.`,
    confirmLabel: 'Cancelar el traslado',
    color: 'error',
  })
  if (!ok) return
  try {
    await cancel.mutateAsync({ id: t.id, version: t.version })
    notifySuccess(
      toast,
      `${t.folio} cancelado`,
      `Las unidades regresaron a ${warehouseName(t.fromWarehouseId)}.`,
    )
  } catch (e) {
    notifyProblem(toast, e, () => refetch())
  }
}

const closing = ref<Transfer | null>(null)
const closeOpen = ref(false)
function openClose(t: Transfer) {
  closing.value = t
  closeOpen.value = true
}

function rowActions(t: Transfer): DropdownMenuItem[] {
  if (!canTransfer.value) return []
  return [
    ...(t.kind === 'LOAN' && t.status === 'OPEN'
      ? [
          {
            label: 'Cerrar el préstamo',
            icon: 'i-lucide-package-check',
            onSelect: () => openClose(t),
          },
        ]
      : []),
    ...(canCancelNow(t, now.value)
      ? [
          {
            label: 'Cancelar',
            icon: 'i-lucide-undo-2',
            color: 'error' as const,
            onSelect: () => void cancelTransfer(t),
          },
        ]
      : []),
  ]
}

const columns: TableColumn<Transfer>[] = [
  { accessorKey: 'folio', header: 'Folio' },
  { id: 'route', header: 'De → a' },
  { id: 'lines', header: 'Productos' },
  { id: 'reason', header: 'Motivo' },
  { id: 'status', header: 'Estado' },
  { accessorKey: 'createdAt', header: 'Registrado' },
  { id: 'actions', header: '' },
]

const hasFilters = computed(() => !!(filters.value.warehouseId || filters.value.status))
</script>

<template>
  <div class="space-y-4">
    <InventoryTabs />

    <p class="max-w-3xl text-sm text-muted">
      Un traslado mueve el producto de un local a otro en un solo paso. Un préstamo lo lleva a
      mostrar con una hora de regreso, y se cierra con lo que regresó. Para registrarlos, usa las
      acciones de cada existencia. Cualquiera de los dos se cancela en sus primeros 10 minutos.
    </p>

    <div class="flex flex-wrap items-end gap-2">
      <USelect
        :model-value="view"
        :items="VIEWS"
        aria-label="Qué mostrar"
        class="w-full sm:w-56"
        @update:model-value="(v) => list.setFilters({ view: v as string, status: undefined })"
      />
      <USelect
        :model-value="filters.warehouseId"
        :items="warehouseOptions"
        placeholder="Todos los almacenes"
        aria-label="Filtrar por almacén"
        class="w-full sm:w-56"
        @update:model-value="(v) => list.setFilter('warehouseId', v as string)"
      />
      <USelect
        v-if="showStatusFilter"
        :model-value="statusFilter"
        :items="statusOptions"
        placeholder="Cualquier estado"
        aria-label="Filtrar por estado"
        class="w-full sm:w-48"
        @update:model-value="(v) => list.setFilter('status', v as string)"
      />
      <UButton
        v-if="hasFilters"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        @click="list.setFilters({ warehouseId: undefined, status: undefined })"
        >Limpiar</UButton
      >
    </div>

    <QueryState
      :loading="isPending"
      :error="error"
      :empty="data?.data.length === 0"
      :empty-title="view === 'loans' || view === 'overdue' ? 'Sin préstamos' : 'Sin traslados'"
      :empty-description="
        view === 'loans'
          ? 'No hay producto prestado en otro local.'
          : view === 'overdue'
            ? 'Ningún préstamo pasó su hora de regreso.'
            : 'Prueba con otros filtros.'
      "
      @retry="refetch()"
    >
      <UTable
        :data="data?.data ?? []"
        :columns="columns"
        :loading="isFetching"
        class="rounded-md border border-default"
      >
        <template #folio-cell="{ row }">
          <code class="text-xs font-medium">{{ row.original.folio }}</code>
        </template>
        <template #route-cell="{ row }">
          <span class="text-sm"
            >{{ warehouseName(row.original.fromWarehouseId) }} →
            {{ warehouseName(row.original.toWarehouseId) }}</span
          >
        </template>
        <template #lines-cell="{ row }">
          <ul class="text-sm">
            <li v-for="line in row.original.lines" :key="line.variantId">
              {{ line.quantity }} × <code class="text-xs">{{ line.sku }}</code>
              <span class="text-muted"> {{ line.productTitle }}</span>
              <span v-if="line.returned !== null" class="text-muted">
                · regresaron {{ line.returned }}</span
              >
            </li>
          </ul>
          <p v-if="row.original.note" class="text-xs text-muted">{{ row.original.note }}</p>
        </template>
        <template #reason-cell="{ row }">{{ TRANSFER_REASON[row.original.reason] }}</template>
        <template #status-cell="{ row }">
          <StatusBadge
            :value="row.original.overdue ? 'OVERDUE' : row.original.status"
            :styles="STATUS_STYLES"
          />
          <p
            v-if="row.original.kind === 'LOAN' && row.original.status === 'OPEN'"
            class="text-xs text-muted"
          >
            Regresa {{ formatDateTime(row.original.returnBy!) }}
          </p>
        </template>
        <template #createdAt-cell="{ row }">{{ formatDateTime(row.original.createdAt) }}</template>
        <template #actions-cell="{ row }">
          <div v-if="rowActions(row.original).length" class="text-right">
            <UDropdownMenu :items="rowActions(row.original)">
              <UButton
                icon="i-lucide-ellipsis-vertical"
                color="neutral"
                variant="ghost"
                :aria-label="`Acciones de ${row.original.folio}`"
              />
            </UDropdownMenu>
          </div>
        </template>
      </UTable>
      <ListPagination class="mt-3" :meta="data?.meta" @update:page="list.setPage" />
    </QueryState>

    <CloseLoanModal
      v-if="closing"
      v-model:open="closeOpen"
      :loan="closing"
      :from-name="warehouseName(closing.fromWarehouseId)"
      :to-name="warehouseName(closing.toWarehouseId)"
    />
  </div>
</template>
