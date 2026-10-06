<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ApiProblem } from '~/shared/api/problem'
import { notifySuccess } from '~/shared/api/feedback'
import { ADDRESS_FIELDS, addressFields, toAddressInput } from '~/shared/address/address-form'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { useCreateWarehouse, useUpdateWarehouse } from '../api'
import { warehouseSchema } from '../schemas'
import type { WarehouseForm } from '../schemas'
import type { Warehouse } from '../types'

/**
 * Crear (CreateWarehouseDto) o editar (UpdateWarehouseDto) un almacén. El código solo se elige al
 * crear; la dirección usa el formato `AddressInput` (API_SPEC §13, ADR-0160).
 */
const props = defineProps<{ warehouse: Warehouse | null }>()
const open = defineModel<boolean>('open', { required: true })

function initial(w: Warehouse | null): WarehouseForm {
  const a = w?.address
  return {
    creating: !w,
    code: w?.code ?? '',
    name: w?.name ?? '',
    priority: w?.priority ?? 100,
    hasAddress: !!a,
    address: addressFields(a ?? null),
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

const form = useTemplateRef('form')
const create = useCreateWarehouse()
const update = useUpdateWarehouse()
const saving = computed(() => create.isPending.value || update.isPending.value)
const toast = useToast()

async function onSubmit(event: FormSubmitEvent<WarehouseForm>) {
  problem.value = null
  otherMessages.value = []
  const d = event.data
  const address = d.hasAddress ? toAddressInput(d.address) : null
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

        <AddressFields v-if="state.hasAddress" :address="state.address" />
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
