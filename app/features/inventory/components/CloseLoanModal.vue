<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { notifySuccess } from '~/shared/api/feedback'
import type { ApiProblem } from '~/shared/api/problem'
import { useCloseLoan } from '../api'
import { closeLoanSchema } from '../schemas'
import type { CloseLoanForm } from '../schemas'
import type { Transfer } from '../types'

/**
 * Cerrar un préstamo con lo que regresó de cada línea (UC-INV-16, ADR-0172): eso vuelve al origen con
 * un traslado de regreso, y lo demás se queda donde está, por ejemplo porque el cliente lo compró ahí.
 */
const props = defineProps<{ loan: Transfer; fromName: string; toName: string }>()
const open = defineModel<boolean>('open', { required: true })

const state = reactive<CloseLoanForm>({ returned: {} })
const schema = computed(() => closeLoanSchema(props.loan.lines))
const problem = ref<ApiProblem | null>(null)
const close = useCloseLoan()
const toast = useToast()

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    // Lo normal es que todo regrese; quien cierra baja lo que se quedó.
    state.returned = Object.fromEntries(props.loan.lines.map((l) => [l.variantId, l.quantity]))
    problem.value = null
  },
  { immediate: true },
)

const stays = computed(() =>
  props.loan.lines.reduce((sum, l) => sum + (l.quantity - (state.returned[l.variantId] ?? 0)), 0),
)

async function onSubmit(event: FormSubmitEvent<CloseLoanForm>) {
  problem.value = null
  try {
    await close.mutateAsync({
      id: props.loan.id,
      input: {
        version: props.loan.version,
        lines: props.loan.lines.map((l) => ({
          variantId: l.variantId,
          returned: event.data.returned[l.variantId] ?? 0,
        })),
      },
    })
    notifySuccess(
      toast,
      `Préstamo ${props.loan.folio} cerrado`,
      stays.value === 0
        ? `Todo regresó a ${props.fromName}.`
        : `${stays.value} ${stays.value === 1 ? 'unidad se queda' : 'unidades se quedan'} en ${props.toName}.`,
    )
    open.value = false
  } catch (e) {
    problem.value = e as ApiProblem
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`Cerrar el préstamo ${loan.folio}`"
    :description="`De ${fromName} a ${toName}`"
  >
    <template #body>
      <UForm
        id="close-loan-form"
        :schema="schema"
        :state="state"
        :validate-on="['input', 'change']"
        class="space-y-4"
        @submit="onSubmit"
      >
        <ProblemAlert v-if="problem" :problem="problem" />
        <p class="text-sm text-muted">
          Escribe cuántas regresaron a {{ fromName }}. Las demás se quedan en {{ toName }}.
        </p>
        <ul class="divide-y divide-default rounded-md border border-default">
          <li
            v-for="line in loan.lines"
            :key="line.variantId"
            class="flex flex-wrap items-center gap-3 p-2 text-sm"
          >
            <div class="min-w-0 flex-1">
              <code class="text-xs font-medium">{{ line.sku }}</code>
              <div class="truncate text-muted">
                {{ line.productTitle }} · prestadas: {{ line.quantity }}
              </div>
            </div>
            <UFormField :name="`returned.${line.variantId}`" label="Regresaron">
              <UInputNumber
                v-model="state.returned[line.variantId]"
                :min="0"
                :max="line.quantity"
                :aria-label="`Regresaron de ${line.sku}`"
                class="w-28"
              />
            </UFormField>
          </li>
        </ul>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">Cancelar</UButton>
        <UButton type="submit" form="close-loan-form" :loading="close.isPending.value"
          >Cerrar el préstamo</UButton
        >
      </div>
    </template>
  </UModal>
</template>
