<script setup lang="ts">
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import { useBringStock, useVariantStockEverywhere } from '../api'
import type { SellableStock } from '../types'

/**
 * "Traer del otro local" en una línea que no alcanza aquí (ADR-0172 de base-shop): traslada primero
 * lo que falta, con motivo `SALE`, y la venta se cobra después en este almacén, así que el cobro queda
 * en el corte de este local. Un traslado equivocado se cancela en Traslados en sus primeros 10 minutos.
 */
const props = defineProps<{
  variantId: string
  sku: string
  /** Unidades de la línea. */
  quantity: number
  /** El almacén de la venta, a donde llegan. */
  warehouseId: string
  warehouseNames: Record<string, string>
}>()

const everywhere = useVariantStockEverywhere(() => props.variantId)
const hereAvailable = computed(
  () => everywhere.data.value?.find((s) => s.warehouseId === props.warehouseId)?.available ?? 0,
)
const missing = computed(() => Math.max(1, props.quantity - hereAvailable.value))
const sources = computed(() =>
  (everywhere.data.value ?? [])
    .filter((s) => s.warehouseId !== props.warehouseId && s.available > 0)
    .sort((a, b) => b.available - a.available),
)
const bring = useBringStock()
const toast = useToast()
const bringing = ref<string | null>(null)
// Una llave por intento: si se reintenta tras un error de red, la API no traslada dos veces.
let idempotencyKey = crypto.randomUUID()
watch(
  () => [props.quantity, props.warehouseId, hereAvailable.value],
  () => (idempotencyKey = crypto.randomUUID()),
)

const nameOf = (id: string) => props.warehouseNames[id] ?? 'otro almacén'
const unitsToBring = (s: SellableStock) => Math.min(missing.value, s.available)

async function bringFrom(s: SellableStock) {
  const quantity = unitsToBring(s)
  bringing.value = s.warehouseId
  try {
    const done = await bring.mutateAsync({
      idempotencyKey,
      input: {
        kind: 'TRANSFER',
        reason: 'SALE',
        fromWarehouseId: s.warehouseId,
        toWarehouseId: props.warehouseId,
        lines: [{ variantId: props.variantId, quantity }],
        note: 'Para vender en mostrador',
      },
    })
    idempotencyKey = crypto.randomUUID()
    notifySuccess(
      toast,
      `Traslado ${done.folio} registrado`,
      `${quantity} ${quantity === 1 ? 'unidad' : 'unidades'} de ${props.sku} llegaron de ${nameOf(s.warehouseId)}. Si fue un error, se cancela en Inventario → Traslados en los próximos 10 minutos.`,
    )
  } catch (e) {
    notifyProblem(toast, e, () => everywhere.refetch())
  } finally {
    bringing.value = null
  }
}
</script>

<template>
  <div class="mt-1 flex flex-wrap items-center gap-2">
    <span v-if="everywhere.isPending.value" class="text-xs text-muted"
      >Buscando en los otros locales…</span
    >
    <span v-else-if="everywhere.isError.value" class="text-xs text-muted"
      >No se pudo consultar los otros locales.</span
    >
    <span v-else-if="sources.length === 0" class="text-xs text-muted"
      >Tampoco hay disponibles en los otros almacenes.</span
    >
    <template v-else>
      <UButton
        v-for="s in sources"
        :key="s.warehouseId"
        size="xs"
        color="primary"
        variant="soft"
        icon="i-lucide-arrow-right-left"
        :loading="bringing === s.warehouseId"
        :disabled="bring.isPending.value"
        @click="bringFrom(s)"
        >Traer {{ unitsToBring(s) }} de {{ nameOf(s.warehouseId)
        }}{{ s.location ? ` (${s.location})` : '' }}</UButton
      >
      <span v-if="sources[0]!.available < missing" class="text-xs text-muted"
        >Faltan {{ missing }}: ningún almacén tiene todas.</span
      >
    </template>
  </div>
</template>
