<script setup lang="ts">
import type { ApiProblem } from '~/shared/api/problem'
import { useCaptureCount } from '../api'
import { countedSchema } from '../schemas'
import type { CountLine } from '../types'

/**
 * Lo contado de una línea (UC-INV-19): se guarda con Enter o al salir del campo, si cambió. Lo que
 * se escribe es el total de esa ubicación, no lo que se suma. No lleva `version`: varias personas
 * cuentan la misma hoja.
 */
const props = defineProps<{ countId: string; line: CountLine; disabled?: boolean }>()
const emit = defineEmits<{ saved: [line: CountLine]; failed: [problem: ApiProblem] }>()

const text = ref('')
const error = ref<string | null>(null)
watch(
  () => props.line.counted,
  (counted) => {
    text.value = counted === null ? '' : String(counted)
    error.value = null
  },
  { immediate: true },
)

const capture = useCaptureCount()

async function save() {
  const raw = text.value.trim()
  // Vacío no borra lo contado: la API no lo permite, y para eso está recontar.
  if (raw === '' || (props.line.counted !== null && raw === String(props.line.counted))) {
    text.value = props.line.counted === null ? '' : String(props.line.counted)
    error.value = null
    return
  }
  const parsed = countedSchema.safeParse(Number(raw))
  if (!/^\d+$/.test(raw) || !parsed.success) {
    error.value = parsed.success ? 'Escribe un número entero.' : parsed.error.issues[0]!.message
    return
  }
  error.value = null
  try {
    const line = await capture.mutateAsync({
      id: props.countId,
      variantId: props.line.variantId,
      counted: parsed.data,
    })
    emit('saved', line)
  } catch (e) {
    error.value = (e as ApiProblem).detail ?? 'No se pudo guardar.'
    emit('failed', e as ApiProblem)
  }
}
</script>

<template>
  <div class="w-28">
    <UInput
      v-model="text"
      inputmode="numeric"
      autocomplete="off"
      size="sm"
      :color="error ? 'error' : undefined"
      :highlight="!!error"
      :disabled="disabled"
      :loading="capture.isPending.value"
      :aria-label="`Contadas de ${line.sku}`"
      :aria-invalid="!!error"
      :data-variant="line.variantId"
      class="w-full"
      @keydown.enter.prevent="save"
      @blur="save"
    />
    <p v-if="error" class="mt-1 text-xs text-error">{{ error }}</p>
  </div>
</template>
