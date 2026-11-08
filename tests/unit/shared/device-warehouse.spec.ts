import { beforeEach, describe, expect, it } from 'vitest'
import { DEVICE_WAREHOUSE_KEY, useDeviceWarehouse } from '~/shared/device/device-warehouse'

const L204 = '01a0f54d-639d-7173-a3ff-f510cd91429d'
const L206 = '01a0f54d-639d-7173-a3ff-f510cd914299'

describe('useDeviceWarehouse', () => {
  beforeEach(() => {
    localStorage.clear()
    useDeviceWarehouse().reload()
  })

  it('guarda el local en este navegador, para cualquier usuario', () => {
    const device = useDeviceWarehouse()
    expect(device.warehouseId.value).toBeNull()

    device.set(L204)

    expect(localStorage.getItem(DEVICE_WAREHOUSE_KEY)).toBe(L204)
    expect(useDeviceWarehouse().warehouseId.value).toBe(L204)
    device.set(null)
    expect(localStorage.getItem(DEVICE_WAREHOUSE_KEY)).toBeNull()
  })

  it('ignora un valor que no es un ID, guardado o recibido', () => {
    localStorage.setItem(DEVICE_WAREHOUSE_KEY, 'local 204')
    const device = useDeviceWarehouse()
    device.reload()
    expect(device.warehouseId.value).toBeNull()

    device.set('local 206')
    expect(device.warehouseId.value).toBeNull()
  })

  it('empieza con el local del equipo si está activo, o con el primero activo', () => {
    const device = useDeviceWarehouse()
    expect(device.initial([L206, L204])).toBe(L206)

    device.set(L204)
    expect(device.initial([L206, L204])).toBe(L204)
    // Desactivado: se usa el primero.
    expect(device.initial([L206])).toBe(L206)
    expect(device.initial([])).toBe('')
  })
})
