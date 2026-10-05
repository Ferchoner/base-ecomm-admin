import { CHANGE_PASSWORD_PATH, loginRedirect } from '~/shared/auth/redirect'
import { useSessionStore } from '~/shared/auth/session.store'

export default defineNuxtRouteMiddleware(async (to) => {
  const session = useSessionStore()
  await session.restore()

  if (!session.isAuthenticated) {
    return to.meta.public ? undefined : navigateTo(loginRedirect(to.fullPath))
  }

  // Staff con contraseña temporal: la API solo le permite cambiarla (API_SPEC §3.2).
  if (session.mustChangePassword && to.path !== CHANGE_PASSWORD_PATH) {
    return navigateTo(CHANGE_PASSWORD_PATH)
  }

  if (to.path === '/login') return navigateTo('/')

  if (to.meta.permission && !session.can(to.meta.permission)) {
    return abortNavigation(
      createError({ statusCode: 403, statusMessage: 'No tienes permiso para ver esta sección.' }),
    )
  }
})
