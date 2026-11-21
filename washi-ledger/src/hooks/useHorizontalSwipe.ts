import { useRef, type MouseEvent, type PointerEvent } from 'react'

/** 日历共用横向手势，竖向移动交给页面滚动。 */
export function useHorizontalSwipe(onSwipe: (direction: 'previous' | 'next') => void) {
  const start = useRef<{ id: number; x: number; y: number } | null>(null)
  const ignoreClickUntil = useRef(0)

  function onPointerDown(event: PointerEvent) {
    // 新的一次按下代表真实点击，不能被上一次滑动的合成 click 保护误拦。
    ignoreClickUntil.current = 0
    start.current = event.isPrimary && event.button === 0
      ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null
  }

  function onPointerUp(event: PointerEvent) {
    const origin = start.current
    start.current = null
    if (!origin || origin.id !== event.pointerId) return
    const dx = event.clientX - origin.x
    const dy = event.clientY - origin.y
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    ignoreClickUntil.current = performance.now() + 300
    onSwipe(dx < 0 ? 'next' : 'previous')
  }

  function onClickCapture(event: MouseEvent) {
    if (event.detail === 0 || performance.now() >= ignoreClickUntil.current) return
    ignoreClickUntil.current = 0
    event.preventDefault()
    event.stopPropagation()
  }

  return {
    onPointerDown,
    onPointerUp,
    onPointerCancel: () => { start.current = null },
    onClickCapture,
    style: { touchAction: 'pan-y' as const },
  }
}
