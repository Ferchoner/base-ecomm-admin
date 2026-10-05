<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ApiProblem } from '~/shared/api/problem'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { useSaveVariant } from '../api'
import { variantSchema } from '../schemas'
import type { VariantForm, VariantFormOutput } from '../schemas'
import type { Product, Variant } from '../types'

const props = defineProps<{ product: Product; variant?: Variant | null }>()
const open = defineModel<boolean>('open', { required: true })

const FIELDS = ['sku', 'options', 'weightGrams', 'lengthCm', 'widthCm', 'heightCm'] as const
const MAX_OPTIONS = 3

const state = reactive<VariantForm>({
  sku: '',
  options: [],
  weightGrams: '',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
})
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const otherMessages = ref<string[]>([])
const save = useSaveVariant(() => props.product.id)
const toast = useToast()

/** Nombres de opción que ya usan las demás variantes: todas deben tener los mismos (API_SPEC §11.7). */
const siblingOptionNames = computed(() => {
  const other = props.product.variants.find((v) => v.id !== props.variant?.id)
  return other ? Object.keys(other.options) : null
})
// SKU y opciones son fijos tras la primera publicación (`editableIdentity`, ADR-0068).
const identityLocked = computed(() =>
  props.variant ? !props.variant.editableIdentity : !!props.product.firstPublishedAt,
)
// Con otras variantes, los nombres vienen dados; la única variante sin publicar puede cambiarlos.
const namesLocked = computed(() => identityLocked.value || siblingOptionNames.value !== null)

watch(open, (isOpen) => {
  if (!isOpen) return
  const v = props.variant
  state.sku = v?.sku ?? ''
  state.options = v
    ? Object.entries(v.options).map(([name, value]) => ({ name, value }))
    : (siblingOptionNames.value ?? []).map((name) => ({ name, value: '' }))
  state.weightGrams = v?.weightGrams?.toString() ?? ''
  state.lengthCm = v?.lengthCm?.toString() ?? ''
  state.widthCm = v?.widthCm?.toString() ?? ''
  state.heightCm = v?.heightCm?.toString() ?? ''
  problem.value = null
  otherMessages.value = []
  save.reset()
})

function addOption() {
  if (state.options.length < MAX_OPTIONS) state.options.push({ name: '', value: '' })
}

function toRecord(options: VariantFormOutput['options']) {
  return Object.fromEntries(options.map((o) => [o.name.toLowerCase(), o.value]))
}

function sameOptions(a: Record<string, string>, b: Record<string, string>) {
  const ka = Object.keys(a)
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k])
}

async function onSubmit(event: FormSubmitEvent<VariantFormOutput>) {
  problem.value = null
  otherMessages.value = []
  const d = event.data
  const options = toRecord(d.options)
  const v = props.variant
  const measures = {
    weightGrams: d.weightGrams,
    lengthCm: d.lengthCm,
    widthCm: d.widthCm,
    heightCm: d.heightCm,
  }
  const input = v
    ? {
        ...(!identityLocked.value && d.sku.toUpperCase() !== v.sku && { sku: d.sku }),
        ...(!identityLocked.value && !sameOptions(options, v.options) && { options }),
        ...Object.fromEntries(
          Object.entries(measures).filter(([k, value]) => value !== v[k as keyof typeof measures]),
        ),
        version: props.product.version,
      }
    : { sku: d.sku, options, ...measures, version: props.product.version }
  try {
    await save.mutateAsync({ variantId: v?.id, input })
    notifySuccess(toast, v ? 'Variante actualizada' : 'Variante agregada')
    open.value = false
  } catch (error) {
    const p = error as ApiProblem
    if (p.type === 'version-conflict') {
      notifyProblem(toast, p)
      open.value = false
      return
    }
    const { fieldErrors, otherMessages: rest } = problemFieldErrors(p, FIELDS)
    form.value?.setErrors(fieldErrors)
    otherMessages.value = rest
    if (fieldErrors.length === 0 || rest.length > 0) problem.value = p
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="variant ? `Editar variante ${variant.sku}` : 'Nueva variante'"
  >
    <template #body>
      <UForm
        id="variant-form"
        ref="form"
        :schema="variantSchema"
        :state="state"
        :validate-on="['input', 'change']"
        class="space-y-4"
        @submit="onSubmit"
      >
        <ProblemAlert v-if="problem" :problem="problem" :messages="otherMessages" />
        <UAlert
          v-if="identityLocked"
          color="info"
          variant="subtle"
          icon="i-lucide-lock"
          :title="variant ? 'SKU y opciones fijos' : 'Opciones fijas'"
          description="El producto ya se publicó una vez: solo se pueden cambiar el peso y las medidas."
        />

        <UFormField
          label="SKU"
          name="sku"
          required
          help="Se guarda en mayúsculas. Único y nunca reutilizado."
        >
          <UInput
            v-model="state.sku"
            class="w-full"
            :disabled="!!variant && identityLocked"
            autofocus
          />
        </UFormField>

        <fieldset class="space-y-2">
          <legend class="text-sm font-medium">Opciones</legend>
          <p class="text-xs text-muted">
            Hasta 3, como talla o color. Todas las variantes del producto usan los mismos nombres.
          </p>
          <div v-for="(option, i) in state.options" :key="i" class="flex items-start gap-2">
            <UFormField :name="`options.${i}.name`" class="flex-1">
              <UInput
                v-model="option.name"
                placeholder="Nombre (ej. talla)"
                :aria-label="`Nombre de la opción ${i + 1}`"
                :disabled="namesLocked"
                class="w-full"
              />
            </UFormField>
            <UFormField :name="`options.${i}.value`" class="flex-1">
              <UInput
                v-model="option.value"
                placeholder="Valor (ej. M)"
                :aria-label="`Valor de la opción ${i + 1}`"
                :disabled="!!variant && identityLocked"
                class="w-full"
              />
            </UFormField>
            <UButton
              v-if="!namesLocked"
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              :aria-label="`Quitar la opción ${i + 1}`"
              @click="state.options.splice(i, 1)"
            />
          </div>
          <UFormField name="options">
            <UButton
              v-if="!namesLocked && state.options.length < 3"
              icon="i-lucide-plus"
              color="neutral"
              variant="outline"
              size="sm"
              @click="addOption"
              >Agregar opción</UButton
            >
          </UFormField>
        </fieldset>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <UFormField label="Peso (g)" name="weightGrams">
            <UInput
              v-model="state.weightGrams"
              type="number"
              min="1"
              step="1"
              inputmode="numeric"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Largo (cm)" name="lengthCm">
            <UInput
              v-model="state.lengthCm"
              type="number"
              min="0.1"
              step="0.1"
              inputmode="decimal"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Ancho (cm)" name="widthCm">
            <UInput
              v-model="state.widthCm"
              type="number"
              min="0.1"
              step="0.1"
              inputmode="decimal"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Alto (cm)" name="heightCm">
            <UInput
              v-model="state.heightCm"
              type="number"
              min="0.1"
              step="0.1"
              inputmode="decimal"
              class="w-full"
            />
          </UFormField>
        </div>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">Cancelar</UButton>
        <UButton type="submit" form="variant-form" :loading="save.isPending.value">Guardar</UButton>
      </div>
    </template>
  </UModal>
</template>
