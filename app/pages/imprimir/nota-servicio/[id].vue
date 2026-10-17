<script setup lang="ts">
import { useServiceNote } from '~/features/work-orders/api'
import ServiceNoteDocument from '~/features/work-orders/components/ServiceNoteDocument.vue'
import { usePreferencesStore } from '~/shared/preferences/preferences.store'
import { DOCUMENT_FORMATS, options, usePrintPage } from '~/shared/print/formats'
import type { DocumentFormat } from '~/shared/print/formats'

definePageMeta({
  layout: 'print',
  title: 'Imprimir nota de servicio',
  permission: 'work-orders.read',
})

const route = useRoute()
const id = computed(() => String(route.params.id))
const note = useServiceNote(id)

// El papel inicial es el de Mi cuenta (carta si no se eligió otro, D-083).
const prefs = usePreferencesStore()
const format = ref<DocumentFormat>(prefs.serviceNoteFormat)
const FORMATS = options(DOCUMENT_FORMATS)
usePrintPage(
  () => DOCUMENT_FORMATS[format.value].page,
  () => (format.value === 'letter' ? '12mm' : '2mm'),
)
</script>

<template>
  <div>
    <PrintToolbar
      :format="format"
      :back="`/ordenes-trabajo/${id}`"
      back-label="Orden de trabajo"
      title="Nota de servicio"
      :formats="FORMATS"
      @update:format="(v) => (format = v as DocumentFormat)"
    />
    <div class="p-4 print:p-0">
      <QueryState :loading="note.isPending.value" :error="note.error.value" @retry="note.refetch()">
        <div
          v-if="note.data.value"
          class="mx-auto w-fit bg-white p-4 shadow print:p-0 print:shadow-none"
        >
          <ServiceNoteDocument :note="note.data.value" :format="format" />
        </div>
      </QueryState>
    </div>
  </div>
</template>
