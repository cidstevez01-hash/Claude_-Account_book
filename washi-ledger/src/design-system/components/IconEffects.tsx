import { AppIcon } from './AppIcon'
import type { IconKey } from '../../lib/iconGlyphs'

interface IconEffectProps {
  icon: IconKey
  size: number
  className?: string
}

/** 萤火虫预设——固定几组游走轨迹(wander)+发光节奏(glow)的时长/负delay组合，不是
 * 运行时随机生成(那样每次刷新都不一样，没法稳定复测，B-XX这轮之前是这么权衡的)。
 * 负delay让每个萤火虫一挂载就已经"游到/亮到"周期中间某处，不是全部从第0帧同步
 * 起跳(参照index.css头部注释)。三只轨迹(wander-a/b/c)和数值都是各自独立的，
 * 看起来才不像同一只萤火虫的分身 */
const FIREFLY_PRESETS: {
  wander: 'a' | 'b' | 'c'
  wanderDuration: number
  wanderDelay: number
  glowDuration: number
  glowDelay: number
}[] = [
  { wander: 'a', wanderDuration: 26, wanderDelay: 9, glowDuration: 6.5, glowDelay: 1.5 },
  { wander: 'b', wanderDuration: 22, wanderDelay: 4, glowDuration: 7.5, glowDelay: 5 },
  { wander: 'c', wanderDuration: 30, wanderDelay: 17, glowDuration: 5.5, glowDelay: 3 },
]

function Firefly({ wander, wanderDuration, wanderDelay, glowDuration, glowDelay }: (typeof FIREFLY_PRESETS)[number]) {
  return (
    <span
      className="firefly"
      aria-hidden="true"
      style={{
        animation: `firefly-wander-${wander} ${wanderDuration}s ease-in-out infinite, firefly-glow ${glowDuration}s ease-in-out infinite`,
        animationDelay: `-${wanderDelay}s, -${glowDelay}s`,
      }}
    />
  )
}

/** 有圈效果——只用在真实UI这个位置本来就有常驻圆形背景的地方(SettingsPage行/
 * RateShortcutFab/头像)，光晕要贴着那个真实圆形容器的外沿往外发光(见index.css的
 * .icon-ring-glow，inset:-9px)。
 * B-XX：之前这里自己又包了一层跟图标同尺寸(24px)的span当发光的定位基准，
 * inset:-9px是相对这个小span算的，跟调用方真正的圆形容器(比如SettingsPage行是
 * 40px)完全对不上——结果发光只在24+18=42px这个跟图标差不多大的范围里，几乎全部
 * 糊在纯色圆内部，没有真正探出圆外发光，跟设计稿"光晕贴着圆形容器外侧"对不上。
 * 改成不再自己包裹，直接把发光层和图标作为调用方容器的直接子节点渲染——调用方
 * 那个真实圆形容器本来就是position:relative+flex居中(SettingsRow等已经是这样)，
 * inset:-9px改成相对那个真实大小的圆计算，发光才会正确探出圆外。
 * fireflies——只有最早定稿的语言/货币两个图标带这个装饰(见确认稿)，后补的位置
 * (比如着せ替え行)不带，调用方按需传 */
export function RingIconEffect({ icon, size, className, fireflies }: IconEffectProps & { fireflies?: boolean }) {
  return (
    <>
      <span className="icon-ring-glow" aria-hidden="true" />
      <AppIcon icon={icon} size={size} fill="url(#icon-fill-grad)" className={`relative z-[1] ${className ?? ''}`} />
      {fireflies && FIREFLY_PRESETS.map((preset, i) => <Firefly key={i} {...preset} />)}
    </>
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
