<script setup lang="ts">
/**
 * Contraseña temporal que la API muestra una sola vez (API_SPEC §9.17, ADR-0071). Vive solo en este
 * modal: al cerrarlo se pierde y hay que reactivar para generar otra.
 */
const props = defineProps<{ email: string; password: string | null }>()
const emit = defineEmits<{ close: [] }>()

const open = computed({
  get: () => props.password !== null,
  set: (v) => {
    if (!v) emit('close')
  },
})
const copied = ref(false)
const toast = useToast()

async function copy() {
  if (!props.password) return
  try {
    await navigator.clipboard.writeText(props.password)
    copied.value = true
  } catch {
    toast.add({
      title: 'No se pudo copiar',
      description: 'Selecciona y copia la contraseña.',
      color: 'warning',
    })
  }
}
watch(open, () => (copied.value = false))
</script>

<template>
  <UModal v-model:open="open" title="Contraseña temporal" :dismissible="false">
    <template #body>
      <div class="space-y-4">
        <UAlert
          color="warning"
          variant="subtle"
          icon="i-lucide-key-round"
          title="Se muestra solo esta vez"
          description="Entrégala por un canal seguro. Al entrar, la persona debe cambiarla."
        />
        <p class="text-sm">Cuenta: {{ email }}</p>
        <div class="flex items-center gap-2">
          <code
            class="flex-1 rounded-md bg-elevated px-3 py-2 font-mono text-base select-all"
            aria-label="Contraseña temporal"
            >{{ password }}</code
          >
          <UButton
            :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            color="neutral"
            variant="outline"
            @click="copy"
            >{{ copied ? 'Copiada' : 'Copiar' }}</UButton
          >
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end">
        <UButton @click="open = false">Ya la guardé</UButton>
      </div>
    </template>
  </UModal>
</template>
