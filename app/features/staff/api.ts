import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { ApiProblem } from '~/shared/api/problem'
import { QUERY_ROOT, invalidateRoots } from '~/shared/api/query-roots'
import { useApi } from '~/shared/api/use-api'
import type {
  CreateRoleInput,
  CreateStaffInput,
  PermissionInfo,
  Role,
  RoleListParams,
  RolePage,
  StaffListParams,
  StaffPage,
  StaffUser,
  StaffWithPassword,
  UpdateRoleInput,
} from './types'

const BASE = '/v1/admin/identity'

export const staffKeys = {
  all: [QUERY_ROOT.staff] as const,
  list: (params: StaffListParams) => [...staffKeys.all, 'users', 'list', params] as const,
  detail: (id: string) => [...staffKeys.all, 'users', 'detail', id] as const,
  roles: () => [...staffKeys.all, 'roles'] as const,
  roleList: (params: RoleListParams) => [...staffKeys.roles(), 'list', params] as const,
  permissions: () => [...staffKeys.all, 'permissions'] as const,
}

// ── Staff ──────────────────────────────────────────────────────────────────────

export function useStaffList(params: MaybeRefOrGetter<StaffListParams>) {
  const api = useApi()
  return useQuery<StaffPage, ApiProblem>({
    queryKey: computed(() => staffKeys.list(toValue(params))),
    queryFn: ({ signal }) =>
      api<StaffPage>(`${BASE}/staff`, { query: { ...toValue(params) }, signal }),
    placeholderData: keepPreviousData,
  })
}

export function useStaffUser(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useQuery<StaffUser, ApiProblem>({
    queryKey: computed(() => staffKeys.detail(toValue(id))),
    queryFn: ({ signal }) => api<StaffUser>(`${BASE}/staff/${toValue(id)}`, { signal }),
    enabled: computed(() => !!toValue(id)),
  })
}

/**
 * Alta y reactivación responden la contraseña temporal una sola vez (API_SPEC §9.17). No se guarda
 * en la cache: solo se guarda el usuario.
 */
export function useCreateStaff() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<StaffWithPassword, ApiProblem, CreateStaffInput>({
    mutationFn: (body) =>
      api<StaffWithPassword>(`${BASE}/staff`, { method: 'POST', body: { ...body } }),
    onSuccess: ({ user }) => {
      qc.setQueryData(staffKeys.detail(user.id), user)
      invalidateRoots(qc, [QUERY_ROOT.staff])
    },
  })
}

export type StaffChange =
  | { action: 'roles'; roleIds: string[]; version: number }
  | { action: 'suspend'; reason: string; version: number }
  | { action: 'reactivate'; reason: string; version: number }

export function useStaffChange(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<{ user: StaffUser; temporaryPassword?: string }, ApiProblem, StaffChange>({
    mutationFn: async ({ action, ...body }) => {
      const path = `${BASE}/staff/${toValue(id)}`
      if (action === 'roles')
        return { user: await api<StaffUser>(`${path}/roles`, { method: 'PUT', body }) }
      if (action === 'suspend')
        return { user: await api<StaffUser>(`${path}/suspend`, { method: 'POST', body }) }
      return api<StaffWithPassword>(`${path}/reactivate`, { method: 'POST', body })
    },
    onSuccess: ({ user }) => {
      qc.setQueryData(staffKeys.detail(user.id), user)
      invalidateRoots(qc, [QUERY_ROOT.staff])
    },
    onError: (error) => {
      if (error.type === 'version-conflict')
        void qc.invalidateQueries({ queryKey: staffKeys.detail(toValue(id)) })
    },
  })
}

// ── Roles y permisos ───────────────────────────────────────────────────────────

export function useRoles(params: MaybeRefOrGetter<RoleListParams>) {
  const api = useApi()
  return useQuery<RolePage, ApiProblem>({
    queryKey: computed(() => staffKeys.roleList(toValue(params))),
    queryFn: ({ signal }) =>
      api<RolePage>(`${BASE}/roles`, { query: { ...toValue(params) }, signal }),
    placeholderData: keepPreviousData,
  })
}

/** Todos los roles, para los selectores (máximo de página de la API, API_SPEC §5.1). */
export function useAllRoles() {
  return useRoles({ page: 1, pageSize: 100, sort: 'name' })
}

export function usePermissions() {
  const api = useApi()
  return useQuery<PermissionInfo[], ApiProblem>({
    queryKey: staffKeys.permissions(),
    queryFn: async ({ signal }) =>
      (await api<{ data: PermissionInfo[] }>(`${BASE}/permissions`, { signal })).data,
    staleTime: Infinity,
  })
}

export function useSaveRole() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<Role, ApiProblem, { id?: string; input: CreateRoleInput | UpdateRoleInput }>({
    mutationFn: ({ id, input }) =>
      id
        ? api<Role>(`${BASE}/roles/${id}`, { method: 'PATCH', body: { ...input } })
        : api<Role>(`${BASE}/roles`, { method: 'POST', body: { ...input } }),
    // Los nombres de rol aparecen en el staff: se invalida todo Identity del staff.
    onSuccess: () => invalidateRoots(qc, [QUERY_ROOT.staff]),
    onError: (error) => {
      if (error.type === 'version-conflict')
        void qc.invalidateQueries({ queryKey: staffKeys.roles() })
    },
  })
}

export function useDeleteRole() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<undefined, ApiProblem, string>({
    mutationFn: (id) => api<undefined>(`${BASE}/roles/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateRoots(qc, [QUERY_ROOT.staff]),
  })
}
