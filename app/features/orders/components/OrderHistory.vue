<script setup lang="ts">
import { ORDER_STATUS } from '~/shared/status/sales'
import { formatDateTime } from '~/shared/utils/dates'
import type { StatusHistoryEntry } from '../types'

/** Historial de estados, del más antiguo al más reciente (API_SPEC §15.7). */
defineProps<{ history: StatusHistoryEntry[] }>()
</script>

<template>
  <ol class="space-y-3" aria-label="Historial de estados">
    <li v-for="(entry, i) in history" :key="i" class="flex gap-3 text-sm">
      <span class="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
      <div class="space-y-0.5">
        <div class="flex flex-wrap items-center gap-2">
          <StatusBadge :value="entry.toStatus" :styles="ORDER_STATUS" />
          <span class="text-muted">{{ formatDateTime(entry.occurredAt) }}</span>
        </div>
        <p v-if="entry.reason">{{ entry.reason }}</p>
        <p class="text-xs text-muted">{{ entry.actorId ? 'Por el staff' : 'Automático' }}</p>
      </div>
    </li>
  </ol>
</template>
