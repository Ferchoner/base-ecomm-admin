<script setup lang="ts">
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import { useSessionStore } from '~/shared/auth/session.store'
import { useConfirm } from '~/shared/ui/use-confirm'
import { useHandOver, useReorder, useRetryFulfillment } from '../api'
import { canRun, restockReason } from '../status'
import type { AdminOrder } from '../types'
import BlockedDataModal from './BlockedDataModal.vue'
import CancelOrderModal from './CancelOrderModal.vue'
import ManualCaptureModal from './ManualCaptureModal.vue'
import RestockModal from './RestockModal.vue'

/** Acciones de la orden según su estado y los permisos de `GET /v1/me`; la API decide al final. */
const props = defineProps<{ order: AdminOrder }>()

const session = useSessionStore()
const canManage = computed(() => session.can('orders.manage'))
const canCapture = computed(() => session.can('payments.manage'))
const canRestock = computed(() => session.can('inventory.write'))
const canReadBlocked = computed(() => session.can('orders.read-blocked'))
const canHandOver = computed(
  () =>
    session.can('orders.place') &&
    props.order.fulfillment === 'IN_STORE' &&
    props.order.status === 'PAID',
)

const status = computed(() => props.order.status)
const reason = computed(() => restockReason(props.order))

const showCancel = ref(false)
const showCapture = ref(false)
const showRestock = ref(false)
const showBlocked = ref(false)

const retry = useRetryFulfillment(() => props.order.id)
const reorder = useReorder(() => props.order.id)
const handOver = useHandOver(() => props.order.id)
const confirm = useConfirm()
const toast = useToast()

async function runRetry() {
  const ok = await confirm({
    title: '¿Reintentar el surtido?',
    description:
      'Se intenta apartar y confirmar el stock. Si lo consigue, el pedido pasa a Pagado.',
    confirmLabel: 'Reintentar',
  })
  if (!ok) return
  try {
    await retry.mutateAsync(props.order.version)
    notifySuccess(toast, 'Surtido confirmado', 'El pedido pasó a Pagado.')
  } catch (e) {
    notifyProblem(toast, e)
  }
}

async function runHandOver() {
  const ok = await confirm({
    title: '¿Entregar el pedido al cliente?',
    description:
      'Confirma que el cliente se lleva la mercancía. El pedido pasa a Entregado y concluye.',
    confirmLabel: 'Entregar',
  })
  if (!ok) return
  try {
    await handOver.mutateAsync(props.order.version)
    notifySuccess(toast, 'Pedido entregado', 'El cliente se llevó la mercancía.')
  } catch (e) {
    notifyProblem(toast, e)
  }
}

async function runReorder() {
  const ok = await confirm({
    title: '¿Volver a comprar este pedido?',
    description: props.order.customerId
      ? 'Las líneas que se siguen vendiendo se agregan al carrito activo del cliente.'
      : 'Se reactiva el carrito original del invitado con las líneas que se siguen vendiendo.',
    confirmLabel: 'Copiar al carrito',
  })
  if (!ok) return
  try {
    const result = await reorder.mutateAsync(undefined)
    const skipped = result.skippedVariantIds.length
    notifySuccess(
      toast,
      'Líneas copiadas al carrito',
      skipped ? `${skipped} variantes ya no se venden y se omitieron.` : undefined,
    )
  } catch (e) {
    notifyProblem(toast, e)
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <UButton
      v-if="canCapture && canRun('manualCapture', status)"
      icon="i-lucide-banknote"
      @click="showCapture = true"
      >Registrar pago</UButton
    >
    <UButton
      v-if="canHandOver"
      icon="i-lucide-hand-helping"
      :loading="handOver.isPending.value"
      @click="runHandOver"
      >Entregar en tienda</UButton
    >
    <UButton
      v-if="canManage && canRun('retryFulfillment', status)"
      icon="i-lucide-refresh-cw"
      :loading="retry.isPending.value"
      @click="runRetry"
      >Reintentar surtido</UButton
    >
    <UButton
      v-if="canRestock && reason"
      icon="i-lucide-package-plus"
      color="neutral"
      variant="outline"
      @click="showRestock = true"
      >Reintegrar stock</UButton
    >
    <UButton
      v-if="canManage && canRun('reorder', status)"
      icon="i-lucide-shopping-cart"
      color="neutral"
      variant="outline"
      :loading="reorder.isPending.value"
      @click="runReorder"
      >Volver a comprar</UButton
    >
    <UButton
      v-if="canReadBlocked && order.blockedAt && !order.anonymizedAt"
      icon="i-lucide-lock-open"
      color="neutral"
      variant="outline"
      @click="showBlocked = true"
      >Ver datos bloqueados</UButton
    >
    <UButton
      v-if="canManage && canRun('cancel', status)"
      icon="i-lucide-circle-x"
      color="error"
      variant="outline"
      @click="showCancel = true"
      >Cancelar pedido</UButton
    >

    <CancelOrderModal v-model:open="showCancel" :order="order" :can-restock="canRestock" />
    <ManualCaptureModal v-model:open="showCapture" :order="order" />
    <RestockModal v-if="reason" v-model:open="showRestock" :order="order" :reason="reason" />
    <BlockedDataModal v-model:open="showBlocked" :order="order" />
  </div>
</template>
