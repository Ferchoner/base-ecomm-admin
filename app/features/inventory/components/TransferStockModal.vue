<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { notifySuccess } from '~/shared/api/feedback'
import type { ApiProblem } from '~/shared/api/problem'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { useTransferStock } from '../api'
import type { TransferError } from '../api'
import { transferSchema } from '../schemas'
import type { TransferForm } from '../schemas'
import type { StockItem, Warehouse } from '../types'

/**
 * Mover unidades de una variante a otro almacén activo: un ajuste negativo en el origen y uno
 * positivo en el destino, con el motivo `WAREHOUSE_TRANSFER` (API_SPEC §13, ADR-0160, D-068).
 */
const props = defineProps<{ item: StockItem; fromName: string; destinations: Warehouse[] }>()
const open = defineModel<boolean>('open', { required: true })

const state = reactive<{
  fromWarehouseId: string
  toWarehouseId: string | undefined
  quantity: number | undefined
  note: string
}>({ fromWarehouseId: '', toWarehouseId: undefined, quantity: undefined, note: '' })
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
/** La salida ya quedó registrada y la entrada falló (GAPS G-20). */
const halfDone = ref(false)
const transfer = useTransferStock()
const toast = useToast()

// El modal se monta ya abierto desde la fila, así que se inicializa también al montarse.
watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    Object.assign(state, {
      fromWarehouseId: props.item.warehouseId,
      toWarehouseId: props.destinations.length === 1 ? props.destinations[0]!.id : undefined,
      quantity: undefined,
      note: '',
    })
    problem.value = null
    halfDone.value = false
  },
  { immediate: true },
)

const options = computed(() =>
  props.destinations.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })),
)
const destinationName = computed(() => {
  const w = props.destinations.find((d) => d.id === state.toWarehouseId)
  return w ? `${w.name} (${w.code})` : 'el destino'
})

async function run(d: TransferForm, inboundOnly: boolean) {
  problem.value = null
  try {
    await transfer.mutateAsync({
      variantId: props.item.variantId,
      fromWarehouseId: d.fromWarehouseId,
      toWarehouseId: d.toWarehouseId,
      quantity: d.quantity,
      note: d.note || null,
      inboundOnly,
    })
    notifySuccess(
      toast,
      'Transferencia registrada',
      `${d.quantity} unidades de ${props.item.sku} a ${destinationName.value}.`,
    )
    open.value = false
  } catch (e) {
    const { problem: p, applied } = e as TransferError
    halfDone.value = halfDone.value || applied
    const { fieldErrors, otherMessages } = problemFieldErrors(p, ['quantity', 'note'])
    if (!halfDone.value) form.value?.setErrors(fieldErrors)
    if (halfDone.value || fieldErrors.length === 0 || otherMessages.length > 0) problem.value = p
  }
}

const onSubmit = (event: FormSubmitEvent<TransferForm>) => run(event.data, false)

/** Repite solo la entrada al destino; la salida ya quedó registrada. */
function retryInbound() {
  void run(
    {
      fromWarehouseId: state.fromWarehouseId,
      toWarehouseId: state.toWarehouseId ?? '',
      quantity: state.quantity ?? 0,
      note: state.note,
    },
    true,
  )
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Transferir a otro almacén"
    :description="`${item.sku} · ${item.productTitle}`"
  >
    <template #body>
      <UForm
        id="transfer-form"
        ref="form"
        :schema="transferSchema"
        :state="state"
        :validate-on="['input', 'change']"
        :disabled="halfDone"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UAlert
          v-if="halfDone"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="La transferencia quedó a medias"
          :description="`Las ${state.quantity} unidades ya salieron de ${fromName}, pero no entraron a ${destinationName}. Vuelve a registrar la entrada; la salida no se repite.`"
        />
        <ProblemAlert v-if="problem" :problem="problem" />
        <p class="text-sm">
          Desde <strong>{{ fromName }}</strong
          >: {{ item.available }} disponibles de {{ item.onHand }} físicas.
        </p>
        <UFormField label="Almacén de destino" name="toWarehouseId" required>
          <USelect
            v-model="state.toWarehouseId"
            :items="options"
            placeholder="Elige el destino"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Cantidad" name="quantity" required help="De 1 a 100,000 unidades.">
          <UInputNumber
            v-model="state.quantity"
            :min="1"
            :max="Math.max(1, Math.min(100000, item.available))"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Nota" name="note" help="Opcional. Queda en los dos movimientos.">
          <UTextarea v-model="state.note" :maxlength="500" autoresize class="w-full" />
        </UFormField>
        <p class="text-sm text-muted">
          Se registran dos ajustes: la salida del origen y la entrada al destino.
        </p>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">{{
          halfDone ? 'Cerrar' : 'Cancelar'
        }}</UButton>
        <UButton v-if="halfDone" :loading="transfer.isPending.value" @click="retryInbound"
          >Registrar la entrada en el destino</UButton
        >
        <UButton v-else type="submit" form="transfer-form" :loading="transfer.isPending.value"
          >Transferir</UButton
        >
      </div>
    </template>
  </UModal>
</template>
