<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import type { ApiProblem } from '~/shared/api/problem'
import { BACKGROUND_NOTICE } from '~/shared/api/query-roots'
import { useConfirm } from '~/shared/ui/use-confirm'
import { useShipmentTransition } from '../api'
import { shipmentNoteSchema } from '../schemas'
import type { ShipmentNoteForm } from '../schemas'
import { canRunShipment } from '../status'
import type { AdminShipment } from '../types'

/** Transiciones del envío (API_SPEC §17, ADR-0141). */
const props = defineProps<{ shipment: AdminShipment }>()

const transition = useShipmentTransition(() => props.shipment.id)
const confirm = useConfirm()
const toast = useToast()
const status = computed(() => props.shipment.status)

// Despachar: por paquetería exige guía capturada; entrega propia exige que no la haya (BR-SHP-04).
const showDispatch = ref(false)
const ownDelivery = ref<'carrier' | 'own'>('carrier')
const hasTracking = computed(() => !!props.shipment.carrierName && !!props.shipment.trackingNumber)
const dispatchProblem = ref<ApiProblem | null>(null)
watch(showDispatch, (open) => {
  if (!open) return
  ownDelivery.value = hasTracking.value ? 'carrier' : 'own'
  dispatchProblem.value = null
})
const DELIVERY_OPTIONS = computed(() => [
  {
    value: 'carrier',
    label: 'Por paquetería',
    description: hasTracking.value
      ? `${props.shipment.carrierName} · ${props.shipment.trackingNumber}`
      : 'Primero captura la paquetería y la guía.',
    disabled: !hasTracking.value,
  },
  {
    value: 'own',
    label: 'Entrega propia',
    description: hasTracking.value
      ? 'Quita antes la paquetería y la guía.'
      : 'La entrega la hace la tienda, sin guía.',
    disabled: hasTracking.value,
  },
])

async function dispatch() {
  dispatchProblem.value = null
  try {
    await transition.mutateAsync({
      action: 'dispatch',
      ownDelivery: ownDelivery.value === 'own',
      version: props.shipment.version,
    })
    notifySuccess(toast, 'Envío despachado', BACKGROUND_NOTICE)
    showDispatch.value = false
  } catch (e) {
    const p = e as ApiProblem
    if (p.type === 'version-conflict') {
      notifyProblem(toast, p)
      showDispatch.value = false
    } else dispatchProblem.value = p
  }
}

async function deliver() {
  const ok = await confirm({
    title: '¿Marcar como entregado?',
    description: 'Es definitivo: el envío ya no se puede cambiar.',
    confirmLabel: 'Marcar entregado',
  })
  if (!ok) return
  try {
    await transition.mutateAsync({ action: 'deliver', version: props.shipment.version })
    notifySuccess(toast, 'Envío entregado', BACKGROUND_NOTICE)
  } catch (e) {
    notifyProblem(toast, e)
  }
}

// Entrega fallida y devolución comparten el modal de nota opcional.
const noteAction = ref<'delivery-failure' | 'return' | null>(null)
const showNote = computed({
  get: () => noteAction.value !== null,
  set: (v) => {
    if (!v) noteAction.value = null
  },
})
const noteState = reactive<ShipmentNoteForm>({ note: '' })
const noteProblem = ref<ApiProblem | null>(null)
function openNote(action: 'delivery-failure' | 'return') {
  noteState.note = ''
  noteProblem.value = null
  noteAction.value = action
}
const NOTE_COPY = {
  'delivery-failure': {
    title: 'Registrar entrega fallida',
    help: 'Opcional. Por ejemplo, "Nadie recibió".',
    submit: 'Registrar entrega fallida',
    done: 'Entrega fallida registrada',
    detail: 'El pedido sigue como Enviado.',
  },
  return: {
    title: 'Marcar como devuelto',
    help: 'Opcional. Es definitivo.',
    submit: 'Marcar devuelto',
    done: 'Envío devuelto',
    detail: 'Reintegra el stock desde el pedido.',
  },
} as const

async function submitNote(event: FormSubmitEvent<ShipmentNoteForm>) {
  const action = noteAction.value
  if (!action) return
  noteProblem.value = null
  try {
    await transition.mutateAsync({
      action,
      note: event.data.note || null,
      version: props.shipment.version,
    })
    notifySuccess(toast, NOTE_COPY[action].done, NOTE_COPY[action].detail)
    noteAction.value = null
  } catch (e) {
    const p = e as ApiProblem
    if (p.type === 'version-conflict') {
      notifyProblem(toast, p)
      noteAction.value = null
    } else noteProblem.value = p
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <UButton
      v-if="canRunShipment('dispatch', status)"
      icon="i-lucide-truck"
      @click="showDispatch = true"
      >Despachar</UButton
    >
    <UButton
      v-if="canRunShipment('deliver', status)"
      icon="i-lucide-package-check"
      :loading="transition.isPending.value && !noteAction"
      @click="deliver"
      >Marcar entregado</UButton
    >
    <UButton
      v-if="canRunShipment('deliveryFailure', status)"
      icon="i-lucide-package-x"
      color="warning"
      variant="outline"
      @click="openNote('delivery-failure')"
      >Entrega fallida</UButton
    >
    <UButton
      v-if="canRunShipment('return', status)"
      icon="i-lucide-undo-2"
      color="neutral"
      variant="outline"
      @click="openNote('return')"
      >Marcar devuelto</UButton
    >

    <UModal
      v-model:open="showDispatch"
      title="Despachar envío"
      :description="`Pedido ${shipment.orderCode}`"
    >
      <template #body>
        <div class="space-y-4">
          <ProblemAlert v-if="dispatchProblem" :problem="dispatchProblem" />
          <URadioGroup v-model="ownDelivery" :items="DELIVERY_OPTIONS" legend="¿Cómo se entrega?" />
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="showDispatch = false">Cancelar</UButton>
          <UButton :loading="transition.isPending.value" @click="dispatch">Despachar</UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="showNote"
      :title="noteAction ? NOTE_COPY[noteAction].title : ''"
      :description="`Pedido ${shipment.orderCode}`"
    >
      <template #body>
        <UForm
          id="shipment-note-form"
          :schema="shipmentNoteSchema"
          :state="noteState"
          :validate-on="['input', 'change']"
          class="space-y-4"
          @submit="submitNote"
        >
          <ProblemAlert v-if="noteProblem" :problem="noteProblem" />
          <UFormField label="Nota" name="note" :help="noteAction ? NOTE_COPY[noteAction].help : ''">
            <UTextarea v-model="noteState.note" :maxlength="500" autoresize class="w-full" />
          </UFormField>
        </UForm>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="showNote = false">Cancelar</UButton>
          <UButton type="submit" form="shipment-note-form" :loading="transition.isPending.value">
            {{ noteAction ? NOTE_COPY[noteAction].submit : '' }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
