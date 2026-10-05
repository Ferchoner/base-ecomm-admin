<script setup lang="ts">
import { formatDateTime } from '~/shared/utils/dates'
import { DELIVERY_STATUS, MAX_ATTEMPTS, canRetryDelivery, deliveryMoment } from '../status'
import type { EventDelivery } from '../types'
import RetryDeliveryButton from './RetryDeliveryButton.vue'

/** Detalle de una entrega: el último error y el evento tal como lo recibe el manejador. */
defineProps<{ delivery: EventDelivery }>()
const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <USlideover v-model:open="open" :title="delivery.eventType" :description="delivery.handler">
    <template #body>
      <div class="space-y-5 text-sm">
        <div class="flex flex-wrap items-center gap-2">
          <StatusBadge :value="delivery.status" :styles="DELIVERY_STATUS" />
          <span class="text-muted">{{ delivery.attempts }} de {{ MAX_ATTEMPTS }} intentos</span>
          <RetryDeliveryButton
            v-if="canRetryDelivery(delivery.status)"
            :delivery-id="delivery.id"
            class="ms-auto"
            @retried="open = false"
          />
        </div>

        <DetailList
          :items="[
            { label: 'Ocurrió', value: formatDateTime(delivery.occurredAt) },
            {
              label: deliveryMoment(delivery).label,
              value: deliveryMoment(delivery).at
                ? formatDateTime(deliveryMoment(delivery).at)
                : 'Sin reintentos automáticos',
            },
            { label: 'ID del evento', value: delivery.eventId, mono: true },
            { label: 'ID de la entrega', value: delivery.id, mono: true },
          ]"
        />

        <section v-if="delivery.lastError" class="space-y-1">
          <h3 class="font-medium">Último error</h3>
          <pre
            class="rounded-md bg-elevated p-3 text-xs break-words whitespace-pre-wrap"
            aria-label="Último error"
            >{{ delivery.lastError }}</pre>
        </section>

        <section class="space-y-1">
          <h3 class="font-medium">Evento</h3>
          <p class="text-xs text-muted">
            Como lo recibe el manejador; nunca lleva datos personales.
          </p>
          <pre
            class="overflow-x-auto rounded-md bg-elevated p-3 text-xs"
            aria-label="Contenido del evento"
            >{{ JSON.stringify(delivery.event, null, 2) }}</pre>
        </section>
      </div>
    </template>
  </USlideover>
</template>
