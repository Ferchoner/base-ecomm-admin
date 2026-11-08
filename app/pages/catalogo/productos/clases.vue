<script setup lang="ts">
import { MAX_COUNT_CLASS_ITEMS, useSetCountClasses } from '~/features/catalog/api'
import { useCountClassSuggestions } from '~/features/orders/api'
import type { CountClassSuggestion } from '~/features/orders/types'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import { useSessionStore } from '~/shared/auth/session.store'
import { useConfirm } from '~/shared/ui/use-confirm'
import { formatDate } from '~/shared/utils/dates'
import { formatMoney } from '~/shared/utils/money'

definePageMeta({ title: 'Clases de conteo', permission: 'orders.read' })

/**
 * La clase sugerida de cada producto por lo vendido en 90 días (UC-ORD-18, ADR-0173 de base-shop):
 * A, lo que suma el primer 80 % de las ventas; B, el siguiente 15 %; C, el resto. Se aplica a los que
 * no tienen clase o a los que se elijan, para acomodar los que quedaron sueltos.
 */
const session = useSessionStore()
const canApply = computed(() => session.can('catalog.write'))
const query = useCountClassSuggestions()
const rows = computed(() => query.data.value?.data ?? [])

const VIEWS = [
  { value: 'differs', label: 'Con otra clase sugerida' },
  { value: 'none', label: 'Sin clase' },
  { value: 'all', label: 'Todos' },
]
const view = ref('differs')
const shown = computed(() =>
  rows.value.filter((r) =>
    view.value === 'none'
      ? r.countClass === null
      : view.value === 'differs'
        ? r.countClass !== r.suggestedClass
        : true,
  ),
)

const selected = ref<Set<string>>(new Set())
watch(rows, () => (selected.value = new Set()))
function toggle(r: CountClassSuggestion, on: boolean) {
  const next = new Set(selected.value)
  if (on) next.add(r.productId)
  else next.delete(r.productId)
  selected.value = next
}
const allShownSelected = computed(
  () => shown.value.length > 0 && shown.value.every((r) => selected.value.has(r.productId)),
)
function toggleShown(on: boolean) {
  const next = new Set(selected.value)
  for (const r of shown.value) {
    if (on) next.add(r.productId)
    else next.delete(r.productId)
  }
  selected.value = next
}
function selectWithoutClass() {
  selected.value = new Set(rows.value.filter((r) => r.countClass === null).map((r) => r.productId))
}

// Solo los que cambian: aplicar la misma clase no hace nada.
const changes = computed(() =>
  rows.value
    .filter((r) => selected.value.has(r.productId) && r.countClass !== r.suggestedClass)
    .map((r) => ({ productId: r.productId, countClass: r.suggestedClass })),
)

const set = useSetCountClasses()
const confirm = useConfirm()
const toast = useToast()
async function applySelected() {
  const items = changes.value
  if (items.length === 0) return
  const ok = await confirm({
    title: `¿Aplicar la clase sugerida a ${items.length} ${items.length === 1 ? 'producto' : 'productos'}?`,
    description:
      items.length > MAX_COUNT_CLASS_ITEMS
        ? `Se aplican de ${MAX_COUNT_CLASS_ITEMS} en ${MAX_COUNT_CLASS_ITEMS}. La clase se cambia después en cada producto si hace falta.`
        : 'La clase se cambia después en cada producto si hace falta.',
    confirmLabel: 'Aplicar',
  })
  if (!ok) return
  let updated = 0
  try {
    for (let i = 0; i < items.length; i += MAX_COUNT_CLASS_ITEMS) {
      const result = await set.mutateAsync(items.slice(i, i + MAX_COUNT_CLASS_ITEMS))
      updated += result.updated
    }
    notifySuccess(
      toast,
      `${updated} ${updated === 1 ? 'producto cambió' : 'productos cambiaron'} de clase`,
    )
  } catch (e) {
    notifyProblem(toast, e)
  } finally {
    await query.refetch()
  }
}

