# PLAN_API_1.7 · Actualizar el backoffice a base-shop 1.7.0, lector de códigos e impresión

Fecha: 2026-10-17. Estado: **APROBADO** por el usuario el 2026-10-17, con sus ajustes (venta de mostrador por defecto, ticket de 58 mm, vista carta, códigos compactos para productos pequeños y técnicos: lista para quien puede ver al staff, "Asignármela" para quien no) y las recomendaciones de §5 (seis PR, etiquetas y `bwip-js`, con la ampliación del stack aceptada). DECISIONS D-081 a D-085.

Contrato actual del backoffice: `base-shop@ff10406` (2026-10-06, 1.3 sin publicar).
Contrato nuevo: `base-shop@7af0f1d` (tag `v1.7.0`, 2026-10-17), que incluye 1.4.0, 1.5.0, 1.6.0 y 1.7.0. OpenAPI: 133 → 152 operaciones, 172 → 202 esquemas. **Sin operaciones eliminadas ni campos quitados**: todos los cambios son compatibles (versiones menores, ADR-0159).

Requerimientos nuevos del usuario (2026-10-17):

- **RQ-1** Lector de código de barras en la búsqueda de productos y en la venta en tienda.
- **RQ-2** Imprimir tickets, notas de servicio y etiquetas con código de barras para productos con SKU o GTIN. Ticket en térmica de 58 mm como principal y 80 mm como opción; ticket y nota de servicio también en vista carta; para productos pequeños, un código compacto (QR u otra opción mejor).
- **RQ-3** La venta en tienda abre con "Venta de mostrador (sin envío)" marcada por defecto, porque será la más usada.
- **RQ-4** Elegir técnico en las órdenes de trabajo: de una lista para quien puede ver al staff; para quien no, solo asignársela a sí mismo (ajuste del usuario, 2026-10-17).

## 1. Qué cambió en la API

### 1.1 Datos para el ticket, nota del pago y GTIN (v1.4.0, ADR-0163)

| Cambio                                                                                                                                                                                                                                                           | Contrato                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `gtin` opcional en variantes (alta y edición): EAN/UPC de 8, 12, 13 o 14 dígitos con dígito verificador (400 `matches` / `gtinCheckDigit`); único entre activas comparado a 14 dígitos (409 `duplicate-value`, `field: gtin`)                                    | §11.7; `AdminVariantDto.gtin`     |
| **Nuevo** `GET /v1/admin/catalog/variants/lookup?code=` → `{ data: [{ id, sku, gtin, options, status, matchedBy, product{ id, title, slug, status } }] }`. SKU exacto o GTIN; activas primero; lista vacía, nunca 404. "Para el lector de códigos del mostrador" | `catalog.read`, UC-CAT-15, §11.10 |
| `q` de `GET …/catalog/products` busca también por GTIN                                                                                                                                                                                                           | §11.6                             |
| **Nuevo** `GET /v1/admin/store-profile` → `StoreProfile { name, address, taxId, phone, ticketFooter }`. "El cliente arma e imprime el ticket con `AdminOrder` y estos datos; la API no genera PDF ni imágenes"                                                   | `orders.read`, UC-ORD-15, §15.8   |
| `AdminOrder.fulfilledFrom { id, code, name }` (solo detalle): almacén del que salieron los productos                                                                                                                                                             | §8.9                              |
| Nota del pago y del reembolso manual: `AdminPayment.attempts[].note`, `refunds[].note`, `AdminOrder.payment.note`                                                                                                                                                | §16                               |

### 1.2 Cargas masivas (v1.5.0, ADR-0164)

