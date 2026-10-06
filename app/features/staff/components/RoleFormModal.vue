<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import type { ApiProblem } from '~/shared/api/problem'
import { useSessionStore } from '~/shared/auth/session.store'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { usePermissions, useSaveRole } from '../api'
import { roleSchema } from '../schemas'
import type { RoleForm } from '../schemas'
import { permissionGroup } from '../status'
import type { Permission, Role } from '../types'

/**
 * Alta y edición de un rol (API_SPEC §9.16). Agregar un permiso exige tenerlo; quitarlo, no. El rol
 * superadministrador tiene siempre todos: solo cambian su nombre y descripción.
 */
const props = defineProps<{ role?: Role | null }>()
const open = defineModel<boolean>('open', { required: true })

const session = useSessionStore()
const { data: catalog, isPending: loadingCatalog } = usePermissions()
const state = reactive<RoleForm>({ name: '', description: '', permissions: [] })
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const save = useSaveRole()
const toast = useToast()

const superadmin = computed(() => !!props.role?.isSuperadmin)
const original = computed(() => props.role?.permissions ?? [])

watch(open, (isOpen) => {
  if (!isOpen) return
  state.name = props.role?.name ?? ''
  state.description = props.role?.description ?? ''
  state.permissions = [...original.value]
  problem.value = null
})

const groups = computed(() => {
  const map = new Map<string, Array<{ code: string; description: string; locked: boolean }>>()
  for (const p of catalog.value ?? []) {
    // Los permisos `superadminOnly` solo los tiene el rol superadministrador (BR-USR-21, ADR-0162).
    if (p.superadminOnly && !superadmin.value) continue
    const group = permissionGroup(p.code)
    const has = session.can(p.code as Permission)
    // No se puede agregar lo que no se tiene; lo que el rol ya tenía sí se puede quitar.
    const locked = superadmin.value || (!has && !original.value.includes(p.code as Permission))
    map.set(group, [...(map.get(group) ?? []), { ...p, locked }])
  }
  return [...map.entries()]
})

function toggle(code: string, checked: boolean | 'indeterminate') {
  state.permissions =
    checked === true
      ? [...new Set([...state.permissions, code])]
      : state.permissions.filter((c) => c !== code)
}

const hints = computed(() =>
  problem.value?.type === 'forbidden' ? ['Solo puedes dar permisos que tienes tú.'] : [],
)

async function onSubmit(event: FormSubmitEvent<RoleForm>) {
  problem.value = null
  const { name, description } = event.data
  const permissions = event.data.permissions as Permission[]
  const role = props.role
  let input
  if (role) {
    const samePermissions =
      permissions.length === role.permissions.length &&
      permissions.every((p) => role.permissions.includes(p))
    input = {
      version: role.version,
      ...(name !== role.name && { name }),
      ...(description !== (role.description ?? '') && { description: description || null }),
      ...(!role.isSuperadmin && !samePermissions && { permissions }),
    }
  } else {
    input = { name, permissions, ...(description && { description }) }
  }
  try {
    await save.mutateAsync({ id: role?.id, input })
    notifySuccess(toast, role ? 'Rol actualizado' : 'Rol creado')
    open.value = false
  } catch (e) {
    const p = e as ApiProblem
    if (p.type === 'version-conflict') {
      notifyProblem(toast, p)
      open.value = false
      return
    }
    const { fieldErrors, otherMessages } = problemFieldErrors(p, [
      'name',
      'description',
      'permissions',
    ])
    form.value?.setErrors(fieldErrors)
    if (fieldErrors.length === 0 || otherMessages.length > 0) problem.value = p
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="role ? `Editar rol ${role.name}` : 'Nuevo rol'"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <UForm
        id="role-form"
        ref="form"
        :schema="roleSchema"
        :state="state"
        :validate-on="['input', 'change']"
        class="space-y-4"
        @submit="onSubmit"
      >
        <ProblemAlert v-if="problem" :problem="problem" :messages="hints" />
        <UFormField label="Nombre" name="name" required help="Hasta 50 caracteres, único.">
          <UInput v-model="state.name" :maxlength="50" class="w-full" />
        </UFormField>
        <UFormField label="Descripción" name="description" help="Opcional, hasta 250 caracteres.">
          <UTextarea v-model="state.description" :maxlength="250" autoresize class="w-full" />
        </UFormField>
        <!-- Fuera de UFormField: cada casilla conserva su propio nombre accesible. -->
        <fieldset class="space-y-2">
          <legend class="text-sm font-medium">Permisos</legend>
          <p v-if="superadmin" class="text-sm text-muted">
            El superadministrador tiene siempre todos los permisos.
          </p>
          <p v-else class="text-sm text-muted">
            Solo puedes agregar permisos que tienes tú. Los exclusivos del superadministrador, como
            configurar pagos, no se ofrecen.
          </p>
          <USkeleton v-if="loadingCatalog" class="h-40 w-full" />
          <div v-else class="grid gap-4 sm:grid-cols-2">
            <fieldset v-for="[group, items] in groups" :key="group" class="space-y-2">
              <legend class="text-sm text-muted">{{ group }}</legend>
              <UCheckbox
                v-for="p in items"
                :key="p.code"
                :model-value="superadmin || state.permissions.includes(p.code)"
                :disabled="p.locked"
                :label="p.description"
                :description="p.code"
                @update:model-value="(v) => toggle(p.code, v)"
              />
            </fieldset>
          </div>
          <UFormField name="permissions" />
        </fieldset>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">Cancelar</UButton>
        <UButton type="submit" form="role-form" :loading="save.isPending.value">{{
          role ? 'Guardar cambios' : 'Crear rol'
        }}</UButton>
      </div>
    </template>
  </UModal>
</template>