const CLASS_COLOR = { A: 'error', B: 'warning', C: 'neutral' } as const
</script>

<template>
  <div class="space-y-4">
    <UButton
      to="/catalogo/productos"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      size="sm"
      >Productos</UButton
    >
    <div class="space-y-1">
      <h2 class="text-xl font-semibold">Clases de conteo sugeridas</h2>
      <p class="max-w-3xl text-sm text-muted">
        Por lo vendido en los últimos 90 días, en línea y en la tienda: A, los que suman el primer
        80 % de las ventas, se cuentan cada semana; B, el siguiente 15 %, cada mes; C, el resto,
        cada trimestre. Los que no vendieron no aparecen y se cuentan como C.
      </p>
    </div>

    <QueryState
      :loading="query.isPending.value"
      :error="query.error.value"
      :empty="rows.length === 0"
      empty-title="Sin ventas en 90 días"
      empty-description="Todos los productos se cuentan como C."
      @retry="query.refetch()"
    >
      <template v-if="query.data.value">
        <p class="text-sm">
          Del {{ formatDate(query.data.value.meta.from) }} al
          {{ formatDate(query.data.value.meta.to) }}:
          <strong>{{ formatMoney(query.data.value.meta.total) }}</strong> en {{ rows.length }}
          {{ rows.length === 1 ? 'producto' : 'productos' }}.
        </p>

        <div class="flex flex-wrap items-center gap-2">
          <UTabs
            v-model="view"
            :items="VIEWS"
            :content="false"
            size="sm"
            aria-label="Qué mostrar"
          />
          <div class="flex-1" />
          <template v-if="canApply">
            <UButton color="neutral" variant="outline" @click="selectWithoutClass"
              >Elegir los que no tienen clase</UButton
            >
            <UButton
              icon="i-lucide-check"
              :disabled="changes.length === 0"
              :loading="set.isPending.value"
              @click="applySelected"
              >Aplicar a {{ changes.length }}</UButton
            >
          </template>
        </div>

        <div class="overflow-x-auto rounded-md border border-default">
          <table class="w-full text-sm">
            <thead class="bg-elevated text-left">
              <tr>
                <th v-if="canApply" class="w-10 p-2">
                  <UCheckbox
                    :model-value="allShownSelected"
                    aria-label="Elegir todos los que se ven"
                    @update:model-value="(v) => toggleShown(v === true)"
                  />
                </th>
                <th class="p-2">Producto</th>
                <th class="p-2 text-right">Vendido</th>
                <th class="p-2 text-right">Piezas</th>
                <th class="p-2">Clase hoy</th>
                <th class="p-2">Sugerida</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-if="shown.length === 0">
                <td colspan="6" class="p-4 text-center text-muted">
                  {{
                    view === 'differs'
                      ? 'Todos tienen ya la clase sugerida.'
                      : 'Ningún producto coincide.'
                  }}
                </td>
              </tr>
              <tr v-for="r in shown" :key="r.productId">
                <td v-if="canApply" class="p-2">
                  <UCheckbox
                    :model-value="selected.has(r.productId)"
                    :aria-label="`Elegir ${r.productTitle}`"
                    @update:model-value="(v) => toggle(r, v === true)"
                  />
                </td>
                <td class="p-2">
                  <ULink :to="`/catalogo/productos/${r.productId}`">{{ r.productTitle }}</ULink>
                </td>
                <td class="p-2 text-right tabular-nums">{{ formatMoney(r.sales) }}</td>
                <td class="p-2 text-right tabular-nums">{{ r.units }}</td>
                <td class="p-2">
                  <span v-if="r.countClass" class="font-medium">{{ r.countClass }}</span>
                  <span v-else class="text-muted">Sin clase</span>
                </td>
                <td class="p-2">
                  <UBadge :color="CLASS_COLOR[r.suggestedClass]" variant="subtle">{{
                    r.suggestedClass
                  }}</UBadge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </QueryState>
  </div>
</template>
