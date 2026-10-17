<script setup lang="ts">
import { useSessionStore } from '~/shared/auth/session.store'
import { useStaffMember } from '../api'

/**
 * Una cuenta de staff por su ID (técnico, quién recibió, historial): "Tú" si es la propia, el nombre
 * con `staff.manage` y, sin él, el ID corto (GAPS G-21, G-23).
 */
const props = defineProps<{ id: string | null; empty?: string }>()
const session = useSessionStore()
const canRead = computed(() => session.can('staff.manage'))
const mine = computed(() => !!props.id && props.id === session.account?.id)
const member = useStaffMember(
  () => props.id,
  () => canRead.value && !mine.value,
)
</script>

<template>
  <span v-if="!id" class="text-muted">{{ empty ?? 'Sin asignar' }}</span>
  <span v-else-if="mine">Tú</span>
  <span v-else-if="member.data.value"
    >{{ member.data.value.firstNames }} {{ member.data.value.lastNames }}</span
  >
  <span v-else :title="id">Staff {{ id.slice(-6) }}</span>
</template>
