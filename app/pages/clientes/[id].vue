<script setup lang="ts">
import { useCustomer } from '~/features/customers/api'
import CustomerActions from '~/features/customers/components/CustomerActions.vue'
import { CUSTOMER_STATUS, customerName } from '~/features/customers/status'
import { useOrders } from '~/features/orders/api'
import { useSessionStore } from '~/shared/auth/session.store'
import { formatDateTime } from '~/shared/utils/dates'

definePageMeta({ title: 'Cliente', permission: 'customers.read' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const session = useSessionStore()
const { data: customer, isPending, error, refetch } = useCustomer(id)

// Sus pedidos se cuentan en Pedidos (API_SPEC §9.18: `orderCount` ya no existe).
const canSeeOrders = computed(() => session.can('orders.read'))
const { data: orders } = useOrders(() => ({ page: 1, pageSize: 1, customerId: id.value }), {
  enabled: canSeeOrders,
})
</script>

<template>
  <div class="space-y-4">
    <UButton to="/clientes" icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm"
      >Clientes</UButton
    >

    <QueryState :loading="isPending" :error="error" @retry="refetch()">
      <template v-if="customer">
        <header class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-1">
            <h2 class="text-xl font-semibold">{{ customerName(customer) }}</h2>
            <div class="flex flex-wrap items-center gap-2">
              <StatusBadge :value="customer.status" :styles="CUSTOMER_STATUS" />
              <span class="text-sm text-muted">{{ customer.email ?? 'Sin email' }}</span>
            </div>
          </div>
          <CustomerActions v-if="session.can('customers.manage')" :customer="customer" />
        </header>

        <UAlert
          v-if="customer.anonymizedAt"
          color="neutral"
          variant="subtle"
          icon="i-lucide-eraser"
          :title="`Anonimizado el ${formatDateTime(customer.anonymizedAt)}`"
          description="La cuenta ya no tiene datos personales y no se puede reactivar."
        />

        <div class="grid gap-4 lg:grid-cols-3">
          <UCard>
            <template #header><h3 class="font-semibold">Cuenta</h3></template>
            <DetailList
              :items="[
                { label: 'Email', value: customer.email },
                {
                  label: 'Verificación',
                  value: customer.emailVerified ? 'Verificado' : 'Sin verificar',
                },
                { label: 'Registro', value: formatDateTime(customer.createdAt) },
                { label: 'Último acceso', value: formatDateTime(customer.lastLoginAt) },
              ]"
            />
          </UCard>
          <UCard class="lg:col-span-2">
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <h3 class="font-semibold">Pedidos</h3>
                <UButton
                  v-if="canSeeOrders"
                  :to="`/pedidos?customerId=${customer.id}`"
                  color="neutral"
                  variant="link"
                  size="sm"
                  >Ver sus pedidos</UButton
                >
              </div>
            </template>
            <p v-if="canSeeOrders" class="text-sm">
              {{ orders ? `${orders.meta.totalItems} pedidos` : 'Contando pedidos…' }}
            </p>
            <p v-else class="text-sm text-muted">Necesitas el permiso de pedidos para verlos.</p>
          </UCard>
        </div>

        <UCard>
          <template #header><h3 class="font-semibold">Direcciones</h3></template>
          <p v-if="!customer.addresses?.length" class="text-sm text-muted">Sin direcciones.</p>
          <ul v-else class="grid gap-4 sm:grid-cols-2">
            <li
              v-for="a in customer.addresses"
              :key="a.id"
              class="space-y-1 rounded-md border border-default p-3"
            >
              <UBadge v-if="a.isDefault" color="primary" variant="subtle" size="sm"
                >Predeterminada</UBadge
              >
              <PostalAddress :address="a" />
            </li>
          </ul>
        </UCard>
      </template>
    </QueryState>
  </div>
</template>
