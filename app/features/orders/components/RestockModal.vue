<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { notifySuccess } from '~/shared/api/feedback'
import type { ApiProblem } from '~/shared/api/problem'
import { useRestock } from '../api'
import { restockSchema } from '../schemas'
import type { RestockForm } from '../schemas'
import { RESTOCK_REASON_LABEL } from '../status'
import type { AdminOrder, RestockConflictLine, RestockReason } from '../types'

/** Reintegrar al inventario unidades de una orden (API_SPEC §15.7, ADR-0142). */
const props = defineProps<{ order: AdminOrder; reason: RestockReason }>()
const open = defineModel<boolean>('open', { required: true })

const maxByLine = computed(() =>
  Object.fromEntries(props.order.lines.map((l) => [l.id, l.quantity])),
)
const schema = computed(() => restockSchema(maxByLine.value))
const state = reactive<RestockForm>({ quantities: {}, note: '' })
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const restock = useRestock(() => props.order.id)
const toast = useToast()
// Una llave por solicitud: si el usuario reintenta tras un error de red, la API no reintegra dos veces.
let idempotencyKey = crypto.randomUUID()

watch(open, (isOpen) => {
  if (!isOpen) return
  state.quantities = Object.fromEntries(props.order.lines.map((l) => [l.id, 0]))
  state.note = ''
  problem.value = null
  idempotencyKey = crypto.randomUUID()
})
watch(
  () => [state.quantities, state.note],
  () => (idempotencyKey = crypto.randomUUID()),
  { deep: true },
)

/** El 409 trae lo vendido y lo ya reintegrado por línea (T-161). */
const conflictLines = computed(() => {
  const lines = problem.value?.extensions.lines
  if (problem.value?.type !== 'restock-not-allowed' || !Array.isArray(lines)) return []
  return (lines as RestockConflictLine[]).map((c) => {
    const line = props.order.lines.find((l) => l.id === c.orderLineId)
    return `${line?.sku ?? c.orderLineId}: vendidas ${c.sold}, ya reintegradas ${c.restocked}, pedidas ${c.requested}.`
  })
})

function fillAll() {
  state.quantities = { ...maxByLine.value }
}

async function onSubmit(event: FormSubmitEvent<RestockForm>) {
  problem.value = null
  const lines = Object.entries(event.data.quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([orderLineId, quantity]) => ({ orderLineId, quantity }))
  try {
    const result = await restock.mutateAsync({
      input: {
        reasonCode: props.reason,
        lines,
        ...(event.data.note ? { note: event.data.note } : {}),
      },
      idempotencyKey,
    })
    const units = result.movements.reduce((sum, m) => sum + m.quantity, 0)
    notifySuccess(toast, 'Stock reintegrado', `${units} unidades volvieron al inventario.`)
    open.value = false
  } catch (e) {
    problem.value = e as ApiProblem
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Reintegrar stock"
    :description="`Pedido ${order.publicCode} · Motivo: ${RESTOCK_REASON_LABEL[reason]}`"
  >
    <template #body>
      <UForm
        id="restock-form"
        ref="form"
        :schema="schema"
        :state="state"
        :validate-on="['input', 'change']"
        class="space-y-4"
        @submit="onSubmit"
      >
        <ProblemAlert v-if="problem" :problem="problem" :messages="conflictLines" />
        <p class="text-sm text-muted">
          Indica cuántas unidades de cada línea vuelven al inventario. La API no permite reintegrar
          más de lo vendido, contando reintegros anteriores.
        </p>
        <UFormField name="quantities">
          <ul class="divide-y divide-default rounded-md border border-default">
            <li
              v-for="line in order.lines"
              :key="line.id"
              class="flex items-center justify-between gap-3 p-2"
            >
              <div class="min-w-0 text-sm">
                <div class="font-medium">{{ line.sku }}</div>
                <div class="truncate text-muted">
                  {{ line.productName }} · vendidas {{ line.quantity }}
                </div>
              </div>
              <UFormField :name="`quantities.${line.id}`">
                <UInputNumber
                  v-model="state.quantities[line.id]"
                  :min="0"
                  :max="line.quantity"
                  :aria-label="`Unidades de ${line.sku}`"
                  class="w-32"
                />
              </UFormField>
            </li>
          </ul>
        </UFormField>
        <UButton color="neutral" variant="link" size="sm" class="px-0" @click="fillAll"
          >Todas las unidades vendidas</UButton
        >
        <UFormField label="Nota" name="note" help="Opcional. Hasta 500 caracteres.">
          <UTextarea v-model="state.note" :maxlength="500" autoresize class="w-full" />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">Cancelar</UButton>
        <UButton type="submit" form="restock-form" :loading="restock.isPending.value"
          >Reintegrar</UButton
        >
      </div>
    </template>
  </UModal>
</template>
