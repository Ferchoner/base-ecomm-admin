import type { StatusStyle } from '~/components/StatusBadge.vue'
import type { Permission, Role, StaffStatus } from './types'

export const STAFF_STATUS: Record<StaffStatus, StatusStyle> = {
  ACTIVE: { label: 'Activo', color: 'success' },
  SUSPENDED: { label: 'Suspendido', color: 'warning' },
}

export const STAFF_STATUS_OPTIONS = (Object.keys(STAFF_STATUS) as StaffStatus[]).map((value) => ({
  value: value as string,
  label: STAFF_STATUS[value].label,
}))

export const STAFF_SORT_OPTIONS = [
  { value: '-createdAt', label: 'Alta más reciente' },
  { value: 'createdAt', label: 'Alta más antigua' },
  { value: 'email', label: 'Email (A-Z)' },
]

export const ROLE_SORT_OPTIONS = [
  { value: 'name', label: 'Nombre (A-Z)' },
  { value: '-createdAt', label: 'Más recientes' },
]

export function staffName(s: { firstNames: string; lastNames: string }) {
  return `${s.firstNames} ${s.lastNames}`
}

/** Grupo de un permiso por su prefijo (`orders.read` → `orders`), para mostrarlos juntos. */
export const PERMISSION_GROUP: Record<string, string> = {
  catalog: 'Catálogo',
  pricing: 'Precios',
  inventory: 'Inventario',
  orders: 'Pedidos',
  payments: 'Pagos',
  shipping: 'Envíos',
  customers: 'Clientes',
  staff: 'Staff y roles',
  audit: 'Auditoría',
  events: 'Eventos',
}

export function permissionGroup(code: string): string {
  const prefix = code.split('.')[0] ?? code
  return PERMISSION_GROUP[prefix] ?? prefix
}

/**
 * "Nadie da lo que no tiene" (BR-USR-20, ADR-0154): asignar un rol exige tener todos sus permisos,
 * y el rol superadministrador solo lo asigna otro superadministrador. Solo decide qué se ofrece; la
 * API responde 403 si no procede.
 */
export function canGrantRole(
  role: Pick<Role, 'isSuperadmin' | 'permissions'>,
  can: (p: Permission) => boolean,
  actorIsSuperadmin: boolean,
): boolean {
  if (role.isSuperadmin) return actorIsSuperadmin
  return role.permissions.every((p) => can(p))
}
