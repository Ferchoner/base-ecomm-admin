import type { Page, Permission, Schemas } from '~/shared/api/types'

export type StaffUser = Schemas['StaffUserDto']
export type StaffPage = Page<StaffUser>
export type StaffStatus = StaffUser['status']
export type StaffWithPassword = Schemas['StaffWithTemporaryPasswordDto']
export type CreateStaffInput = Schemas['CreateStaffDto']
export type Role = Schemas['RoleDto']
export type RolePage = Page<Role>
export type CreateRoleInput = Schemas['CreateRoleDto']
export type UpdateRoleInput = Schemas['UpdateRoleDto']
export type PermissionInfo = Schemas['PermissionDto']
export type { Permission }

/** Filtros de `GET /v1/admin/identity/staff` (API_SPEC §9.17). */
export interface StaffListParams {
  page: number
  pageSize: number
  q?: string
  status?: string
  roleId?: string
  sort?: string
}

/** Filtros de `GET /v1/admin/identity/roles` (API_SPEC §9.16). */
export interface RoleListParams {
  page: number
  pageSize: number
  q?: string
  sort?: string
}
