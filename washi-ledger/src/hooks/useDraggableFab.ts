import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { FabPosition } from '../lib/fabPosition'

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
}

export function useDraggableFab<T extends HTMLElement>({
  size,
  edgeMargin = 6,
  dragThreshold = 6,
  loadPosition,
  savePosition,
  onDragStart,
}: UseDraggableFabOptions) {
  const [pos, setPos] = useState(loadPosition)
  const elRef = useRef<T | null>(null)
  const dragState = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    startRight: number
    startBottom: number
    dragged: boolean
  } | null>(null)
  // handlePointerUp里dragState.current就清空了，但click事件是在pointerup之后才触发的
  // (松手那一下会连带补一次click)，得用这个单独的ref把"刚才是拖拽"这个结论带到
  // 调用方的click handler里，不然click里已经看不到dragState了
  const justDraggedRef = useRef(false)

  function onPointerDown(e: ReactPointerEvent<T>) {
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

  function onPointerMove(e: ReactPointerEvent<T>) {
    const state = dragState.current
    if (!state || state.pointerId !== e.pointerId) return
    const dx = e.clientX - state.startClientX
    const dy = e.clientY - state.startClientY
    if (!state.dragged && Math.hypot(dx, dy) < dragThreshold) return
    if (!state.dragged) onDragStart?.()
    state.dragged = true
    const maxRight = Math.max(edgeMargin, window.innerWidth - size - edgeMargin)
    const maxBottom = Math.max(edgeMargin, window.innerHeight - size - edgeMargin)
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
        if (current) savePosition(current)
        return current
      })
    }
    dragState.current = null
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
    elRef,
    bind: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
    consumeJustDragged,
  }
}