| Cambio                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Contrato                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| **Nuevo** `POST /v1/admin/catalog/product-imports` (multipart `file`, `?dryRun=true`): crea productos **nuevos** en `DRAFT` con sus variantes; una fila por variante; columnas `slug`, `title`, `sku` + opcionales (`brand`, `categories`, `gtin`, medidas, `storeOnly`, `option:<nombre>`). CSV ≤ 5,000 filas y 5 MB. Todo o nada; errores en `rows[<línea>].<columna>` (primeros 100). 413 `payload-too-large`. Respuesta `{ rows, products, variants, dryRun }` | `catalog.write`, UC-CAT-16, §11.11 |
| **Nuevo** `POST /v1/admin/inventory/receipt-imports` (multipart `file`, `?dryRun=true`): entradas de mercancía por `sku`, `warehouse` (código), `quantity`, `note`. ≤ 5,000 filas y 1 MB. El mismo archivo dos veces → 409 `duplicate-value` (`field: file`, `importedAt`). Respuesta `{ rows, units, dryRun }`                                                                                                                                                    | `inventory.write`, UC-INV-12, §13  |
| La carga de precios (ya implementada en el backoffice) ahora dice qué columna falta o sobra en el error `columns`                                                                                                                                                                                                                                                                                                                                                  | §12                                |
| Plantillas oficiales: `docs/templates/products.csv`, `prices.csv`, `stock.csv` y su guía                                                                                                                                                                                                                                                                                                                                                                           | repo base-shop                     |

### 1.3 Servicios solo en tienda y órdenes de trabajo (v1.6.0, ADR-0165 a 0167)

| Cambio                                                                                                                                                                                                                                                                                | Contrato                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `storeOnly` en el producto (alta, edición, `AdminProduct`, filtro `?storeOnly=`): se vende solo en la tienda física, como un servicio. `storeVisibility` suma `STORE_ONLY`. Su existencia se carga "con un número alto", como cualquier entrada                                       | §11.6, UC-CAT-17                     |
| **Módulo nuevo** `/v1/admin/work-orders`: recibir equipo (`Idempotency-Key`), listar/buscar, consultar con historial, corregir y diagnosticar (`version`), cambiar estado (`RECEIVED → DIAGNOSED → IN_REPAIR → READY → DELIVERED`, saltando pasos, nunca atrás; `CANCELLED` con nota) | `work-orders.read` / `.manage`, §25  |
| Ligar/desligar ventas de mostrador (`channel = STORE`) que cobran la orden de trabajo; `sales[]`, `paidTotal`, `unpaidTotal`. Error nuevo 409 `sale-not-linkable` (E-37)                                                                                                              | §25.7, §25.8                         |
| **`GET …/work-orders/{id}/service-note`** → `{ workOrder, store, terms }` para imprimir la nota con línea de firma (la firma no se guarda)                                                                                                                                            | `work-orders.read`, UC-WRK-06, §25.9 |
| Conservación: `blockedAt`, `anonymizedAt`; `POST …/blocked-data` (`work-orders.read-blocked`, con motivo) y `POST …/anonymize` (`customers.manage`). Anonimizar un cliente responde `anonymizedWorkOrderCount`; `active-orders-exist` también por órdenes de trabajo abiertas         | §25.10–25.12, §9.18                  |
| Permisos nuevos `work-orders.read`, `work-orders.manage` (Vendedor y Administrador), `work-orders.read-blocked` (Administrador)                                                                                                                                                       | §3.3                                 |

### 1.4 Promociones y cupones (v1.7.0, ADR-0168)

| Cambio                                                                                                                                                                                                                                                                                      | Contrato                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Módulo nuevo** `/v1/admin/promotions`: crear, listar (filtros `q`, `kind`, `status`, `channel`, `appliesTo`), consultar, editar (`version`; ya iniciada solo `name`, `endsAt`, `usageLimit`; terminada nada) y **terminar** (`POST …/end`). Estado calculado `SCHEDULED`/`ACTIVE`/`ENDED` | `promotions.read` (Admin y Vendedor) / `promotions.manage` (Admin), §26 |
| Porcentaje (1–100) o monto fijo; toda la compra o `targets` (productos, categorías, marcas); canales `ONLINE`/`STORE`; compra mínima; vigencia; `code` = cupón con `usageLimit`, `oncePerCustomer`, `uses`                                                                                  | §26.1, §26.2                                                            |
| Las cotizaciones y órdenes aplican la mejor promoción automática del canal; `promotion { id, name, code }` y `discountAmount` por línea en `CheckoutQuote`, `AdminOrder`; `discountTotal` deja de ser siempre 0                                                                             | §26.7                                                                   |
| `couponCode` opcional en `POST /v1/admin/orders/quote` y `POST /v1/admin/orders`; error nuevo 409 `coupon-not-applicable` (E-38) con `reason` (`unavailable`, `minimumNotMet`, `noEligibleLines`, `exhausted`, `alreadyUsed`, `buyerRequired`)                                              | §26.8                                                                   |

