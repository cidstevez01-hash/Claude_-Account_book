import { AppIcon } from './AppIcon'
import type { IconKey } from '../../lib/iconGlyphs'

interface IconEffectProps {
  icon: IconKey
  size: number
  className?: string
}

/** 有圈效果——只用在真实UI这个位置本来就有常驻圆形背景的地方(SettingsPage行/
 * RateShortcutFab/头像)，光晕贴着那个圆的外沿发光(见index.css的.icon-ring-glow，
 * inset:-9px)。调用方自己的圆形容器要有position:relative，这里只负责发光层+图标，
 * 不负责画那个圆——那个圆是真实UI本来就有的，不是为了这个效果新加的 */
export function RingIconEffect({ icon, size, className }: IconEffectProps) {
  return (
    <span
      className={`relative inline-flex items-center justify-center ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <span className="icon-ring-glow" aria-hidden="true" />
      <AppIcon icon={icon} size={size} fill="url(#icon-fill-grad)" className="relative z-[1]" />
    </span>
  )
}

/** 裸图标效果——真实UI这个位置没有常驻圆形容器(AppLayout按钮/NavDrawer行/
 * BottomNav tab)，不画假圆圈，改成复制一层同样的图标形状、模糊叠在原图标正下方
 * 当发光(见index.css的.icon-bare-glow)，光晕贴着图标本身轮廓，不是贴一个圆 */
export function BareIconEffect({ icon, size, className }: IconEffectProps) {
  return (
    <span className={`icon-bare-wrap ${className ?? ''}`} style={{ width: size, height: size }}>
      <span className="icon-bare-glow" aria-hidden="true">
        <AppIcon icon={icon} size={size} fill="var(--color-primary)" />
      </span>
      <span className="icon-bare-crisp">
        <AppIcon icon={icon} size={size} fill="url(#icon-fill-grad)" />
      </span>
    </span>
  )
}
