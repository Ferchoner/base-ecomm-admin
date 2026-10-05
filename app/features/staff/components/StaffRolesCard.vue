<script setup lang="ts">
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import type { ApiProblem } from '~/shared/api/problem'
import { useStaffChange } from '../api'
import type { StaffUser } from '../types'
import { useRoleGrant } from '../use-role-grant'

/** Roles de un staff (`PUT …/roles`, API_SPEC §9.17): reemplaza el conjunto, de 1 a 50. */
const props = defineProps<{ user: StaffUser; canWrite: boolean }>()

const editing = ref(false)
const roleIds = ref<string[]>([])
const problem = ref<ApiProblem | null>(null)
const change = useStaffChange(() => props.user.id)
const { options } = useRoleGrant()
const toast = useToast()

const current = computed(() => props.user.roles.map((r) => r.id))
const unchanged = computed(
  () =>
    roleIds.value.length === current.value.length &&
    roleIds.value.every((id) => current.value.includes(id)),
)
const hints = computed(() => {
  if (problem.value?.type === 'last-superadmin')
    return ['Debe quedar al menos un superadministrador activo.']
  if (problem.value?.type === 'forbidden')
    return ['Solo puedes dar roles cuyos permisos tienes tú.']
  return []
})

function startEdit() {
  roleIds.value = [...current.value]
  problem.value = null
  editing.value = true
}

async function save() {
  if (roleIds.value.length === 0) return
  problem.value = null
  try {
    await change.mutateAsync({
      action: 'roles',
      roleIds: roleIds.value,
      version: props.user.version,
    })
    notifySuccess(toast, 'Roles actualizados')
    editing.value = false
  } catch (e) {
    const p = e as ApiProblem
    if (p.type === 'version-conflict') {
      notifyProblem(toast, p)
      editing.value = false
    } else problem.value = p
  }
}
</script>

<template>
  <div class="space-y-3">
    <template v-if="editing">
      <ProblemAlert v-if="problem" :problem="problem" :messages="hints" />
      <UFormField
        label="Roles"
        :error="roleIds.length === 0 ? 'Elige al menos un rol.' : undefined"
        help="Solo puedes agregar roles cuyos permisos tienes."
      >
        <USelectMenu
          v-model="roleIds"
          :items="options(current)"
          value-key="value"
          label-key="label"
          multiple
          class="w-full"
        />
      </UFormField>
      <div class="flex gap-2">
        <UButton
          :loading="change.isPending.value"
          :disabled="unchanged || roleIds.length === 0"
          @click="save"
          >Guardar roles</UButton
        >
        <UButton color="neutral" variant="ghost" @click="editing = false">Cancelar</UButton>
      </div>
    </template>
    <template v-else>
      <ul class="flex flex-wrap gap-2" aria-label="Roles del staff">
        <li v-for="r in user.roles" :key="r.id">
          <UBadge color="neutral" variant="subtle">{{ r.name }}</UBadge>
        </li>
      </ul>
      <UButton
        v-if="canWrite"
        size="sm"
        color="neutral"
        variant="outline"
        icon="i-lucide-pencil"
        @click="startEdit"
        >Cambiar roles</UButton
      >
    </template>
  </div>
</template>
