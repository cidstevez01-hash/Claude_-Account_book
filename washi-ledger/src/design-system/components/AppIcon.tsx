import { useId } from 'react'
import { ICON_GLYPHS, type IconKey } from '../../lib/iconGlyphs'

interface AppIconProps {
  icon: IconKey
  size: number
  /** 默认currentColor跟随文字色(非"夏 · 花火"主题下的书本图标就是这样用)；summer
   * 效果层传gradient=true覆盖成珊瑚红渐变。跟fill二选一，不会同时传 */
  fill?: string
  /** B-XX：真机反馈有圈图标"圆圈都是空的"(只看到光晕、看不到图标本身)——排查到
   * 之前所有图标共用同一份渐变定义(IconGradientDefs.tsx，挂在App.tsx根部的一个
   * width=0 height=0的<svg>里)，图标自己的<svg>用url(#icon-fill-grad)跨SVG引用它。
   * 这种"引用另一个零尺寸<svg>里定义的渐变"的写法在部分WebKit/Safari版本上有已知的
   * 不稳定表现(引用解析不到，图形直接没有填充，只剩背后的光晕可见)——不是CSS
   * z-index层级的问题(图标本身z-index确实在光晕之上，层级没错，只是内容没画出来)。
   * 改成每个图标实例自带一份本地渐变定义(同一个<svg>内部的<defs>，url(#id)解析
   * 完全在自己文档内完成，不依赖任何其它节点是否还挂载/渲染成功)，彻底不再有
   * 跨SVG引用这件事，不管原因是不是真是这个Safari的坑，这样写法本身就更稳。
   * gradient=true时用useId()生成每个实例独立的id，避免多个图标实例共享同一个id
   * 引发的潜在冲突(虽然分处不同<svg>本来就有各自独立的id作用域，这里是双重保险) */
  gradient?: boolean
  className?: string
}

const GRADIENT_STOPS = [
  { offset: '0%', color: '#e4ca95' },
  { offset: '55%', color: '#d98668' },
  { offset: '100%', color: '#d67966' },
]

/** 纯图标形状渲染层——数据来源+viewBox偏移量说明见lib/iconGlyphs.ts顶部注释。
 * 颜色(fill/gradient prop)和发光效果(见IconEffects.tsx)都是外部决定，这里不掺和，
 * 方便三者分开改动 */
export function AppIcon({ icon, size, fill = 'currentColor', gradient, className }: AppIconProps) {
  const glyph = ICON_GLYPHS[icon]
  const reactId = useId()
  const gradientId = `icon-fill-grad-${reactId}`
  const resolvedFill = gradient ? `url(#${gradientId})` : fill
  const path = <path d={glyph.path} fill={resolvedFill} />
  return (
    <svg
      viewBox={glyph.viewBox}
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
      aria-hidden="true"
    >
      {gradient && (
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="30%" r="75%">
            {GRADIENT_STOPS.map((stop) => (
              <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
            ))}
          </radialGradient>
        </defs>
      )}
      {glyph.flipY ? <g transform="translate(0,960) scale(1,-1)">{path}</g> : path}
    </svg>
  )
}
