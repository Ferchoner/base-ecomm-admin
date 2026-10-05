<script setup lang="ts">
/**
 * Estado de la PWA (docs/PWA_STRATEGY.md): aviso de versión nueva y aviso sin conexión. Es
 * online-first: sin conexión no se guarda nada; las consultas se reanudan solas al reconectar.
 */
const { $pwa } = useNuxtApp()
const toast = useToast()

const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
const setOnline = () => (online.value = true)
const setOffline = () => (online.value = false)
onMounted(() => {
  window.addEventListener('online', setOnline)
  window.addEventListener('offline', setOffline)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', setOnline)
  window.removeEventListener('offline', setOffline)
})

// La versión nueva se aplica solo cuando el usuario lo pide: recargar perdería lo que esté editando.
watch(
  () => $pwa?.needRefresh,
  (needRefresh) => {
    if (!needRefresh) return
    toast.add({
      id: 'pwa-update',
      title: 'Hay una versión nueva del backoffice',
      description: 'Guarda lo que estés editando y actualiza para usarla.',
      icon: 'i-lucide-download',
      color: 'info',
      duration: 0,
      actions: [{ label: 'Actualizar', onClick: () => $pwa?.updateServiceWorker(true) }],
    })
  },
  { immediate: true },
)
</script>

<template>
  <div
    v-if="!online"
    role="status"
    class="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-2 bg-warning px-4 py-2 text-center text-sm font-medium text-inverted"
  >
    <UIcon name="i-lucide-wifi-off" class="size-4 shrink-0" />
    <span
      >Sin conexión. Lo que ves puede estar desactualizado y no se guardan cambios hasta que vuelva
      la conexión.</span
    >
  </div>
</template>
