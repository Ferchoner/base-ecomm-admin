<script setup lang="ts">
import { useAnonymizeWorkOrder, useWarehouses, useWorkOrder } from '~/features/work-orders/api'
import StaffName from '~/features/work-orders/components/StaffName.vue'
import StatusChangeModal from '~/features/work-orders/components/StatusChangeModal.vue'
import WorkOrderBlockedDataModal from '~/features/work-orders/components/WorkOrderBlockedDataModal.vue'
import WorkOrderForm from '~/features/work-orders/components/WorkOrderForm.vue'
import WorkOrderHistory from '~/features/work-orders/components/WorkOrderHistory.vue'
import WorkOrderSales from '~/features/work-orders/components/WorkOrderSales.vue'
import { WORK_ORDER_STATUS, isClosed } from '~/features/work-orders/status'
import { notifySuccess } from '~/shared/api/feedback'
import { useSessionStore } from '~/shared/auth/session.store'
import { formatDateTime } from '~/shared/utils/dates'

definePageMeta({ title: 'Orden de trabajo', permission: 'work-orders.read' })

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))
const session = useSessionStore()
const { data: workOrder, isPending, error, refetch } = useWorkOrder(id)

const closed = computed(() => !!workOrder.value && isClosed(workOrder.value.status))
const hidden = computed(() => !!(workOrder.value?.blockedAt || workOrder.value?.anonymizedAt))
const canManage = computed(() => session.can('work-orders.manage'))
const editable = computed(() => canManage.value && !closed.value && !hidden.value)

// El nombre del almacén requiere `inventory.read`; sin él se muestra su ID.
const warehouses = useWarehouses(() => session.can('inventory.read'))
const warehouseLabel = computed(() => {
  const wid = workOrder.value?.warehouseId
  const w = warehouses.data.value?.find((x) => x.id === wid)
  return w ? `${w.name} (${w.code})` : wid
})

// Recién recibida: se invita a imprimir la nota para la firma del cliente.
const justReceived = computed(() => route.query.recibida === '1')

// Venta colocada desde "Nueva venta para esta orden" (`?ligar=<id>&venta=<código>`).
const pending = computed(() => {
  const orderId = typeof route.query.ligar === 'string' ? route.query.ligar : ''
  const code = typeof route.query.venta === 'string' ? route.query.venta : ''
  return orderId ? { orderId, code: code || orderId } : null
})
function clearQuery(...keys: string[]) {
  const query = Object.fromEntries(Object.entries(route.query).filter(([k]) => !keys.includes(k)))
  void router.replace({ query })
}

const statusOpen = ref(false)
const blockedOpen = ref(false)
const anonymizeOpen = ref(false)
const canReadBlocked = computed(
  () =>
    session.can('work-orders.read-blocked') &&
    !!workOrder.value?.blockedAt &&
    !workOrder.value.anonymizedAt,
)
// Solo la de un cliente sin cuenta: las de un cliente registrado se anonimizan con su cuenta (§25.12).
const canAnonymize = computed(
  () =>
    session.can('customers.manage') &&
    closed.value &&
    !workOrder.value?.customerId &&
    !workOrder.value?.anonymizedAt,
)
const anonymize = useAnonymizeWorkOrder(id)
const toast = useToast()
async function onAnonymize(reason: string) {
  await anonymize.mutateAsync(reason)
  notifySuccess(toast, 'Orden de trabajo anonimizada')
}
</script>

