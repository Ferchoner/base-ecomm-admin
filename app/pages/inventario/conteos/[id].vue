<script setup lang="ts">
import { useCategoryTree } from '~/features/catalog/api'
import { flattenTree } from '~/features/catalog/tree'
import {
  inventoryKeys,
  useApplyCount,
  useCancelCount,
  useCaptureCount,
  useCount,
  useRecountLine,
  useWarehouses,
} from '~/features/inventory/api'
import CountedInput from '~/features/inventory/components/CountedInput.vue'
import { COUNT_OUTCOME, COUNT_STATUS, countFilterLabel } from '~/features/inventory/status'
import type { Count, CountLine } from '~/features/inventory/types'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import type { ApiProblem } from '~/shared/api/problem'
import { isScanCode } from '~/shared/api/variant-lookup'
import { useSessionStore } from '~/shared/auth/session.store'
import { usePreferencesStore } from '~/shared/preferences/preferences.store'
import { scanBeep } from '~/shared/scanner/beep'
import { fixScannedCode } from '~/shared/scanner/scanned-text'
import { useScannerCapture } from '~/shared/scanner/use-scanner-capture'
import { useVariantScan } from '~/shared/scanner/use-variant-scan'
import type { ScanFeedback } from '~/shared/scanner/use-variant-scan'
import { useConfirm } from '~/shared/ui/use-confirm'
import { formatDateTime } from '~/shared/utils/dates'
import { useQueryClient } from '@tanstack/vue-query'

definePageMeta({ title: 'Hoja de conteo', permission: 'inventory.read' })

/**
 * Una hoja de conteo (UC-INV-19 y 20, ADR-0173). Quien cuenta escanea cada pieza o escribe el total de
 * cada línea, sin ver lo esperado. Quien revisa (`inventory.write`) ve la diferencia, pide recontar y
 * aplica la hoja de una vez, o la cancela.
 */
const route = useRoute()
const id = computed(() => String(route.params.id))
const session = useSessionStore()
const canCount = computed(() => session.can('inventory.count'))
const canReview = computed(() => session.can('inventory.write'))

const query = useCount(id)
const count = computed(() => query.data.value)
const isOpen = computed(() => count.value?.status === 'OPEN')
const capturing = computed(() => isOpen.value && canCount.value)

const { data: warehouses } = useWarehouses()
const warehouseName = computed(
  () => warehouses.value?.find((w) => w.id === count.value?.warehouseId)?.name ?? '',
)
const tree = useCategoryTree(undefined, { enabled: () => session.can('catalog.read') })
function categoryName(categoryId: string) {
  const found = flattenTree(tree.data.value ?? []).find((c) => c.node.id === categoryId)
  return found ? found.path.join(' › ') : 'elegida'
}

// ── Qué líneas se ven ──
const VIEWS = computed(() => [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Sin contar' },
  ...(count.value && !count.value.blind ? [{ value: 'difference', label: 'Con diferencia' }] : []),
  { value: 'recount', label: 'Por recontar' },
])
const view = ref('all')
const search = ref('')
const PAGE = 200
const shown = ref(PAGE)
watch([view, search], () => (shown.value = PAGE))

const lines = computed(() => {
  const q = search.value.trim().toUpperCase()
  return (count.value?.lines ?? []).filter((l) => {
    if (view.value === 'pending' && l.counted !== null) return false
    if (view.value === 'difference' && !l.difference) return false
    if (view.value === 'recount' && !l.recount) return false
    if (!q) return true
    return (
      l.sku.toUpperCase().includes(q) ||
      l.productTitle.toUpperCase().includes(q) ||
      (l.location ?? '').includes(q)
    )
  })
})

const summary = computed(() => {
  const all = count.value?.lines ?? []
  return {
    pending: all.filter((l) => l.counted === null).length,
    recount: all.filter((l) => l.recount).length,
    withDifference: all.filter((l) => l.difference).length,
    net: all.reduce((sum, l) => sum + (l.difference ?? 0), 0),
  }
})

// ── Contar escaneando: cada escaneo suma una pieza a su línea ──
const qc = useQueryClient()
const capture = useCaptureCount()
const confirm = useConfirm()
const toast = useToast()
const prefs = usePreferencesStore()
const scanText = ref('')
const localFeedback = ref<ScanFeedback | null>(null)
const lastVariant = ref<string | null>(null)

