import type { ApiProblem } from '~/shared/api/problem'

export interface FormFieldError {
  name: string
  message: string
}

/**
 * Reparte los `errors[]` de un 400 (API_SPEC §6.1) entre los campos del formulario.
 * Los que no corresponden a un campo conocido se devuelven aparte para mostrarlos en una alerta.
 * `fieldMap` traduce rutas de la API a nombres del formulario cuando difieren.
 */
export function splitFieldErrors(
  problem: ApiProblem,
  formFields: readonly string[],
  fieldMap: Record<string, string> = {},
): { fieldErrors: FormFieldError[]; otherMessages: string[] } {
  const fieldErrors: FormFieldError[] = []
  const otherMessages: string[] = []
  for (const error of problem.errors) {
    const name = fieldMap[error.field] ?? error.field
    if (formFields.includes(name)) fieldErrors.push({ name, message: error.message })
    else otherMessages.push(error.message)
  }
  return { fieldErrors, otherMessages }
}
