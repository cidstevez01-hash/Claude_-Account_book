import { useLayoutEffect, useState } from 'react'
import { useDraggableFab } from '../../hooks/useDraggableFab'
import { useKeyboardInset } from '../../hooks/useKeyboardInset'
import { loadMainFabPosition, saveMainFabPosition } from '../../lib/mainFabPosition'

/** R-XX：新建"+"和汇率快捷入口合并成一个可拖拽展开的悬浮按钮——参考Material Design
 * 的Speed Dial模式(很多App的"+"发布按钮都是这个路子：收起态一个圆按钮，点开在
 * 旁边弹出几个更小的子按钮，点遮罩/子按钮/再点一次主按钮收起)。目前只在仪表盘用
 * (原来的"+"按钮和RateShortcutFab都只在仪表盘同时出现过，明细/统计/我的账户三个
 * 页面只有汇率按钮单独存在，暂不动，见AppLayout.tsx的hideRateFab说明)，但按通用
 * 组件设计——传入actions数组，以后要在其它页面也用这套合并按钮(或者要加第三个
 * 动作)，直接改调用方传的actions就行，不用改这个组件内部逻辑。
 *
 * 拖拽逻辑跟RateShortcutFab.tsx共用同一份(hooks/useDraggableFab.ts)。展开方向
 * (往上/往下弹出子按钮)是展开那一刻现测主按钮的真实DOM位置算的，不是写死"永远往
 * 上"——按钮被拖到屏幕上半部分时，往上展开会被顶到状态栏外面去，这时候要改成往下
 * 展开；子按钮固定跟主按钮同一条水平线(同一个right值)、按固定间距上下堆叠，结构上
 * 就不会互相重叠，不需要额外做碰撞检测。 */

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
  const keyboardOpen = useKeyboardInset() > 0
  const [expanded, setExpanded] = useState(false)
  const [subLayout, setSubLayout] = useState<SubLayout | null>(null)
  // 子按钮弹出的入场动画开关——跟subLayout分开一个state：subLayout要在展开那一刻
  // 就用useLayoutEffect同步算好最终位置(避免先出现在错误位置再跳过去这种闪烁)，
  // 但入场动画需要"先挂载在起始态、下一帧再切到目标态"才能被CSS transition插值，
  // 两者时机不一样，不能合并成一个state
  const [subVisible, setSubVisible] = useState(false)

  const { pos, elRef, bind, consumeJustDragged } = useDraggableFab<HTMLButtonElement>({
    size: FAB_SIZE,
    loadPosition: loadMainFabPosition,
    savePosition: saveMainFabPosition,
    // 正在展开的状态下开始拖拽主按钮，子按钮位置会跟主按钮当前位置对不上(子按钮
    // 是展开那一刻算好定住的，不会跟着拖拽实时重算)，直接先收起，只留主按钮跟手动
    onDragStart: () => setExpanded(false),
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
    setExpanded((v) => !v)
  }

  const rightCss = pos ? `${pos.right}px` : DEFAULT_RIGHT_CSS
  const bottomCss = pos ? `${pos.bottom}px` : DEFAULT_BOTTOM_CSS

  return (
    <>
      {expanded && (
        <div
          className="fixed inset-0 z-40 bg-inverse-surface/30 backdrop-blur-[1px] transition-opacity"
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
            className="stamp-shadow fixed z-40 flex items-center justify-center rounded-full bg-surface text-primary border-[1.5px] border-outline-variant"
            style={{
              width: SUB_SIZE,
              height: SUB_SIZE,
              right: rightCss,
              bottom: `${subLayout.bottoms[i]}px`,
              transform: subVisible ? 'scale(1)' : 'scale(0.5)',
              opacity: subVisible ? 1 : 0,
              transition: `transform 0.18s ease ${i * 0.03}s, opacity 0.18s ease ${i * 0.03}s`,
            }}
          >
            <span className="material-symbols-outlined text-2xl">{action.icon}</span>
          </button>
        ))}

      <button
        ref={elRef}
        type="button"
        aria-label={ariaLabel}
        onClick={handleClick}
        {...bind}
        className="stamp-shadow fixed z-40 flex items-center justify-center w-[58px] h-[58px] rounded-full bg-primary text-fab-icon active:scale-90"
        style={{
          right: rightCss,
          bottom: bottomCss,
          touchAction: 'none',
          transform: keyboardOpen ? 'translateY(150%)' : undefined,
          opacity: keyboardOpen ? 0 : 1,
          pointerEvents: keyboardOpen ? 'none' : undefined,
          transition: 'transform 0.2s ease, opacity 0.2s ease',
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