## 2. Qué del backoffice actual queda desactualizado

Nada se rompe al abrir: los campos nuevos son opcionales o adicionales. Lo que queda mal o incompleto:

| #   | Severidad | Dónde                                                                  | Problema                                                                                                                                                    |
| --- | --------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-1 | MEDIA     | `features/orders/components/OrderLines.vue`, `StoreOrderForm.vue`      | Las líneas muestran `lineTotal` sin `discountAmount`: con una promoción, la suma de líneas no cuadra con el total, y no se ve qué promoción se aplicó.      |
| R-2 | MEDIA     | `StoreOrderForm.vue`                                                   | No hay campo de cupón; un 409 `coupon-not-applicable` no tendría mensaje propio.                                                                            |
| R-3 | BAJA      | `features/catalog/status.ts`                                           | `storeVisibility = STORE_ONLY` se mostraría con el valor crudo.                                                                                             |
| R-4 | BAJA      | Detalle de cliente (anonimizar)                                        | El mensaje de `active-orders-exist` solo habla de pedidos; ahora también lo causan órdenes de trabajo abiertas, y no se muestra `anonymizedWorkOrderCount`. |
| R-5 | BAJA      | Editor de roles                                                        | Sin etiquetas para los 5 permisos nuevos (`work-orders.*`, `promotions.*`).                                                                                 |
| R-6 | BAJA      | Detalle de pedido y de pago                                            | No muestran `fulfilledFrom` ni las notas del pago y del reembolso.                                                                                          |
| R-7 | BAJA      | Documentación (`API_SOURCE_OF_TRUTH.md`, `GAPS.md`, `TRACEABILITY.md`) | Apuntan a `ff10406`.                                                                                                                                        |

## 3. Diseño de los requerimientos nuevos

### 3.1 RQ-1 · Lector de código de barras

**Cómo funciona un lector:** los lectores USB o Bluetooth comunes trabajan en modo teclado (HID): "escriben" el código muy rápido y terminan con Enter. No requieren drivers ni permisos del navegador, así que el backoffice no necesita ninguna API especial del navegador. ASSUMPTION: el lector está configurado con sufijo Enter, el ajuste de fábrica de casi todos.

**Pieza compartida** (`app/shared/scanner/`):

- `useScanInput()`: un campo "Escanear o escribir código" que al recibir Enter busca el código exacto. Recorta espacios, valida el formato del contrato (1–64 de `A-Z a-z 0-9 - _ .`) y no consulta si no lo cumple.
- `useScannerCapture()` (solo en la venta en tienda): detecta una ráfaga de teclas rápidas terminada en Enter aunque el foco no esté en el campo, para que escanear funcione sin dar clic primero. No se activa mientras se escribe en otro campo de texto.
- La consulta `GET /v1/admin/catalog/variants/lookup` vive en `app/shared/api/variant-lookup.ts` (como `geo.ts`), porque la usan Catálogo y Pedidos y una feature no importa a otra.
- Aviso sonoro corto opcional (Web Audio, sin dependencias) para "encontrado" y "no encontrado".

**En la búsqueda de productos** (`/catalogo/productos`, `catalog.read`):

- El buscador actual sigue igual (y ahora encuentra también por GTIN). Al pulsar Enter o escanear, se consulta el lookup: una sola coincidencia abre el producto con la variante resaltada; varias muestran la lista con `matchedBy` (SKU/GTIN) y el estado; ninguna, "No hay variantes con ese código".

**En la venta en tienda** (`/pedidos/nuevo`, `orders.place`). La pantalla abre con "Venta de mostrador" (`fulfillment = IN_STORE`) marcada (RQ-3) y el campo de escaneo con el foco, listo para el primer producto; "Envío" sigue disponible.

1. Escanear → lookup. Se toma la primera variante `ACTIVE` de un producto `PUBLISHED`; si hay varias activas (un SKU de dígitos que coincide con el GTIN de otra), se pide elegir.
2. Si ninguna es vendible, se explica por qué con los datos de la respuesta (descontinuada, producto en borrador o archivado), como pide el contrato.
3. Se consulta su disponible en el almacén elegido (`GET …/inventory/stock-items?variantId&warehouseId`, `inventory.read`, que el Vendedor tiene) y se agrega la línea; si ya estaba, suma 1 (tope 30). Recotiza como hoy.
4. El escaneo funciona igual con productos solo de tienda (servicios).

