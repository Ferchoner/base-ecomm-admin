/**
 * El local de este equipo (ADR-0171 de base-shop, DECISIONS D-097): el almacén que cada equipo usa por
 * omisión al vender, cobrar y cerrar la caja. Es del equipo, no de la cuenta: en una tienda varias
 * personas usan la misma computadora, así que se guarda en este navegador para todos sus usuarios.
 * La API no lo conoce; cada solicitud sigue mandando el almacén elegido.
 */
export const DEVICE_WAREHOUSE_KEY = 'backoffice.device.warehouseId'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function read(): string | null {
  try {
    const value = globalThis.localStorage?.getItem(DEVICE_WAREHOUSE_KEY) ?? null
    return value !== null && UUID.test(value) ? value : null
  } catch {
    return null
  }
}

const current = ref<string | null>(read())

// Otra pestaña del mismo equipo lo cambió.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === DEVICE_WAREHOUSE_KEY) current.value = read()
  })
}

export function useDeviceWarehouse() {
  /** `null` mientras este equipo no tenga local. */
  const warehouseId = readonly(current)

  /** Guarda el local de este equipo; `null` lo quita. Un valor que no es un ID se ignora. */
  function set(id: string | null) {
    if (id !== null && !UUID.test(id)) return
    current.value = id
    try {
      if (id === null) globalThis.localStorage?.removeItem(DEVICE_WAREHOUSE_KEY)
      else globalThis.localStorage?.setItem(DEVICE_WAREHOUSE_KEY, id)
    } catch {
      // Sin almacenamiento dura lo que la pestaña.
    }
  }

  /**
   * El almacén para empezar una pantalla: el del equipo si está entre los activos, si no el primero
   * activo, o `''` sin almacenes.
   */
  function initial(activeIds: readonly string[]): string {
    return current.value && activeIds.includes(current.value) ? current.value : (activeIds[0] ?? '')
  }

  /** Re-lee el valor guardado (pruebas, o después de que otro código lo cambie). */
  function reload() {
    current.value = read()
  }

  return { warehouseId, set, initial, reload }
}
