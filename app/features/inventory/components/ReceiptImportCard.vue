<script setup lang="ts">
import { useImportReceipts } from '../api'
import type { ReceiptImportSummary } from '../types'

/** Carga de entradas de mercancía desde CSV (API_SPEC §13, UC-INV-12). */
const importer = useImportReceipts()

const run = (file: File, dryRun: boolean) => importer.mutateAsync({ file, dryRun })
const summarize = (s: ReceiptImportSummary) => `${s.rows} entradas con ${s.units} unidades`
</script>

<template>
  <CsvImportCard
    title="Cargar entradas de mercancía desde CSV"
    file-label="Archivo CSV de entradas"
    template-href="/plantillas/existencias.csv"
    :run="run"
    :summarize="summarize"
    success-title="Entradas registradas"
  >
    <p>
      Una entrada por fila: <code>sku</code>, <code>warehouse</code> (el código de un almacén
      activo, como <code>PRINCIPAL</code>) y <code>quantity</code> (1 a 100,000), obligatorias, y
      <code>note</code>, opcional, como el número de remisión. Cada fila suma a la existencia.
    </p>
    <p class="mt-1">
      Hasta 5,000 filas y 1 MB. Si alguna fila tiene error no se carga nada, y el mismo archivo no
      se carga dos veces.
    </p>
  </CsvImportCard>
</template>
