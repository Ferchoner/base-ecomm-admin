<script setup lang="ts">
import { useStaffUser } from '~/features/staff/api'
import StaffActions from '~/features/staff/components/StaffActions.vue'
import StaffRolesCard from '~/features/staff/components/StaffRolesCard.vue'
import { STAFF_STATUS, staffName } from '~/features/staff/status'
import { useSessionStore } from '~/shared/auth/session.store'
import { formatDateTime } from '~/shared/utils/dates'

definePageMeta({ title: 'Staff', permission: 'staff.manage' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const session = useSessionStore()
const { data: user, isPending, error, refetch } = useStaffUser(id)
</script>

<template>
  <div class="space-y-4">
    <UButton to="/staff" icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm"
      >Staff</UButton
    >

    <QueryState :loading="isPending" :error="error" @retry="refetch()">
      <template v-if="user">
        <header class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-1">
            <h2 class="text-xl font-semibold">{{ staffName(user) }}</h2>
            <div class="flex flex-wrap items-center gap-2">
              <StatusBadge :value="user.status" :styles="STAFF_STATUS" />
              <span class="text-sm text-muted">{{ user.email }}</span>
              <UBadge v-if="session.account?.id === user.id" color="neutral" variant="outline"
                >Tú</UBadge
              >
            </div>
          </div>
          <StaffActions :user="user" />
        </header>

        <div class="grid gap-4 lg:grid-cols-2">
          <UCard>
            <template #header><h3 class="font-semibold">Cuenta</h3></template>
            <DetailList
              :items="[
                { label: 'Email', value: user.email },
                {
                  label: 'Contraseña',
                  value: user.mustChangePassword ? 'Temporal, debe cambiarla' : 'Propia',
                },
                { label: 'Último acceso', value: formatDateTime(user.lastLoginAt) },
                { label: 'Alta', value: formatDateTime(user.createdAt) },
              ]"
            />
          </UCard>
          <UCard>
            <template #header><h3 class="font-semibold">Roles</h3></template>
            <StaffRolesCard :user="user" :can-write="true" />
          </UCard>
        </div>
      </template>
    </QueryState>
  </div>
</template>
