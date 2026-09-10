import type { CSSProperties } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { RingIconEffect, BareIconEffect } from './IconEffects'
import { ICON_GLYPHS, type IconKey } from '../../lib/iconGlyphs'

interface ThemeIconProps {
  /** 默认Material Symbols字体图标名(比如'grid_view') */
  icon: string
  /** "夏 · 花火"主题下这个位置对应的复刻资源路径(见public/icons/fw/，从旧App
   * index.html的<symbol id="ic-*-fw">按原样potrace路径导出)——不传就是这个位置
   * 在summer主题下还没有对应资源，一直用普通Material图标(旧App本身也不是所有
   * 图标都有-fw版本，缺的就用原图标，不是这里漏做)。跟下面的effect二选一，同一个
   * 位置不会两个都传——effect是新的"复用默认主题图标形状+单独发光"方案(见
   * design-assets/icons/summer-fireworks-icon-effects/)，逐步替换掉这套旧的
   * "旧App专属插画图标"方案，还没轮到替换的位置继续用fw */
  fw?: string
  className?: string
  style?: CSSProperties
  /** "夏 · 花火"下的图标光效——'ring'用在真实UI这个位置本来就有常驻圆形背景的地方
   * (SettingsPage行/RateShortcutFab/头像)，'bare'用在没有常驻圆形容器的地方
   * (AppLayout按钮/NavDrawer行/BottomNav tab)。哪个位置该用哪种不是随便挑的，逐个
   * 核对过真实UI是否存在常驻圆形背景才定的。只有icon在ICON_GLYPHS里有形状数据
   * 才会生效，没有数据就还是走fw/默认图标那两条旧路径 */
  effect?: 'ring' | 'bare'
  /** 配合effect用，图标实际渲染尺寸(px)——默认24跟.material-symbols-outlined默认
   * font-size一致，个别位置(比如RateShortcutFab用22px)需要单独传 */
  size?: number
  /** 只对effect='ring'生效——萤火虫装饰，只有确认稿里最早定稿的语言/货币两个图标带，
   * 后补的位置(着せ替え行等)不传 */
  fireflies?: boolean
  /** 只对effect='bare'生效——B-48，给呼吸发光动画传一个基于真实时间戳算出的负delay，
   * 用在BottomNav这类"每次切换都会整个重新挂载"的位置，避免动画从0%重新开始看起来
   * "跳"一下。调用方要用useState(()=>Date.now()%5500)这类只在挂载时算一次的方式算，
   * 不要每次渲染都重算，见IconEffects.tsx的BareIconEffect */
  glowDelayMs?: number
}

export function ThemeIcon({ icon, fw, className, style, effect, size = 24, fireflies, glowDelayMs }: ThemeIconProps) {
  const { settings } = useSettings()
  const isSummer = settings.themeSkin === 'summer'
  const glyphKey = icon as IconKey

  if (isSummer && effect && ICON_GLYPHS[glyphKey]) {
    return effect === 'ring' ? (
      <RingIconEffect icon={glyphKey} size={size} className={className} fireflies={fireflies} />
    ) : (
      <BareIconEffect icon={glyphKey} size={size} className={className} glowDelayMs={glowDelayMs} />
    )
  }
  if (fw && isSummer) {
    return <img src={fw} alt="" className={className} style={style} />
  }
  return (
    <span className={`material-symbols-outlined ${className ?? ''}`} style={style}>
      {icon}
    </span>
  )
}
