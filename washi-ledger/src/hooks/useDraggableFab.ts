import { useRef, useState, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from 'react'
import type { FabPosition } from '../lib/fabPosition'

// 松手贴边动画时长——跟AppLayout.tsx其它过渡(0.2s)保持同一节奏
const SNAP_DURATION_MS = 220

/** 悬浮按钮拖拽的通用逻辑——用Pointer Events实现，RateShortcutFab.tsx和
 * MainActionFab.tsx共用同一份，不是各写一份容易走样。核心是靠移动距离区分"轻点"
 * (触发按钮本身的功能，比如跳转/展开)和"拖拽"(挪位置)：移动距离没超过阈值都算轻点，
 * 超过了才算拖拽开始；拖拽松手瞬间浏览器会顺带触发一次click，调用方要在自己的
 * click handler里先调consumeJustDragged()，是true就该拦掉这次click(不执行轻点该做
 * 的事)，不是true才执行正常的轻点逻辑 */
export interface UseDraggableFabOptions {
  /** 按钮本体边长(正方形)，拖拽越界clamp要用到 */
  size: number
  /** 拖拽到底也要跟视口边缘留的空隙，默认6px */
  edgeMargin?: number
  /** 移动距离超过这个才算拖拽开始，默认6px */
  dragThreshold?: number
  loadPosition: () => FabPosition | null
  savePosition: (pos: FabPosition) => void
  /** 刚判定为拖拽(第一次超过阈值)时触发——比如展开态的按钮开始被拖拽时要先收起
   * 子按钮，不然子按钮位置跟主按钮对不上 */
  onDragStart?: () => void
  /** R-XO：参考iOS原生AssistiveTouch的行为——拖拽范围限制在左右两侧边缘(松手自动
   * 贴到最近一侧，不能停在屏幕中间任意位置)，纵向范围避开顶部安全区(状态栏/灵动岛，
   * 用header实际渲染高度动态测量，不是写死一个数字，不同机型安全区高度不一样)。
   * 不传(默认false)维持原来"能停在屏幕任意位置、只挡出屏幕"的自由拖拽行为——
   * RateShortcutFab.tsx这次不改这块，只有MainActionFab.tsx开启 */
  snapToEdge?: boolean
}

/** 拖拽时纵向范围的上边界——不能拖进header底下那截区域(状态栏/灵动岛+header本身)。
 * 现场查DOM量header真实渲染位置，不同机型/是否登录态(header内容不同但高度一般不变)
 * 都能准确反映；查不到header就退回一个保守的默认值，不让拖拽逻辑直接崩掉 */
function measureMinTop(edgeMargin: number): number {
  const header = document.querySelector('[data-app-header]')
  if (header) return header.getBoundingClientRect().bottom + edgeMargin
  return 80
}

export function useDraggableFab<T extends HTMLElement>({
  size,
  edgeMargin = 6,
  dragThreshold = 6,
  loadPosition,
  savePosition,
  onDragStart,
  snapToEdge = false,
}: UseDraggableFabOptions) {
  const [pos, setPos] = useState(loadPosition)
  // 松手贴边那一下需要CSS transition动画(而不是拖拽过程中1:1跟手、不能有过渡延迟)，
  // 这个flag只在贴边动画期间为true，动画结束后自动清掉；调用方据此决定要不要给
  // right/bottom加transition
  const [snapping, setSnapping] = useState(false)
  const elRef = useRef<T | null>(null)
  const dragState = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    startRight: number
    startBottom: number
    dragged: boolean
    minTop: number
  } | null>(null)
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // handlePointerUp里dragState.current就清空了，但click事件是在pointerup之后才触发的
  // (松手那一下会连带补一次click)，得用这个单独的ref把"刚才是拖拽"这个结论带到
  // 调用方的click handler里，不然click里已经看不到dragState了
  const justDraggedRef = useRef(false)

  function onPointerDown(e: ReactPointerEvent<T>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const el = elRef.current
    if (!el) return
    if (snapTimerRef.current != null) {
      clearTimeout(snapTimerRef.current)
      snapTimerRef.current = null
      setSnapping(false)
    }
    const rect = el.getBoundingClientRect()
    dragState.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startRight: window.innerWidth - rect.right,
      startBottom: window.innerHeight - rect.bottom,
      dragged: false,
      minTop: snapToEdge ? measureMinTop(edgeMargin) : edgeMargin,
    }
    el.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: ReactPointerEvent<T>) {
    const state = dragState.current
    if (!state || state.pointerId !== e.pointerId) return
    const dx = e.clientX - state.startClientX
    const dy = e.clientY - state.startClientY
    if (!state.dragged && Math.hypot(dx, dy) < dragThreshold) return
    if (!state.dragged) onDragStart?.()
    state.dragged = true
    const maxRight = Math.max(edgeMargin, window.innerWidth - size - edgeMargin)
    // 纵向下边界维持原来的edgeMargin；上边界(snapToEdge时)按header真实位置换算出的
    // minTop算，同样的道理"bottom值越大越靠上"，bottom不能超过"视口高度-按钮高度-
    // minTop"，不然按钮顶部会跑到minTop这条线以上(header底下那截区域)
    const maxBottom = Math.max(edgeMargin, window.innerHeight - size - state.minTop)
    setPos({
      right: Math.min(Math.max(state.startRight - dx, edgeMargin), maxRight),
      bottom: Math.min(Math.max(state.startBottom - dy, edgeMargin), maxBottom),
    })
  }

  function onPointerUp(e: ReactPointerEvent<T>) {
    const state = dragState.current
    if (!state || state.pointerId !== e.pointerId) return
    if (state.dragged) {
      justDraggedRef.current = true
      // 这里不能直接用外层闭包里的pos(可能还是拖拽前那次渲染捕获到的旧值)，用
      // updater函数拿setPos内部最新的state，存的就是刚才松手那一刻真实停在的位置
      setPos((current) => {
        if (!current) return current
        let final = current
        if (snapToEdge) {
          // 参考AssistiveTouch：松手贴到离得更近的那一侧边缘，不停在屏幕中间。
          // 用按钮中心点X坐标跟视口中线比，不是单纯比较right值本身(right值本身
          // 不直接对应"离哪边更近"，要还原成中心点坐标才准确)
          const centerX = window.innerWidth - current.right - size / 2
          const nearRight = centerX >= window.innerWidth / 2
          const maxRight = Math.max(edgeMargin, window.innerWidth - size - edgeMargin)
          final = { ...current, right: nearRight ? edgeMargin : maxRight }
          setSnapping(true)
          snapTimerRef.current = setTimeout(() => {
            setSnapping(false)
            snapTimerRef.current = null
          }, SNAP_DURATION_MS)
        }
        savePosition(final)
        return final
      })
    }
    dragState.current = null
  }

  // 防御性兜底：MainActionFab目前挂在<main>可滚动容器内部，触摸事件默认会往上冒泡到
  // <main>上usePullToRefresh挂的原生touchstart/touchmove监听器——哪怕这个按钮本身
  // 已经touchAction:none挡住了浏览器把这次触摸识别成页面滚动，事件本身还是会冒泡，
  // 下拉刷新那边一样会被同一根手指的下滑触发，两套手势打架。在这里(而不是逐个调用方)
  // 统一挡掉冒泡，不管这个按钮实际挂在DOM哪个位置，都不会被祖先元素的手势监听器
  // 误伤——这是防御性的，跟"把MainActionFab挪到<main>外面"这个根治方案叠加，不是
  // 互相替代
  function stopTouchPropagation(e: ReactTouchEvent<T>) {
    e.stopPropagation()
  }

  function consumeJustDragged(): boolean {
    if (justDraggedRef.current) {
      justDraggedRef.current = false
      return true
    }
    return false
  }

  return {
    pos,
    snapping,
    elRef,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onTouchStart: stopTouchPropagation,
      onTouchMove: stopTouchPropagation,
    },
    consumeJustDragged,
  }
}
