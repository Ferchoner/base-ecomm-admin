<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ApiProblem } from '~/shared/api/problem'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import { useConfirm } from '~/shared/ui/use-confirm'
import { formatDateTime } from '~/shared/utils/dates'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { formatMoney, pesosTextToCents } from '~/shared/utils/money'
import { useCancelScheduledPrice, usePricePeriods, useSetPrice } from '../api'
import { priceSchema } from '../schemas'
import type { PriceForm } from '../schemas'
import { PERIOD_STATE } from '../status'
import type { PricePeriod } from '../types'

/** Precio vigente, programados e historial de una variante en una lista (API_SPEC §12). */
const props = defineProps<{ listId: string; variantId: string; title: string; canWrite: boolean }>()
const open = defineModel<boolean>('open', { required: true })

const { data, isPending, error, refetch } = usePricePeriods(
  () => props.listId,
  () => props.variantId,
)
const setPrice = useSetPrice(
  () => props.listId,
  () => props.variantId,
)
const cancel = useCancelScheduledPrice(
  () => props.listId,
  () => props.variantId,
)
const confirm = useConfirm()
const toast = useToast()

const state = reactive<PriceForm>({
  amount: '',
  compareAtAmount: '',
  mode: 'now',
  effectiveFrom: '',
})
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(state, { amount: '', compareAtAmount: '', mode: 'now', effectiveFrom: '' })
  problem.value = null
})

const MODES = [
  { value: 'now', label: 'Desde ahora' },
  { value: 'scheduled', label: 'Programar' },
]

async function onSubmit(event: FormSubmitEvent<PriceForm>) {
  problem.value = null
  const d = event.data
  try {
    const period = await setPrice.mutateAsync({
      amount: pesosTextToCents(d.amount),
      compareAtAmount: d.compareAtAmount ? pesosTextToCents(d.compareAtAmount) : null,
      ...(d.mode === 'scheduled' && { effectiveFrom: new Date(d.effectiveFrom).toISOString() }),
    })
    notifySuccess(
      toast,
      period.state === 'SCHEDULED' ? 'Precio programado' : 'Precio actualizado',
      period.state === 'SCHEDULED'
        ? `Empieza el ${formatDateTime(period.effectiveFrom)}`
        : undefined,
    )
    Object.assign(state, { amount: '', compareAtAmount: '', effectiveFrom: '' })
  } catch (e) {
    const p = e as ApiProblem
    const { fieldErrors, otherMessages } = problemFieldErrors(p, [
      'amount',
      'compareAtAmount',
      'effectiveFrom',
    ])
    form.value?.setErrors(fieldErrors)
    if (fieldErrors.length === 0 || otherMessages.length > 0) problem.value = p
  }
}

async function cancelPeriod(period: PricePeriod) {
  const ok = await confirm({
    title: '¿Cancelar este precio programado?',
    description: `${formatMoney(period.amount)} desde el ${formatDateTime(period.effectiveFrom)}. El precio anterior seguirá vigente hasta el siguiente.`,
    confirmLabel: 'Cancelar precio',
    color: 'warning',
  })
  if (!ok) return
  try {
    await cancel.mutateAsync(period.id)
    notifySuccess(toast, 'Precio programado cancelado')
  } catch (e) {
    notifyProblem(toast, e)
  }
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="`Precio de ${title}`"
    description="Lista general. Montos con IVA incluido."
  >
    <template #body>
      <QueryState :loading="isPending" :error="error" @retry="refetch()">
        <div v-if="data" class="space-y-6">
          <section aria-labelledby="current-price" class="rounded-md border border-default p-4">
            <h3 id="current-price" class="text-sm text-muted">Precio vigente</h3>
            <template v-if="data.current">
              <p class="text-2xl font-semibold">{{ formatMoney(data.current.amount) }}</p>
              <p v-if="data.current.compareAtAmount" class="text-sm text-muted line-through">
                {{ formatMoney(data.current.compareAtAmount) }}
              </p>
              <p class="text-xs text-muted">
                Desde {{ formatDateTime(data.current.effectiveFrom) }}
              </p>
            </template>
            <p v-else class="text-sm">Sin precio: la variante no se puede vender.</p>
          </section>

          <UForm
            v-if="canWrite"
            ref="form"
            :schema="priceSchema"
            :state="state"
            :validate-on="['input', 'change']"
            class="space-y-3"
            @submit="onSubmit"
          >
            <h3 class="font-medium">Nuevo precio</h3>
            <ProblemAlert v-if="problem" :problem="problem" />
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Precio (MXN)" name="amount" required>
                <UInput
                  v-model="state.amount"
                  inputmode="decimal"
                  placeholder="599.00"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Precio antes (opcional)" name="compareAtAmount">
                <UInput
                  v-model="state.compareAtAmount"
                  inputmode="decimal"
                  placeholder="799.00"
                  class="w-full"
                />
              </UFormField>
            </div>
            <URadioGroup
              v-model="state.mode"
              :items="MODES"
              orientation="horizontal"
              legend="Cuándo"
            />
            <UFormField
              v-if="state.mode === 'scheduled'"
              label="Empieza"
              name="effectiveFrom"
              required
            >
              <UInput v-model="state.effectiveFrom" type="datetime-local" class="w-full" />
            </UFormField>
            <UButton type="submit" :loading="setPrice.isPending.value">
              {{ state.mode === 'scheduled' ? 'Programar precio' : 'Aplicar precio' }}
            </UButton>
          </UForm>

          <section aria-labelledby="price-history" class="space-y-2">
            <h3 id="price-history" class="font-medium">Historial</h3>
            <p v-if="data.data.length === 0" class="text-sm text-muted">Sin periodos.</p>
            <ul v-else class="divide-y divide-default rounded-md border border-default">
              <li
                v-for="period in data.data"
                :key="period.id"
                class="flex items-center justify-between gap-2 p-3"
              >
                <div class="space-y-0.5">
                  <div class="flex items-center gap-2">
                    <span class="font-medium">{{ formatMoney(period.amount) }}</span>
                    <span v-if="period.compareAtAmount" class="text-xs text-muted line-through">
                      {{ formatMoney(period.compareAtAmount) }}
                    </span>
                    <StatusBadge :value="period.state" :styles="PERIOD_STATE" />
                  </div>
                  <p class="text-xs text-muted">
                    {{ formatDateTime(period.effectiveFrom) }} –
                    {{ period.effectiveTo ? formatDateTime(period.effectiveTo) : 'sin fin' }}
                  </p>
                </div>
                <UButton
                  v-if="canWrite && period.state === 'SCHEDULED'"
                  size="xs"
                  color="warning"
                  variant="ghost"
                  icon="i-lucide-calendar-x"
                  :loading="cancel.isPending.value && cancel.variables.value === period.id"
                  @click="cancelPeriod(period)"
                  >Cancelar</UButton
                >
              </li>
            </ul>
          </section>
        </div>
      </QueryState>
    </template>
  </USlideover>
</template>
