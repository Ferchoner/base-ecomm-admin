import ConfirmDialog from '~/components/ConfirmDialog.vue'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  color?: 'primary' | 'error' | 'warning'
}

/** Pide confirmación en un modal y resuelve `true` si el usuario acepta. */
export function useConfirm() {
  const overlay = useOverlay()
  const dialog = overlay.create(ConfirmDialog)
  return async (options: ConfirmOptions): Promise<boolean> => {
    const result = await dialog.open(options)
    return result?.confirmed === true
  }
}