// Los escaneos van uno tras otro, para que cada uno sume sobre lo que guardó el anterior.
let queue: Promise<unknown> = Promise.resolve()
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job)
  queue = next.catch(() => undefined)
  return next
}

function currentLine(variantId: string): CountLine | undefined {
  return qc
    .getQueryData<Count>(inventoryKeys.count(id.value))
    ?.lines.find((l) => l.variantId === variantId)
}

async function addOne(variantId: string, sku: string): Promise<ScanFeedback> {
  const inSheet = currentLine(variantId)
  if (!inSheet) {
    const ok = await confirm({
      title: `¿Agregar ${sku} a la hoja?`,
      description:
        'No está en esta hoja, por ejemplo porque apareció en el estante. Se agrega al final con una pieza contada.',
      confirmLabel: 'Agregar',
    })
    if (!ok) return { tone: 'info', text: `${sku} no se agregó.` }
  }
  return enqueue(async () => {
    const before = currentLine(variantId)?.counted ?? 0
    try {
      const line = await capture.mutateAsync({ id: id.value, variantId, counted: before + 1 })
      lastVariant.value = variantId
      return {
        tone: 'success' as const,
        text: `${line.sku}${line.location ? ` en ${line.location}` : ''}: ${line.counted} ${line.counted === 1 ? 'contada' : 'contadas'}.`,
      }
    } catch (e) {
      const p = e as ApiProblem
      return {
        tone: 'error' as const,
        text:
          p.type === 'variant-in-open-count'
            ? `${sku} está en otra hoja abierta de este almacén.`
            : (p.detail ?? 'No se pudo guardar. Escanea de nuevo.'),
      }
    }
  })
}

const scan = useVariantScan({
  onFound: (v) => addOne(v.id, v.sku),
  notFound: (code) => `Ningún producto tiene el código ${code}.`,
})
const feedback = computed(() => localFeedback.value ?? scan.feedback.value)

/** Primero el SKU de una línea de la hoja, sin ir a la API; luego el catálogo, que conoce el GTIN. */
async function scanCode(raw: string) {
  localFeedback.value = null
  scan.clear()
  const code = fixScannedCode(raw, /^[A-Za-z0-9._-]{1,64}$/).trim()
  if (!code) return
  const line = count.value?.lines.find((l) => l.sku.toUpperCase() === code.toUpperCase())
  if (line) {
    localFeedback.value = await addOne(line.variantId, line.sku)
    if (prefs.scanSound) scanBeep(localFeedback.value.tone === 'success')
    return
  }
  if (session.can('catalog.read')) return scan.scan(code)
  localFeedback.value = { tone: 'warning', text: `${code} no está en esta hoja.` }
  if (prefs.scanSound) scanBeep(false)
}
const scanInput = useTemplateRef('scanInput')
async function onScanEnter() {
  if (!isScanCode(scanText.value)) return
  await scanCode(scanText.value)
  scanText.value = ''
}
useScannerCapture((code) => {
  if (!capturing.value) return
  void scanCode(code)
  scanInput.value?.inputRef?.focus()
})

function onSaved(line: CountLine) {
  lastVariant.value = line.variantId
}

// ── Revisar ──
const recount = useRecountLine()
async function askRecount(line: CountLine) {
  if (!count.value) return
  try {
    await recount.mutateAsync({
      id: id.value,
      variantId: line.variantId,
      version: count.value.version,
    })
    notifySuccess(
      toast,
      `${line.sku} por recontar`,
      'Lo contado se borró: hay que contarla otra vez.',
    )
  } catch (e) {
    notifyProblem(toast, e, () => query.refetch())
  }
}

