import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { FabPosition } from '../lib/fabPosition'

// 松手贴边动画时长——跟AppLayout.tsx其它过渡(0.2s)保持同一节奏
const SNAP_DURATION_MS = 220

/** 悬浮按钮拖拽的通用逻辑——用Pointer Events实现，RateShortcutFab.tsx和
 * MainActionFab.tsx共用同一份，不是各写一份容易走样。核心是靠移动距离区分"轻点"
 * (触发按钮本身的功能，比如跳转/展开)和"拖拽"(挪位置)：移动距离没超过阈值都算轻点，
 * 超过了才算拖拽开始。
 *
 * R-XO：真机反馈MainActionFab"点第一下没反应，要点第二下才生效"——排查是
 * setPointerCapture+touchAction:none+(曾经加过的)触摸事件阻止冒泡这几个机制叠加
 * 的场景下，iOS WKWebView合成click事件的时机不总是可靠，偶发延迟或者干脆没触发。
 * 改成不依赖浏览器额外合成的click事件：pointerup那一刻已经能确定这次是不是拖拽，
 * 是"轻点"就直接调用onTap，不用等click。consumeJustTapped()是给调用方仍然保留的
 * onClick handler用的(键盘Enter/Space激活这类没有对应pointer事件序列的场景还是要
 * 走click这条路)——click触发时先检查是不是刚才pointerup已经处理过的同一次轻点，
 * 是的话跳过，不然会一次轻点触发两次(pointerup调一次onTap，随后合成的click又调
 * 一次调用方自己的逻辑，两次叠加等于抵消/出现两次副作用)。
 * consumeJustDragged()同理，是拖拽的话调用方click handler要跳过(比如RateShortcutFab
 * 这种真实<a>链接，拖拽松手不该触发导航跳转)。
 *
 * 曾经加过的touchstart/touchmove阻止冒泡防御性代码已经去掉——两个调用方现在都渲染
 * 在<main>之外(不再是下拉刷新手势容器的DOM子节点)，这层防御已经没有实际作用，
 * 反而可能是"需要点两下"这个问题的来源之一，一并清理 */
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
  /** 松手判定为"轻点"(没有触发拖拽)时，在pointerup里直接调用——不等待浏览器
   * 另外合成一次click事件，见上方文件头说明。可选：RateShortcutFab.tsx是真实
   * <a>链接，点击涉及修饰键判断(cmd/ctrl+点击新开标签页这类原生语义)，继续用
   * 自己的onClick+consumeJustDragged()，不传这个 */
  onTap?: () => void
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
  onTap,
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
  // (松手那一下会连带补一次click)，得用这两个单独的ref把"刚才pointerup已经处理过
  // 拖拽/轻点"这个结论带到调用方自己的click handler里，不然click里已经看不到
  // dragState了，也不知道该不该跳过(避免同一次操作被处理两遍)
  const justDraggedRef = useRef(false)
  const justTappedRef = useRef(false)

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
    } else {
      // 轻点：不等浏览器另外合成click，这一刻就确定了是轻点，直接触发
      justTappedRef.current = true
      onTap?.()
    }
    dragState.current = null
  }

  // pointercancel是手势被中途打断(比如系统弹了个提示/来电)，不是用户正常完成了一次
  // 点击——只清状态，不能当成onPointerUp处理，不然会误触发onTap(之前这里直接复用
  // onPointerUp，被打断的手势也会被判定成"轻点"触发一次操作，是个真实bug)
  function onPointerCancel(e: ReactPointerEvent<T>) {
    const state = dragState.current
    if (!state || state.pointerId !== e.pointerId) return
    dragState.current = null
  }

  function consumeJustDragged(): boolean {
    if (justDraggedRef.current) {
      justDraggedRef.current = false
      return true
    }
    return false
  }

  function consumeJustTapped(): boolean {
    if (justTappedRef.current) {
      justTappedRef.current = false
      return true
    }
    return false
  }

  return {
    pos,
    snapping,
    elRef,
    bind: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    consumeJustDragged,
    consumeJustTapped,
  }
}
