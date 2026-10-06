<script setup lang="ts">
import { usePaymentSettings } from '~/features/payments/api'
import PaymentSettingsCard from '~/features/payments/components/PaymentSettingsCard.vue'
import { useSessionStore } from '~/shared/auth/session.store'

definePageMeta({ title: 'Pago en tienda', permission: 'orders.read' })

const session = useSessionStore()
const { data, isPending, error, refetch } = usePaymentSettings()
const canConfigure = computed(() => session.can('payments.configure'))
</script>

<template>
  <div class="space-y-4">
    <p class="max-w-2xl text-sm text-muted">
      Decide si la tienda registra pagos y reembolsos manuales (efectivo, terminal bancaria o
      transferencia) y si los clientes pueden elegir pagar en la tienda.
    </p>
    <UAlert
      v-if="!canConfigure"
      color="neutral"
      variant="subtle"
      icon="i-lucide-lock"
      title="Solo lectura"
      description="Solo un superadministrador puede habilitarlo o deshabilitarlo."
    />
    <QueryState :loading="isPending" :error="error" @retry="refetch()">
      <PaymentSettingsCard v-if="data" :settings="data" :can-configure="canConfigure" />
    </QueryState>
  </div>
</template>
