import type { CategoryNode } from './types'

export interface FlatCategory {
  node: CategoryNode
  depth: number
  /** Nombres de los ancestros y el propio, para mostrar la ruta completa. */
  path: string[]
}

/** Recorre el árbol en orden (padres antes que hijos) conservando la profundidad. */
export function flattenTree(
  nodes: readonly CategoryNode[],
  depth = 0,
  parents: string[] = [],
): FlatCategory[] {
  return nodes.flatMap((node) => {
    const path = [...parents, node.name]
    return [{ node, depth, path }, ...flattenTree(node.children, depth + 1, path)]
  })
}

/** IDs de una categoría y todas sus descendientes (destinos que crearían un ciclo al moverla). */
export function descendantIds(node: CategoryNode): Set<string> {
  const ids = new Set<string>([node.id])
  for (const child of node.children) for (const id of descendantIds(child)) ids.add(id)
  return ids
}
