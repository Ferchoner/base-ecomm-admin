<script setup lang="ts">
import type { ApiProblem } from '~/shared/api/problem'
import { notifySuccess } from '~/shared/api/feedback'
import { useImportPrices } from '../api'
import type { PriceImportSummary } from '../types'

/**
 * Importación por CSV (API_SPEC §12): primero se revisa con `dryRun`, luego se importa el mismo
 * archivo. Es todo o nada: con un error no se guarda ninguna fila.
 */
const props = defineProps<{ listId: string }>()

const file = ref<File | null>(null)
const checked = ref<PriceImportSummary | null>(null)
const done = ref<PriceImportSummary | null>(null)
const problem = ref<ApiProblem | null>(null)
const importer = useImportPrices(() => props.listId)
const toast = useToast()
const input = useTemplateRef('input')

function onFile(event: Event) {
  const el = event.target as HTMLInputElement
  file.value = el.files?.[0] ?? null
  checked.value = null
  done.value = null
  problem.value = null
}

/** `rows[12].amount` → "Línea 12 (amount)". */
const rowErrors = computed(() =>
  (problem.value?.errors ?? []).map((e) => {
    const m = /^rows\[(\d+)\](?:\.(\w+))?$/.exec(e.field)
    const where = m
      ? `Línea ${m[1]}${m[2] ? ` (${m[2]})` : ''}`
      : e.field === 'file'
        ? 'Archivo'
        : e.field
    return { where, message: e.message }
  }),
)

async function run(dryRun: boolean) {
  if (!file.value) return
  problem.value = null
  try {
    const summary = await importer.mutateAsync({ file: file.value, dryRun })
    if (dryRun) checked.value = summary
    else {
      done.value = summary
      checked.value = null
      file.value = null
      if (input.value) input.value.value = ''
      notifySuccess(
        toast,
        'Precios importados',
        `${summary.created} creados, ${summary.unchanged} sin cambio.`,
      )
    }
  } catch (e) {
    problem.value = e as ApiProblem
    checked.value = null
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">Importar precios desde CSV</h2>
      <p class="text-sm text-muted">
        Columnas <code>sku</code>, <code>amount</code>, <code>compareAtAmount</code> y
        <code>effectiveFrom</code>, con montos en pesos y fechas en hora de México (<code
          >2026-11-14 00:00</code
        >). Hasta 5,000 filas y 1 MB. Si alguna fila tiene error no se importa nada.
      </p>
    </template>

    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <input
          ref="input"
          type="file"
          accept=".csv,text/csv"
          aria-label="Archivo CSV de precios"
          class="text-sm file:me-3 file:rounded-md file:border-0 file:bg-elevated file:px-3 file:py-1.5"
          @change="onFile"
        />
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-file-check"
          :disabled="!file"
          :loading="importer.isPending.value && importer.variables.value?.dryRun"
          @click="run(true)"
          >Revisar archivo</UButton
        >
        <UButton
          icon="i-lucide-upload"
          :disabled="!checked"
          :loading="importer.isPending.value && importer.variables.value?.dryRun === false"
          @click="run(false)"
          >Importar</UButton
        >
      </div>

      <UAlert
        v-if="checked"
        color="info"
        variant="subtle"
        icon="i-lucide-file-check"
        title="Archivo sin errores"
        :description="`${checked.rows} filas: ${checked.created} precios nuevos y ${checked.unchanged} sin cambio. Aún no se guardó nada.`"
        role="status"
      />
      <UAlert
        v-if="done"
        color="success"
        variant="subtle"
        icon="i-lucide-circle-check"
        title="Importación terminada"
        :description="`${done.rows} filas: ${done.created} precios nuevos y ${done.unchanged} sin cambio.`"
        role="status"
      />

      <template v-if="problem">
        <ProblemAlert :problem="problem" />
        <div
          v-if="rowErrors.length"
          class="max-h-64 overflow-auto rounded-md border border-default"
        >
          <table class="w-full text-sm">
            <caption class="sr-only">
              Errores del archivo
            </caption>
            <thead>
              <tr class="text-left text-muted">
                <th class="px-3 py-2 font-medium">Dónde</th>
                <th class="px-3 py-2 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(e, i) in rowErrors" :key="i" class="border-t border-default">
                <td class="px-3 py-1.5 whitespace-nowrap">{{ e.where }}</td>
                <td class="px-3 py-1.5">{{ e.message }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </UCard>
</template>
