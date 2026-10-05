import { describe, expect, it } from 'vitest'
import { guestAnonymizationSchema } from '~/features/customers/schemas'
import { canRunCustomer, customerName } from '~/features/customers/status'
import { roleSchema, staffSchema } from '~/features/staff/schemas'
import { canGrantRole, permissionGroup } from '~/features/staff/status'
import type { Permission } from '~/features/staff/types'

describe('clientes', () => {
  it('transiciones documentadas; un anonimizado ya no cambia (ADR-0076)', () => {
    expect(canRunCustomer('suspend', 'ACTIVE')).toBe(true)
    expect(canRunCustomer('suspend', 'SUSPENDED')).toBe(false)
    expect(canRunCustomer('reactivate', 'SUSPENDED')).toBe(true)
    expect(canRunCustomer('reactivate', 'ANONYMIZED')).toBe(false)
    expect(canRunCustomer('anonymize', 'ANONYMIZED')).toBe(false)
  })

  it('nombre visible aun sin datos personales', () => {
    expect(customerName({ firstNames: 'María', lastNames: 'López' })).toBe('María López')
    expect(customerName({ firstNames: null, lastNames: null })).toBe('Sin nombre')
  })

  it('anonimizar invitado: email, código, motivo hasta 250 y confirmación', () => {
    const base = {
      contactEmail: 'a@example.com',
      publicCode: 'K7M4-Q9XA',
      reason: 'ARCO-1',
      acknowledged: true,
    }
    expect(guestAnonymizationSchema.safeParse(base).success).toBe(true)
    expect(guestAnonymizationSchema.safeParse({ ...base, acknowledged: false }).success).toBe(false)
    expect(guestAnonymizationSchema.safeParse({ ...base, reason: 'x'.repeat(251) }).success).toBe(
      false,
    )
    expect(guestAnonymizationSchema.safeParse({ ...base, contactEmail: 'no' }).success).toBe(false)
  })
})

describe('staff y roles', () => {
  const can = (owned: string[]) => (p: Permission) => owned.includes(p)

  it('nadie da lo que no tiene (BR-USR-20)', () => {
    const catalog = { isSuperadmin: false, permissions: ['catalog.read'] as Permission[] }
    const superadmin = { isSuperadmin: true, permissions: [] as Permission[] }
    expect(canGrantRole(catalog, can(['catalog.read']), false)).toBe(true)
    expect(canGrantRole(catalog, can([]), false)).toBe(false)
    expect(canGrantRole(superadmin, can(['catalog.read']), false)).toBe(false)
    expect(canGrantRole(superadmin, can([]), true)).toBe(true)
  })

  it('alta de staff: de 1 a 50 roles y nombres de hasta 100', () => {
    const base = { email: 'a@example.com', firstNames: 'Ana', lastNames: 'Pérez', roleIds: ['r1'] }
    expect(staffSchema.safeParse(base).success).toBe(true)
    expect(staffSchema.safeParse({ ...base, roleIds: [] }).success).toBe(false)
    expect(staffSchema.safeParse({ ...base, firstNames: ' ' }).success).toBe(false)
    expect(staffSchema.safeParse({ ...base, roleIds: Array(51).fill('r') }).success).toBe(false)
  })

  it('rol: nombre de 1 a 50 y descripción hasta 250', () => {
    expect(roleSchema.safeParse({ name: 'Ventas', description: '', permissions: [] }).success).toBe(
      true,
    )
    expect(
      roleSchema.safeParse({ name: 'x'.repeat(51), description: '', permissions: [] }).success,
    ).toBe(false)
  })

  it('agrupa los permisos por prefijo', () => {
    expect(permissionGroup('orders.read-blocked')).toBe('Pedidos')
    expect(permissionGroup('nuevo.permiso')).toBe('nuevo')
  })
})
