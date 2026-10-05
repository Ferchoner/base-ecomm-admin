/**
 * Refresh token en localStorage (DECISIONS D-P03). El token de acceso nunca se guarda: vive en memoria.
 * Todas las pestañas comparten el mismo refresh token; se renueva de una en una (ver session.store.ts).
 */
export const REFRESH_TOKEN_KEY = 'backoffice.refreshToken'

export interface TokenStorage {
  read(): string | null
  write(token: string): void
  clear(): void
}

export function createLocalTokenStorage(
  storage: Storage | undefined = globalThis.localStorage,
): TokenStorage {
  return {
    read() {
      try {
        return storage?.getItem(REFRESH_TOKEN_KEY) ?? null
      } catch {
        return null
      }
    },
    write(token) {
      try {
        storage?.setItem(REFRESH_TOKEN_KEY, token)
      } catch {
        // Almacenamiento bloqueado (modo privado estricto): la sesión dura lo que la pestaña.
      }
    },
    clear() {
      try {
        storage?.removeItem(REFRESH_TOKEN_KEY)
      } catch {
        // Sin almacenamiento no hay nada que borrar.
      }
    },
  }
}
