import { ApiProblem, toApiProblem } from './problem'

type Toast = ReturnType<typeof useToast>

/**
 * Mensaje de error de una mutación. Un 409 `version-conflict` (API_SPEC §2.3) pide recargar:
 * nunca se reenvía con una versión más nueva sin que el usuario vea los cambios.
 */
export function notifyProblem(toast: Toast, error: unknown, onConflict?: () => void) {
  const problem = error instanceof ApiProblem ? error : toApiProblem(error)
  if (problem.type === 'version-conflict') {
    toast.add({
      title: 'Otro usuario modificó este registro',
      description: 'Se recargaron los datos actuales. Revisa los cambios y vuelve a intentarlo.',
      color: 'warning',
      icon: 'i-lucide-git-compare',
    })
    onConflict?.()
    return
  }
  const fieldMessages = problem.errors.map((e) => e.message)
  // Un error del servidor lleva la referencia para soporte, como ProblemAlert.
  const reference =
    problem.status >= 500 && problem.correlationId ? `Referencia: ${problem.correlationId}` : null
  toast.add({
    title: problem.title,
    description:
      [problem.detail, ...fieldMessages, reference].filter(Boolean).join(' ') || undefined,
    color: 'error',
    icon: 'i-lucide-circle-alert',
  })
}

export function notifySuccess(toast: Toast, title: string, description?: string) {
  toast.add({ title, description, color: 'success', icon: 'i-lucide-circle-check' })
}
