import { useState, type CSSProperties } from 'react'
import { useSettings } from '../../hooks/useSettings'

// Fixed routes and negative time offsets keep a populated, repeatable field on page changes.
const FALLING_LEAVES = [
  // Left, middle and right landing lanes. Cross the page before reaching the cards.
  [90, -.82, 22, 22, -25], [94, -.48, 19, 29, 35], [88, -.72, 25, 24, -60],
  [92, -.2, 21, 34, 10], [96, -.88, 27, 27, 55], [86, -.46, 24, 20, -10],
  [94, -.78, 20, 31, 80], [91, -.12, 28, 23, -45], [96, -.86, 23, 26, 20],
  [90, -.55, 26, 36, 65], [93, -.28, 18, 21, -70], [94, -.74, 29, 28, 40],
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
