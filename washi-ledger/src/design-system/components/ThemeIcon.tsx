import type { CSSProperties } from 'react'
import { useSettings } from '../../hooks/useSettings'

interface ThemeIconProps {
  /** 默认Material Symbols字体图标名(比如'grid_view') */
  icon: string
  /** "夏 · 花火"主题下这个位置对应的复刻资源路径(见public/icons/fw/，从旧App
   * index.html的<symbol id="ic-*-fw">按原样potrace路径导出)——不传就是这个位置
   * 在summer主题下还没有对应资源，一直用普通Material图标(旧App本身也不是所有
   * 图标都有-fw版本，缺的就用原图标，不是这里漏做) */
  fw?: string
  className?: string
  style?: CSSProperties
}

export function ThemeIcon({ icon, fw, className, style }: ThemeIconProps) {
  const { settings } = useSettings()
  if (fw && settings.themeSkin === 'summer') {
    return <img src={fw} alt="" className={className} style={style} />
  }
  return (
    <span className={`material-symbols-outlined ${className ?? ''}`} style={style}>
      {icon}
    </span>
  )
}