Fuera de alcance por defecto: escanear con la cámara del teléfono (ver D-4).

### 3.2 RQ-2 · Impresión

**Cómo se imprime:** la API no genera PDF ni imágenes (ADR-0163); el backoffice arma cada documento como una página HTML con estilos de impresión (`@media print`, `@page` con el tamaño del papel) y abre el diálogo del navegador (`window.print()`). Funciona con impresoras térmicas, de etiquetas y de hoja instaladas en el sistema operativo. ASSUMPTION/GAP: sin software adicional en la computadora, el navegador no puede mandar comandos ESC/POS (cortar papel, abrir cajón) ni imprimir sin el diálogo; eso queda fuera (G-25).

**Pieza compartida** (`app/shared/print/`): layout `print` sin menú; componente `PrintSheet` con presets de papel; componente `BarcodeSvg` que dibuja el código como SVG (sin `v-html`); preferencias de papel por usuario en el store de preferencias existente (como el umbral de stock bajo, G-06).

| Documento                         | Ruta                                                                                                               | Permiso            | Datos                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Formatos (el primero, por defecto)                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Ticket** de un pedido           | `/imprimir/ticket/[orderId]`; botón "Imprimir ticket" en el detalle del pedido y al colocar una venta de mostrador | `orders.read`      | `AdminOrder` + `store-profile`: nombre, dirección, RFC y teléfono de la tienda; código público y fecha; almacén (`fulfilledFrom`); líneas con SKU, opciones, cantidad, precio y descuento; promoción/cupón; subtotal, descuento, IVA incluido, envío, total; método y estado del pago ("Pendiente de pago" si no está pagado); `ticketFooter` ("no es comprobante fiscal"); código de barras Code 128 del código público, que se puede escanear en el buscador de pedidos | **Térmica 58 mm**, térmica 80 mm, carta                                            |
| **Nota de servicio**              | `/imprimir/nota-servicio/[workOrderId]`; botón al recibir el equipo y en el detalle                                | `work-orders.read` | `service-note`: folio con su código de barras, tienda, cliente, equipo, accesorios, estado, falla, diagnóstico, trabajo, costo estimado, ventas ligadas con pagado/pendiente, condiciones (`terms`, con saltos de línea) y **línea de firma del cliente**                                                                                                                                                                                                                 | **Carta**, térmica 58 mm, térmica 80 mm                                            |
| **Etiquetas** de código de barras | `/catalogo/etiquetas` (cola de impresión) e "Imprimir etiquetas" en cada variante y en el producto                 | `catalog.read`     | `AdminProduct.variants[]`: título, opciones, SKU y el código                                                                                                                                                                                                                                                                                                                                                                                                              | **Térmica 50 × 25 mm**, compacta 25 × 15 mm (código 2D), hoja carta de 30 (3 × 10) |

**Formatos de papel:**

- Un mismo documento tiene una plantilla por ancho, no una sola que se encoge. En 58 mm (unos 48 mm imprimibles, ~32 caracteres por línea) las líneas del ticket van en dos renglones: título y opciones arriba; cantidad × precio, descuento e importe abajo. En carta, el ticket y la nota usan una tabla con encabezado de tienda y caben en media hoja o una hoja.
- El formato se elige en el botón de imprimir ("Ticket 58 mm", "Ticket 80 mm", "Hoja carta") y cada usuario guarda su preferido en Mi cuenta. El valor inicial es 58 mm para el ticket y carta para la nota.

**Qué código lleva cada etiqueta:**

- Con `gtin`: su simbología GS1: EAN-13 (13 dígitos), UPC-A (12), EAN-8 (8); un GTIN-14 que empieza con 0 se imprime como EAN-13 de sus 13 últimos dígitos (es el mismo artículo) y uno que no, como ITF-14.
- Sin `gtin`: Code 128 del SKU.
- Las dos se encuentran con el lookup, porque compara el SKU exacto y el GTIN completado a 14 dígitos.
- Un SKU muy largo para el ancho de la etiqueta se avisa antes de imprimir, y se ofrece la etiqueta compacta.

