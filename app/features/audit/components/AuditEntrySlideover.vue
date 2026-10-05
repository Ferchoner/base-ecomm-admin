<script setup lang="ts">
import { formatDateTime } from '~/shared/utils/dates'
import { AUDIT_ACTOR_TYPE, AUDIT_RESULT, changeRows } from '../status'
import type { AuditEntry } from '../types'

/** Detalle de un registro: cambios, motivo y contexto de la solicitud. Solo lectura (API_SPEC §18). */
const props = defineProps<{ entry: AuditEntry }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ filter: [key: 'actorId' | 'resource', entry: AuditEntry] }>()

const rows = computed(() => changeRows(props.entry.changes))
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="entry.action"
    :description="formatDateTime(entry.occurredAt)"
  >
    <template #body>
      <div class="space-y-5 text-sm">
        <div class="flex flex-wrap items-center gap-2">
          <StatusBadge :value="entry.result" :styles="AUDIT_RESULT" />
          <span class="text-muted">{{ AUDIT_ACTOR_TYPE[entry.actorType] ?? entry.actorType }}</span>
        </div>

        <DetailList
          :items="[
            { label: 'Actor', value: entry.actorId, mono: true },
            {
              label: 'Recurso',
              value: entry.resourceType
                ? `${entry.resourceType}${entry.resourceId ? ` · ${entry.resourceId}` : ''}`
                : null,
              mono: true,
            },
            { label: 'Correlación', value: entry.correlationId, mono: true },
            { label: 'IP', value: entry.ip, mono: true },
            { label: 'Navegador', value: entry.userAgent },
          ]"
        />

        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="entry.actorId"
            size="xs"
            color="neutral"
            variant="outline"
            icon="i-lucide-user-search"
            @click="emit('filter', 'actorId', entry)"
            >Ver lo que hizo este actor</UButton
          >
          <UButton
            v-if="entry.resourceType && entry.resourceId"
            size="xs"
            color="neutral"
            variant="outline"
            icon="i-lucide-history"
            @click="emit('filter', 'resource', entry)"
            >Ver el historial de este recurso</UButton
          >
        </div>

        <section v-if="entry.reason" class="space-y-1">
          <h3 class="font-medium">Motivo</h3>
          <p class="break-words whitespace-pre-wrap">{{ entry.reason }}</p>
        </section>

        <section class="space-y-1">
          <h3 class="font-medium">Cambios</h3>
          <p v-if="rows.length === 0" class="text-muted">Sin cambios registrados.</p>
          <table v-else class="w-full text-left text-xs">
            <thead class="text-muted">
              <tr>
                <th scope="col" class="py-1 pe-2 font-normal">Campo</th>
                <th scope="col" class="py-1 pe-2 font-normal">Antes</th>
                <th scope="col" class="py-1 font-normal">Después</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-for="row in rows" :key="row.field" class="align-top">
                <th scope="row" class="py-1 pe-2 font-mono font-normal">{{ row.field }}</th>
                <td v-if="row.hidden" colspan="2" class="py-1 text-muted">
                  Cambió; es un dato personal o sensible y no se muestra.
                </td>
                <template v-else>
                  <td class="py-1 pe-2 break-all">{{ row.from }}</td>
                  <td class="py-1 break-all">{{ row.to }}</td>
                </template>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </template>
  </USlideover>
</template>
