import type { Ref } from 'vue'

/** Copia de `source` que se actualiza `ms` milisegundos después del último cambio. */
export function useDebounced<T>(source: Ref<T>, ms = 300): Readonly<Ref<T>> {
  const out = ref(source.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(source, (value) => {
    clearTimeout(timer)
    timer = setTimeout(() => (out.value = value), ms)
  })
  onScopeDispose(() => clearTimeout(timer))
  return readonly(out) as Readonly<Ref<T>>
}
