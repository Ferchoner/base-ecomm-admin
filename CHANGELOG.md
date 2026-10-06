# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico. Contrato de la API: `Ferchoner/base-shop` commit `ff10406`.

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
- **Prueba contra la API real:** recorrido completo del checklist de release con `base-shop` en local, registrado en el reporte de QA.
- **Documentación y release:** documentación del frontend sincronizada con el código, onboarding, despliegue, checklist de release, revisión técnica final, preparación del release y handover.

- **Contrato base-shop `ff10406` (API 1.1, 1.2 y 1.3):** pedidos con canal, tipo de entrega, quién los colocó y almacén; filtros por canal y "Mis ventas en tienda".

- **Varios almacenes (API 1.1):** pantalla Almacenes para crear, editar la prioridad y desactivar; existencias, entradas y ajustes por almacén; transferencia entre almacenes; almacén de regreso en el reintegro; filtro y columna de almacén en Envíos.

### Corregido

- El detalle de un pedido de entrega en tienda fallaba porque no tiene dirección ni plazo de entrega; ahora lo explica, también cuando el comprador no dio sus datos.

- Una mutación sin conexión quedaba en pausa y se enviaba sola al reconectar (QA-01).
- Contraste insuficiente en el tema claro y en placeholders del oscuro (QA-02).
- Región con scroll sin acceso por teclado en el detalle de una entrega (QA-03).
- Los toasts de error del servidor ahora muestran la referencia de soporte (`correlationId`).
- El formulario de un producto ya no borra los cambios sin guardar cuando el producto se vuelve a consultar; avisa y ofrece descartarlos (QA-09).
- Con un token de acceso de 60 segundos o menos, cada pestaña ya no renueva cada 5 segundos (QA-10).
- Doble punto en el aviso de precio programado (QA-11).

### Eliminado

- Indicador "Próximamente" de la navegación, que ya no aplicaba con todas las secciones construidas.
