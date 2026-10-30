<script setup lang="ts">
import { parseSvg } from '~/shared/print/svg'
import { linearWidthMm } from '~/shared/print/symbology'
import type { SvgNode } from '~/shared/print/svg'

/**
 * Código de barras lineal o 2D dibujado en SVG con bwip-js (D-084), que se carga solo cuando una
 * página lo usa. El texto legible lo pone cada documento.
 */
const props = defineProps<{
  bcid: string
  text: string
  /** Alto de las barras en mm (solo códigos lineales). */
  height?: number
  /**
   * Ancho disponible en mm (solo códigos lineales): el código toma el ancho de módulos de puntos
   * enteros que quepa y las barras, el alto del elemento.
   */
  maxWidth?: number
}>()

const QUIET_ZONE = 11
const SCALE = 2

const svg = shallowRef<{ viewBox: string; nodes: SvgNode[] } | null>(null)
const fitted = ref(false)
const width = computed(() => {
  if (!svg.value || !fitted.value || !props.maxWidth) return undefined
  // En los lineales, cada módulo mide SCALE unidades del viewBox.
  const modules = Number(svg.value.viewBox.split(' ')[2]) / SCALE
  return `${linearWidthMm(modules, props.maxWidth)}mm`
})
const failed = ref(false)

watchEffect(async () => {
  const { bcid, text, height } = props
  try {
    const { toSVG } = await import('bwip-js/browser')
    const two = bcid === 'datamatrix' || bcid === 'qrcode'
    // Los lineales llevan su zona blanca a los lados (11 módulos): sin ella el lector no los toma.
    const linear = !two && { height: height ?? 10, paddingwidth: QUIET_ZONE }
    svg.value = parseSvg(toSVG({ bcid, text, scale: SCALE, ...linear }))
    fitted.value = !two
    failed.value = !svg.value
  } catch {
    svg.value = null
    failed.value = true
  }
})
</script>

<template>
  <svg
    v-if="svg"
    :viewBox="svg.viewBox"
    role="img"
    :aria-label="`Código ${text}`"
    :preserveAspectRatio="width ? 'none' : 'xMidYMid meet'"
    :shape-rendering="fitted ? 'crispEdges' : undefined"
    :style="width && { width }"
    class="block"
  >
    <component :is="n.tag" v-for="(n, i) in svg.nodes" :key="i" v-bind="n.attrs" />
  </svg>
  <span v-else-if="failed" class="text-xs">No se pudo dibujar el código {{ text }}.</span>
</template>
