import type { Permission } from '~/shared/api/types'

declare module '#app' {
  interface PageMeta {
    /** Ruta accesible sin sesión (login, recuperación). */
    public?: boolean
    /** Permiso de la API necesario para ver la página (solo UX; la API decide). */
    permission?: Permission
    /** Título del encabezado del panel. */
    title?: string
  }
}

export {}
