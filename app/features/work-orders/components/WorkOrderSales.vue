<script setup lang="ts">
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import type { ApiProblem } from '~/shared/api/problem'
import { useSessionStore } from '~/shared/auth/session.store'
import { ORDER_STATUS } from '~/shared/status/sales'
import { useConfirm } from '~/shared/ui/use-confirm'
import { formatDateTime } from '~/shared/utils/dates'
import { formatMoney } from '~/shared/utils/money'
import { useLinkSale, useStoreSaleSearch, useUnlinkSale } from '../api'
import { saleNotLinkableMessage } from '../status'
import type { LinkedSale, StoreSale, WorkOrder } from '../types'

/**
 * Ventas de mostrador que cobran la orden de trabajo (API_SPEC §25.7, §25.8). Se ligan mientras la
 * orden está abierta: una nueva desde "Vender en tienda", o una ya colocada por su código. Una
 * venta liga a una sola orden; ligar o desligar nunca se reintenta solo.
 */
const props = defineProps<{
  workOrder: WorkOrder
  editable: boolean
  /** Venta recién colocada desde esta orden, para ligarla con un clic. */
  pending?: { orderId: string; code: string } | null
}>()
const emit = defineEmits<{ 'pending-done': [] }>()

const session = useSessionStore()
const canSell = computed(() => session.can('orders.place'))
const canSearch = computed(() => session.can('orders.read'))
const toast = useToast()
const confirm = useConfirm()

const newSaleLink = computed(
  () =>
    `/pedidos/nuevo?ordenTrabajo=${encodeURIComponent(props.workOrder.id)}&folio=${encodeURIComponent(props.workOrder.folio)}`,
)

const linked = (orderId: string) => props.workOrder.sales.some((s) => s.orderId === orderId)
const pendingSale = computed(() =>
  props.pending && !linked(props.pending.orderId) ? props.pending : null,
)

// ── Ligar una venta ya colocada, por su código (escrito o escaneado del ticket) ──
const code = ref('')
const searched = ref('')
const sales = useStoreSaleSearch(searched)
const results = computed(() => (searched.value ? (sales.data.value?.data ?? []) : []))
function search() {
  searched.value = code.value.trim()
}

const problem = ref<ApiProblem | null>(null)
const messages = ref<string[]>([])
const link = useLinkSale(() => props.workOrder.id)
const unlink = useUnlinkSale(() => props.workOrder.id)
const busy = ref<string | null>(null)

function explain(p: ApiProblem): string[] {
  if (p.type === 'sale-not-linkable') return [saleNotLinkableMessage(p.extensions.saleStatus)]
  if (p.type === 'duplicate-value')
    return ['Esa venta ya está ligada a una orden de trabajo. Deslígala de esa orden primero.']
  if (p.type === 'invalid-state-transition')
    return ['La orden ya se entregó o se canceló: ya no cambian sus ventas.']
  if (p.status === 404) return ['La venta no existe o no es de la tienda física.']
  return []
}

async function onLink(orderId: string, publicCode: string) {
  problem.value = null
  messages.value = []
  busy.value = orderId
  try {
    await link.mutateAsync({ orderId, version: props.workOrder.version })
    notifySuccess(toast, `Venta ${publicCode} ligada`)
    code.value = ''
    searched.value = ''
    if (props.pending?.orderId === orderId) emit('pending-done')
  } catch (e) {
    const p = e as ApiProblem
    if (p.type === 'version-conflict') return notifyProblem(toast, p)
    problem.value = p
    messages.value = explain(p)
  } finally {
    busy.value = null
  }
}

async function onUnlink(sale: LinkedSale) {
  const ok = await confirm({
    title: `¿Desligar la venta ${sale.publicCode}?`,
    description:
      'Deja de cobrar esta orden de trabajo y queda libre para ligarla a otra. La venta no se cancela.',
    confirmLabel: 'Desligar',
    color: 'warning',
  })
  if (!ok) return
  problem.value = null
  messages.value = []
  busy.value = sale.orderId
  try {
    await unlink.mutateAsync({ orderId: sale.orderId, version: props.workOrder.version })
    notifySuccess(toast, `Venta ${sale.publicCode} desligada`)
  } catch (e) {
    const p = e as ApiProblem
    if (p.type === 'version-conflict') return notifyProblem(toast, p)
    problem.value = p
    messages.value = explain(p)
  } finally {
    busy.value = null
  }
}

const NOT_LINKABLE = new Set(['EXPIRED', 'CANCELLED', 'REFUNDED'])
const resultNote = (s: StoreSale) =>
  linked(s.id)
    ? 'Ya está ligada a esta orden.'
    : NOT_LINKABLE.has(s.status)
      ? saleNotLinkableMessage(s.status)
      : null
