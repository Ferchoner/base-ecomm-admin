<script setup lang="ts">
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import { useConfirm } from '~/shared/ui/use-confirm'
import { formatDateTime } from '~/shared/utils/dates'
import { useUpdatePaymentSettings } from '../api'
import type { PaymentSettings } from '../types'

/**
 * Habilitar o deshabilitar el pago manual en tienda (API_SPEC §16.6, ADR-0162). Vale desde la
 * siguiente operación; se envía la `version` leída.
 */
const props = defineProps<{ settings: PaymentSettings; canConfigure: boolean }>()

const update = useUpdatePaymentSettings()
const confirm = useConfirm()
const toast = useToast()

async function toggle(enabled: boolean) {
  const ok = await confirm(
    enabled
      ? {
          title: '¿Habilitar el pago en tienda?',
          description:
            'El staff podrá registrar pagos y reembolsos manuales, y los clientes podrán elegir pagar en la tienda.',
          confirmLabel: 'Habilitar',
        }
      : {
          title: '¿Deshabilitar el pago en tienda?',
          description:
            'Registrar pagos y reembolsos manuales responderá con error, los clientes no podrán elegir pagar en la tienda y el correo de pedido recibido dejará de dar instrucciones de pago.',
          confirmLabel: 'Deshabilitar',
          color: 'error',
        },
  )
  if (!ok) return
  try {
    await update.mutateAsync({ manualPaymentsEnabled: enabled, version: props.settings.version })
    notifySuccess(toast, enabled ? 'Pago en tienda habilitado' : 'Pago en tienda deshabilitado')
  } catch (e) {
    notifyProblem(toast, e)
  }
}
</script>

<template>
  <UCard>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <h3 class="font-semibold">Pago manual en tienda</h3>
          <UBadge
            :color="settings.manualPaymentsEnabled ? 'success' : 'neutral'"
            variant="subtle"
            >{{ settings.manualPaymentsEnabled ? 'Habilitado' : 'Deshabilitado' }}</UBadge
          >
        </div>
        <p class="text-sm text-muted">
          Último cambio: {{ formatDateTime(settings.updatedAt) }}. Vale desde la siguiente
          operación.
        </p>
      </div>
      <UButton
        v-if="canConfigure"
        :color="settings.manualPaymentsEnabled ? 'error' : 'primary'"
        :variant="settings.manualPaymentsEnabled ? 'outline' : 'solid'"
        :loading="update.isPending.value"
        @click="toggle(!settings.manualPaymentsEnabled)"
        >{{ settings.manualPaymentsEnabled ? 'Deshabilitar' : 'Habilitar' }}</UButton
      >
    </div>
  </UCard>
</template>
