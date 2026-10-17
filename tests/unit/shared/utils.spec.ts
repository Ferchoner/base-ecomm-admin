import { describe, expect, it } from 'vitest'
import { ApiProblem } from '~/shared/api/problem'
import { isScanCode, isSellable, notSellableReason } from '~/shared/api/variant-lookup'
import { createScanDetector } from '~/shared/scanner/scan-detector'
import { toQuery } from '~/shared/api/client'
import { safeRedirect } from '~/shared/auth/redirect'
import { formatDateTime } from '~/shared/utils/dates'
import { splitFieldErrors } from '~/shared/utils/form-errors'
import { gtin14, isValidGtin } from '~/shared/utils/gtin'
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

describe('GTIN', () => {
  it('acepta EAN-13, UPC-A, EAN-8 y GTIN-14 con su dígito verificador', () => {
    for (const code of ['7501055363063', '036000291452', '96385074', '00012345600012'])
      expect(isValidGtin(code)).toBe(true)
  })
  it('rechaza un dígito verificador incorrecto o una longitud no admitida', () => {
    expect(isValidGtin('7501055363064')).toBe(false)
    expect(isValidGtin('12345678901')).toBe(false)
    expect(isValidGtin('ABC12345')).toBe(false)
  })
  it('completa a 14 dígitos como la API', () => {
    expect(gtin14('96385074')).toBe('00000096385074')
  })
})

describe('lector de códigos (PLAN_API_1.7 §3.1)', () => {
  const typeAt = (detector: ReturnType<typeof createScanDetector>, text: string, gap: number) => {
    let t = 1000
    let closed = false
    for (const k of [...text, 'Enter']) closed = detector.key(k, (t += gap))
    return closed
  }

  it('toma como escaneo una ráfaga rápida terminada en Enter', () => {
    const scans: string[] = []
    const d = createScanDetector((c) => scans.push(c))
    expect(typeAt(d, '7501055363063', 5)).toBe(true)
    expect(scans).toEqual(['7501055363063'])
  })

  it('ignora lo que escribe una persona y los códigos muy cortos', () => {
    const scans: string[] = []
    const d = createScanDetector((c) => scans.push(c))
    expect(typeAt(d, 'CAM-M', 120)).toBe(false)
    expect(typeAt(d, 'abc', 5)).toBe(false)
    expect(scans).toEqual([])
  })

  it('una pausa reinicia el código', () => {
    const scans: string[] = []
    const d = createScanDetector((c) => scans.push(c))
    d.key('X', 0)
    for (const [i, k] of [...'CAM-M', 'Enter'].entries()) d.key(k, 500 + i * 5)
    expect(scans).toEqual(['CAM-M'])
  })

  it('valida el formato del contrato y explica por qué no se vende', () => {
    expect(isScanCode(' CAM-LIN.AZ_M ')).toBe(true)
    expect(isScanCode('camisa de lino')).toBe(false)
    expect(isScanCode('x'.repeat(65))).toBe(false)
    const v = {
      id: 'v',
      sku: 'CAM-M',
      gtin: null,
      options: {},
      status: 'ACTIVE' as const,
      matchedBy: 'SKU' as const,
      product: { id: 'p', title: 'Camisa', slug: 'camisa', status: 'PUBLISHED' as const },
    }
    expect(isSellable(v)).toBe(true)
    expect(isSellable({ ...v, status: 'DISCONTINUED' })).toBe(false)
    expect(notSellableReason({ ...v, product: { ...v.product, status: 'DRAFT' } })).toBe(
      'Camisa está en borrador: no se vende.',
    )
    expect(notSellableReason({ ...v, status: 'DISCONTINUED' })).toBe(
      'La variante CAM-M está descontinuada: no se vende.',
    )
  })
})
