import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { newPasswordField, PASSWORDS_MISMATCH, passwordsMatch } from '~/shared/auth/password-policy'

describe('política de contraseña (ADR-0047, parte validable en el cliente)', () => {
  it('acepta de 15 a 64 caracteres', () => {
    expect(newPasswordField.safeParse('a'.repeat(14)).success).toBe(false)
    expect(newPasswordField.safeParse('a'.repeat(15)).success).toBe(true)
    expect(newPasswordField.safeParse('a'.repeat(64)).success).toBe(true)
    expect(newPasswordField.safeParse('a'.repeat(65)).success).toBe(false)
  })

  it('marca la confirmación cuando no coincide', () => {
    const schema = z
      .object({ newPassword: newPasswordField, confirmPassword: z.string() })
      .refine(passwordsMatch, PASSWORDS_MISMATCH)
    const result = schema.safeParse({
      newPassword: 'una frase larga y segura',
      confirmPassword: 'otra',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['confirmPassword'])
  })
})
