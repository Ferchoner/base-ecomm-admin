import type { RouteLocationRaw } from 'vue-router'

export const CHANGE_PASSWORD_PATH = '/cambiar-contrasena'

/** Solo rutas internas: evita redirecciones abiertas con `?redirect=//otro-sitio`. */
export function safeRedirect(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string') return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  return value
}

export function loginRedirect(fullPath: string): RouteLocationRaw {
  return fullPath && fullPath !== '/'
    ? { path: '/login', query: { redirect: fullPath } }
    : { path: '/login' }
}
