<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'
import { useSessionStore } from '~/shared/auth/session.store'
import { visibleNavigation } from '~/shared/navigation'

const session = useSessionStore()
const route = useRoute()

const navItems = computed<NavigationMenuItem[][]>(() =>
  visibleNavigation(session.can).map((group) => [
    ...(group.label ? [{ label: group.label, type: 'label' as const }] : []),
    ...group.items.map((item) => ({ label: item.label, icon: item.icon, to: item.to })),
  ]),
)

const fullName = computed(() =>
  session.account ? `${session.account.firstNames} ${session.account.lastNames}` : '',
)

const userMenu = computed<DropdownMenuItem[][]>(() => [
  [{ label: session.account?.email ?? '', type: 'label' }],
  [
    { label: 'Mi cuenta', icon: 'i-lucide-circle-user', to: '/cuenta' },
    { label: 'Cambiar contraseña', icon: 'i-lucide-key-round', to: '/cambiar-contrasena' },
  ],
  [{ label: 'Cerrar sesión', icon: 'i-lucide-log-out', onSelect: () => logout() }],
])

async function logout() {
  await session.logout()
  await navigateTo('/login')
}

const title = computed(() => route.meta.title ?? 'Backoffice')
useHead({ title })
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar collapsible resizable :ui="{ footer: 'border-t border-default' }">
      <template #header="{ collapsed }">
        <NuxtLink to="/" class="flex items-center gap-2 font-semibold">
          <UIcon name="i-lucide-store" class="size-5 text-primary" />
          <span v-if="!collapsed">Backoffice</span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :items="navItems"
          :collapsed="collapsed"
          orientation="vertical"
          tooltip
          aria-label="Navegación principal"
        />
      </template>

      <template #footer="{ collapsed }">
        <UDropdownMenu :items="userMenu" :content="{ align: 'start' }">
          <UButton
            color="neutral"
            variant="ghost"
            block
            :square="collapsed"
            :aria-label="`Menú de ${fullName}`"
            class="justify-start"
          >
            <UUser :name="collapsed ? undefined : fullName" :avatar="{ alt: fullName }" size="sm" />
          </UButton>
        </UDropdownMenu>
      </template>
    </UDashboardSidebar>

    <UDashboardPanel>
      <template #header>
        <UDashboardNavbar :title="title" />
      </template>
      <template #body>
        <slot />
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
