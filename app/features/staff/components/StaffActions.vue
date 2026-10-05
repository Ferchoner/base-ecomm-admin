<script setup lang="ts">
import { notifySuccess } from '~/shared/api/feedback'
import { useSessionStore } from '~/shared/auth/session.store'
import { useStaffChange } from '../api'
import { staffName } from '../status'
import type { StaffUser } from '../types'
import TemporaryPasswordDialog from './TemporaryPasswordDialog.vue'

/** Suspender y reactivar un staff (API_SPEC §9.17). */
const props = defineProps<{ user: StaffUser }>()

const session = useSessionStore()
const change = useStaffChange(() => props.user.id)
const toast = useToast()
const kind = ref<'suspend' | 'reactivate' | null>(null)
const dialogOpen = computed({
  get: () => kind.value !== null,
  set: (v) => {
    if (!v) kind.value = null
  },
})
const temporaryPassword = ref<string | null>(null)

// Un staff no puede suspenderse a sí mismo (API_SPEC §9.17).
const isSelf = computed(() => session.account?.id === props.user.id)
const name = computed(() => staffName(props.user))
const COPY = computed(() => ({
  suspend: {
    title: `Suspender a ${name.value}`,
    description: 'No podrá iniciar sesión y se cerrarán sus sesiones abiertas.',
    confirmLabel: 'Suspender',
    color: 'warning' as const,
  },
  reactivate: {
    title: `Reactivar a ${name.value}`,
    description:
      'Conserva sus roles. La API genera una contraseña temporal nueva que verás una sola vez.',
    confirmLabel: 'Reactivar',
    color: 'primary' as const,
  },
}))

async function submit(reason: string) {
  const action = kind.value
  if (!action) return
  const result = await change.mutateAsync({ action, reason, version: props.user.version })
  if (action === 'suspend') notifySuccess(toast, 'Staff suspendido')
  else temporaryPassword.value = result.temporaryPassword ?? null
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <UButton
      v-if="user.status === 'SUSPENDED'"
      icon="i-lucide-rotate-ccw"
      @click="kind = 'reactivate'"
      >Reactivar</UButton
    >
    <UButton
      v-if="user.status === 'ACTIVE' && !isSelf"
      icon="i-lucide-user-x"
      color="warning"
      variant="outline"
      @click="kind = 'suspend'"
      >Suspender</UButton
    >

    <ReasonDialog
      v-if="kind"
      v-model:open="dialogOpen"
      v-bind="COPY[kind]"
      :hints="{
        'last-superadmin': 'Debe quedar al menos un superadministrador activo.',
        forbidden: 'Para reactivarlo necesitas todos los permisos de sus roles.',
      }"
      :submit="submit"
    />
    <TemporaryPasswordDialog
      :email="user.email"
      :password="temporaryPassword"
      @close="temporaryPassword = null"
    />
  </div>
</template>
