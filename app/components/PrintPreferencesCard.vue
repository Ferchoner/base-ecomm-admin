<script setup lang="ts">
import { notifySuccess } from '~/shared/api/feedback'
import { useSessionStore } from '~/shared/auth/session.store'
import { usePreferencesStore } from '~/shared/preferences/preferences.store'
import type { CompactSymbology, DocumentFormat, LabelFormat } from '~/shared/print/formats'
import {
  COMPACT_SYMBOLOGIES,
  DOCUMENT_FORMATS,
  LABEL_FORMATS,
  options,
} from '~/shared/print/formats'

/** Papel con el que abre cada documento (D-083); al imprimir se puede elegir otro. */
const prefs = usePreferencesStore()
const session = useSessionStore()
const toast = useToast()
const DOCUMENTS = options(DOCUMENT_FORMATS)
const LABELS = options(LABEL_FORMATS)
const SYMBOLOGIES = options(COMPACT_SYMBOLOGIES)

function save(changes: Parameters<typeof prefs.setPrint>[0]) {
  prefs.setPrint(changes)
  notifySuccess(toast, 'Preferencia guardada')
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">Impresión</h2>
      <p class="text-sm text-muted">
        El papel con el que abre cada documento. Se guarda en este navegador, solo para tu usuario.
      </p>
    </template>
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField v-if="session.can('orders.read')" label="Ticket">
        <USelect
          :model-value="prefs.ticketFormat"
          :items="DOCUMENTS"
          class="w-full"
          @update:model-value="(v) => save({ ticketFormat: v as DocumentFormat })"
        />
      </UFormField>
      <UFormField v-if="session.can('work-orders.read')" label="Nota de servicio">
        <USelect
          :model-value="prefs.serviceNoteFormat"
          :items="DOCUMENTS"
          class="w-full"
          @update:model-value="(v) => save({ serviceNoteFormat: v as DocumentFormat })"
        />
      </UFormField>
      <template v-if="session.can('catalog.read')">
        <UFormField label="Etiquetas">
          <USelect
            :model-value="prefs.labelFormat"
            :items="LABELS"
            class="w-full"
            @update:model-value="(v) => save({ labelFormat: v as LabelFormat })"
          />
        </UFormField>
        <UFormField label="Código de la etiqueta compacta" help="Data Matrix es el más pequeño.">
          <USelect
            :model-value="prefs.compactSymbology"
            :items="SYMBOLOGIES"
            class="w-full"
            @update:model-value="(v) => save({ compactSymbology: v as CompactSymbology })"
          />
        </UFormField>
      </template>
    </div>
  </UCard>
</template>
