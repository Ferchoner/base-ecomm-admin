<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ApiProblem } from '~/shared/api/problem'
import { notifySuccess } from '~/shared/api/feedback'
import { useGeoMunicipalities, useGeoStates } from '~/shared/api/geo'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { useUpdateWarehouse } from '../api'
import { warehouseSchema } from '../schemas'
import type { WarehouseForm } from '../schemas'
import type { AddressInput, Warehouse } from '../types'

/** Nombre y dirección del almacén (UpdateWarehouseDto). La dirección usa el formato `AddressInput`. */
const props = defineProps<{ warehouse: Warehouse; disabled?: boolean }>()

const ADDRESS_FIELDS = [
  'recipientName',
  'phone',
  'street',
  'exteriorNumber',
  'interiorNumber',
  'neighborhood',
  'postalCode',
  'stateCode',
  'municipalityCode',
  'city',
  'references',
] as const

function initial(w: Warehouse): WarehouseForm {
  const a = w.address
  return {
    name: w.name,
    hasAddress: !!a,
    address: {
      recipientName: a?.recipientName ?? '',
      phone: a?.phone ?? '',
      street: a?.street ?? '',
      exteriorNumber: a?.exteriorNumber ?? '',
      interiorNumber: a?.interiorNumber ?? '',
      neighborhood: a?.neighborhood ?? '',
      postalCode: a?.postalCode ?? '',
      stateCode: a?.stateCode ?? '',
      municipalityCode: a?.municipalityCode ?? '',
      city: a?.city ?? '',
      references: a?.references ?? '',
    },
  }
}

const state = reactive<WarehouseForm>(initial(props.warehouse))
watch(
  () => props.warehouse,
  (w) => Object.assign(state, initial(w)),
)

const { data: states } = useGeoStates()
const { data: municipalities, isFetching: loadingMunicipalities } = useGeoMunicipalities(
  () => state.address.stateCode,
)
const stateOptions = computed(() =>
  (states.value ?? []).map((s) => ({ value: s.code, label: s.name })),
)
const municipalityOptions = computed(() =>
  (municipalities.value ?? []).map((m) => ({ value: m.code, label: m.name })),
)
watch(
  () => state.address.stateCode,
  (code, previous) => {
    if (previous !== undefined && code !== previous) state.address.municipalityCode = ''
  },
)

const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const otherMessages = ref<string[]>([])
const update = useUpdateWarehouse()
const toast = useToast()

function toAddress(a: WarehouseForm['address']): AddressInput {
  return {
    recipientName: a.recipientName,
    phone: a.phone,
    street: a.street,
    exteriorNumber: a.exteriorNumber,
    interiorNumber: a.interiorNumber || null,
    neighborhood: a.neighborhood,
    postalCode: a.postalCode,
    stateCode: a.stateCode,
    municipalityCode: a.municipalityCode,
    city: a.city || null,
    references: a.references || null,
  }
}

async function onSubmit(event: FormSubmitEvent<WarehouseForm>) {
  problem.value = null
  otherMessages.value = []
  const d = event.data
  try {
    await update.mutateAsync({
      id: props.warehouse.id,
      input: { name: d.name, address: d.hasAddress ? toAddress(d.address) : null },
    })
    notifySuccess(toast, 'Almacén actualizado')
  } catch (e) {
    const p = e as ApiProblem
    // Los errores de la dirección llegan como `address.<campo>`, igual que los campos del formulario.
    const { fieldErrors, otherMessages: rest } = problemFieldErrors(p, [
      'name',
      ...ADDRESS_FIELDS.map((f) => `address.${f}`),
    ])
    form.value?.setErrors(fieldErrors)
    otherMessages.value = rest
    if (fieldErrors.length === 0 || rest.length > 0) problem.value = p
  }
}
</script>

<template>
  <UForm
    ref="form"
    :schema="warehouseSchema"
    :state="state"
    :disabled="disabled"
    class="max-w-3xl space-y-4"
    @submit="onSubmit"
  >
    <ProblemAlert v-if="problem" :problem="problem" :messages="otherMessages" />
    <UFormField label="Nombre" name="name" required>
      <UInput v-model="state.name" :maxlength="100" class="w-full" />
    </UFormField>

    <USwitch v-model="state.hasAddress" label="Tiene dirección" />

    <fieldset v-if="state.hasAddress" class="grid gap-4 sm:grid-cols-2">
      <legend class="sr-only">Dirección</legend>
      <UFormField label="Contacto" name="address.recipientName" required>
        <UInput v-model="state.address.recipientName" class="w-full" />
      </UFormField>
      <UFormField label="Teléfono" name="address.phone" required help="10 dígitos.">
        <UInput v-model="state.address.phone" inputmode="numeric" maxlength="10" class="w-full" />
      </UFormField>
      <UFormField label="Calle" name="address.street" required class="sm:col-span-2">
        <UInput v-model="state.address.street" class="w-full" />
      </UFormField>
      <UFormField label="Número exterior" name="address.exteriorNumber" required>
        <UInput v-model="state.address.exteriorNumber" class="w-full" />
      </UFormField>
      <UFormField label="Número interior" name="address.interiorNumber">
        <UInput v-model="state.address.interiorNumber" class="w-full" />
      </UFormField>
      <UFormField label="Colonia" name="address.neighborhood" required>
        <UInput v-model="state.address.neighborhood" class="w-full" />
      </UFormField>
      <UFormField label="Código postal" name="address.postalCode" required>
        <UInput
          v-model="state.address.postalCode"
          inputmode="numeric"
          maxlength="5"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Estado" name="address.stateCode" required>
        <USelectMenu
          v-model="state.address.stateCode"
          :items="stateOptions"
          value-key="value"
          label-key="label"
          placeholder="Elige el estado"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Municipio" name="address.municipalityCode" required>
        <USelectMenu
          v-model="state.address.municipalityCode"
          :items="municipalityOptions"
          value-key="value"
          label-key="label"
          :loading="loadingMunicipalities"
          :disabled="disabled || !state.address.stateCode"
          placeholder="Elige el municipio"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Ciudad" name="address.city">
        <UInput v-model="state.address.city" class="w-full" />
      </UFormField>
      <UFormField label="Referencias" name="address.references" class="sm:col-span-2">
        <UTextarea v-model="state.address.references" :maxlength="250" autoresize class="w-full" />
      </UFormField>
    </fieldset>

    <UButton v-if="!disabled" type="submit" :loading="update.isPending.value">Guardar</UButton>
  </UForm>
</template>
