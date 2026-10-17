<script setup lang="ts">
import { formatDateTime } from '~/shared/utils/dates'
import { WORK_ORDER_STATUS } from '../status'
import type { WorkOrderHistoryEntry } from '../types'
import StaffName from './StaffName.vue'

/** Historial de estados, del más antiguo al más reciente, con quién y la nota (API_SPEC §25.6). */
defineProps<{ history: WorkOrderHistoryEntry[] }>()
</script>

<template>
  <ol class="space-y-3" aria-label="Historial de estados">
    <li v-for="(entry, i) in history" :key="i" class="flex gap-3 text-sm">
      <span class="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
      <div class="space-y-0.5">
        <div class="flex flex-wrap items-center gap-2">
          <StatusBadge :value="entry.toStatus" :styles="WORK_ORDER_STATUS" />
          <span class="text-muted">{{ formatDateTime(entry.occurredAt) }}</span>
        </div>
        <p v-if="entry.note">{{ entry.note }}</p>
        <p class="text-xs text-muted">Por <StaffName :id="entry.actorId" /></p>
      </div>
    </li>
  </ol>
</template>
