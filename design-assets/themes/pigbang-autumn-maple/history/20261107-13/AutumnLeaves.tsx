import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useSettings } from '../../hooks/useSettings'

// Fixed routes and negative time offsets keep a populated, repeatable field on page changes.
const FALLING_LEAVES = [
  // Left, middle and right landing lanes. Cross the page before reaching the cards.
  [90, -.82, 22, 60, -25], [94, -.48, 19, 78, 35], [88, -.72, 25, 70, -60],
  [92, -.2, 21, 92, 10], [96, -.88, 27, 84, 55], [86, -.46, 24, 64, -10],
  [94, -.78, 20, 80, 80], [91, -.12, 28, 96, -45], [96, -.86, 23, 74, 20],
  [90, -.55, 26, 88, 65], [93, -.28, 18, 68, -70], [94, -.74, 29, 82, 40],
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
          '--leaf-flight-delay': `${-((epoch + index * 5.7) % duration)}s`,
          animationDuration: `${duration}s`,
          animationDelay: `${-((epoch + index * 5.7) % duration)}s`,
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