<template>
  <div class="space-y-4">
    <UButton
      to="/ordenes-trabajo"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      size="sm"
      >Órdenes de trabajo</UButton
    >

    <QueryState :loading="isPending" :error="error" @retry="refetch()">
      <template v-if="workOrder">
        <header class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-1">
            <h2 class="text-xl font-semibold">Orden de trabajo {{ workOrder.folio }}</h2>
            <StatusBadge :value="workOrder.status" :styles="WORK_ORDER_STATUS" />
          </div>
          <div class="flex flex-wrap items-start gap-2">
            <UButton
              :to="`/imprimir/nota-servicio/${workOrder.id}`"
              icon="i-lucide-printer"
              color="neutral"
              variant="outline"
              >Imprimir nota de servicio</UButton
            >
            <UButton
              v-if="canManage && !closed"
              icon="i-lucide-arrow-right-circle"
              @click="statusOpen = true"
              >Cambiar estado</UButton
            >
          </div>
        </header>

        <UAlert
          v-if="justReceived"
          color="success"
          variant="subtle"
          icon="i-lucide-circle-check"
          :title="`Equipo recibido con el folio ${workOrder.folio}`"
          description="Imprime la nota de servicio para que el cliente la firme."
          :actions="[
            {
              label: 'Imprimir nota',
              icon: 'i-lucide-printer',
              to: `/imprimir/nota-servicio/${workOrder.id}`,
            },
            {
              label: 'Cerrar',
              color: 'neutral',
              variant: 'ghost',
              onClick: () => clearQuery('recibida'),
            },
          ]"
        />
        <UAlert
          v-if="workOrder.anonymizedAt"
          color="neutral"
          variant="subtle"
          icon="i-lucide-user-x"
          :title="`Anonimizada el ${formatDateTime(workOrder.anonymizedAt)}`"
          description="Ya no tiene los datos del cliente ni los textos del servicio."
        />
        <UAlert
          v-else-if="workOrder.blockedAt"
          color="neutral"
          variant="subtle"
          icon="i-lucide-lock"
          :title="`Datos del cliente bloqueados desde el ${formatDateTime(workOrder.blockedAt)}`"
          description="Se conservan por el plazo legal, pero ya no se muestran."
          :actions="
            canReadBlocked
              ? [
                  {
                    label: 'Ver datos',
                    color: 'neutral',
                    variant: 'outline',
                    onClick: () => (blockedOpen = true),
                  },
                ]
              : []
          "
        />
        <UAlert
          v-else-if="closed && canManage"
          color="neutral"
          variant="subtle"
          icon="i-lucide-lock"
          title="Orden cerrada"
          description="Se entregó o se canceló: sus datos, su estado y sus ventas ya no cambian."
        />

        <div class="grid gap-4 lg:grid-cols-3">
          <div class="space-y-4 lg:col-span-2">
            <WorkOrderForm :key="workOrder.id" :work-order="workOrder" :readonly="!editable" />
            <UCard>
              <template #header><h3 class="font-semibold">Historial</h3></template>
              <WorkOrderHistory :history="workOrder.statusHistory" />
            </UCard>
          </div>
          <div class="space-y-4">
            <UCard>
              <template #header><h3 class="font-semibold">Ventas</h3></template>
              <WorkOrderSales
                :work-order="workOrder"
                :editable="editable"
                :pending="pending"
                @pending-done="clearQuery('ligar', 'venta')"
              />
            </UCard>
            <UCard>
              <template #header><h3 class="font-semibold">Recepción</h3></template>
              <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt class="text-muted">Recibida</dt>
                <dd>{{ formatDateTime(workOrder.receivedAt) }}</dd>
                <dt class="text-muted">Recibió</dt>
                <dd><StaffName :id="workOrder.receivedBy" /></dd>
                <dt class="text-muted">Almacén</dt>
                <dd>{{ warehouseLabel }}</dd>
                <template v-if="workOrder.closedAt">
                  <dt class="text-muted">Cerrada</dt>
                  <dd>{{ formatDateTime(workOrder.closedAt) }}</dd>
                </template>
              </dl>
            </UCard>
            <UCard v-if="canAnonymize">
              <template #header><h3 class="font-semibold">Privacidad</h3></template>
              <p class="mb-3 text-sm text-muted">
                Para la solicitud de un cliente sin cuenta: borra su nombre, teléfono, email, número
                de serie y los textos del servicio.
              </p>
              <UButton color="error" variant="outline" @click="anonymizeOpen = true"
                >Anonimizar</UButton
              >
            </UCard>
          </div>
        </div>

        <StatusChangeModal v-model:open="statusOpen" :work-order="workOrder" />
        <WorkOrderBlockedDataModal v-model:open="blockedOpen" :work-order="workOrder" />
        <ReasonDialog
          v-model:open="anonymizeOpen"
          :title="`Anonimizar ${workOrder.folio}`"
          description="Se borran los datos del cliente de esta orden de trabajo. Conserva el folio, el historial, el equipo y las ventas."
          confirm-label="Anonimizar"
          color="error"
          reason-help="La referencia de la solicitud (ARCO), sin datos personales. Queda en la auditoría."
          acknowledge="Entiendo que no se puede deshacer."
          :submit="onAnonymize"
        />
      </template>
    </QueryState>
  </div>
</template>
