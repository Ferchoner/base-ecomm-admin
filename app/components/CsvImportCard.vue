<script setup lang="ts" generic="T">
import type { ApiProblem } from '~/shared/api/problem'
import { notifySuccess } from '~/shared/api/feedback'
import { formatDateTime } from '~/shared/utils/dates'

/**
 * Carga masiva por CSV (API_SPEC §11.11, §12, §13; ADR-0126, ADR-0164): primero se revisa con
 * `dryRun`, luego se carga el mismo archivo. Es todo o nada: con un error no se guarda ninguna fila,
 * y la API responde los primeros 100 errores en `rows[<línea>].<columna>`. No se reintenta solo.
 */
const props = defineProps<{
  title: string
  /** Nombre accesible del selector de archivo. */
  fileLabel: string
  /** Plantilla de ejemplo para descargar (`public/plantillas`). */
  templateHref?: string
  run: (file: File, dryRun: boolean) => Promise<T>
  /** Resumen de una respuesta, como "3 filas: 2 productos y 3 variantes". */
  summarize: (summary: T) => string
  successTitle: string
}>()

const file = ref<File | null>(null)
const checked = ref<T | null>(null)
const done = ref<T | null>(null)
const problem = ref<ApiProblem | null>(null)
const pending = ref<'check' | 'import' | null>(null)
const toast = useToast()
const input = useTemplateRef('input')

function onFile(event: Event) {
  const el = event.target as HTMLInputElement
  file.value = el.files?.[0] ?? null
  checked.value = null
  done.value = null
  problem.value = null
}

/** `rows[12].amount` → "Línea 12 (amount)"; `rows[3].option:talla` → "Línea 3 (option:talla)". */
const rowErrors = computed(() =>
  (problem.value?.errors ?? []).map((e) => {
    const m = /^rows\[(\d+)\](?:\.(.+))?$/.exec(e.field)
    const where = m
      ? `Línea ${m[1]}${m[2] ? ` (${m[2]})` : ''}`
      : e.field === 'file'
        ? 'Archivo'
        : e.field
    return { where, message: e.message }
  }),
)

/** Explicaciones de los errores de archivo que no traen `errors[]` (API_SPEC §6.2). */
const hints = computed(() => {
  const p = problem.value
  if (!p) return []
  if (p.type === 'payload-too-large' && typeof p.extensions.maxBytes === 'number')
    return [`El archivo pasa de ${(p.extensions.maxBytes / 1_048_576).toFixed(0)} MB.`]
  if (p.type === 'duplicate-value' && p.extensions.field === 'file') {
    const at = p.extensions.importedAt
    return [
      `Este archivo ya se cargó${typeof at === 'string' ? ` el ${formatDateTime(at)}` : ''}. Para registrar otra entrega igual, cambia la nota.`,
    ]
  }
  if (p.type === 'duplicate-value')
    return [
      'Otro cambio tomó un valor del archivo mientras se cargaba. Revisa el archivo de nuevo.',
    ]
  return []
})

async function submit(dryRun: boolean) {
  if (!file.value) return
  problem.value = null
  pending.value = dryRun ? 'check' : 'import'
  try {
    const summary = await props.run(file.value, dryRun)
    if (dryRun) checked.value = summary
    else {
      done.value = summary
      checked.value = null
      file.value = null
      if (input.value) input.value.value = ''
      notifySuccess(toast, props.successTitle, props.summarize(summary))
    }
  } catch (e) {
    problem.value = e as ApiProblem
    checked.value = null
  } finally {
    pending.value = null
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-2">
        <h2 class="font-semibold">{{ title }}</h2>
        <UButton
          v-if="templateHref"
          :to="templateHref"
          external
          download
          color="neutral"
          variant="link"
          size="sm"
          icon="i-lucide-download"
          class="px-0"
          >Descargar plantilla</UButton
        >
      </div>
      <div class="text-sm text-muted"><slot /></div>
    </template>

    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <input
          ref="input"
          type="file"
          accept=".csv,text/csv"
          :aria-label="fileLabel"
          class="text-sm file:me-3 file:rounded-md file:border-0 file:bg-elevated file:px-3 file:py-1.5"
          @change="onFile"
        />
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-file-check"
          :disabled="!file || !!pending"
          :loading="pending === 'check'"
          @click="submit(true)"
          >Revisar archivo</UButton
        >
        <UButton
          icon="i-lucide-upload"
          :disabled="!checked || !!pending"
          :loading="pending === 'import'"
          @click="submit(false)"
          >Importar</UButton
        >
      </div>

      <UAlert
        v-if="checked"
        color="info"
        variant="subtle"
        icon="i-lucide-file-check"
        title="Archivo sin errores"
        :description="`${summarize(checked as T)}. Aún no se guardó nada.`"
        role="status"
      />
      <UAlert
        v-if="done"
        color="success"
        variant="subtle"
        icon="i-lucide-circle-check"
        title="Importación terminada"
        :description="`${summarize(done as T)}.`"
        role="status"
      />

      <template v-if="problem">
        <ProblemAlert :problem="problem" :messages="hints" />
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
