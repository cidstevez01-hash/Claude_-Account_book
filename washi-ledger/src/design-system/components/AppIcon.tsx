import { ICON_GLYPHS, type IconKey } from '../../lib/iconGlyphs'

interface AppIconProps {
  icon: IconKey
  size: number
  /** 默认currentColor跟随文字色(非"夏 · 花火"主题下的书本图标就是这样用)；
   * summer效果层会传共享渐变url(#icon-fill-grad)覆盖——颜色来源见IconGradientDefs.tsx，
   * 这个组件本身不关心颜色/发光，只管形状 */
  fill?: string
  className?: string
}

/** 纯图标形状渲染层——数据来源+viewBox偏移量说明见lib/iconGlyphs.ts顶部注释。
 * 颜色(fill prop)和发光效果(见IconEffects.tsx)都是外部决定，这里不掺和，方便
 * 三者分开改动 */
export function AppIcon({ icon, size, fill = 'currentColor', className }: AppIconProps) {
  const glyph = ICON_GLYPHS[icon]
  return (
    <svg
      viewBox={glyph.viewBox}
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
      aria-hidden="true"
    >
      {glyph.flipY ? (
        <g transform="translate(0,960) scale(1,-1)">
          <path d={glyph.path} fill={fill} />
        </g>
      ) : (
        <path d={glyph.path} fill={fill} />
      )}
    </svg>
  )
}
