<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import type { ApiProblem } from '~/shared/api/problem'
import { useSessionStore } from '~/shared/auth/session.store'
import { useDebounced } from '~/shared/utils/debounce'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { useCustomerSearch, useReceiveWorkOrder, useUpdateWorkOrder, useWarehouses } from '../api'
import { initialWorkOrderForm, toReceiveInput, toUpdateInput, workOrderSchema } from '../schemas'
import type { WorkOrderForm } from '../schemas'
import type { CustomerOption, WorkOrder } from '../types'
import TechnicianField from './TechnicianField.vue'

/**
 * Recibir un equipo (sin `workOrder`, API_SPEC §25.2) o corregir sus datos y registrar el
 * diagnóstico (§25.5). Al recibir se envía con `Idempotency-Key`: un doble envío no crea dos folios.
 */
const props = defineProps<{ workOrder?: WorkOrder; readonly?: boolean }>()
const emit = defineEmits<{ saved: [workOrder: WorkOrder] }>()

const FIELDS = [
  'warehouseId',
  'customerId',
  'customerName',
  'customerPhone',
  'customerEmail',
  'equipmentType',
  'equipmentBrand',
  'equipmentModel',
  'serialNumber',
  'accessories',
  'equipmentCondition',
  'reportedFault',
  'diagnosis',
  'workPerformed',
  'estimatedCost',
  'technicianId',
] as const

const session = useSessionStore()
const canSearchCustomers = computed(() => session.can('customers.read'))
const editing = computed(() => !!props.workOrder)

const base = shallowRef(props.workOrder)
const state = reactive<WorkOrderForm>(initialWorkOrderForm(base.value))
function load(w?: WorkOrder) {
  base.value = w
  Object.assign(state, initialWorkOrderForm(w))
  picked.value = null
}
// Una versión nueva (otro usuario, un cambio de estado) se carga si no hay cambios sin guardar.
watch(
  () => props.workOrder,
  (w) => {
    if (JSON.stringify(state) === JSON.stringify(initialWorkOrderForm(base.value))) load(w)
  },
)

// ── Almacén (solo al recibir; no cambia después) ──
const warehouses = useWarehouses(() => !editing.value)
const warehouseOptions = computed(() =>
  (warehouses.data.value ?? [])
    .filter((w) => w.status === 'ACTIVE')
    .map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })),
)
watch(
  warehouseOptions,
  (list) => {
    if (!editing.value && !state.warehouseId && list[0]) state.warehouseId = list[0].value
  },
  { immediate: true },
)

// ── Cliente registrado (opcional): el nombre y el teléfono son siempre los de la orden ──
const customerSearch = ref('')
const customers = useCustomerSearch(useDebounced(customerSearch))
const picked = ref<CustomerOption | null>(null)
function pickCustomer(c: CustomerOption) {
  picked.value = c
  state.customerId = c.id
  const name = [c.firstNames, c.lastNames].filter(Boolean).join(' ')
  if (!state.customerName.trim() && name) state.customerName = name
  if (!state.customerEmail.trim() && c.email) state.customerEmail = c.email
  customerSearch.value = ''
}
function unlinkCustomer() {
  picked.value = null
  state.customerId = ''
}

const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const otherMessages = ref<string[]>([])
const receive = useReceiveWorkOrder()
const update = useUpdateWorkOrder(() => props.workOrder?.id ?? '')
const saving = computed(() => receive.isPending.value || update.isPending.value)
const toast = useToast()

// Una llave por equipo recibido: si el usuario reintenta el mismo tras un error, no se duplica.
let idempotencyKey = crypto.randomUUID()
watch(state, () => (idempotencyKey = crypto.randomUUID()), { deep: true })

async function onSubmit(event: FormSubmitEvent<WorkOrderForm>) {
  problem.value = null
  otherMessages.value = []
  try {
    let saved: WorkOrder
    if (base.value) {
      const input = toUpdateInput(event.data, base.value)
      if (Object.keys(input).length === 1) {
        toast.add({ title: 'No hay cambios que guardar', color: 'neutral', icon: 'i-lucide-info' })
        return
      }
      saved = await update.mutateAsync(input)
      load(saved)
      notifySuccess(toast, 'Orden de trabajo actualizada')
    } else {
      saved = await receive.mutateAsync({ input: toReceiveInput(event.data), idempotencyKey })
      notifySuccess(toast, `Equipo recibido con el folio ${saved.folio}`)
    }
    emit('saved', saved)
  } catch (error) {
    const p = error as ApiProblem
    if (p.type === 'version-conflict') return notifyProblem(toast, p, () => load(props.workOrder))
    const { fieldErrors, otherMessages: rest } = problemFieldErrors(p, FIELDS)
    form.value?.setErrors(fieldErrors)
    otherMessages.value = rest
    if (p.type === 'invalid-state-transition')
      otherMessages.value.push('La orden ya se entregó o se canceló: sus datos ya no cambian.')
    if (p.status === 404)
      otherMessages.value.push(
        'El almacén, el cliente o el técnico ya no está activo. Elige otro y vuelve a intentarlo.',
      )
    if (fieldErrors.length === 0 || otherMessages.value.length > 0) problem.value = p
  }
}
</script>

