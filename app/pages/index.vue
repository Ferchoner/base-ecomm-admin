<script setup lang="ts">
import { useSessionStore } from '~/shared/auth/session.store'
import { visibleNavigation } from '~/shared/navigation'

definePageMeta({ title: 'Inicio' })

const session = useSessionStore()
const sections = computed(() =>
  visibleNavigation(session.can)
    .flatMap((group) => group.items)
    .filter((item) => item.to !== '/'),
)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold">Hola, {{ session.account?.firstNames }}</h2>
      <p class="text-muted">El tablero de conteos llega en la fase F6.</p>
    </div>

    <UEmpty
      v-if="sections.length === 0"
      icon="i-lucide-lock"
      title="Sin secciones disponibles"
      description="Tu cuenta no tiene permisos asignados. Pide a un administrador que te asigne un rol."
    />

    <ul v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Tus secciones">
      <li v-for="item in sections" :key="item.to">
        <UCard>
          <div class="flex items-center gap-3">
            <UIcon :name="item.icon" class="size-5 text-primary" />
            <span class="font-medium">{{ item.label }}</span>
            <UBadge v-if="!item.available" color="neutral" variant="subtle" class="ms-auto"
              >Próximamente</UBadge
            >
          </div>
        </UCard>
      </li>
    </ul>
  </div>
</template>
