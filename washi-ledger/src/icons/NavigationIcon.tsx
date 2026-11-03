import { useId, type CSSProperties } from 'react'
import { resolveNavigationIcon, type NavigationIconKey } from './themes/registry'

interface NavigationIconProps {
  icon: NavigationIconKey
  theme: string
  size: number
  className?: string
  active?: boolean
  glowDelayMs?: number
}

export function NavigationIcon({ icon, theme, size, className, active, glowDelayMs }: NavigationIconProps) {
  const resolved = resolveNavigationIcon(theme, icon)
  const gradientId = `pb-nav-${useId().replaceAll(':', '')}`
  const style = {
    width: size,
    height: size,
    '--pb-icon-accent': resolved.accent,
    '--pb-icon-paper': resolved.paper,
  } as CSSProperties
  const glyph = (glowing = false) => (
    <svg width={size} height={size} viewBox="0 0 256 256" aria-hidden="true" style={{ display: 'block' }}>
      {resolved.glow && !glowing && <defs><radialGradient id={gradientId} cx="50%" cy="30%" r="75%"><stop offset="0%" stopColor="#e4ca95" /><stop offset="55%" stopColor="#d98668" /><stop offset="100%" stopColor="#d67966" /></radialGradient></defs>}
      <g dangerouslySetInnerHTML={{ __html: resolved.glow && !glowing ? resolved.body.replaceAll('currentColor', `url(#${gradientId})`) : resolved.body }} />
    </svg>
  )
  return (
    <span className={`pb-navigation-icon icon-bare-wrap ${className ?? ''}`} style={style} data-icon={icon} data-icon-theme={theme} data-active={active ? 'true' : 'false'} aria-hidden="true">
      {resolved.glow && <span className="icon-bare-glow" style={{ color: 'var(--color-primary)', animationDelay: `${-(glowDelayMs ?? 0)}ms` }}>{glyph(true)}</span>}
      <span className="icon-bare-crisp">{glyph()}</span>
    </span>
  )
}