</script>

<template>
  <div class="space-y-4">
    <ProblemAlert v-if="problem" :problem="problem" :messages="messages" />

    <UAlert
      v-if="pendingSale && editable"
      color="info"
      variant="subtle"
      icon="i-lucide-link"
      :title="`Venta ${pendingSale.code} colocada`"
      description="Lígala para que cobre esta orden de trabajo."
      :actions="[
        {
          label: 'Ligar venta',
          loading: busy === pendingSale.orderId,
          onClick: () => onLink(pendingSale!.orderId, pendingSale!.code),
        },
        {
          label: 'Ahora no',
          color: 'neutral',
          variant: 'ghost',
          onClick: () => emit('pending-done'),
        },
      ]"
    />

    <p v-if="workOrder.sales.length === 0" class="text-sm text-muted">
      Sin ventas ligadas. La orden no cobra: se cobra con una venta de mostrador.
    </p>
    <ul v-else class="divide-y divide-default text-sm" aria-label="Ventas ligadas">
      <li
        v-for="sale in workOrder.sales"
        :key="sale.orderId"
        class="flex flex-wrap items-center justify-between gap-2 py-2"
      >
        <div class="space-y-0.5">
          <div class="flex flex-wrap items-center gap-2">
            <NuxtLink
              v-if="canSearch"
              :to="`/pedidos/${sale.orderId}`"
              class="font-mono font-medium hover:underline"
              >{{ sale.publicCode }}</NuxtLink
            >
            <span v-else class="font-mono font-medium">{{ sale.publicCode }}</span>
            <StatusBadge :value="sale.status" :styles="ORDER_STATUS" />
          </div>
          <div class="text-xs text-muted">
            {{ formatDateTime(sale.placedAt) }} ·
            {{ sale.paid ? `pagada ${formatDateTime(sale.paidAt)}` : 'sin pagar' }}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-medium tabular-nums">{{ formatMoney(sale.grandTotal) }}</span>
          <UButton
            v-if="editable"
            icon="i-lucide-unlink"
            color="neutral"
            variant="ghost"
            size="sm"
            :loading="busy === sale.orderId"
            :aria-label="`Desligar ${sale.publicCode}`"
            @click="onUnlink(sale)"
          />
        </div>
      </li>
    </ul>

    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt class="text-muted">Cobrado</dt>
      <dd class="text-right font-medium tabular-nums">{{ formatMoney(workOrder.paidTotal) }}</dd>
      <dt class="text-muted">Por cobrar</dt>
      <dd class="text-right font-medium tabular-nums">
        {{ formatMoney(workOrder.unpaidTotal) }}
      </dd>
    </dl>

    <template v-if="editable">
      <UButton
        v-if="canSell"
        :to="newSaleLink"
        icon="i-lucide-store"
        color="neutral"
        variant="outline"
        block
        >Nueva venta para esta orden</UButton
      >
      <div v-if="canSearch" class="space-y-2">
        <form class="flex gap-2" @submit.prevent="search">
          <UInput
            v-model="code"
            icon="i-lucide-scan-barcode"
            placeholder="Código de la venta"
            aria-label="Código de la venta a ligar"
            class="flex-1"
            :maxlength="64"
          />
          <UButton type="submit" color="neutral" variant="outline" :loading="sales.isFetching.value"
            >Buscar</UButton
          >
        </form>
        <p class="text-xs text-muted">
          Escanea el código del ticket o escríbelo. Solo se ligan ventas de la tienda física.
        </p>
        <ul
          v-if="searched && sales.data.value"
          class="divide-y divide-default rounded-md border border-default"
          aria-label="Ventas encontradas"
        >
          <li
            v-for="s in results"
            :key="s.id"
            class="flex items-center justify-between gap-2 p-2 text-sm"
          >
            <div>
              <div class="flex items-center gap-2">
                <span class="font-mono font-medium">{{ s.publicCode }}</span>
                <StatusBadge :value="s.status" :styles="ORDER_STATUS" />
              </div>
              <div class="text-xs text-muted">
                {{ formatDateTime(s.placedAt) }} · {{ formatMoney(s.grandTotal) }}
              </div>
              <div v-if="resultNote(s)" class="text-xs text-muted">{{ resultNote(s) }}</div>
            </div>
            <UButton
              size="sm"
              :disabled="!!resultNote(s)"
              :loading="busy === s.id"
              :aria-label="`Ligar ${s.publicCode}`"
              @click="onLink(s.id, s.publicCode)"
              >Ligar</UButton
            >
          </li>
          <li v-if="results.length === 0" class="p-2 text-sm text-muted">
            Ninguna venta de la tienda física con ese código.
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
