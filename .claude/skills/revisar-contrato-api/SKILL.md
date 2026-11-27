---
name: revisar-contrato-api
description: Revisa la compatibilidad del cambio con el contrato de API fijado en este repositorio.
disable-model-invocation: true
---

Flujo o diff: $ARGUMENTS

1. Identifica la operación y su referencia en openapi/v1.json. Toma el commit y la versión de la API fijados en docs/API_SOURCE_OF_TRUTH.md; no los supongas.
2. Compara método, ruta, petición, respuesta y errores documentados con la implementación. Comprueba permisos, idempotencia, paginación y concurrencia cuando apliquen.
3. Sigue app/features y app/shared/api/client.ts. Verifica permisos, versión del recurso, transiciones, idempotencia y errores según la operación. Registra discrepancias en docs/GAPS.md. Si cambia el OpenAPI, ejecuta npm run api:types y revisa el diff de tipos generados. Usa Vitest/MSW para escenarios dirigidos.
4. Reporta cada diferencia con evidencia y registra las comprobaciones ejecutadas y pendientes.
