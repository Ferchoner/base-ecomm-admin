import { z } from 'zod'

/**
 * Lo que el frontend puede validar de ADR-0047 (ChangePasswordDto, PasswordResetConfirmDto):
 * de 15 a 64 caracteres. Que no sea común ni igual a la actual lo decide la API con
 * `password-policy-violation`, que también cuenta los caracteres tras normalizar a NFKC.
 */
export const newPasswordField = z
  .string()
  .min(15, 'Mínimo 15 caracteres.')
  .max(64, 'Máximo 64 caracteres.')

export const NEW_PASSWORD_HELP = 'De 15 a 64 caracteres. Una frase larga es buena opción.'

/** Para `.refine(passwordsMatch, PASSWORDS_MISMATCH)` en formularios con confirmación. */
export const passwordsMatch = (v: { newPassword: string; confirmPassword: string }) =>
  v.newPassword === v.confirmPassword

export const PASSWORDS_MISMATCH = {
  path: ['confirmPassword'],
  message: 'Las contraseñas no coinciden.',
}
