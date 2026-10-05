# DESIGN_SYSTEM

**Última actualización:** 2026-10-05. No hay un diseño visual aparte (Figma u otro): el sistema de diseño es **Nuxt UI 4** con la configuración y los componentes compartidos de este repo. Este documento describe lo que existe en el código.

## Base

| Aspecto     | Decisión                                                                                                                                                                              | Dónde                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Librería    | Nuxt UI 4 sobre Tailwind CSS 4 (D-P05)                                                                                                                                                | `nuxt.config.ts`                            |
| Colores     | `primary: indigo`, `neutral: slate`; semánticos de Nuxt UI (`success`, `info`, `warning`, `error`, `secondary`)                                                                       | `app/app.config.ts`                         |
| Contraste   | Tema claro con tonos más oscuros para cumplir AA (primario 600; info y error 700; éxito y advertencia 800; texto atenuado 500 y apagado 600). Tema oscuro: texto atenuado 400 (D-059) | `app/assets/css/main.css`                   |
| Tema oscuro | Sigue la preferencia del sistema operativo (color mode de Nuxt UI); sin selector en la interfaz                                                                                       | —                                           |
| Tipografía  | Fuente del sistema (`ui.fonts: false`): sin descargar fuentes                                                                                                                         | `nuxt.config.ts`                            |
| Iconos      | Lucide (`i-lucide-*`), incluidos en el bundle; sin proveedor remoto (D-020)                                                                                                           | `nuxt.config.ts` (`icon`)                   |
| Marca       | Glifo "store" de Lucide sobre índigo `#4f46e5` (sidebar, favicon, iconos PWA)                                                                                                         | `public/`, `scripts/generate-pwa-icons.mjs` |
| Idioma      | Español de México en textos, `lang="es-MX"`; formatos con `Intl` (`es-MX`, MXN)                                                                                                       | `app/shared/utils/`                         |

## Formatos

| Dato   | Regla                                                                                                                | Función                                                            |
| ------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Dinero | La API usa centavos enteros; se muestra `$1,299.00`; se escribe en pesos como texto y se convierte sin coma flotante | `formatMoney`, `pesosTextToCents`, `centsToPesosText` (`money.ts`) |
| Fechas | ISO UTC de la API → fecha local `medium` y hora `short`                                                              | `formatDateTime`, `formatDate` (`dates.ts`)                        |
| Vacíos | `—` cuando el dato es `null`                                                                                         | formatos anteriores                                                |
| IDs    | Texto monoespaciado en detalles (`DetailList` con `mono`)                                                            | `DetailList.vue`                                                   |

## Componentes compartidos (`app/components`)

| Componente        | Uso                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `QueryState`      | Carga (skeleton), error con "Reintentar", vacío; el contenido va en el slot                        |
| `ProblemAlert`    | Error de la API: título, detalle, mensajes, espera de `Retry-After` y referencia (`correlationId`) |
| `StatusBadge`     | Badge de un estado con etiqueta y color; un valor desconocido se muestra tal cual en neutro        |
| `ListPagination`  | Paginación de listados por página                                                                  |
| `DateRangeFilter` | Rango de fechas `desde`–`hasta` para filtros                                                       |
| `DetailList`      | Lista de pares etiqueta–valor de un detalle                                                        |
| `ConfirmDialog`   | Confirmación genérica (con `useConfirm` en `app/shared/ui`)                                        |
| `ReasonDialog`    | Acción con motivo obligatorio y, si es irreversible, casilla de confirmación                       |
| `CountCard`       | Tarjeta de conteo del Inicio con enlace y nombre accesible "Etiqueta: N"                           |
| `PostalAddress`   | Dirección postal mexicana                                                                          |
| `PreferencesCard` | Preferencias del usuario (umbral de stock bajo)                                                    |
| `InventoryTabs`   | Navegación Existencias · Almacén                                                                   |
| `PwaStatus`       | Franja sin conexión y aviso de versión nueva                                                       |

Componentes de Nuxt UI más usados: `UDashboardGroup`/`UDashboardSidebar`, `UTable`, `UForm`/`UFormField`, `UInput`, `UInputNumber`, `USelect`, `USelectMenu`, `UModal`, `USlideover`, `UTabs`, `UBadge`, `UAlert`, `UEmpty`, `USkeleton`, `UButton`, `UDropdownMenu`, `useToast`.

## Colores de estado

Cada feature define sus estados en `status.ts` (o `app/shared/status/sales.ts` si los usan varias). Convención:

| Color       | Significado                      | Ejemplos                                   |
| ----------- | -------------------------------- | ------------------------------------------ |
| `success`   | Terminado bien, activo           | Entregado, Cobrado, Publicado, Activo      |
| `warning`   | Requiere acción pronto           | Por cobrar, Pendiente, Suspendido          |
| `error`     | Bloqueado o fallido              | Esperando surtido, Fallida                 |
| `info`      | En curso                         | Pagado, Autorizado                         |
| `primary`   | En tránsito                      | Enviado                                    |
| `secondary` | Revertido                        | Reembolsado                                |
| `neutral`   | Cerrado sin efecto o desconocido | Cancelado, Vencido, Archivado, valor nuevo |

## Reglas de interfaz

- Textos en español, en segunda persona ("Revisa tu conexión…"), sin jerga técnica; los mensajes de error de la API se muestran como llegan (`title`, `detail`, `errors[]`).
- Una acción solo aparece si el permiso y el estado la admiten; no se muestran botones deshabilitados sin explicación.
- Acciones destructivas o irreversibles: confirmación; las irreversibles piden marcar "Entiendo que no se puede deshacer".
- Formularios: validación con Zod antes de enviar y errores de la API en su campo (`problemFieldErrors`).
- Toda tabla tiene encabezados y cada botón con solo icono tiene `aria-label`.
- Responsive: mismo diseño en escritorio y móvil; el sidebar pasa a cajón; las tablas se desplazan en horizontal.
- Sin `v-html` (regla de lint `vue/no-v-html`).

## Pendiente

- Revisión con lector de pantalla real (QA_REPORT).
- Opciones deshabilitadas de `USelectMenu` sin `aria-disabled` (G-14), limitación de Nuxt UI 4.11.
