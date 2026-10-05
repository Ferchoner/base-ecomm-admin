<script setup lang="ts">
import { notifySuccess } from '~/shared/api/feedback'
import { useAnonymizeCustomer, useCustomerStatus } from '../api'
import { canRunCustomer, customerName } from '../status'
import type { AdminCustomer } from '../types'

/** Suspender, reactivar y anonimizar un cliente (API_SPEC §9.18), con `customers.manage`. */
const props = defineProps<{ customer: AdminCustomer }>()

const status = useCustomerStatus(() => props.customer.id)
const anonymize = useAnonymizeCustomer(() => props.customer.id)
const toast = useToast()

type Kind = 'suspend' | 'reactivate' | 'anonymize'
const open = ref<Kind | null>(null)
const dialogOpen = computed({
  get: () => open.value !== null,
  set: (v) => {
    if (!v) open.value = null
  },
})

const name = computed(() => customerName(props.customer))
const COPY = computed(() => ({
  suspend: {
    title: `Suspender a ${name.value}`,
    description: 'No podrá iniciar sesión y se cerrarán sus sesiones abiertas.',
    confirmLabel: 'Suspender',
    color: 'warning' as const,
  },
  reactivate: {
    title: `Reactivar a ${name.value}`,
    description: 'Vuelve a entrar con su contraseña de siempre.',
    confirmLabel: 'Reactivar',
    color: 'primary' as const,
  },
  anonymize: {
    title: `Anonimizar a ${name.value}`,
    description:
      'Se borran para siempre su email, nombre, contraseña, direcciones y carritos, y los datos de contacto de sus pedidos y envíos. Los montos y estados de los pedidos se conservan.',
    confirmLabel: 'Anonimizar',
    color: 'error' as const,
  },
}))

async function submit(reason: string) {
  const kind = open.value
  const version = props.customer.version
  if (kind === 'anonymize') {
    const result = await anonymize.mutateAsync({ reason, version })
    notifySuccess(
      toast,
      'Cliente anonimizado',
      `También se anonimizaron ${result.anonymizedOrderCount} pedidos.`,
    )
  } else if (kind) {
    await status.mutateAsync({ action: kind, reason, version })
    notifySuccess(toast, kind === 'suspend' ? 'Cliente suspendido' : 'Cliente reactivado')
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <UButton
      v-if="canRunCustomer('reactivate', customer.status)"
      icon="i-lucide-rotate-ccw"
      @click="open = 'reactivate'"
      >Reactivar</UButton
    >
    <UButton
      v-if="canRunCustomer('suspend', customer.status)"
      icon="i-lucide-user-x"
      color="warning"
      variant="outline"
      @click="open = 'suspend'"
      >Suspender</UButton
    >
    <UButton
      v-if="canRunCustomer('anonymize', customer.status)"
      icon="i-lucide-eraser"
      color="error"
      variant="outline"
      @click="open = 'anonymize'"
      >Anonimizar</UButton
    >

    <ReasonDialog
      v-if="open"
      v-model:open="dialogOpen"
      v-bind="COPY[open]"
      :max-length="open === 'anonymize' ? 250 : 500"
      :reason-help="
        open === 'anonymize' ? 'Referencia de la solicitud ARCO, hasta 250 caracteres.' : undefined
      "
      :acknowledge="open === 'anonymize' ? 'Entiendo que no se puede deshacer.' : undefined"
      :hints="{
        'active-orders-exist':
          'Tiene pedidos sin concluir. Espera a que se entreguen, venzan o se reembolsen.',
      }"
      :submit="submit"
    />
  </div>
</template>