**Productos pequeños: código 2D.** Un código lineal necesita ancho; un código 2D guarda el mismo SKU o GTIN en un cuadro de 10 a 15 mm. Opciones:

| Opción                        | Tamaño para un SKU o GTIN                                                        | Lo lee                              | Comentario                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Data Matrix** (recomendada) | El más chico: ~8–10 mm de lado, también en tira rectangular para piezas angostas | Lectores 2D (imager)                | Es el estándar GS1 para artículos pequeños; aguanta bien la impresión térmica pequeña y el daño parcial. |
| QR                            | ~12–15 mm de lado para el mismo dato                                             | Lectores 2D y cámaras de teléfono   | El más conocido; algo más grande que Data Matrix con datos cortos.                                       |
| GS1 DataBar                   | Tira de ~ 25 × 8 mm                                                              | La mayoría de los lectores modernos | Lineal compacto, solo para GTIN; no sirve para SKU.                                                      |

- Recomendación: la etiqueta compacta usa **Data Matrix** por defecto y **QR** como opción, ambos con el texto plano del código (el SKU o el GTIN tal cual), para que el lector lo "teclee" igual que un código lineal y la búsqueda exacta lo encuentre sin cambios.
- Requisito de hardware: los lectores láser lineales **no** leen códigos 2D; hace falta un lector 2D (imager), que lee también los lineales. ASSUMPTION registrada en G-26.
- La etiqueta compacta lleva el código y el SKU en letra pequeña; sin título si no cabe.
- Cantidad por variante elegida por el usuario (por defecto 1). La cola vive en la página, no en Pinia (no es server state ni sesión).
- ASSUMPTION: la etiqueta **no** lleva precio, porque los precios cambian por periodos y la etiqueta impresa no.

## 4. Plan propuesto

Seis PR, apilados como en 1.2 y en este orden. Cada uno pasa la puerta de calidad de `CLAUDE.md` y se prueba contra la API real 1.7.0 en el contenedor.

### PR A · Contrato 1.7.0 y compatibilidad

1. Fijar `base-shop@7af0f1d` en `API_SOURCE_OF_TRUTH.md`, copiar `openapi/v1.json`, `npm run api:types`.
2. RQ-3: `/pedidos/nuevo` abre con "Venta de mostrador (sin envío)" marcada; hoy el valor inicial es `SHIPPING` (`StoreOrderForm.vue:39`).
3. R-1: columna "Descuento" en las líneas y nombre/código de la promoción en el detalle del pedido y en la venta en tienda.
4. R-6: almacén de salida y notas del pago y del reembolso.
5. Productos: interruptor "Solo en tienda (servicio)" en el formulario, filtro y distintivo en el listado; etiqueta de `STORE_ONLY` (R-3); al marcarlo, recordar que su existencia se registra con una entrada (ADR-0165).
6. Variantes: campo GTIN con validación local del dígito verificador (Zod), error `duplicate-value` en el campo; GTIN visible en el panel de variantes; el buscador de productos dice "título, SKU o GTIN".
7. R-4, R-5 y los mensajes de los tipos de error nuevos (`sale-not-linkable`, `coupon-not-applicable`).

### PR B · Cargas masivas

1. Extraer de `PriceImportCard` un componente compartido de carga CSV: elegir archivo, **Revisar** (`dryRun=true`) y luego **Importar**, tabla de errores por línea y columna con el código traducido, 413 con el tamaño máximo, sin reintentos automáticos.
2. **Cargar productos** en `/catalogo/productos` (`catalog.write`): resumen de productos y variantes creados, en borrador; enlace al listado filtrado.
3. **Cargar entradas de mercancía** en `/inventario/stock` (`inventory.write`): resumen de filas y unidades; "Este archivo ya se cargó el {fecha}" con `importedAt`.
4. Plantillas descargables: copias de `docs/templates/*.csv` de base-shop en `public/plantillas/`, con la guía de columnas resumida en la pantalla.
5. Precios masivos ya existen: solo se suma su plantilla y el mensaje nuevo de columnas.

### PR C · Promociones y cupones

