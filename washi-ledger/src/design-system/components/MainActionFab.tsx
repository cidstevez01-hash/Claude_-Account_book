import { useLayoutEffect, useState } from 'react'
import { useDraggableFab } from '../../hooks/useDraggableFab'
import { useKeyboardInset } from '../../hooks/useKeyboardInset'
import { useSettings } from '../../hooks/useSettings'
import { loadMainFabPosition, saveMainFabPosition } from '../../lib/mainFabPosition'

/** R-XX：新建"+"和汇率快捷入口合并成一个可拖拽展开的悬浮按钮——参考Material Design
 * 的Speed Dial模式(很多App的"+"发布按钮都是这个路子：收起态一个圆按钮，点开在
 * 旁边弹出几个更小的子按钮，点遮罩/子按钮/再点一次主按钮收起)。目前只在仪表盘用
 * (原来的"+"按钮和RateShortcutFab都只在仪表盘同时出现过，明细/统计/我的账户三个
 * 页面只有汇率按钮单独存在，暂不动，见AppLayout.tsx的hideRateFab说明)，但按通用
 * 组件设计——传入actions数组，以后要在其它页面也用这套合并按钮(或者要加第三个
 * 动作)，直接改调用方传的actions就行，不用改这个组件内部逻辑。
 *
 * 拖拽逻辑跟RateShortcutFab.tsx共用同一份(hooks/useDraggableFab.ts)，这个按钮额外
 * 开启了snapToEdge(参考iOS原生AssistiveTouch)：纵向拖拽范围避开顶部安全区，松手
 * 自动贴到最近一侧边缘，不能停在屏幕中间任意位置；z-index提到55(比底部导航栏50
 * 还高)，保证不会被常规页面元素挡住点不到。
 *
 * 展开方向(往上/往下弹出子按钮)是展开那一刻现测主按钮的真实DOM位置算的，不是写死
 * "永远往上"——按钮被拖到屏幕上半部分时，往上展开会被顶到状态栏外面去，这时候要
 * 改成往下展开；子按钮固定跟主按钮同一条水平线(同一个right值)、按固定间距上下
 * 堆叠，结构上就不会互相重叠，不需要额外做碰撞检测。
 *
 * 子按钮的虚线边框+呼吸光晕样式照抄RateShortcutFab.tsx现有的真实实现(不是重新
 * 设计一套)——真机反馈过之前这里图省事写了一套`border-outline-variant`实线灰边、
 * 完全没有发光层的简化样式，跟App其它悬浮按钮的视觉语言不一致。收起态主按钮维持
 * 原来"+"按钮自己的样式(bg-primary+stamp-shadow压印投影)不变，这部分没有被反馈
 * 为问题，不在这次调整范围内。 */

export interface MainFabAction {
  key: string
  icon: string
  ariaLabel: string
  onActivate: () => void
}

interface MainActionFabProps {
  icon: string
  ariaLabel: string
  actions: MainFabAction[]
}

const FAB_SIZE = 58
const SUB_SIZE = 48
const GAP = 16
// 展开方向判断时视口边缘留的安全余量——比useDraggableFab拖拽clamp用的6px大，因为
// 要保证一整排子按钮都落在可视区域内，不是只保证主按钮本身不贴死边缘
const EDGE_SAFETY = 16

const DEFAULT_RIGHT_CSS = 'max(20px, calc(50% - 240px + 20px))'
const DEFAULT_BOTTOM_CSS = 'calc(6rem + 24px)'

interface SubLayout {
  /** 每个子按钮的bottom偏移(px，跟主按钮同一套"距视口底部距离"坐标系) */
  bottoms: number[]
}

