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

/**
 * Errores por campo de cualquier problema que los traiga: `errors[]` de un 400, `field` de un 409
 * `duplicate-value` y `fields` de un 409 `field-locked` (API_SPEC §6.2). El resto va aparte.
 */
export function problemFieldErrors(
  problem: ApiProblem,
  formFields: readonly string[],
  fieldMap: Record<string, string> = {},
): { fieldErrors: FormFieldError[]; otherMessages: string[] } {
  if (problem.type === 'validation-error') return splitFieldErrors(problem, formFields, fieldMap)
  const fieldErrors: FormFieldError[] = []
  const map = (f: string) => fieldMap[f] ?? f
  if (problem.type === 'duplicate-value' && typeof problem.extensions.field === 'string') {
    const name = map(problem.extensions.field)
    if (formFields.includes(name))
      fieldErrors.push({ name, message: 'Ya existe; escribe otro valor.' })
  }
  if (problem.type === 'field-locked' && Array.isArray(problem.extensions.fields)) {
    for (const f of problem.extensions.fields) {
      const name = map(String(f))
      if (formFields.includes(name))
        fieldErrors.push({ name, message: 'Ya no se puede cambiar: el producto se publicó.' })
    }
  }
  return { fieldErrors, otherMessages: [] }
}