1. Feature nueva `app/features/promotions`; rutas `/promociones`, `/promociones/nueva`, `/promociones/[id]`; menú con `promotions.read`.
2. Listado con filtros `q`, tipo (automática/cupón), estado, canal y alcance; columnas nombre, descuento, código, canales, vigencia, estado y usos (`uses` / `usageLimit`).
3. Formulario: nombre; porcentaje **o** monto; toda la compra o productos/categorías/marcas (el selector de productos pasa a `shared/ui` para no importar Catálogo); canales; compra mínima; inicio y fin en hora de México; código, límite de usos y una vez por cliente. Campos bloqueados según el estado (iniciada: solo nombre, fin y límite; terminada: solo lectura), con `version`.
4. **Terminar** con confirmación (irreversible).
5. Venta en tienda: campo **Cupón** que se manda en la cotización y al colocar; mensajes por `reason` (incluido `buyerRequired` para una venta sin datos del comprador); la promoción aplicada y el descuento por línea a la vista. El Vendedor puede consultar las promociones vigentes para ofrecerlas.

### PR D · Lector de códigos (RQ-1)

1. `shared/scanner` y `shared/api/variant-lookup.ts` (§3.1).
2. Escaneo en la búsqueda de productos y en `/pedidos/nuevo`.
3. Escaneo también en el buscador de pedidos (el ticket lleva el código público en Code 128) y en la entrada de mercancía, porque reusan la misma pieza sin endpoints nuevos.

### PR E · Impresión: base, ticket y etiquetas (RQ-2)

1. `shared/print`, layout `print`, formatos 58 mm, 80 mm y carta, y preferencia por usuario en Mi cuenta (§3.2).
2. Ticket de pedido en los tres formatos y botón en el detalle y al colocar la venta de mostrador.
3. Etiquetas con código lineal y compactas con Data Matrix o QR, y cola en `/catalogo/etiquetas`.
4. Dependencia para dibujar los códigos: ver D-4.

### PR F · Órdenes de trabajo (servicios) y nota de servicio

1. Feature nueva `app/features/work-orders`; rutas `/ordenes-trabajo`, `/ordenes-trabajo/nueva`, `/ordenes-trabajo/[id]`; menú con `work-orders.read`.
2. Listado: búsqueda por folio, teléfono, nombre o número de serie (también escaneando el folio de la nota), filtros de estado, almacén, técnico y fechas.
3. **Técnicos (RQ-4, ajustado por el usuario el 2026-10-17):** con `staff.manage`, el selector de técnico al recibir y en el detalle lista al staff activo con búsqueda (`GET /v1/admin/identity/staff?status=ACTIVE&q=`), y el técnico se muestra con su nombre (`GET /v1/admin/identity/staff/{id}`). Sin `staff.manage`, solo se ofrece "Asignármela" con mi cuenta (`GET /v1/me`) y el técnico se muestra como "Tú" o el ID corto. No se supone ningún servicio; se registra el gap para pedir al backend una lista de técnicos con permisos de órdenes de trabajo (G-23).
4. **Recibir equipo**: formulario de §25.2 con `Idempotency-Key` generada al abrir la confirmación (un doble envío no crea dos folios), almacén activo, cliente registrado opcional (`customers.read`), costo estimado; al crear, ofrecer imprimir la nota.
5. Detalle: datos, editar y registrar diagnóstico/trabajo (`version`; bloqueado al cerrar), **cambiar estado** solo hacia adelante con las opciones válidas, cancelar con nota obligatoria, historial.
6. **Cobrar**: "Nueva venta para esta orden" abre `/pedidos/nuevo` y al colocar regresa a la orden con la venta lista para ligar (dos pasos visibles; si ligar falla, el pedido ya existe y se avisa sin reintentar). "Ligar venta existente" busca ventas de tienda por código público. Desligar con confirmación. Totales pagado/pendiente.
7. Datos bloqueados (`work-orders.read-blocked`, con motivo) y anonimizar (`customers.manage`, con motivo), como ya se hace en pedidos.
8. Nota de servicio impresa (§3.2).

### Cierre

