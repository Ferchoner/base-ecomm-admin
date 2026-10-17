/**
 * El SVG que genera bwip-js se convierte en nodos que Vue dibuja, sin `v-html` (CLAUDE.md): solo
 * pasan las etiquetas y los atributos de dibujo de esta lista.
 */
const TAGS = new Set(['path', 'rect', 'polygon', 'g'])
const ATTRS = new Set([
  'd',
  'x',
  'y',
  'width',
  'height',
  'points',
  'fill',
  'stroke',
  'stroke-width',
  'transform',
])

export interface SvgNode {
  tag: string
  attrs: Record<string, string>
}

export function parseSvg(markup: string): { viewBox: string; nodes: SvgNode[] } | null {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml')
  const root = doc.documentElement
  if (root.nodeName !== 'svg') return null
  const nodes: SvgNode[] = []
  for (const el of Array.from(root.children)) {
    if (!TAGS.has(el.nodeName)) continue
    const attrs: Record<string, string> = {}
    for (const a of Array.from(el.attributes)) if (ATTRS.has(a.name)) attrs[a.name] = a.value
    nodes.push({ tag: el.nodeName, attrs })
  }
  return { viewBox: root.getAttribute('viewBox') ?? '0 0 0 0', nodes }
}
