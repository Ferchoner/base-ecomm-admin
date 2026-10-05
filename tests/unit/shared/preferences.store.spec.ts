import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Account } from '~/shared/api/types'
import { useSessionStore } from '~/shared/auth/session.store'
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  usePreferencesStore,
} from '~/shared/preferences/preferences.store'

const account = (id: string) => ({ id, permissions: [] }) as unknown as Account

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('preferencias por usuario (G-06)', () => {
  it('el umbral de stock bajo empieza en 5', () => {
    expect(usePreferencesStore().lowStockThreshold).toBe(DEFAULT_LOW_STOCK_THRESHOLD)
    expect(DEFAULT_LOW_STOCK_THRESHOLD).toBe(5)
  })

  it('se guarda por cuenta y no se mezcla entre usuarios', async () => {
    const session = useSessionStore()
    const prefs = usePreferencesStore()
    session.$patch({ account: account('u1') })
    await nextTick()
    prefs.setLowStockThreshold(12)
    expect(prefs.lowStockThreshold).toBe(12)

    session.$patch({ account: account('u2') })
    await nextTick()
    expect(prefs.lowStockThreshold).toBe(5)

    session.$patch({ account: account('u1') })
    await nextTick()
    expect(prefs.lowStockThreshold).toBe(12)
  })

  it('ignora valores inválidos, también los guardados a mano', async () => {
    localStorage.setItem('backoffice.preferences.u3', '{"lowStockThreshold":-2}')
    const session = useSessionStore()
    const prefs = usePreferencesStore()
    session.$patch({ account: account('u3') })
    await nextTick()
    expect(prefs.lowStockThreshold).toBe(5)
    prefs.setLowStockThreshold(2.5)
    expect(prefs.lowStockThreshold).toBe(5)
  })
})
