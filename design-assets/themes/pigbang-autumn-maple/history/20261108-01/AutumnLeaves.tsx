import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useSettings } from '../../hooks/useSettings'

// Fixed routes and negative time offsets keep a populated, repeatable field on page changes.
const FALLING_LEAVES = [
  // Parallel lanes share drift and duration, so they cannot overtake or converge.
  // Artwork points upward: 180–225deg makes the blade face down/down-left.
  [52, -.38, 30, 70, 200],
  [78, -.38, 30, 96, 220],
  [104, -.38, 30, 80, 208],
] as const

/** Decorative overlay: no hit testing, no layout or safe-area space, no new imagery. */
export function AutumnLeaves({ restingOnly = false }: { restingOnly?: boolean }) {
  const { settings } = useSettings()
  const [epoch] = useState(() => Date.now() / 1000)
  const overlayRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay || restingOnly || settings.themeSkin !== 'autumn') return

    // Event driven only: CSS owns every frame, and resumes at the paused position.
    let inView = true
    let pageActive = true
    const sync = () => overlay.style.setProperty('--leaf-play-state',
      !document.hidden && inView && pageActive ? 'running' : 'paused')
    const hide = () => { pageActive = false; sync() }
    const show = () => { pageActive = true; sync() }
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      sync()
    })
    observer.observe(overlay)
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', show)
    sync()
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', show)
    }
  }, [restingOnly, settings.themeSkin])
  if (settings.themeSkin !== 'autumn') return null

  return (
    <div ref={overlayRef} className={`autumn-scattered-leaves${restingOnly ? ' autumn-resting-only' : ''}`} aria-hidden="true">
      {!restingOnly && FALLING_LEAVES.map(([left, drift, duration, size, angle], index) => (
        <span className="autumn-falling-leaf" key={index} style={{
          // Match the responsive canopy scale; the bitmap has transparent margins.
          left: `${left}%`, '--leaf-drift': drift,
          '--leaf-size': `calc(clamp(260px,74vw,330px) * ${size / 289})`,
          '--leaf-angle': `${angle}deg`, '--leaf-sway': `${18 + index % 4 * 7}px`,
          '--leaf-flight-duration': `${duration}s`,
          '--leaf-flight-delay': `${-((epoch + index * 10) % duration)}s`,
          animationDuration: `${duration}s`,
          animationDelay: `${-((epoch + index * 10) % duration)}s`,
        } as CSSProperties}>
          <i className="autumn-leaf-blade">
            <span className="autumn-leaf-panel autumn-leaf-left" />
            <span className="autumn-leaf-panel autumn-leaf-right" />
          </i>
        </span>
      ))}
      {[0, 1, 2, 3].map(index => <span className="autumn-resting-leaf" key={`rest-${index}`} />)}
    </div>
  )
}
