<script setup lang="ts">
import { useOrder, useStoreProfile } from '~/features/orders/api'
import OrderTicket from '~/features/orders/components/OrderTicket.vue'
import { usePreferencesStore } from '~/shared/preferences/preferences.store'
import { DOCUMENT_FORMATS, options, usePrintPage } from '~/shared/print/formats'
import type { DocumentFormat } from '~/shared/print/formats'

definePageMeta({ layout: 'print', title: 'Imprimir ticket', permission: 'orders.read' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const order = useOrder(id)
const profile = useStoreProfile()

// El papel inicial es el de Mi cuenta (58 mm si no se eligió otro, D-083).
const prefs = usePreferencesStore()
const format = ref<DocumentFormat>(prefs.ticketFormat)
const FORMATS = options(DOCUMENT_FORMATS)
usePrintPage(
  () => DOCUMENT_FORMATS[format.value].page,
  () => (format.value === 'letter' ? '12mm' : '2mm'),
)

const error = computed(() => order.error.value ?? profile.error.value)
</script>

<template>
  <div>
    <PrintToolbar
      :format="format"
      :back="`/pedidos/${id}`"
      back-label="Pedido"
      title="Ticket"
      :formats="FORMATS"
      @update:format="(v) => (format = v as DocumentFormat)"
    />
    <div class="p-4 print:p-0">
      <QueryState
        :loading="order.isPending.value || profile.isPending.value"
        :error="error"
        @retry="(order.refetch(), profile.refetch())"
      >
        <div
          v-if="order.data.value && profile.data.value"
          class="mx-auto w-fit bg-white p-4 shadow print:p-0 print:shadow-none"
        >
          <OrderTicket :order="order.data.value" :profile="profile.data.value" :format="format" />
        </div>
      </QueryState>
    </div>
  </div>
</template>
