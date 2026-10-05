import { describe, expect, it } from 'vitest'
import { ApiProblem } from '~/shared/api/problem'
import { toQuery } from '~/shared/api/client'
import { safeRedirect } from '~/shared/auth/redirect'
import { formatDateTime } from '~/shared/utils/dates'
import { splitFieldErrors } from '~/shared/utils/form-errors'
import { formatMoney, pesosToCents } from '~/shared/utils/money'
import { NAVIGATION, visibleNavigation } from '~/shared/navigation'

describe('dinero', () => {
  it('muestra centavos como pesos MXN', () => {
    expect(formatMoney({ amount: 129900, currency: 'MXN' })).toBe('$1,299.00')
    expect(formatMoney(null)).toBe('—')
  })
  it('convierte pesos a centavos sin errores de redondeo', () => {
    expect(pesosToCents(599.99)).toBe(59999)
    expect(pesosToCents(0.1 + 0.2)).toBe(30)
  })
})

describe('fechas', () => {
  it('tolera nulos y valores inválidos', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime('no-es-fecha')).toBe('—')
    expect(formatDateTime('2026-09-25T18:30:00.000Z')).toMatch(/2026/)
  })
})

describe('toQuery (API_SPEC §5.3)', () => {
  it('une listas con coma y quita vacíos', () => {
    expect(
      toQuery({
        status: ['PAID', 'SHIPPED'],
        q: '',
        page: 2,
        guest: false,
        x: undefined,
        y: null,
        z: [],
      }),
    ).toEqual({
      status: 'PAID,SHIPPED',
      page: '2',
      guest: 'false',
    })
  })
})

describe('safeRedirect', () => {
  it('acepta solo rutas internas', () => {
    expect(safeRedirect('/pedidos?page=2')).toBe('/pedidos?page=2')
    expect(safeRedirect('//evil.example')).toBe('/')
    expect(safeRedirect('/\\evil.example')).toBe('/')
    expect(safeRedirect('https://evil.example')).toBe('/')
    expect(safeRedirect(['/a'])).toBe('/')
  })
})

describe('splitFieldErrors', () => {
  it('separa errores de campos conocidos y el resto', () => {
    const problem = new ApiProblem({
      type: 'validation-error',
      status: 400,
      title: 'Solicitud inválida',
      errors: [
        { field: 'email', code: 'isEmail', message: 'Email inválido.' },
        { field: 'unknown', code: 'whitelistValidation', message: 'Campo no permitido.' },
      ],
    })
    expect(splitFieldErrors(problem, ['email', 'password'])).toEqual({
      fieldErrors: [{ name: 'email', message: 'Email inválido.' }],
      otherMessages: ['Campo no permitido.'],
    })
  })
})

describe('visibleNavigation', () => {
  it('muestra solo secciones permitidas y quita grupos vacíos', () => {
    const groups = visibleNavigation((p) => p === 'orders.read')
    const labels = groups.flatMap((g) => g.items.map((i) => i.label))
    expect(labels).toEqual(['Inicio', 'Pedidos', 'Pagos'])
    expect(groups.some((g) => g.label === 'Catálogo')).toBe(false)
  })
  it('cada sección protegida declara un permiso del catálogo de la API', () => {
    const items = NAVIGATION.flatMap((g) => g.items).filter((i) => i.to !== '/')
    expect(items.every((i) => typeof i.permission === 'string')).toBe(true)
  })
})
