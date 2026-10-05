<script setup lang="ts">
import { useEventDeliveries } from '~/features/events/api'
import { useStockItems } from '~/features/inventory/api'
import { useOrders } from '~/features/orders/api'
import { useShipments } from '~/features/shipping/api'
import { useSessionStore } from '~/shared/auth/session.store'
import { visibleNavigation } from '~/shared/navigation'
import { usePreferencesStore } from '~/shared/preferences/preferences.store'

definePageMeta({ title: 'Inicio' })

const session = useSessionStore()
const prefs = usePreferencesStore()
const sections = computed(() =>
  visibleNavigation(session.can)
    .flatMap((group) => group.items)
    .filter((item) => item.to !== '/'),
)

// Tablero de conteos (DECISIONS D-P04, GAPS G-03): cada número es `meta.totalItems` de un listado
// con `pageSize=1`, y solo se consulta con el permiso de lectura de ese listado.
const ONE = { page: 1, pageSize: 1 }
const canOrders = computed(() => session.can('orders.read'))
const canShipping = computed(() => session.can('shipping.manage'))
const canEvents = computed(() => session.can('events.manage'))
const canInventory = computed(() => session.can('inventory.read'))

const pendingPayment = useOrders({ ...ONE, status: 'PENDING_PAYMENT' }, { enabled: canOrders })
const awaitingFulfillment = useOrders(
  { ...ONE, status: 'AWAITING_MANUAL_FULFILLMENT' },
  { enabled: canOrders },
)
const pendingRefund = useOrders({ ...ONE, hasPendingRefund: true }, { enabled: canOrders })
const pendingShipments = useShipments({ ...ONE, status: 'PENDING' }, { enabled: canShipping })
const failedDeliveries = useEventDeliveries({ ...ONE, status: 'FAILED' }, { enabled: canEvents })
const lowStock = useStockItems(() => ({ ...ONE, availableMax: prefs.lowStockThreshold }), {
  enabled: canInventory,
})

interface CountDef {
  show: boolean
  label: string
  icon: string
  to: string
  query: {
    data: Ref<{ meta: { totalItems: number } } | undefined>
    isPending: Ref<boolean>
    isError: Ref<boolean>
  }
  color: 'warning' | 'error' | 'info'
}

const counts = computed(() => {
  const all: CountDef[] = [
    {
      show: canOrders.value,
      label: 'Pedidos por cobrar',
      icon: 'i-lucide-hourglass',
      to: '/pedidos?status=PENDING_PAYMENT',
      query: pendingPayment,
      color: 'warning',
    },
    {
      show: canOrders.value,
      label: 'Pedidos esperando surtido',
      icon: 'i-lucide-package-x',
      to: '/pedidos?status=AWAITING_MANUAL_FULFILLMENT',
      query: awaitingFulfillment,
      color: 'error',
    },
    {
      show: canOrders.value,
      label: 'Pedidos con reembolso pendiente',
      icon: 'i-lucide-undo-2',
      to: '/pedidos?hasPendingRefund=true',
      query: pendingRefund,
      color: 'warning',
    },
    {
      show: canShipping.value,
      label: 'Envíos por despachar',
      icon: 'i-lucide-truck',
      to: '/envios',
      query: pendingShipments,
      color: 'info',
    },
    {
      show: canInventory.value,
      label: `Variantes con stock bajo (≤ ${prefs.lowStockThreshold})`,
      icon: 'i-lucide-package-minus',
      to: `/inventario/stock?availableMax=${prefs.lowStockThreshold}`,
      query: lowStock,
      color: 'warning',
    },
    {
      show: canEvents.value,
      label: 'Entregas de eventos fallidas',
      icon: 'i-lucide-activity',
      to: '/operacion/eventos',
      query: failedDeliveries,
      color: 'error',
    },
  ]
  return all.filter((c) => c.show)
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold">Hola, {{ session.account?.firstNames }}</h2>
      <p v-if="counts.length" class="text-muted">Esto es lo que está pendiente de atender.</p>
    </div>

    <section v-if="counts.length" aria-labelledby="pending-heading" class="space-y-3">
      <h3 id="pending-heading" class="sr-only">Pendientes</h3>
      <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Pendientes">
        <li v-for="c in counts" :key="c.to">
          <CountCard
            :label="c.label"
            :icon="c.icon"
            :to="c.to"
            :color="c.color"
            :total="c.query.data.value?.meta.totalItems"
            :loading="c.query.isPending.value"
            :failed="c.query.isError.value"
          />
        </li>
      </ul>
    </section>

    <UEmpty
      v-if="sections.length === 0"
      icon="i-lucide-lock"
      title="Sin secciones disponibles"
      description="Tu cuenta no tiene permisos asignados. Pide a un administrador que te asigne un rol."
    />

    <section v-else aria-labelledby="sections-heading" class="space-y-3">
      <h3 id="sections-heading" class="text-sm font-medium text-muted">Tus secciones</h3>
      <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Tus secciones">
        <li v-for="item in sections" :key="item.to">
          <NuxtLink
            :to="item.to"
            class="flex items-center gap-3 rounded-lg border border-default p-4 hover:bg-elevated/50"
          >
            <UIcon :name="item.icon" class="size-5 text-primary" />
            <span class="font-medium">{{ item.label }}</span>
            <UBadge v-if="!item.available" color="neutral" variant="subtle" class="ms-auto"
              >Próximamente</UBadge
            >
          </NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>
