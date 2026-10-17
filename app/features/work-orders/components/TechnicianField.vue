<script setup lang="ts">
import { useSessionStore } from '~/shared/auth/session.store'
import { useDebounced } from '~/shared/utils/debounce'
import { useTechnicianSearch } from '../api'
import StaffName from './StaffName.vue'

/**
 * Técnico de la orden (D-085, GAPS G-23): con `staff.manage` se elige del staff activo; sin él,
 * solo "Asignármela". El modelo es el ID de la cuenta, o '' sin técnico.
 */
const model = defineModel<string>({ required: true })
defineProps<{ disabled?: boolean }>()

const session = useSessionStore()
const canList = computed(() => session.can('staff.manage'))
const myId = computed(() => session.account?.id ?? '')

const search = ref('')
const query = useDebounced(search)
const staff = useTechnicianSearch(query, canList)
const items = computed(() =>
  (staff.data.value?.data ?? []).map((s) => ({
    value: s.id,
    label: `${s.firstNames} ${s.lastNames}`,
    description: s.email,
  })),
)
</script>

<template>
  <div v-if="canList && !disabled" class="flex flex-wrap items-center gap-2">
    <USelectMenu
      v-model="model"
      v-model:search-term="search"
      :items="items"
      value-key="value"
      label-key="label"
      description-key="description"
      ignore-filter
      :loading="staff.isFetching.value"
      placeholder="Sin asignar"
      :search-input="{ placeholder: 'Nombre o email' }"
      aria-label="Técnico"
      class="w-full sm:w-72"
    >
      <template v-if="model && !items.some((i) => i.value === model)" #default>
        <StaffName :id="model" />
      </template>
    </USelectMenu>
    <UButton v-if="model" color="neutral" variant="ghost" size="sm" @click="model = ''"
      >Quitar</UButton
    >
  </div>
  <div v-else class="flex flex-wrap items-center gap-2 text-sm">
    <StaffName :id="model || null" />
    <template v-if="!disabled">
      <UButton
        v-if="model !== myId"
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-user-check"
        @click="model = myId"
        >Asignármela</UButton
      >
      <UButton v-if="model" color="neutral" variant="ghost" size="sm" @click="model = ''"
        >Quitar</UButton
      >
    </template>
  </div>
</template>
