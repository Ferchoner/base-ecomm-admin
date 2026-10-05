import type { Permission } from '~/shared/api/types'

export interface NavSection {
  label: string
  icon: string
  to: string
  /** Permiso de lectura que habilita la sección (ARCHITECTURE_PROPOSAL §2). */
  permission?: Permission
}

export interface NavGroup {
  label?: string
  items: NavSection[]
}

/** Mapa de navegación (ROUTE_MAP.md). Cada sección se ve solo con su permiso de lectura. */
export const NAVIGATION: NavGroup[] = [
  { items: [{ label: 'Inicio', icon: 'i-lucide-house', to: '/' }] },
  {
    label: 'Catálogo',
    items: [
      {
        label: 'Productos',
        icon: 'i-lucide-package',
        to: '/catalogo/productos',
        permission: 'catalog.read',
      },
      {
        label: 'Categorías',
        icon: 'i-lucide-folder-tree',
        to: '/catalogo/categorias',
        permission: 'catalog.read',
      },
      {
        label: 'Marcas',
        icon: 'i-lucide-tag',
        to: '/catalogo/marcas',
        permission: 'catalog.read',
      },
      {
        label: 'Precios',
        icon: 'i-lucide-circle-dollar-sign',
        to: '/precios',
        permission: 'pricing.read',
      },
      {
        label: 'Inventario',
        icon: 'i-lucide-warehouse',
        to: '/inventario/stock',
        permission: 'inventory.read',
      },
    ],
  },
  {
    label: 'Ventas',
    items: [
      {
        label: 'Pedidos',
        icon: 'i-lucide-shopping-cart',
        to: '/pedidos',
        permission: 'orders.read',
      },
      {
        label: 'Pagos',
        icon: 'i-lucide-credit-card',
        to: '/pagos',
        permission: 'orders.read',
      },
      {
        label: 'Envíos',
        icon: 'i-lucide-truck',
        to: '/envios',
        permission: 'shipping.manage',
      },
      {
        label: 'Clientes',
        icon: 'i-lucide-users',
        to: '/clientes',
        permission: 'customers.read',
      },
    ],
  },
  {
    label: 'Administración',
    items: [
      {
        label: 'Staff',
        icon: 'i-lucide-user-cog',
        to: '/staff',
        permission: 'staff.manage',
      },
      {
        label: 'Roles',
        icon: 'i-lucide-shield',
        to: '/roles',
        permission: 'staff.manage',
      },
      {
        label: 'Método de envío',
        icon: 'i-lucide-settings',
        to: '/configuracion/envio',
        permission: 'shipping.manage',
      },
      {
        label: 'Auditoría',
        icon: 'i-lucide-scroll-text',
        to: '/auditoria',
        permission: 'audit.read',
      },
      {
        label: 'Eventos',
        icon: 'i-lucide-activity',
        to: '/operacion/eventos',
        permission: 'events.manage',
      },
    ],
  },
]

/** Secciones visibles para quien tiene `can`. Los grupos vacíos desaparecen. */
export function visibleNavigation(
  can: (permission: Permission) => boolean,
  groups = NAVIGATION,
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || can(item.permission)),
    }))
    .filter((group) => group.items.length > 0)
}