const apply = useApplyCount()
// Una llave por intento: si se repite tras un error de red, la API no ajusta dos veces.
let applyKey = crypto.randomUUID()
watch(
  () => count.value?.version,
  () => (applyKey = crypto.randomUUID()),
)
async function applyCount() {
  const c = count.value
  if (!c) return
  const s = summary.value
  const ok = await confirm({
    title: `¿Aplicar ${c.folio}?`,
    description: [
      s.withDifference === 0
        ? 'Ninguna línea contada tiene diferencia.'
        : `${s.withDifference} ${s.withDifference === 1 ? 'línea se ajusta' : 'líneas se ajustan'} como conteo físico (${s.net > 0 ? '+' : ''}${s.net} en total).`,
      s.pending > 0
        ? `${s.pending} sin contar${s.recount > 0 ? `, ${s.recount} de ellas por recontar,` : ''} no se ${s.pending === 1 ? 'toca' : 'tocan'}.`
        : '',
      'Después ya no se puede cambiar.',
    ]
      .filter(Boolean)
      .join(' '),
    confirmLabel: 'Aplicar',
    color: 'warning',
  })
  if (!ok) return
  try {
    const done = await apply.mutateAsync({ id: c.id, version: c.version, idempotencyKey: applyKey })
    const adjusted = done.lines.filter((l) => l.outcome === 'ADJUSTED').length
    const skipped = done.lines.filter((l) => l.outcome === 'SKIPPED_RESERVED').length
    notifySuccess(
      toast,
      `${done.folio} aplicada`,
      [
        `${adjusted} ${adjusted === 1 ? 'ajuste' : 'ajustes'}.`,
        skipped > 0
          ? `${skipped} no se ${skipped === 1 ? 'aplicó porque dejaría' : 'aplicaron porque dejarían'} menos piezas que las apartadas.`
          : '',
      ]
        .filter(Boolean)
        .join(' '),
    )
  } catch (e) {
    notifyProblem(toast, e, () => query.refetch())
  }
}

const cancel = useCancelCount()
async function cancelCount() {
  const c = count.value
  if (!c) return
  const ok = await confirm({
    title: `¿Cancelar ${c.folio}?`,
    description: 'No se ajusta nada, y sus productos pueden ir en otra hoja.',
    confirmLabel: 'Cancelar la hoja',
    color: 'error',
  })
  if (!ok) return
  try {
    await cancel.mutateAsync({ id: c.id, version: c.version })
    notifySuccess(toast, `${c.folio} cancelada`)
  } catch (e) {
    notifyProblem(toast, e, () => query.refetch())
  }
}

function differenceClass(d: number | null) {
  if (!d) return 'text-muted'
  return d > 0 ? 'text-success' : 'text-error'
}
</script>

