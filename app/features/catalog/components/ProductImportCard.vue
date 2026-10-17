<script setup lang="ts">
import { useImportProducts } from '../api'
import type { ProductImportSummary } from '../types'

/** Carga de productos nuevos con sus variantes desde CSV (API_SPEC §11.11, UC-CAT-16). */
const importer = useImportProducts()

const run = (file: File, dryRun: boolean) => importer.mutateAsync({ file, dryRun })
const summarize = (s: ProductImportSummary) =>
  `${s.rows} filas: ${s.products} productos y ${s.variants} variantes, en borrador`
</script>

<template>
  <CsvImportCard
    title="Cargar productos desde CSV"
    file-label="Archivo CSV de productos"
    template-href="/plantillas/productos.csv"
    :run="run"
    :summarize="summarize"
    success-title="Productos cargados"
  >
    <p>
      Una fila por variante: las filas con el mismo <code>slug</code> forman un producto, y sus
      datos van en su primera fila. Obligatorias <code>slug</code>, <code>title</code> y
      <code>sku</code>; opcionales <code>description</code>, <code>brand</code> y
      <code>categories</code> (slugs, separadas por <code>|</code>), <code>gtin</code>,
      <code>weightGrams</code>, <code>lengthCm</code>, <code>widthCm</code>, <code>heightCm</code>,
      <code>storeOnly</code> y una <code>option:&lt;nombre&gt;</code> por opción, como
      <code>option:talla</code>.
    </p>
    <p class="mt-1">
      Solo crea productos nuevos, en borrador; no edita los que ya existen. Hasta 5,000 filas y 5
      MB. Si alguna fila tiene error no se carga nada. Las marcas y categorías deben existir antes.
    </p>
  </CsvImportCard>
</template>
