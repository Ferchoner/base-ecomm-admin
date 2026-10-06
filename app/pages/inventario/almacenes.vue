<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useDeactivateWarehouse, useWarehouses } from '~/features/inventory/api'
import WarehouseFormModal from '~/features/inventory/components/WarehouseFormModal.vue'
import { WAREHOUSE_STATUS } from '~/features/inventory/status'
import type { Warehouse } from '~/features/inventory/types'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import type { ApiProblem } from '~/shared/api/problem'
import { useSessionStore } from '~/shared/auth/session.store'
import { useConfirm } from '~/shared/ui/use-confirm'

definePageMeta({ title: 'Almacenes', permission: 'inventory.read' })

const session = useSessionStore()
const canWrite = computed(() => session.can('inventory.write'))
const { data, isPending, error, refetch } = useWarehouses()
const activeCount = computed(() => data.value?.filter((w) => w.status === 'ACTIVE').length ?? 0)

const formOpen = ref(false)
const editing = ref<Warehouse | null>(null)
function openForm(warehouse: Warehouse | null) {
  editing.value = warehouse
  formOpen.value = true
}

const deactivate = useDeactivateWarehouse()
const confirm = useConfirm()
const toast = useToast()

/** Mensajes de los 409 de desactivar (API_SPEC §13, ADR-0160). */
function deactivateMessage(p: ApiProblem): string | undefined {
  if (p.type === 'resource-in-use')
    return 'Tiene unidades apartadas para pedidos. Espera a que se surtan o venzan.'
  if (p.extensions.reason === 'last-active-warehouse')
    return 'Es el último almacén activo: la tienda necesita al menos uno.'
  return undefined
}

async function runDeactivate(w: Warehouse) {
  const ok = await confirm({
    title: `¿Desactivar ${w.name}?`,
    description:
      'Es para siempre: deja de vender, apartar y recibir mercancía. Conserva su stock, que puedes transferir a otro almacén con un ajuste.',
    confirmLabel: 'Desactivar',
    color: 'error',
  })
  if (!ok) return
  try {
    await deactivate.mutateAsync(w.id)
    notifySuccess(toast, 'Almacén desactivado', `${w.code} ya no vende ni recibe mercancía.`)
  } catch (e) {
    const p = e as ApiProblem
    const message = deactivateMessage(p)
    if (!message) return notifyProblem(toast, p)
    toast.add({
      title: p.title,
      description: message,
      color: 'error',
      icon: 'i-lucide-circle-alert',
    })
  }
}

const columns: TableColumn<Warehouse>[] = [
  { accessorKey: 'priority', header: 'Prioridad' },
  { accessorKey: 'code', header: 'Código' },
  { accessorKey: 'name', header: 'Nombre' },
  { id: 'address', header: 'Dirección' },
  { accessorKey: 'status', header: 'Estado' },
  { id: 'actions', header: '' },
]
</script>

<template>
  <div class="space-y-4">
    <InventoryTabs />
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="max-w-2xl text-sm text-muted">
        Cada pedido se aparta completo en el primer almacén activo, por prioridad, que tiene todo lo
        pedido; si empatan, por código.
      </p>
      <UButton v-if="canWrite" icon="i-lucide-plus" @click="openForm(null)">Nuevo almacén</UButton>
    </div>
    <QueryState
      :loading="isPending"
      :error="error"
      :empty="data?.length === 0"
      empty-title="Sin almacenes"
      @retry="refetch()"
    >
      <UTable :data="data ?? []" :columns="columns" class="rounded-md border border-default">
        <template #code-cell="{ row }">
          <code class="text-xs font-medium">{{ row.original.code }}</code>
        </template>
        <template #address-cell="{ row }">
          <span v-if="row.original.address" class="text-sm">
            {{ row.original.address.street }} {{ row.original.address.exteriorNumber }},
            {{ row.original.address.municipalityName }}
          </span>
          <span v-else class="text-muted">—</span>
        </template>
        <template #status-cell="{ row }">
          <StatusBadge :value="row.original.status" :styles="WAREHOUSE_STATUS" />
        </template>
        <template #actions-cell="{ row }">
          <div v-if="canWrite && row.original.status === 'ACTIVE'" class="flex justify-end gap-1">
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              :aria-label="`Editar ${row.original.code}`"
              @click="openForm(row.original)"
            />
            <UButton
              icon="i-lucide-power-off"
              color="error"
              variant="ghost"
              :disabled="activeCount <= 1"
              :aria-label="`Desactivar ${row.original.code}`"
              @click="runDeactivate(row.original)"
            />
          </div>
        </template>
      </UTable>
    </QueryState>
    <WarehouseFormModal v-model:open="formOpen" :warehouse="editing" />
  </div>
</template>
