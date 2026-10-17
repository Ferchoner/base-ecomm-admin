<script setup lang="ts">
import { parseSvg } from '~/shared/print/svg'
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
}>()

const svg = shallowRef<{ viewBox: string; nodes: SvgNode[] } | null>(null)
const failed = ref(false)

watchEffect(async () => {
  const { bcid, text, height } = props
  try {
    const { toSVG } = await import('bwip-js/browser')
    const two = bcid === 'datamatrix' || bcid === 'qrcode'
    svg.value = parseSvg(toSVG({ bcid, text, scale: 2, ...(!two && { height: height ?? 10 }) }))
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
    preserveAspectRatio="xMidYMid meet"
    class="block"
  >
    <component :is="n.tag" v-for="(n, i) in svg.nodes" :key="i" v-bind="n.attrs" />
  </svg>
  <span v-else-if="failed" class="text-xs">No se pudo dibujar el código {{ text }}.</span>
</template>
