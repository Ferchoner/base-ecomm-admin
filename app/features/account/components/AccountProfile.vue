<script setup lang="ts">
import type { Account } from '~/shared/api/types'
import { formatDate } from '~/shared/utils/dates'

defineProps<{ account: Account }>()
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-2">
    <UCard>
      <template #header>
        <h2 class="font-semibold">Datos de la cuenta</h2>
      </template>
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt class="text-muted">Nombre</dt>
        <dd>{{ account.firstNames }} {{ account.lastNames }}</dd>
        <dt class="text-muted">Email</dt>
        <dd class="break-all">{{ account.email }}</dd>
        <dt class="text-muted">Cuenta creada</dt>
        <dd>{{ formatDate(account.createdAt) }}</dd>
      </dl>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Roles y permisos</h2>
        <p class="text-sm text-muted">
          Los asigna un administrador con permiso de gestionar el staff.
        </p>
      </template>
      <div class="space-y-4 text-sm">
        <div>
          <h3 class="mb-2 text-muted">Roles</h3>
          <ul v-if="account.roles.length" class="flex flex-wrap gap-2" aria-label="Roles">
            <li v-for="role in account.roles" :key="role.id">
              <UBadge color="primary" variant="subtle">{{ role.name }}</UBadge>
            </li>
          </ul>
          <p v-else>Sin roles asignados.</p>
        </div>
        <div>
          <h3 class="mb-2 text-muted">Permisos</h3>
          <ul v-if="account.permissions.length" class="flex flex-wrap gap-2" aria-label="Permisos">
            <li v-for="permission in account.permissions" :key="permission">
              <UBadge color="neutral" variant="outline" class="font-mono">{{ permission }}</UBadge>
            </li>
          </ul>
          <p v-else>Sin permisos.</p>
        </div>
      </div>
    </UCard>
  </div>
</template>
