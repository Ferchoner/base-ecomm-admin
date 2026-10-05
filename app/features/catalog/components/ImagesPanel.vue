<script setup lang="ts">
import type { ApiProblem } from '~/shared/api/problem'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import { useConfirm } from '~/shared/ui/use-confirm'
import { useDeleteImage, useReorderImages, useUploadImage } from '../api'
import type { Product, ProductImage } from '../types'
import ImageEditModal from './ImageEditModal.vue'

const props = defineProps<{ product: Product; canWrite: boolean }>()

/** Límite documentado (API_SPEC §11.8); la API responde 409 `image-limit-reached` si se supera. */
const IMAGE_LIMIT = 20
const ACCEPT = 'image/jpeg,image/png,image/webp'

const editable = computed(() => props.canWrite && props.product.status !== 'ARCHIVED')
const images = computed(() => [...props.product.images].sort((a, b) => a.position - b.position))
const full = computed(() => images.value.length >= IMAGE_LIMIT)
const variantSku = (id: string | null) => props.product.variants.find((v) => v.id === id)?.sku

const upload = useUploadImage(() => props.product.id)
const reorder = useReorderImages(() => props.product.id)
const remove = useDeleteImage(() => props.product.id)
const confirm = useConfirm()
const toast = useToast()
const fileInput = useTemplateRef('fileInput')
const uploadProblem = ref<ApiProblem | null>(null)

function uploadMessage(p: ApiProblem): string[] {
  if (p.type === 'payload-too-large' && typeof p.extensions.maxBytes === 'number')
    return [`El máximo es ${(p.extensions.maxBytes / 1024 / 1024).toFixed(0)} MB.`]
  if (p.type === 'unsupported-media-type') return ['Usa una imagen JPEG, PNG o WebP.']
  return []
}

// Una a una, en el orden elegido: cada imagen nueva va al final (API_SPEC §11.8).
async function onFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  uploadProblem.value = null
  let added = 0
  for (const file of files) {
    try {
      await upload.mutateAsync({ file })
      added++
    } catch (e) {
      uploadProblem.value = e as ApiProblem
      break
    }
  }
  if (added > 0)
    notifySuccess(toast, added === 1 ? 'Imagen agregada' : `${added} imágenes agregadas`)
}

async function move(image: ProductImage, delta: -1 | 1) {
  const ids = images.value.map((i) => i.id)
  const from = ids.indexOf(image.id)
  const to = from + delta
  if (to < 0 || to >= ids.length) return
  ids.splice(to, 0, ...ids.splice(from, 1))
  try {
    await reorder.mutateAsync(ids)
  } catch (e) {
    notifyProblem(toast, e)
  }
}

async function destroy(image: ProductImage) {
  const ok = await confirm({
    title: '¿Eliminar esta imagen?',
    description: 'Se borra el archivo; no se puede deshacer.',
    confirmLabel: 'Eliminar',
    color: 'error',
  })
  if (!ok) return
  try {
    await remove.mutateAsync(image.id)
    notifySuccess(toast, 'Imagen eliminada')
  } catch (e) {
    notifyProblem(toast, e)
  }
}

const editOpen = ref(false)
const editing = ref<ProductImage | null>(null)
function edit(image: ProductImage) {
  editing.value = image
  editOpen.value = true
}

const busy = computed(
  () => upload.isPending.value || reorder.isPending.value || remove.isPending.value,
)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm text-muted">
        {{ images.length }} de {{ IMAGE_LIMIT }} imágenes. La primera es la principal. JPEG, PNG o
        WebP.
      </p>
      <template v-if="editable">
        <input
          ref="fileInput"
          type="file"
          :accept="ACCEPT"
          multiple
          class="sr-only"
          aria-label="Elegir imágenes"
          @change="onFiles"
        />
        <UButton
          icon="i-lucide-upload"
          :loading="upload.isPending.value"
          :disabled="full || busy"
          @click="fileInput?.click()"
          >Subir imágenes</UButton
        >
      </template>
    </div>

    <ProblemAlert
      v-if="uploadProblem"
      :problem="uploadProblem"
      :messages="uploadMessage(uploadProblem)"
    />

    <UEmpty
      v-if="images.length === 0"
      icon="i-lucide-image"
      title="Sin imágenes"
      description="La tienda muestra un marcador mientras no tenga imágenes."
    />
    <ul
      v-else
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      aria-label="Imágenes del producto"
    >
      <li
        v-for="(image, index) in images"
        :key="image.id"
        class="overflow-hidden rounded-md border border-default bg-elevated/40"
      >
        <img
          :src="image.url"
          :alt="image.altText ?? `Imagen ${index + 1} de ${product.title}`"
          loading="lazy"
          class="aspect-square w-full object-contain"
        />
        <div class="space-y-1 p-2 text-xs">
          <div class="flex items-center gap-1">
            <UBadge v-if="index === 0" size="sm" variant="subtle">Principal</UBadge>
            <UBadge v-if="image.variantId" size="sm" color="neutral" variant="subtle">
              {{ variantSku(image.variantId) ?? 'Variante' }}
            </UBadge>
          </div>
          <p class="truncate text-muted" :title="image.altText ?? undefined">
            {{ image.altText ?? 'Sin texto alternativo' }}
          </p>
          <div v-if="editable" class="flex justify-between">
            <div class="flex">
              <UButton
                icon="i-lucide-arrow-left"
                size="xs"
                color="neutral"
                variant="ghost"
                :disabled="index === 0 || busy"
                :aria-label="`Mover la imagen ${index + 1} antes`"
                @click="move(image, -1)"
              />
              <UButton
                icon="i-lucide-arrow-right"
                size="xs"
                color="neutral"
                variant="ghost"
                :disabled="index === images.length - 1 || busy"
                :aria-label="`Mover la imagen ${index + 1} después`"
                @click="move(image, 1)"
              />
            </div>
            <div class="flex">
              <UButton
                icon="i-lucide-pencil"
                size="xs"
                color="neutral"
                variant="ghost"
                :aria-label="`Editar la imagen ${index + 1}`"
                @click="edit(image)"
              />
              <UButton
                icon="i-lucide-trash-2"
                size="xs"
                color="error"
                variant="ghost"
                :disabled="busy"
                :aria-label="`Eliminar la imagen ${index + 1}`"
                @click="destroy(image)"
              />
            </div>
          </div>
        </div>
      </li>
    </ul>

    <ImageEditModal v-model:open="editOpen" :product="product" :image="editing" />
  </div>
</template>
