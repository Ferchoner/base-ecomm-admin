<script setup lang="ts">
import { useShippingMethod } from '~/features/shipping/api'
import ShippingMethodForm from '~/features/shipping/components/ShippingMethodForm.vue'
import { useSessionStore } from '~/shared/auth/session.store'

definePageMeta({ title: 'Método de envío', permission: 'shipping.manage' })

const session = useSessionStore()
const { data, isPending, error, refetch } = useShippingMethod()
const canConfigure = computed(() => session.can('shipping.configure'))
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-muted">
      La tienda tiene un solo método de envío: un costo fijo por pedido, con envío gratis opcional a
      partir de un monto.
    </p>
    <UAlert
      v-if="!canConfigure"
      color="neutral"
      variant="subtle"
      icon="i-lucide-lock"
      title="Solo lectura"
      description="Cambiar el costo o el plazo requiere el permiso para configurar envíos."
    />
    <QueryState :loading="isPending" :error="error" @retry="refetch()">
      <ShippingMethodForm v-if="data" :method="data" :disabled="!canConfigure" />
    </QueryState>
  </div>
</template>
