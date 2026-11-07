import { useState, type CSSProperties } from 'react'
import { useSettings } from '../../hooks/useSettings'

// Fixed routes and negative time offsets keep a populated, repeatable field on page changes.
const FALLING_LEAVES = [
  [94, -.86, 22, 22, -25], [103, -.48, 19, 29, 35], [88, -.66, 25, 24, -60],
  [97, -.2, 21, 34, 10], [108, -1.02, 27, 27, 55], [86, -.38, 24, 20, -10],
  [100, -.72, 20, 31, 80], [91, -.12, 28, 23, -45], [106, -.95, 23, 26, 20],
  [90, -.55, 26, 36, 65], [99, -.32, 18, 21, -70], [104, -.8, 29, 28, 40],
] as const

/** Decorative overlay: no hit testing, no layout or safe-area space, no new imagery. */
export function AutumnLeaves({ restingOnly = false }: { restingOnly?: boolean }) {
  const { settings } = useSettings()
  const [epoch] = useState(() => Date.now() / 1000)
  if (settings.themeSkin !== 'autumn') return null

  return (
    <div className={`autumn-scattered-leaves${restingOnly ? ' autumn-resting-only' : ''}`} aria-hidden="true">
      {!restingOnly && FALLING_LEAVES.map(([left, drift, duration, size, angle], index) => (
        <span className="autumn-falling-leaf" key={index} style={{
          left: `${left}%`, '--leaf-drift': drift, '--leaf-size': `${size + 12}px`,
          '--leaf-angle': `${angle}deg`, '--leaf-sway': `${18 + index % 4 * 7}px`,
          '--leaf-flutter-duration': `${3.8 + index % 5 * .65}s`,
          '--leaf-flutter-delay': `${-(epoch % (3.8 + index % 5 * .65))}s`,
          animationDuration: `${duration}s`,
          animationDelay: `${-((epoch + index * 5.7) % duration)}s`,
        } as CSSProperties}>
          <i className={index % 5 === 0 ? 'autumn-leaf-blade autumn-leaf-tumbling' : 'autumn-leaf-blade'} />
        </span>
      ))}
      {[0, 1, 2, 3].map(index => <span className="autumn-resting-leaf" key={`rest-${index}`} />)}
    </div>
  )
}