<template>
  <UForm
    ref="form"
    :schema="workOrderSchema"
    :state="state"
    :disabled="readonly"
    class="max-w-3xl space-y-4"
    @submit="onSubmit"
  >
    <ProblemAlert v-if="problem" :problem="problem" :messages="otherMessages" />

    <UCard>
      <template #header><h3 class="font-semibold">Cliente</h3></template>
      <div class="grid gap-4 sm:grid-cols-2">
        <div v-if="canSearchCustomers || state.customerId" class="sm:col-span-2">
          <div
            v-if="state.customerId"
            class="flex flex-wrap items-center justify-between gap-2 text-sm"
          >
            <div>
              <div class="font-medium">
                <template v-if="picked">{{ picked.firstNames }} {{ picked.lastNames }}</template>
                <NuxtLink
                  v-else-if="canSearchCustomers"
                  :to="`/clientes/${state.customerId}`"
                  class="hover:underline"
                  >Cliente registrado</NuxtLink
                >
                <template v-else>Cliente registrado</template>
              </div>
              <div class="text-muted">
                {{ picked?.email ?? 'La orden queda ligada a su cuenta.' }}
              </div>
            </div>
            <UButton
              v-if="!readonly"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="unlinkCustomer"
              >Desligar</UButton
            >
          </div>
          <UFormField
            v-else-if="!readonly"
            label="Cliente registrado"
            name="customerId"
            help="Opcional. Busca por nombre o email; el teléfono se captura aquí porque la cuenta no lo guarda."
          >
            <UInput
              v-model="customerSearch"
              icon="i-lucide-search"
              placeholder="Nombre o email"
              class="w-full"
            />
            <ul
              v-if="customerSearch.trim().length >= 2 && customers.data.value"
              class="mt-2 divide-y divide-default rounded-md border border-default"
              aria-label="Clientes"
            >
              <li v-for="c in customers.data.value.data" :key="c.id">
                <button
                  type="button"
                  class="w-full p-2 text-left text-sm hover:bg-elevated"
                  @click="pickCustomer(c)"
                >
                  <span class="font-medium">{{ c.firstNames }} {{ c.lastNames }}</span>
                  <span class="text-muted"> · {{ c.email }}</span>
                </button>
              </li>
              <li v-if="customers.data.value.data.length === 0" class="p-2 text-sm text-muted">
                Sin coincidencias.
              </li>
            </ul>
          </UFormField>
        </div>
        <UFormField label="Nombre" name="customerName" required class="sm:col-span-2">
          <UInput
            v-model="state.customerName"
            :maxlength="120"
            autocomplete="off"
            class="w-full"
            :autofocus="!editing"
          />
        </UFormField>
        <UFormField label="Teléfono" name="customerPhone" required help="10 dígitos.">
          <UInput
            v-model="state.customerPhone"
            type="tel"
            inputmode="tel"
            autocomplete="off"
            :maxlength="20"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Email" name="customerEmail">
          <UInput
            v-model="state.customerEmail"
            type="email"
            autocomplete="off"
            :maxlength="254"
            class="w-full"
          />
        </UFormField>
      </div>
    </UCard>

    <UCard>
      <template #header><h3 class="font-semibold">Equipo</h3></template>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Tipo de equipo" name="equipmentType" required help="Laptop, celular…">
          <UInput v-model="state.equipmentType" :maxlength="60" class="w-full" />
        </UFormField>
        <UFormField label="Marca" name="equipmentBrand">
          <UInput v-model="state.equipmentBrand" :maxlength="60" class="w-full" />
        </UFormField>
        <UFormField label="Modelo" name="equipmentModel">
          <UInput v-model="state.equipmentModel" :maxlength="60" class="w-full" />
        </UFormField>
        <UFormField label="Número de serie" name="serialNumber">
          <UInput v-model="state.serialNumber" :maxlength="60" class="w-full" />
        </UFormField>
        <UFormField
          label="Accesorios que deja"
          name="accessories"
          class="sm:col-span-2"
          help="Cargador, funda…"
        >
          <UInput v-model="state.accessories" :maxlength="500" class="w-full" />
        </UFormField>
        <UFormField
          label="Estado en que llega"
          name="equipmentCondition"
          class="sm:col-span-2"
          help="Golpes, rayones o piezas faltantes."
        >
          <UTextarea
            v-model="state.equipmentCondition"
            :maxlength="1000"
            autoresize
            class="w-full"
          />
        </UFormField>
      </div>
    </UCard>

    <UCard>
      <template #header><h3 class="font-semibold">Servicio</h3></template>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField
          v-if="!editing"
          label="Almacén que lo recibe"
          name="warehouseId"
          required
          class="sm:col-span-2"
        >
          <USelect
            v-model="state.warehouseId"
            :items="warehouseOptions"
            :loading="warehouses.isPending.value"
            placeholder="Elige el almacén"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Falla que reporta" name="reportedFault" required class="sm:col-span-2">
          <UTextarea v-model="state.reportedFault" :maxlength="2000" autoresize class="w-full" />
        </UFormField>
        <template v-if="editing">
          <UFormField label="Diagnóstico" name="diagnosis" class="sm:col-span-2">
            <UTextarea v-model="state.diagnosis" :maxlength="4000" autoresize class="w-full" />
          </UFormField>
          <UFormField label="Trabajo realizado" name="workPerformed" class="sm:col-span-2">
            <UTextarea v-model="state.workPerformed" :maxlength="4000" autoresize class="w-full" />
          </UFormField>
        </template>
        <UFormField
          label="Costo estimado"
          name="estimatedCost"
          help="Informativo: se cobra con una venta."
        >
          <UInput v-model="state.estimatedCost" inputmode="decimal" class="w-full">
            <template #leading><span class="text-sm text-muted">$</span></template>
          </UInput>
        </UFormField>
        <UFormField label="Técnico" name="technicianId">
          <TechnicianField v-model="state.technicianId" :disabled="readonly" />
        </UFormField>
      </div>
    </UCard>

    <div v-if="!readonly" class="flex justify-end gap-2">
      <slot name="actions" />
      <UButton type="submit" :loading="saving" :icon="editing ? undefined : 'i-lucide-inbox'">{{
        editing ? 'Guardar cambios' : 'Recibir equipo'
      }}</UButton>
    </div>
  </UForm>
</template>