<template>
  <div class="space-y-4">
    <UButton
      to="/inventario/conteos"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      size="sm"
      >Conteos</UButton
    >

    <QueryState
      :loading="query.isPending.value"
      :error="query.error.value"
      @retry="query.refetch()"
    >
      <template v-if="count">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-1">
            <h2 class="flex items-center gap-2 text-xl font-semibold">
              Hoja {{ count.folio }}
              <StatusBadge :value="count.status" :styles="COUNT_STATUS" />
            </h2>
            <p class="text-sm text-muted">
              {{ warehouseName }} · {{ countFilterLabel(count.filter, categoryName) }} · abierta
              {{ formatDateTime(count.createdAt) }}
              <template v-if="count.closedAt">
                · {{ count.status === 'APPLIED' ? 'aplicada' : 'cancelada' }}
                {{ formatDateTime(count.closedAt) }}</template
              >
            </p>
            <p v-if="count.note" class="text-sm">{{ count.note }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton
              :to="`/imprimir/conteo/${count.id}`"
              icon="i-lucide-printer"
              color="neutral"
              variant="outline"
              >Imprimir la hoja</UButton
            >
            <template v-if="isOpen && canReview">
              <UButton
                color="error"
                variant="ghost"
                :loading="cancel.isPending.value"
                @click="cancelCount"
                >Cancelar</UButton
              >
              <UButton
                icon="i-lucide-check-check"
                :loading="apply.isPending.value"
                :disabled="count.countedCount === 0"
                @click="applyCount"
                >Aplicar</UButton
              >
            </template>
          </div>
        </div>

        <div class="space-y-1">
          <div class="flex justify-between text-sm">
            <span>{{ count.countedCount }} de {{ count.lineCount }} contadas</span>
            <span v-if="!count.blind && summary.withDifference" class="text-muted"
              >{{ summary.withDifference }} con diferencia</span
            >
          </div>
          <UProgress
            :model-value="count.countedCount"
            :max="Math.max(1, count.lineCount)"
            size="sm"
            aria-label="Avance del conteo"
          />
        </div>

        <UAlert
          v-if="count.blind && isOpen"
          icon="i-lucide-eye-off"
          color="neutral"
          variant="subtle"
          title="Conteo a ciegas"
          description="No se muestra cuántas espera el sistema: cuenta lo que ves. Escanea cada pieza para sumarla, o escribe el total de la línea."
        />

        <div v-if="capturing" class="space-y-2">
          <UInput
            ref="scanInput"
            v-model="scanText"
            icon="i-lucide-scan-barcode"
            placeholder="Escanea una pieza para sumarla"
            aria-label="Escanear para contar"
            autocomplete="off"
            :loading="scan.pending.value || capture.isPending.value"
            class="w-full sm:max-w-md"
            @keydown.enter.prevent="onScanEnter"
          />
          <ScanResult :feedback="feedback" :choices="scan.choices.value" @choose="scan.choose" />
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Buscar SKU, producto o ubicación"
            aria-label="Buscar en la hoja"
            class="w-full sm:w-72"
          />
          <UTabs
            v-model="view"
            :items="VIEWS"
            :content="false"
            size="sm"
            aria-label="Qué líneas mostrar"
          />
        </div>

        <div class="overflow-x-auto rounded-md border border-default">
          <table class="w-full text-sm">
            <thead class="bg-elevated text-left">
              <tr>
                <th class="p-2">Ubicación</th>
                <th class="p-2">Producto</th>
                <th class="p-2">Contadas</th>
                <template v-if="!count.blind">
                  <th class="p-2 text-right">Esperadas</th>
                  <th class="p-2 text-right">Diferencia</th>
                </template>
                <th v-if="!isOpen" class="p-2">Resultado</th>
                <th v-if="isOpen && canReview" class="p-2">
                  <span class="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-if="lines.length === 0">
                <td colspan="7" class="p-4 text-center text-muted">Ninguna línea coincide.</td>
              </tr>
              <tr
                v-for="line in lines.slice(0, shown)"
                :key="line.variantId"
                :class="line.variantId === lastVariant ? 'bg-primary/5' : undefined"
              >
                <td class="p-2 font-medium">{{ line.location ?? '—' }}</td>
                <td class="p-2">
                  <code class="text-xs font-medium">{{ line.sku }}</code>
                  <div class="text-muted">{{ line.productTitle }}</div>
                  <UBadge v-if="line.recount" color="warning" variant="subtle" size="sm"
                    >Recontar</UBadge
                  >
                </td>
                <td class="p-2">
                  <CountedInput
                    v-if="capturing"
                    :count-id="count.id"
                    :line="line"
                    @saved="onSaved"
                  />
                  <span v-else class="tabular-nums">{{ line.counted ?? '—' }}</span>
                </td>
                <template v-if="!count.blind">
                  <td class="p-2 text-right tabular-nums">{{ line.expected ?? '—' }}</td>
                  <td
                    class="p-2 text-right font-medium tabular-nums"
                    :class="differenceClass(line.difference)"
                  >
                    {{
                      line.difference === null
                        ? '—'
                        : `${line.difference > 0 ? '+' : ''}${line.difference}`
                    }}
                  </td>
                </template>
                <td v-if="!isOpen" class="p-2">
                  <StatusBadge v-if="line.outcome" :value="line.outcome" :styles="COUNT_OUTCOME" />
                </td>
                <td v-if="isOpen && canReview" class="p-2 text-right">
                  <UButton
                    v-if="line.counted !== null"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-rotate-ccw"
                    :aria-label="`Recontar ${line.sku}`"
                    :loading="
                      recount.isPending.value &&
                      recount.variables.value?.variantId === line.variantId
                    "
                    @click="askRecount(line)"
                    >Recontar</UButton
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="lines.length > shown" class="text-center">
          <UButton color="neutral" variant="outline" @click="shown += PAGE"
            >Mostrar {{ Math.min(PAGE, lines.length - shown) }} más de {{ lines.length }}</UButton
          >
        </div>
      </template>
    </QueryState>
  </div>
</template>
