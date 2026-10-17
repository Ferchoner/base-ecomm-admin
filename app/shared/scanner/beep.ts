let ctx: AudioContext | null = null

/**
 * Aviso sonoro corto al escanear (Web Audio, sin dependencias): agudo si se encontró, grave si no.
 * Si el navegador no deja reproducir sonido, no pasa nada.
 */
export function scanBeep(ok: boolean) {
  try {
    ctx ??= new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = ok ? 1320 : 330
    gain.gain.value = 0.08
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + (ok ? 0.08 : 0.2))
  } catch {
    // Sin audio disponible.
  }
}
