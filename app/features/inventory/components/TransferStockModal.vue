<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { notifySuccess } from '~/shared/api/feedback'
import type { ApiProblem } from '~/shared/api/problem'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { useCreateTransfer } from '../api'
import { transferSchema } from '../schemas'
import type { TransferForm } from '../schemas'
import { LOAN_DURATION_OPTIONS, LOAN_MINUTES, TRANSFER_REASON_OPTIONS } from '../status'
import type { StockItem, TransferKind, Warehouse } from '../types'

/**
 * Trasladar unidades de una variante a otro almacén activo, o prestarlas para mostrarlas con una hora
 * de regreso, en un solo paso (API_SPEC §13, ADR-0172). Un traslado equivocado se cancela en sus
 * primeros 10 minutos desde Traslados.
 */
const props = defineProps<{
  item: StockItem
  fromName: string
  destinations: Warehouse[]
  kind?: TransferKind
}>()
const open = defineModel<boolean>('open', { required: true })

const state = reactive<{
  kind: TransferKind
  reason: 'SALE' | 'RESTOCK' | 'OTHER'
  loanMinutes: number
  fromWarehouseId: string
  toWarehouseId: string | undefined
  quantity: number | undefined
  note: string
}>({
  kind: 'TRANSFER',
  reason: 'SALE',
  loanMinutes: LOAN_MINUTES.default,
  fromWarehouseId: '',
  toWarehouseId: undefined,
  quantity: undefined,
  note: '',
})
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const transfer = useCreateTransfer()
const toast = useToast()
// Una llave por intento: si se reintenta tras un error de red, la API no mueve dos veces.
let idempotencyKey = crypto.randomUUID()

// El modal se monta ya abierto desde la fila, así que se inicializa también al montarse.
watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    Object.assign(state, {
      kind: props.kind ?? 'TRANSFER',
      reason: 'SALE',
      loanMinutes: LOAN_MINUTES.default,
      fromWarehouseId: props.item.warehouseId,
      toWarehouseId: props.destinations.length === 1 ? props.destinations[0]!.id : undefined,
      quantity: undefined,
      note: '',
    })
    problem.value = null
    idempotencyKey = crypto.randomUUID()
  },
  { immediate: true },
)
watch(
  () => ({ ...state }),
  () => (idempotencyKey = crypto.randomUUID()),
)

const KIND_OPTIONS = [
  { value: 'TRANSFER', label: 'Trasladar' },
  { value: 'LOAN', label: 'Prestar para mostrar' },
]
const options = computed(() =>
  props.destinations.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })),
)
const destinationName = computed(() => {
  const w = props.destinations.find((d) => d.id === state.toWarehouseId)
  return w ? `${w.name} (${w.code})` : 'el destino'
})
const isLoan = computed(() => state.kind === 'LOAN')

async function onSubmit(event: FormSubmitEvent<TransferForm>) {
  const d = event.data
  problem.value = null
  try {
    const done = await transfer.mutateAsync({
      idempotencyKey,
      input: {
        kind: d.kind,
        reason: d.kind === 'LOAN' ? 'SHOW' : d.reason,
        fromWarehouseId: d.fromWarehouseId,
        toWarehouseId: d.toWarehouseId,
        lines: [{ variantId: props.item.variantId, quantity: d.quantity }],
        ...(d.note && { note: d.note }),
        ...(d.kind === 'LOAN' && {
          returnBy: new Date(Date.now() + d.loanMinutes * 60_000).toISOString(),
        }),
      },
    })
    notifySuccess(
      toast,
      d.kind === 'LOAN' ? `Préstamo ${done.folio} registrado` : `Traslado ${done.folio} registrado`,
      `${d.quantity} ${d.quantity === 1 ? 'unidad' : 'unidades'} de ${props.item.sku} a ${destinationName.value}. Se puede cancelar en los próximos 10 minutos.`,
    )
    open.value = false
  } catch (e) {
    const p = e as ApiProblem
    const { fieldErrors, otherMessages } = problemFieldErrors(p, ['quantity', 'note'])
    form.value?.setErrors(fieldErrors)
    if (fieldErrors.length === 0 || otherMessages.length > 0) problem.value = p
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="isLoan ? 'Prestar para mostrar' : 'Trasladar a otro almacén'"
    :description="`${item.sku} · ${item.productTitle}`"
  >
    <template #body>
      <UForm
        id="transfer-form"
        ref="form"
        :schema="transferSchema"
        :state="state"
        :validate-on="['input', 'change']"
        class="space-y-4"
        @submit="onSubmit"
      >
        <ProblemAlert v-if="problem" :problem="problem" />
        <URadioGroup
          v-model="state.kind"
          :items="KIND_OPTIONS"
          orientation="horizontal"
          aria-label="Tipo"
        />
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
        <UFormField
          label="Cantidad"
          name="quantity"
          required
          help="Solo las disponibles; las apartadas para un pedido no se mueven."
        >
          <UInputNumber
            v-model="state.quantity"
            :min="1"
            :max="Math.max(1, Math.min(100000, item.available))"
            class="w-full"
          />
        </UFormField>
        <UFormField v-if="!isLoan" label="Motivo" name="reason" required>
          <USelect v-model="state.reason" :items="TRANSFER_REASON_OPTIONS" class="w-full" />
        </UFormField>
        <UFormField
          v-else
          label="Debe regresar en"
          name="loanMinutes"
          required
          help="Pasada esa hora, el préstamo sale como vencido hasta que se cierre."
        >
          <USelect v-model="state.loanMinutes" :items="LOAN_DURATION_OPTIONS" class="w-full" />
        </UFormField>
        <UFormField
          label="Nota"
          name="note"
          :required="!isLoan && state.reason === 'OTHER'"
          help="Queda en el folio y en los dos movimientos."
        >
          <UTextarea v-model="state.note" :maxlength="500" autoresize class="w-full" />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">Cancelar</UButton>
        <UButton type="submit" form="transfer-form" :loading="transfer.isPending.value">{{
          isLoan ? 'Prestar' : 'Trasladar'
        }}</UButton>
      </div>
    </template>
  </UModal>
</template>