export function MainActionFab({ icon, ariaLabel, actions }: MainActionFabProps) {
  const { settings } = useSettings()
  const isSummer = settings.themeSkin === 'summer'
  const keyboardOpen = useKeyboardInset() > 0
  const [expanded, setExpanded] = useState(false)
  const [subLayout, setSubLayout] = useState<SubLayout | null>(null)
  // 子按钮弹出的入场动画开关——跟subLayout分开一个state：subLayout要在展开那一刻
  // 就用useLayoutEffect同步算好最终位置(避免先出现在错误位置再跳过去这种闪烁)，
  // 但入场动画需要"先挂载在起始态、下一帧再切到目标态"才能被CSS transition插值，
  // 两者时机不一样，不能合并成一个state
  const [subVisible, setSubVisible] = useState(false)

  const { pos, snapping, elRef, bind, consumeJustDragged, consumeJustTapped } = useDraggableFab<HTMLButtonElement>({
    size: FAB_SIZE,
    loadPosition: loadMainFabPosition,
    savePosition: saveMainFabPosition,
    // 正在展开的状态下开始拖拽主按钮，子按钮位置会跟主按钮当前位置对不上(子按钮
    // 是展开那一刻算好定住的，不会跟着拖拽实时重算)，直接先收起，只留主按钮跟手动
    onDragStart: () => setExpanded(false),
    // 参考iOS AssistiveTouch：只能停在左右两侧边缘、纵向避开顶部安全区，不是能
    // 停在屏幕任意位置(RateShortcutFab.tsx保持原样，没开这个)
    snapToEdge: true,
    // R-XO：真机反馈"点第一下没反应，要点第二下"——不再靠浏览器合成的click事件，
    // pointerup里判定是轻点就直接展开/收起，见useDraggableFab.ts文件头说明
    onTap: () => setExpanded((v) => !v),
  })

  // 键盘弹出时整组收起隐藏(见下方style)，收起态就没必要保留展开内容，避免键盘
  // 收起后突然又冒出一组来历不明的子按钮
  useLayoutEffect(() => {
    if (keyboardOpen) setExpanded(false)
  }, [keyboardOpen])

  // 展开那一刻现测主按钮真实DOM位置，算子按钮该往上还是往下弹、具体bottom值——
  // 不在渲染体里算(拿不到还没提交到DOM的真实rect)，用useLayoutEffect在浏览器画下
  // 一帧之前同步算完最终位置；入场动画(scale+opacity)另外用requestAnimationFrame
  // 隔一帧触发，让CSS transition真的有"起点值→终点值"可以插值
  useLayoutEffect(() => {
    if (!expanded) {
      setSubLayout(null)
      setSubVisible(false)
      return
    }
    const el = elRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const mainBottom = window.innerHeight - rect.bottom
    const needed = actions.length * SUB_SIZE + actions.length * GAP
    const spaceAbove = rect.top - EDGE_SAFETY
    const spaceBelow = window.innerHeight - rect.bottom - EDGE_SAFETY
    const direction: 'up' | 'down' =
      spaceAbove >= needed ? 'up' : spaceBelow >= needed ? 'down' : spaceAbove >= spaceBelow ? 'up' : 'down'

    const bottoms: number[] = []
    let cursor = direction === 'up' ? mainBottom + FAB_SIZE + GAP : mainBottom - GAP - SUB_SIZE
    for (let i = 0; i < actions.length; i++) {
      bottoms.push(cursor)
      cursor += direction === 'up' ? SUB_SIZE + GAP : -(SUB_SIZE + GAP)
    }
    setSubLayout({ bottoms })
    setSubVisible(false)
    const raf = requestAnimationFrame(() => setSubVisible(true))
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded])

  function handleClick() {
    if (consumeJustDragged()) return
    // pointerup已经通过onTap处理过这次轻点了，这次click是它自然的后续，不能再
    // 展开/收起一次(不然一次轻点等于toggle两次，视觉上跟"没反应"一样)——只有
    // 键盘Enter/Space这类没有对应pointer事件序列触发的click才会走到下面这行
    if (consumeJustTapped()) return
    setExpanded((v) => !v)
  }

  const rightCss = pos ? `${pos.right}px` : DEFAULT_RIGHT_CSS
  const bottomCss = pos ? `${pos.bottom}px` : DEFAULT_BOTTOM_CSS
  // 松手贴边那一下才需要right的过渡动画，拖拽过程中(snapping为false)要1:1跟手，
  // 不能有transition延迟——跟keyboardOpen那部分transform/opacity的过渡是各自独立的
  const positionTransition = snapping ? 'right 0.22s ease, ' : ''

  return (
    <>
      {expanded && (
        <div
          className="fixed inset-0 z-[54] bg-inverse-surface/30 backdrop-blur-[1px] transition-opacity"
          onClick={() => setExpanded(false)}
          aria-hidden="true"
        />
      )}

      {expanded &&
        subLayout &&
        actions.map((action, i) => (
          <button
            key={action.key}
            type="button"
            aria-label={action.ariaLabel}
            onClick={() => {
              setExpanded(false)
              action.onActivate()
            }}
            className="fixed z-[55] flex items-center justify-center rounded-full"
            style={{
              width: SUB_SIZE,
              height: SUB_SIZE,
              right: rightCss,
              bottom: `${subLayout.bottoms[i]}px`,
              background: 'color-mix(in srgb, var(--color-surface-container-lowest) 55%, transparent)',
              backdropFilter: 'blur(8px) saturate(140%)',
              WebkitBackdropFilter: 'blur(8px) saturate(140%)',
              border: `1.5px dashed var(${isSummer ? '--color-primary' : '--color-secondary'})`,
              color: `var(${isSummer ? '--color-primary' : '--color-secondary'})`,
              boxShadow: '0 3px 10px -4px rgba(0,0,0,.3)',
              transform: subVisible ? 'scale(1)' : 'scale(0.5)',
              opacity: subVisible ? 1 : 0,
              transitionProperty: 'transform, opacity',
              transitionDuration: '0.18s',
              transitionDelay: `${i * 0.03}s`,
              transitionTimingFunction: 'ease',
            }}
          >
            {/* 同一份呼吸光晕实现照抄RateShortcutFab.tsx的.rate-fab-glow——渐变末端
                写死rgba到0而不是字面量transparent(浑浊过渡色那个坑，见
                RateShortcutFab.tsx的详细说明)，不重新踩一遍 */}
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
            <span className="material-symbols-outlined text-2xl relative">{action.icon}</span>
          </button>
        ))}

      <button
        ref={elRef}
        type="button"
        aria-label={ariaLabel}
        onClick={handleClick}
        {...bind}
        className="stamp-shadow fixed z-[55] flex items-center justify-center w-[58px] h-[58px] rounded-full bg-primary text-fab-icon active:scale-90"
        style={{
          right: rightCss,
          bottom: bottomCss,
          touchAction: 'none',
          transform: keyboardOpen ? 'translateY(150%)' : undefined,
          opacity: keyboardOpen ? 0 : 1,
          pointerEvents: keyboardOpen ? 'none' : undefined,
          transition: `${positionTransition}transform 0.2s ease, opacity 0.2s ease`,
          boxShadow: 'var(--shadow-main-fab, 0 4px 0 var(--color-primary-container))',
        }}
      >
        <span
          className="material-symbols-outlined text-3xl"
          style={{
            display: 'inline-block',
            transform: expanded ? 'rotate(45deg)' : undefined,
            transition: 'transform 0.2s ease',
          }}
        >
          {icon}
        </span>
      </button>
    </>
  )
}
