import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { isWinterTheme } from '../../lib/themeSkin'

const SNOW = [
  [4, 14, 23, 25], [12, 20, 25, -35],
  [24, 16, 27, 25], [35, 28, 29, -35],
  [44, 18, 31, 25], [56, 12, 33, -35],
  [67, 24, 23, 25], [78, 14, 25, -35],
  [88, 20, 27, 25], [96, 16, 29, -35],
  [18, 28, 31, 25], [61, 18, 33, -35],
  [82, 12, 23, 25], [39, 24, 25, -35],
] as const

/** One persistent decorative layer for all routes; CSS owns every animation frame. */
export function WinterBackground() {
  const { settings } = useSettings()
  const backgroundRef = useRef<HTMLDivElement>(null)
  const [epoch] = useState(() => Date.now() / 1000)

  useEffect(() => {
    const background = backgroundRef.current
    if (!background || !isWinterTheme(settings.themeSkin)) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let pageActive = true
    const sync = () => background.style.setProperty('--snow-play-state',
      pageActive && !document.hidden && !reducedMotion.matches ? 'running' : 'paused')
    const hide = () => { pageActive = false; sync() }
    const show = () => { pageActive = true; sync() }
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', show)
    reducedMotion.addEventListener('change', sync)
    sync()
    return () => {
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', show)
      reducedMotion.removeEventListener('change', sync)
    }
  }, [settings.themeSkin])

  if (!isWinterTheme(settings.themeSkin)) return null
  return (
    <div ref={backgroundRef} className="winter-background" aria-hidden="true">
      <div className="winter-fall-layer">
        {SNOW.map(([left, size, duration, drift], index) => (
          <span className="winter-flake" key={index} style={{
            '--snow-x': `${left}%`, '--snow-size': `${size}px`,
            '--snow-duration': `${duration}s`,
            '--snow-delay': `${-((epoch + index * 4.7) % duration)}s`,
            '--snow-drift': `${drift}px`,
          } as CSSProperties} />
        ))}
      </div>
    </div>
  )
}
