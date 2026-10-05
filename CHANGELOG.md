# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico. Contrato de la API: `Ferchoner/base-shop` commit `a46829b`.

## [Unreleased]

Sin versión publicada todavía: el MVP corre solo en local (G-07). La primera versión será `0.1.0` cuando se cumpla RELEASE_CHECKLIST.md.

### Agregado

- **Base (F0, PR #1):** Nuxt 4 SPA con TypeScript estricto, Nuxt UI 4, TanStack Query, Pinia y Zod; tipos generados del OpenAPI; cliente API con Bearer, renovación ante 401, Problem Details e `Idempotency-Key`; sesión con token en memoria y renovación de una en una entre pestañas; guard de sesión, contraseña forzada y permisos; layout responsive; CI.
- **Acceso y cuenta (F1, PR #2):** Mi cuenta, recuperar y restablecer contraseña con la política de la API.
- **Catálogo (F2, PR #3 y #4):** productos con variantes e imágenes y su ciclo de vida, categorías en árbol, marcas; filtros en la URL; conflicto de versión.
- **Precios e inventario (F3, PR #5 y #6):** precios vigentes, programados e historial; importación CSV con revisión previa; existencias, entradas, ajustes, movimientos por cursor y almacén; umbral de stock bajo por usuario.
- **Pedidos, pagos y envíos (F4, PR #7):** listados y detalles; pago en tienda, cancelación con reembolso, reintegro de stock, surtido, reembolso manual; guía y transiciones de envío.
- **Clientes, staff y roles (F5, PR #8):** suspender, reactivar y anonimizar clientes e invitados; alta de staff con contraseña temporal; roles con permisos propios.
- **Operación (F6, PR #9):** Inicio con conteos por permiso, método de envío, entregas de eventos con reintentos, auditoría con cursor.
- **QA y PWA (PR #10):** PWA online-first instalable con aviso de versión nueva y franja sin conexión; pruebas de accesibilidad (axe, WCAG 2.1 A/AA) en todas las pantallas; pruebas de PWA; estrategia de pruebas, matriz de casos y reporte de QA.
- **Documentación y release:** documentación del frontend sincronizada con el código, onboarding, despliegue, checklist de release, revisión técnica final, preparación del release y handover.

### Corregido

- Una mutación sin conexión quedaba en pausa y se enviaba sola al reconectar (QA-01).
- Contraste insuficiente en el tema claro y en placeholders del oscuro (QA-02).
- Región con scroll sin acceso por teclado en el detalle de una entrega (QA-03).
- Los toasts de error del servidor ahora muestran la referencia de soporte (`correlationId`).

### Eliminado

- Indicador "Próximamente" de la navegación, que ya no aplicaba con todas las secciones construidas.
