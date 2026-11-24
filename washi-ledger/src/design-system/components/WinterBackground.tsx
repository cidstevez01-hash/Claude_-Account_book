import { useEffect, useRef } from 'react'
import { App } from '@capacitor/app'
import { useSettings } from '../../hooks/useSettings'
import { isWinterTheme } from '../../lib/themeSkin'
import { WinterSnowfallSchedule } from '../../lib/winterSnowfall'

/** Persistent layer: native animations move flakes; timers only spawn/release paths. */
export function WinterBackground() {
  const { settings } = useSettings()
  const active = isWinterTheme(settings.themeSkin)
  const backgroundRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const background = backgroundRef.current
    const layer = layerRef.current
    if (!active || !background || !layer) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const initial = background.getBoundingClientRect()
    let schedule = new WinterSnowfallSchedule(initial.width, initial.height)
    const particles = new Map<number, { element: HTMLSpanElement; animation: Animation }>()
    let elapsed = 0
    let origin = performance.now()
    let running = false
    let nativeActive = true
    let nativeRevision = 0
    let appStateListener: { remove: () => Promise<void> } | undefined
    let disposed = false
    let timer: number | undefined

    const time = () => elapsed + (running ? performance.now() - origin : 0)
    const clearTimer = () => {
      if (timer !== undefined) window.clearTimeout(timer)
      timer = undefined
    }
    const clearParticles = () => {
      for (const { element, animation } of particles.values()) {
        animation.cancel()
        element.remove()
      }
      particles.clear()
    }
    const tick = () => {
      if (!running || disposed) return
      clearTimer()
      const now = time()
      const flakes = schedule.advanceTo(now)
      for (const [id, particle] of particles) {
        if (!schedule.active.has(id)) {
          particle.animation.cancel()
          particle.element.remove()
          particles.delete(id)
        }
      }
      for (const flake of flakes) {
        if (particles.has(flake.id)) continue
        // Newly drawn flakes start above the viewport even when a timer arrives late.
        flake.bornAt = now
        flake.endAt = now + flake.duration
        const element = document.createElement('span')
        element.className = 'winter-flake'
        element.dataset.snowId = String(flake.id)
        element.dataset.snowCenter = String(flake.center)
        element.dataset.snowSpeed = String(flake.speed)
        layer.appendChild(element)
        const from = schedule.pose(flake, flake.bornAt)
        const to = schedule.pose(flake, flake.endAt)
        const transform = (p: typeof from) => `translate3d(${p.x}px,${p.y}px,0) rotate(${p.rotation}deg)`
        const animation = element.animate([
          { opacity: 0, transform: transform(from), offset: 0 },
          { opacity: 1, offset: .08 },
          { opacity: 1, offset: .92 },
          { opacity: 0, transform: transform(to), offset: 1 },
        ], { duration: flake.duration, easing: 'linear', fill: 'both' })
        particles.set(flake.id, { element, animation })
      }
      const next = schedule.nextEventAt
      if (Number.isFinite(next)) timer = window.setTimeout(tick, Math.max(16, next - time()))
    }
    const pause = () => {
      if (running) elapsed = time()
      running = false
      clearTimer()
      for (const { animation } of particles.values()) animation.pause()
      background.style.setProperty('--snow-play-state', 'paused')
    }
    const sync = () => {
      if (disposed) return
      if (!nativeActive || document.hidden || reducedMotion.matches) {
        pause()
      } else {
        const resuming = !running
        if (resuming) {
          origin = performance.now()
          running = true
        }
        let recovered = false
        for (const [id, { animation }] of particles) {
          if (resuming || animation.playState === 'paused') {
            // A native pause can outlive the DOM lifecycle event. Preserve the
            // rendered progress and reserve its corridor until the real exit.
            const flake = schedule.active.get(id)
            const duration = animation.effect?.getTiming().duration
            if (flake && typeof animation.currentTime === 'number' && typeof duration === 'number' && duration > 0) {
              const now = time()
              const progress = Math.max(0, Math.min(1, animation.currentTime / duration))
              flake.bornAt = now - progress * flake.duration
              flake.endAt = flake.bornAt + flake.duration
            }
            animation.play()
            recovered = true
          }
        }
        background.style.setProperty('--snow-play-state', 'running')
        if (resuming || recovered || timer === undefined) tick()
      }
    }
    // pagehide pauses immediately, but does not leave a latch that only a
    // matching pageshow can clear. Visibility, focus and native resume recover.
    const hide = () => { pause() }
    const readNativeState = () => {
      const revision = nativeRevision
      void App.getState().then(({ isActive }) => {
        if (disposed || nativeRevision !== revision) return
        nativeActive = isActive
        sync()
      }).catch(() => { /* Preserve the visible-document fallback. */ })
    }
    const recover = () => {
      sync()
      if (!document.hidden) readNativeState()
    }
    const observer = new ResizeObserver(() => {
      const rect = background.getBoundingClientRect()
      if (Math.abs(rect.width - schedule.width) < .5 && Math.abs(rect.height - schedule.height) < .5) return
      pause()
      clearParticles()
      schedule = new WinterSnowfallSchedule(rect.width, rect.height)
      elapsed = 0
      sync()
    })
    observer.observe(background)
    document.addEventListener('visibilitychange', recover)
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', recover)
    window.addEventListener('focus', recover)
    reducedMotion.addEventListener('change', sync)
    void App.addListener('appStateChange', ({ isActive }) => {
      if (disposed) return
      nativeRevision++
      nativeActive = isActive
      sync()
    }).then((listener) => {
      if (disposed) void listener.remove()
      else appStateListener = listener
    }).catch(() => { /* DOM lifecycle remains available if the bridge fails. */ })
    readNativeState()
    sync()
    return () => {
      pause()
      disposed = true
      observer.disconnect()
      document.removeEventListener('visibilitychange', recover)
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', recover)
      window.removeEventListener('focus', recover)
      reducedMotion.removeEventListener('change', sync)
      void appStateListener?.remove()
      clearParticles()
    }
  }, [active])

  if (!active) return null
  return <div ref={backgroundRef} className="winter-background" aria-hidden="true">
    <div ref={layerRef} className="winter-fall-layer" />
  </div>
}