Actualizar `TRACEABILITY.md` (UC-CAT-15 a 17, UC-INV-12, UC-ORD-15, UC-WRK-01 a 06, UC-PRM-01 a 05, RQ-1, RQ-2), `SCREEN_INVENTORY.md`, `ROUTE_MAP.md`, `AUTHORIZATION_MATRIX.md`, `PRODUCT_DEFINITION.md`, `TEST_CASE_MATRIX.md`, `CHANGELOG.md`, `RELEASE_READINESS.md` y `DECISIONS.md`. Pruebas: unitarias del dígito verificador, la elección de simbología, el detector de ráfagas del lector y los mensajes de error; MSW para las rutas nuevas; e2e de la venta escaneando, del cupón, de las cargas y de la orden de trabajo; captura de impresión con Playwright (`emulateMedia('print')`).

## 5. Decisiones

| #   | Pregunta                                                       | Estado                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1 | ¿Seis PR apilados (A→F) o menos?                               | **Decidido por el usuario (2026-10-17):** seis PR apilados.                                                                                                                                                                                                                                                                                                                                  |
| D-2 | ¿Papel del ticket?                                             | **Decidido por el usuario (2026-10-17):** térmica de 58 mm como principal, 80 mm como opción, y vista carta.                                                                                                                                                                                                                                                                                 |
| D-3 | ¿Formato de las etiquetas?                                     | **Decidido por el usuario (2026-10-17), con la recomendación:** **térmica de 50 × 25 mm** con código lineal; **compacta de 25 × 15 mm con Data Matrix** (QR como opción) para productos pequeños, como pidió el usuario; y hoja carta de 30 (3 × 10). Sin precio.                                                                                                                            |
| D-4 | ¿Cómo dibujar los códigos? Requiere ampliar el stack aprobado. | **Decidido por el usuario (2026-10-17), ampliación del stack aceptada:** **agregar `bwip-js`** (MIT), una sola librería que genera SVG de Code 128, EAN-13/8, UPC-A, ITF-14, Data Matrix y QR, cargada solo en las páginas de impresión. Con QR y Data Matrix, `jsbarcode` ya no alcanza (no hace 2D) y requeriría dos librerías. Escanear con la cámara del teléfono queda fuera por ahora. |
| D-5 | ¿Papel de la nota de servicio?                                 | **Decidido por el usuario (2026-10-17):** vista carta. Recomendación para el resto: carta por defecto, con 58 y 80 mm como opciones.                                                                                                                                                                                                                                                         |
| D-6 | ¿Quién asigna técnico en una orden de trabajo?                 | **Decidido por el usuario (2026-10-17, ajuste):** lista de técnicos (staff activo) para quien tiene `staff.manage`; para quien no, solo "Asignármela" (PR F, paso 3; G-23).                                                                                                                                                                                                                  |
| D-7 | ¿Tipo de entrega inicial en la venta en tienda?                | **Decidido por el usuario (2026-10-17):** venta de mostrador (sin envío).                                                                                                                                                                                                                                                                                                                    |

## 6. Gaps nuevos a registrar

- **G-22 · Sin carga masiva para editar productos existentes o agregarles variantes** — NO DISPONIBLE: `product-imports` solo crea productos nuevos ("Solo crea: no edita productos existentes"). Agregar variantes o GTIN a productos que ya existen es uno por uno.
- **G-23 · Lista de técnicos no disponible en la API** — GAP (D-6): listar al staff exige `staff.manage`. Con ese permiso se elige técnico de la lista de staff activo; sin él, solo "Asignármela". Pedir al backend una lista de técnicos con permisos de órdenes de trabajo. `receivedBy` y `actorId` del historial siguen siendo IDs (relacionado con G-13 y G-21).
- **G-24 · El lookup no trae disponible ni precio** — GAP menor: la venta en tienda hace una consulta extra de stock; el precio llega en la cotización, como hoy.
- **G-25 · Impresión directa a impresora térmica** — ASSUMPTION: sin software local (por ejemplo, un agente de impresión), el navegador no corta papel, no abre el cajón ni imprime sin diálogo.
- **G-26 · Hardware del lector** — ASSUMPTION: lector en modo teclado con sufijo Enter (§3.1), y lector 2D (imager) donde se usen etiquetas compactas con Data Matrix o QR (§3.2).
- **G-19** sigue abierto: 1.7.0 tampoco expone la versión vigente del aviso de privacidad.
