import { z } from 'zod'

const name = (label: string) =>
  z.string().trim().min(1, `Escribe ${label}.`).max(100, 'Máximo 100 caracteres.')

/** `POST /v1/admin/identity/staff` (API_SPEC §9.17). */
export const staffSchema = z.object({
  email: z.email('Escribe un email válido.').max(254, 'Máximo 254 caracteres.'),
  firstNames: name('los nombres'),
  lastNames: name('los apellidos'),
  roleIds: z.array(z.string()).min(1, 'Elige al menos un rol.').max(50, 'Máximo 50 roles.'),
})
export type StaffForm = z.infer<typeof staffSchema>

export const staffRolesSchema = z.object({
  roleIds: z.array(z.string()).min(1, 'Elige al menos un rol.').max(50, 'Máximo 50 roles.'),
})

/** Roles (API_SPEC §9.16): nombre de 1 a 50, descripción hasta 250 (vacía la borra). */
export const roleSchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre.').max(50, 'Máximo 50 caracteres.'),
  description: z.string().trim().max(250, 'Máximo 250 caracteres.'),
  permissions: z.array(z.string()),
})
export type RoleForm = z.infer<typeof roleSchema>
