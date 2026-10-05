<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import type { ApiProblem } from '~/shared/api/problem'
import { useConfirm } from '~/shared/ui/use-confirm'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { useUpdateTracking } from '../api'
import { trackingSchema } from '../schemas'
import type { TrackingForm } from '../schemas'
import { canEditTracking } from '../status'
import type { AdminShipment } from '../types'

/** Paquetería y guía del envío (API_SPEC §17, ADR-0141). */
const props = defineProps<{ shipment: AdminShipment; canWrite: boolean }>()

const editable = computed(() => props.canWrite && canEditTracking(props.shipment))
const state = reactive<TrackingForm>({ carrierName: '', trackingNumber: '' })
const editing = ref(false)
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const update = useUpdateTracking(() => props.shipment.id)
const confirm = useConfirm()
const toast = useToast()

function startEdit() {
  state.carrierName = props.shipment.carrierName ?? ''
  state.trackingNumber = props.shipment.trackingNumber ?? ''
  problem.value = null
  editing.value = true
}

async function onSubmit(event: FormSubmitEvent<TrackingForm>) {
  problem.value = null
  try {
    await update.mutateAsync({ ...event.data, version: props.shipment.version })
    notifySuccess(toast, 'Guía guardada')
    editing.value = false
  } catch (e) {
    const p = e as ApiProblem
    if (p.type === 'version-conflict') {
      notifyProblem(toast, p)
      editing.value = false
      return
    }
    const { fieldErrors, otherMessages } = problemFieldErrors(p, ['carrierName', 'trackingNumber'])
    form.value?.setErrors(fieldErrors)
    if (fieldErrors.length === 0 || otherMessages.length > 0) problem.value = p
  }
}

async function removeTracking() {
  const ok = await confirm({
    title: '¿Quitar la paquetería y la guía?',
    description: 'Podrás capturarlas de nuevo o despacharlo como entrega propia.',
    confirmLabel: 'Quitar',
    color: 'warning',
  })
  if (!ok) return
  try {
    await update.mutateAsync({
      carrierName: null,
      trackingNumber: null,
      version: props.shipment.version,
    })
    notifySuccess(toast, 'Guía quitada')
  } catch (e) {
    notifyProblem(toast, e)
  }
}
</script>

<template>
  <div class="space-y-3">
    <UForm
      v-if="editing"
      ref="form"
      :schema="trackingSchema"
      :state="state"
      :validate-on="['input', 'change']"
      class="space-y-3"
      @submit="onSubmit"
    >
      <ProblemAlert v-if="problem" :problem="problem" />
      <UFormField label="Paquetería" name="carrierName" required>
        <UInput v-model="state.carrierName" :maxlength="100" class="w-full" />
      </UFormField>
      <UFormField label="Número de guía" name="trackingNumber" required>
        <UInput v-model="state.trackingNumber" :maxlength="100" class="w-full" />
      </UFormField>
      <div class="flex gap-2">
        <UButton type="submit" :loading="update.isPending.value">Guardar guía</UButton>
        <UButton color="neutral" variant="ghost" @click="editing = false">Cancelar</UButton>
      </div>
    </UForm>
    <template v-else>
      <p v-if="shipment.ownDelivery" class="text-sm">Entrega propia, sin paquetería.</p>
      <DetailList
        v-else
        :items="[
          { label: 'Paquetería', value: shipment.carrierName },
          { label: 'Guía', value: shipment.trackingNumber },
        ]"
      />
      <div v-if="editable" class="flex flex-wrap gap-2">
        <UButton
          size="sm"
          color="neutral"
          variant="outline"
          icon="i-lucide-pencil"
          @click="startEdit"
        >
          {{ shipment.trackingNumber ? 'Cambiar guía' : 'Capturar guía' }}
        </UButton>
        <UButton
          v-if="shipment.status === 'PENDING' && shipment.trackingNumber"
          size="sm"
          color="neutral"
          variant="ghost"
          icon="i-lucide-eraser"
          :loading="update.isPending.value"
          @click="removeTracking"
          >Quitar guía</UButton
        >
      </div>
    </template>
  </div>
</template>
