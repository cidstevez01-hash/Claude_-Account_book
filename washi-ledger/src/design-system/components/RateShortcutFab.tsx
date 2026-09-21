import { useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAppNavigate, viewTransitionLinkClick } from '../../hooks/useAppNavigate'
import { useI18n } from '../../lib/i18n'
import { useSettings } from '../../hooks/useSettings'
import { ThemeIcon } from './ThemeIcon'
import { AppIcon } from './AppIcon'
import { loadRateFabPosition, saveRateFabPosition } from '../../lib/rateFabPosition'

/** R-20：汇率悬浮快捷入口——用户确认稿(design-assets/icons/rate-shortcut-fab/final/)，
 * 位置/图案取方案A(主"记一笔"FAB正上方20px、currency_exchange图标)，呼吸光晕取方案C。
 * 挂在AppLayout里、只在非子页面(仪表盘/明细/统计/我的账户)渲染——当前就在汇率页时
 * 走的是leftButton='back'分支(isSubpage=true)，AppLayout那边已经不渲染这个组件，
 * 这里不用再额外判断当前路径是不是/rate。
 *
 * 位置数值跟DashboardPage.tsx"记一笔"主FAB对齐：主FAB right取
 * max(20px, calc(50% - 240px + 20px))、宽58px，这个按钮宽48px，right在此基础上
 * +5px让两个圆的中心线对齐(不是简单复用同一个right值)；bottom在主FAB的
 * `bottom + 58px高度 + 20px间距`基础上算出。这是没拖拽过时的默认位置——用户反馈过
 * 这个位置在统计页会挡住趋势图(见下面拖拽实现)，拖拽调整后的位置优先生效 */

// 按钮本体48px(w-12/h-12)，拖拽越界限制要用到这个尺寸
const FAB_SIZE = 48
// 轻点(点进汇率页)和拖拽(挪位置)靠这个阈值区分——移动距离没超过这个值都算轻点，
// 超过了才算拖拽开始，避免手指有一点点抖动就被误判成拖拽从而点不进汇率页
const DRAG_THRESHOLD_PX = 6
// 拖拽到底也要跟视口边缘留一点空隙，不让按钮整个贴死边缘导致以后再也点不到/拖不动
const EDGE_MARGIN_PX = 6
const DEFAULT_RIGHT_CSS = 'max(25px, calc(50% - 240px + 25px))'
const DEFAULT_BOTTOM_CSS = 'calc(6rem + 102px)'

