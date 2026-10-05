import { useSessionStore } from '~/shared/auth/session.store'
import { useAllRoles } from './api'
import { canGrantRole } from './status'
import type { Role } from './types'

/**
 * Roles para los selectores, marcando los que quien actúa no puede dar (BR-USR-20). Se es
 * superadministrador si alguno de los roles propios (`GET /v1/me`) lo es.
 */
export function useRoleGrant() {
  const session = useSessionStore()
  const query = useAllRoles()
  const roles = computed<Role[]>(() => query.data.value?.data ?? [])
  const actorIsSuperadmin = computed(() => {
    const own = new Set((session.account?.roles ?? []).map((r) => r.id))
    return roles.value.some((r) => r.isSuperadmin && own.has(r.id))
  })
  function grantable(role: Role) {
    return canGrantRole(role, (p) => session.can(p), actorIsSuperadmin.value)
  }
  /** Opciones; un rol que ya tiene el usuario sigue elegible para poder conservarlo. */
  function options(current: readonly string[] = []) {
    return roles.value.map((r) => ({
      value: r.id,
      label: r.name,
      disabled: !grantable(r) && !current.includes(r.id),
    }))
  }
  return { ...query, roles, grantable, options, actorIsSuperadmin }
}
