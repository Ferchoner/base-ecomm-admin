# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico. Contrato de la API: `Ferchoner/base-shop` commit `7af0f1d` (v1.7.0).

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

- **Contrato base-shop `7af0f1d` (API 1.4 a 1.7):** descuento por línea y promoción en pedidos y en la venta en tienda; almacén de salida y notas del cobro y del reembolso; productos solo en tienda (servicios) con su filtro; GTIN en variantes; la venta en tienda abre como venta de mostrador.

- **Cargas masivas (API 1.5):** cargar productos nuevos con sus variantes y entradas de mercancía desde CSV, con revisión previa, errores por línea y columna y plantillas para descargar; la carga de precios suma su plantilla.

- **Promociones y cupones (API 1.7):** listado con filtros, alta, edición según su estado y terminar; destinos por producto, categoría o marca; en la venta en tienda se aplica un cupón y se explica por qué no aplica.

- **Lector de códigos de barras:** en productos el SKU o GTIN exacto abre la variante; en la venta en tienda se escanea sin dar clic, suma unidades y explica lo que no se vende o no tiene existencias; el código del ticket abre el pedido; las entradas de mercancía eligen la variante escaneando; tono opcional en Mi cuenta.

- **Impresión:** ticket del pedido en térmica de 58 mm (por defecto), 80 mm o carta, con el código del pedido en Code 128; etiquetas sin precio con código EAN, UPC, ITF-14 o Code 128 en 50 × 25 mm, compactas de 25 × 15 mm con Data Matrix o QR, y hoja carta de 30; papel inicial de cada documento en Mi cuenta.

- **Varios almacenes (API 1.1):** pantalla Almacenes para crear, editar la prioridad y desactivar; existencias, entradas y ajustes por almacén; transferencia entre almacenes; almacén de regreso en el reintegro; filtro y columna de almacén en Envíos.

- **Pago en tienda (API 1.2 y 1.3, G-02):** pantalla para habilitar o deshabilitar el pago manual (solo superadministrador); "Registrar pago" avisa si está deshabilitado y pide cómo se cobró; el método se ve en el pedido y en el pago; el editor de roles no ofrece permisos exclusivos del superadministrador.

- **Vender en tienda (API 1.2):** pantalla para colocar un pedido a nombre de un cliente presente, con cotización en el almacén elegido, cliente registrado, invitado o venta de mostrador sin datos, y dirección guardada o nueva; "Entregar en tienda" en el pedido pagado; botón "Nuevo pedido" en Pedidos.

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
