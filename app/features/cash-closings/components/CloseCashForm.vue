<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { notifySuccess } from '~/shared/api/feedback'
import type { ApiProblem } from '~/shared/api/problem'
import type { Money } from '~/shared/api/types'
import { useConfirm } from '~/shared/ui/use-confirm'
import { formatCalendarDate } from '~/shared/utils/dates'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { formatMoney } from '~/shared/utils/money'
import { useCloseCash } from '../api'
import { MAX_CLOSING_NOTE, closeCashSchema, countedCents, toCloseCashInput } from '../schemas'
import type { CloseCashForm } from '../schemas'
import { differenceTone } from '../status'

/**
 * Cerrar la caja de un local (UC-ORD-17, D-099): se escribe el efectivo contado, se ve la diferencia
 * mientras se escribe y, si no cuadra, se dice por qué. Un cierre no se deshace.
 */
const props = defineProps<{
  warehouseId: string
  warehouseName: string
  date: string
  expectedCash: Money
}>()

const state = reactive<CloseCashForm>({ counted: '', note: '' })
const schema = computed(() => closeCashSchema(props.expectedCash.amount))
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const problemMessages = ref<string[]>([])

const counted = computed(() => countedCents(state.counted))
const difference = computed(() =>
  counted.value === null ? null : counted.value - props.expectedCash.amount,
)
const tone = computed(() => (difference.value === null ? null : differenceTone(difference.value)))
const money = (amount: number) => formatMoney({ amount, currency: props.expectedCash.currency })

const close = useCloseCash()
const confirm = useConfirm()
const toast = useToast()

async function onSubmit(event: FormSubmitEvent<CloseCashForm>) {
  problem.value = null
  problemMessages.value = []
  const cents = countedCents(event.data.counted)
  if (cents === null) return
  const ok = await confirm({
    title: '¿Cerrar la caja?',
    description: `${props.warehouseName}, ${formatCalendarDate(props.date)}: contado ${money(cents)}, esperado ${money(props.expectedCash.amount)}. El cierre no se puede editar ni borrar.`,
    confirmLabel: 'Cerrar caja',
    color: difference.value === 0 ? 'primary' : 'warning',
  })
  if (!ok) return
  try {
    await close.mutateAsync(toCloseCashInput(event.data, props.warehouseId, props.date))
    notifySuccess(
      toast,
      'Caja cerrada',
      `${props.warehouseName}, ${formatCalendarDate(props.date)}.`,
    )
    state.counted = ''
    state.note = ''
  } catch (e) {
    const p = e as ApiProblem
    if (p.type === 'duplicate-value')
      problemMessages.value = ['Este día ya se cerró en otro equipo: abajo está su cierre.']
    const { fieldErrors, otherMessages } = problemFieldErrors(p, ['counted', 'note'], {
      countedCash: 'counted',
    })
    form.value?.setErrors(fieldErrors)
    if (p.type !== 'duplicate-value') problemMessages.value.push(...otherMessages)
    problem.value = p
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="font-semibold">Cerrar la caja</h3>
      <p class="text-sm text-muted">
        Cuenta el efectivo de la caja y escríbelo. Se guardan las cifras de este momento.
      </p>
    </template>
    <UForm
      ref="form"
      :schema="schema"
      :state="state"
      :validate-on="['change']"
      class="space-y-4"
      @submit="onSubmit"
    >
      <ProblemAlert v-if="problem" :problem="problem" :messages="problemMessages" />
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Efectivo contado" name="counted" required>
          <UInput
            v-model="state.counted"
            inputmode="decimal"
            placeholder="0.00"
            icon="i-lucide-dollar-sign"
            autocomplete="off"
            class="w-full"
          />
        </UFormField>
        <div class="text-sm">
          <div class="text-muted">Esperado: {{ formatMoney(expectedCash) }}</div>
          <div v-if="difference !== null && tone" aria-live="polite">
            Diferencia: <span class="font-semibold">{{ money(difference) }}</span>
            <UBadge :color="tone.color" variant="subtle" class="ml-1">{{ tone.label }}</UBadge>
          </div>
        </div>
      </div>
      <UFormField
        label="Nota"
        name="note"
        :required="difference !== null && difference !== 0"
        help="Obligatoria si el efectivo no cuadra: por qué falta o sobra."
      >
        <UTextarea v-model="state.note" :maxlength="MAX_CLOSING_NOTE" :rows="2" class="w-full" />
      </UFormField>
      <UButton type="submit" icon="i-lucide-lock" :loading="close.isPending.value"
        >Cerrar caja</UButton
      >
    </UForm>
  </UCard>
</template>
