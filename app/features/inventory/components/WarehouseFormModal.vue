<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ApiProblem } from '~/shared/api/problem'
import { notifySuccess } from '~/shared/api/feedback'
import { useGeoMunicipalities, useGeoStates } from '~/shared/api/geo'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { useCreateWarehouse, useUpdateWarehouse } from '../api'
import { warehouseSchema } from '../schemas'
import type { WarehouseForm } from '../schemas'
import type { AddressInput, Warehouse } from '../types'

/**
 * Crear (CreateWarehouseDto) o editar (UpdateWarehouseDto) un almacén. El código solo se elige al
 * crear; la dirección usa el formato `AddressInput` (API_SPEC §13, ADR-0160).
 */
const props = defineProps<{ warehouse: Warehouse | null }>()
const open = defineModel<boolean>('open', { required: true })

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

function initial(w: Warehouse | null): WarehouseForm {
  const a = w?.address
  return {
    creating: !w,
    code: w?.code ?? '',
    name: w?.name ?? '',
    priority: w?.priority ?? 100,
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

const problem = ref<ApiProblem | null>(null)
const otherMessages = ref<string[]>([])
const state = reactive<WarehouseForm>(initial(props.warehouse))
watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(state, initial(props.warehouse))
  problem.value = null
  otherMessages.value = []
})

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
const create = useCreateWarehouse()
const update = useUpdateWarehouse()
const saving = computed(() => create.isPending.value || update.isPending.value)
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
  const address = d.hasAddress ? toAddress(d.address) : null
  try {
    if (props.warehouse) {
      await update.mutateAsync({
        id: props.warehouse.id,
        input: { name: d.name, address, priority: d.priority },
      })
      notifySuccess(toast, 'Almacén actualizado')
    } else {
      await create.mutateAsync({ code: d.code, name: d.name, address, priority: d.priority })
      notifySuccess(toast, 'Almacén creado', `${d.code} ya puede recibir mercancía.`)
    }
    open.value = false
  } catch (e) {
    const p = e as ApiProblem
    // Los errores de la dirección llegan como `address.<campo>`, igual que los campos del formulario.
    const { fieldErrors, otherMessages: rest } = problemFieldErrors(p, [
      'code',
      'name',
      'priority',
      ...ADDRESS_FIELDS.map((f) => `address.${f}`),
    ])
    form.value?.setErrors(fieldErrors)
    otherMessages.value = rest
    if (fieldErrors.length === 0 || rest.length > 0) problem.value = p
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="warehouse ? `Editar almacén ${warehouse.code}` : 'Nuevo almacén'"
    :ui="{ content: 'sm:max-w-3xl' }"
  >
    <template #body>
      <UForm
        id="warehouse-form"
        ref="form"
        :schema="warehouseSchema"
        :state="state"
        :validate-on="['input', 'change']"
        class="space-y-4"
        @submit="onSubmit"
      >
        <ProblemAlert v-if="problem" :problem="problem" :messages="otherMessages" />
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            v-if="!warehouse"
            label="Código"
            name="code"
            required
            help="De 2 a 20 mayúsculas, dígitos o guiones. No se puede cambiar."
          >
            <UInput
              :model-value="state.code"
              :maxlength="20"
              class="w-full"
              @update:model-value="(v) => (state.code = String(v).toUpperCase())"
            />
          </UFormField>
          <UFormField label="Nombre" name="name" required>
            <UInput v-model="state.name" :maxlength="100" class="w-full" />
          </UFormField>
          <UFormField
            label="Prioridad"
            name="priority"
            required
            help="De 1 a 1000; 1 es la primera. Cada pedido se aparta completo en el primer almacén activo que lo tiene todo."
          >
            <UInputNumber v-model="state.priority" :min="1" :max="1000" class="w-full" />
          </UFormField>
        </div>

        <USwitch v-model="state.hasAddress" label="Tiene dirección" />

        <fieldset v-if="state.hasAddress" class="grid gap-4 sm:grid-cols-2">
          <legend class="sr-only">Dirección</legend>
          <UFormField label="Contacto" name="address.recipientName" required>
            <UInput v-model="state.address.recipientName" class="w-full" />
          </UFormField>
          <UFormField label="Teléfono" name="address.phone" required help="10 dígitos.">
            <UInput
              v-model="state.address.phone"
              inputmode="numeric"
              maxlength="10"
              class="w-full"
            />
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
              :disabled="!state.address.stateCode"
              placeholder="Elige el municipio"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Ciudad" name="address.city">
            <UInput v-model="state.address.city" class="w-full" />
          </UFormField>
          <UFormField label="Referencias" name="address.references" class="sm:col-span-2">
            <UTextarea
              v-model="state.address.references"
              :maxlength="250"
              autoresize
              class="w-full"
            />
          </UFormField>
        </fieldset>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">Cancelar</UButton>
        <UButton type="submit" form="warehouse-form" :loading="saving">
          {{ warehouse ? 'Guardar' : 'Crear almacén' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
