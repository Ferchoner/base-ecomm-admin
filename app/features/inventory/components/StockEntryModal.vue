<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ApiProblem } from '~/shared/api/problem'
import { notifySuccess } from '~/shared/api/feedback'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { useCreateAdjustment, useCreateReceipt } from '../api'
import { adjustmentSchema, receiptSchema } from '../schemas'
import type { AdjustmentForm, ReceiptForm } from '../schemas'
import { ADJUSTMENT_REASONS, DECREASE_ONLY, REASON_LABEL } from '../status'
import type { StockItem } from '../types'

/**
 * Entrada de mercancía o ajuste de una variante en un almacén (API_SPEC §13). Las entradas solo van a
 * un almacén activo; los ajustes, a cualquiera (ADR-0160).
 */
const props = defineProps<{
  mode: 'receipt' | 'adjustment'
  variantId: string
  sku: string
  productTitle?: string
  warehouseId: string
  warehouseName: string
  /** Existencia actual, si la variante ya tiene stock item. */
  stock?: StockItem | null
}>()
const open = defineModel<boolean>('open', { required: true })

const receipt = reactive<{ quantity: number | undefined; note: string }>({
  quantity: undefined,
  note: '',
})
const adjustment = reactive<{
  direction: AdjustmentForm['direction']
  quantity: number | undefined
  reasonCode: AdjustmentForm['reasonCode'] | undefined
  note: string
}>({ direction: 'decrease', quantity: undefined, reasonCode: undefined, note: '' })

const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const createReceipt = useCreateReceipt()
const createAdjustment = useCreateAdjustment()
const saving = computed(() => createReceipt.isPending.value || createAdjustment.isPending.value)
const toast = useToast()

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(receipt, { quantity: undefined, note: '' })
  Object.assign(adjustment, {
    direction: 'decrease',
    quantity: undefined,
    reasonCode: undefined,
    note: '',
  })
  problem.value = null
})

const DIRECTIONS = [
  { value: 'decrease', label: 'Restar' },
  { value: 'increase', label: 'Sumar' },
]
const reasons = computed(() =>
  ADJUSTMENT_REASONS.filter(
    (r) => adjustment.direction === 'decrease' || !DECREASE_ONLY.includes(r),
  ).map((r) => ({
    value: r,
    label: REASON_LABEL[r],
  })),
)
watch(
  () => adjustment.direction,
  (d) => {
    if (d === 'increase' && adjustment.reasonCode && DECREASE_ONLY.includes(adjustment.reasonCode))
      adjustment.reasonCode = undefined
  },
)

/** Vista previa de las unidades físicas; la API decide si el ajuste procede. */
const onHandAfter = computed(() => {
  const q = props.mode === 'receipt' ? receipt.quantity : adjustment.quantity
  if (!q) return null
  const sign = props.mode === 'adjustment' && adjustment.direction === 'decrease' ? -1 : 1
  return (props.stock?.onHand ?? 0) + sign * q
})

const FIELDS = ['quantity', 'note', 'reasonCode']

async function onSubmit(event: FormSubmitEvent<ReceiptForm | AdjustmentForm>) {
  problem.value = null
  const base = { variantId: props.variantId, warehouseId: props.warehouseId }
  try {
    if (props.mode === 'receipt') {
      const d = event.data as ReceiptForm
      await createReceipt.mutateAsync({ ...base, quantity: d.quantity, note: d.note || null })
      notifySuccess(toast, 'Entrada registrada', `${d.quantity} unidades de ${props.sku}.`)
    } else {
      const d = event.data as AdjustmentForm
      const quantity = d.direction === 'decrease' ? -d.quantity : d.quantity
      await createAdjustment.mutateAsync({
        ...base,
        quantity,
        reasonCode: d.reasonCode,
        note: d.note || null,
      })
      notifySuccess(
        toast,
        'Ajuste registrado',
        `${quantity > 0 ? '+' : ''}${quantity} unidades de ${props.sku}.`,
      )
    }
    open.value = false
  } catch (e) {
    const p = e as ApiProblem
    const { fieldErrors, otherMessages } = problemFieldErrors(p, FIELDS)
    form.value?.setErrors(fieldErrors)
    if (fieldErrors.length === 0 || otherMessages.length > 0) problem.value = p
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="mode === 'receipt' ? 'Registrar entrada' : 'Ajustar existencias'"
    :description="`${productTitle ? `${sku} · ${productTitle}` : sku} · ${warehouseName}`"
  >
    <template #body>
      <UForm
        id="stock-entry-form"
        ref="form"
        :schema="mode === 'receipt' ? receiptSchema : adjustmentSchema"
        :state="mode === 'receipt' ? receipt : adjustment"
        :validate-on="['input', 'change']"
        class="space-y-4"
        @submit="onSubmit"
      >
        <ProblemAlert v-if="problem" :problem="problem" />

        <dl
          v-if="stock"
          class="grid grid-cols-3 gap-2 rounded-md bg-elevated/50 p-3 text-center text-sm"
        >
          <div>
            <dt class="text-muted">Físicas</dt>
            <dd class="font-semibold">{{ stock.onHand }}</dd>
          </div>
          <div>
            <dt class="text-muted">Apartadas</dt>
            <dd class="font-semibold">{{ stock.reserved }}</dd>
          </div>
          <div>
            <dt class="text-muted">Disponibles</dt>
            <dd class="font-semibold">{{ stock.available }}</dd>
          </div>
        </dl>

        <template v-if="mode === 'receipt'">
          <UFormField label="Cantidad" name="quantity" required help="De 1 a 100,000 unidades.">
            <UInputNumber v-model="receipt.quantity" :min="1" :max="100000" class="w-full" />
          </UFormField>
          <UFormField label="Nota" name="note" help="Opcional, como el número de remisión.">
            <UInput v-model="receipt.note" :maxlength="500" class="w-full" />
          </UFormField>
        </template>

        <template v-else>
          <URadioGroup
            v-model="adjustment.direction"
            :items="DIRECTIONS"
            orientation="horizontal"
            legend="Movimiento"
          />
          <UFormField label="Cantidad" name="quantity" required>
            <UInputNumber v-model="adjustment.quantity" :min="1" :max="100000" class="w-full" />
          </UFormField>
          <UFormField label="Motivo" name="reasonCode" required>
            <USelect
              v-model="adjustment.reasonCode"
              :items="reasons"
              placeholder="Elige un motivo"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Nota"
            name="note"
            :required="adjustment.reasonCode === 'OTHER'"
            :help="
              adjustment.reasonCode === 'OTHER' ? 'Obligatoria con el motivo Otro.' : 'Opcional.'
            "
          >
            <UTextarea v-model="adjustment.note" :maxlength="500" autoresize class="w-full" />
          </UFormField>
        </template>

        <p v-if="onHandAfter !== null" class="text-sm text-muted" aria-live="polite">
          Quedarán {{ onHandAfter }} unidades físicas.
        </p>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">Cancelar</UButton>
        <UButton type="submit" form="stock-entry-form" :loading="saving">
          {{ mode === 'receipt' ? 'Registrar entrada' : 'Registrar ajuste' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