export function RateShortcutFab() {
  const { t } = useI18n()
  const { settings } = useSettings()
  const isSummer = settings.themeSkin === 'summer'
  const navigate = useAppNavigate()

  // 用户反馈这个悬浮按钮在统计页会遮挡收支推移图表，要求能拖拽挪位置、记住挪动后的
  // 位置。pos为null表示还没拖拽过，走上面两个DEFAULT_*_CSS默认值(跟主FAB对齐的
  // calc表达式)；拖拽过一次之后换成像素坐标的right/bottom，并持久化到localStorage
  // (这是纯粹的单设备UI摆放偏好，不是要跨设备共享的数据，localStorage是合适的落点)
  const [pos, setPos] = useState(() => loadRateFabPosition())
  const elRef = useRef<HTMLAnchorElement | null>(null)
  const dragState = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    startRight: number
    startBottom: number
    dragged: boolean
  } | null>(null)
  // handlePointerUp里dragState.current就清空了，但click事件是在pointerup之后才触发的
  // (松手拖出去的那一下会连带触发一次click)，得用这个单独的ref把"刚才是拖拽"这个
  // 结论带到handleClick里，不然click里已经看不到dragState了
  const justDraggedRef = useRef(false)

  function handlePointerDown(e: PointerEvent<HTMLAnchorElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const el = elRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    dragState.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startRight: window.innerWidth - rect.right,
      startBottom: window.innerHeight - rect.bottom,
      dragged: false,
    }
    el.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: PointerEvent<HTMLAnchorElement>) {
    const state = dragState.current
    if (!state || state.pointerId !== e.pointerId) return
    const dx = e.clientX - state.startClientX
    const dy = e.clientY - state.startClientY
    if (!state.dragged && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
    state.dragged = true
    const maxRight = Math.max(EDGE_MARGIN_PX, window.innerWidth - FAB_SIZE - EDGE_MARGIN_PX)
    const maxBottom = Math.max(EDGE_MARGIN_PX, window.innerHeight - FAB_SIZE - EDGE_MARGIN_PX)
    setPos({
      right: Math.min(Math.max(state.startRight - dx, EDGE_MARGIN_PX), maxRight),
      bottom: Math.min(Math.max(state.startBottom - dy, EDGE_MARGIN_PX), maxBottom),
    })
  }

  function handlePointerUp(e: PointerEvent<HTMLAnchorElement>) {
    const state = dragState.current
    if (!state || state.pointerId !== e.pointerId) return
    if (state.dragged) {
      justDraggedRef.current = true
      // 这里不能直接用外层闭包里的pos(可能还是拖拽前那次渲染捕获到的旧值)，用
      // updater函数拿setPos内部最新的state，存的就是刚才松手那一刻真实停在的位置
      setPos((current) => {
        if (current) saveRateFabPosition(current)
        return current
      })
    }
    dragState.current = null
  }

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    if (justDraggedRef.current) {
      // 松手瞬间浏览器会顺带补一次click，这次click不是用户想点进汇率页的意思，拦掉
      justDraggedRef.current = false
      e.preventDefault()
      return
    }
    viewTransitionLinkClick(e, navigate, '/rate')
  }

  return (
    <Link
      ref={elRef}
      to="/rate"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      aria-label={t('rateShortcutAria')}
      className="rate-fab-shell fixed z-40 flex items-center justify-center w-12 h-12 rounded-full active:scale-90 transition-transform"
      style={{
        right: pos ? `${pos.right}px` : DEFAULT_RIGHT_CSS,
        bottom: pos ? `${pos.bottom}px` : DEFAULT_BOTTOM_CSS,
        touchAction: 'none', // 拖拽手势不能被浏览器当成页面滚动/惯性划动来处理
        background: 'color-mix(in srgb, var(--color-surface-container-lowest) 55%, transparent)',
        backdropFilter: 'blur(8px) saturate(140%)',
        WebkitBackdropFilter: 'blur(8px) saturate(140%)',
        // B-XX：确认稿(design-assets/icons/summer-fireworks-icon-effects/final/)里
        // "改成珊瑚红"那版，虚线圆环本身也是珊瑚红，不是只换了光晕颜色——之前漏了
        // 这条虚线边框，只顾着改光晕，真机上圆环还是薄荷绿、跟图标/光晕对不上
        border: `1.5px dashed var(${isSummer ? '--color-primary' : '--color-secondary'})`,
        color: `var(${isSummer ? '--color-primary' : '--color-secondary'})`,
        boxShadow: '0 3px 10px -4px rgba(0,0,0,.3)',
      }}
    >
      {/* B-XX：这个呼吸光晕之前一直用--color-secondary(薄荷绿)——跟"夏 · 花火"图标
          光效整体的珊瑚红色板(--color-primary)不是同一个色源，是真的没对上，不是
          summer主题特意选的薄荷绿；呼吸节奏(rate-fab-breathe关键帧)本身不动，只在
          summer下把颜色来源换成--color-primary，其它主题保持原来的--color-secondary
          不受影响。
          B-XX：渐变末端之前写的是字面量transparent(=透明黑，不是"这个颜色但透明")，
          插值会经过一段发暗发浊的过渡色——真机上珊瑚红这版就是因为这个看起来"一片红"
          糊成一团，不是干净的向外发光。summer下直接写死rgba等值(--color-primary在
          summer下固定是#e85d4a，这个分支只在summer渲染，硬编码没有跨主题风险)；
          非summer分支颜色跟主题走、没法硬编码，改成color-mix(...0%, transparent)让
          "透明"也保持跟起始色同色相、只是alpha到0，规避同样的浑浊过渡 */}
      <span
        className="rate-fab-glow absolute rounded-full pointer-events-none"
        style={{
          inset: -8,
          background: isSummer
            ? 'radial-gradient(circle, rgba(232, 93, 74, 0.45) 0%, rgba(232, 93, 74, 0) 70%)'
            : 'radial-gradient(circle, color-mix(in srgb, var(--color-secondary) 45%, transparent) 0%, color-mix(in srgb, var(--color-secondary) 0%, transparent) 70%)',
        }}
        aria-hidden="true"
      />
      {isSummer ? (
        <AppIcon icon="currency_exchange" size={22} gradient className="relative" />
      ) : (
        <ThemeIcon icon="currency_exchange" className="relative w-6 h-6" style={{ fontSize: 22 }} />
      )}
    </Link>
  )
}
