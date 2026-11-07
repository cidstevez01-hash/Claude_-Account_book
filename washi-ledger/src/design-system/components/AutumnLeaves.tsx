import { useSettings } from '../../hooks/useSettings'

/** Decorative only: shares the shell background layer and never consumes safe-area space. */
export function AutumnLeaves() {
  const { settings } = useSettings()
  if (settings.themeSkin !== 'autumn') return null

  return (
    <div className="autumn-scattered-leaves" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => <span className="autumn-scattered-leaf" key={index} />)}
    </div>
  )
}
