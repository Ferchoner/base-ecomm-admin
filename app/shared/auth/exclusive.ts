/** Ejecuta `fn` sin solaparse con otras pestañas (Web Locks API) ni con la misma. */
export type RunExclusive = <T>(fn: () => Promise<T>) => Promise<T>

const LOCK_NAME = 'backoffice.session-refresh'

export function createRunExclusive(
  locks: LockManager | undefined = globalThis.navigator?.locks,
): RunExclusive {
  if (locks) {
    return (fn) => locks.request(LOCK_NAME, fn) as Promise<Awaited<ReturnType<typeof fn>>>
  }
  // Sin Web Locks (navegadores antiguos): solo se serializa dentro de la pestaña.
  let tail: Promise<unknown> = Promise.resolve()
  return (fn) => {
    const run = tail.then(fn, fn)
    tail = run.catch(() => undefined)
    return run
  }
}
