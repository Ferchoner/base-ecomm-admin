<script setup lang="ts">
import { useImportPrices } from '../api'
import type { PriceImportSummary } from '../types'

/** Importación de precios por CSV (API_SPEC §12), con revisión previa y todo o nada. */
const props = defineProps<{ listId: string }>()
const importer = useImportPrices(() => props.listId)

const run = (file: File, dryRun: boolean) => importer.mutateAsync({ file, dryRun })
const summarize = (s: PriceImportSummary) =>
  `${s.rows} filas: ${s.created} precios nuevos y ${s.unchanged} sin cambio`
</script>

<template>
  <CsvImportCard
    title="Importar precios desde CSV"
    file-label="Archivo CSV de precios"
    template-href="/plantillas/precios.csv"
    :run="run"
    :summarize="summarize"
    success-title="Precios importados"
  >
    Columnas <code>sku</code>, <code>amount</code>, <code>compareAtAmount</code> y
    <code>effectiveFrom</code>, con montos en pesos y fechas en hora de México (<code
      >2026-11-14 00:00</code
    >). Hasta 5,000 filas y 1 MB. Si alguna fila tiene error no se importa nada.
  </CsvImportCard>
</template>
