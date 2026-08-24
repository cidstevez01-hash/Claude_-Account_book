import { useEffect, useRef, useState } from 'react'

const PULL_THRESHOLD = 64 // 松手触发刷新的临界距离(px)
const MAX_PULL = 88 // 视觉上允许拉出的最大距离，超过后阻尼拉满不再继续跟手
const RESISTANCE = 0.55 // 手指划动距离按这个系数打折换算成实际下拉距离，制造"拉纸有阻力"的手感

/** 下拉刷新(R-17)——挂在AppLayout的<main>滚动容器上，只在scrollTop===0时才开始追踪
 * 手指下滑距离，避免跟正常向下滚动内容冲突。原生addEventListener而不是React的
 * onTouchMove(合成事件)：React从17开始touchmove默认走passive监听器，
 * preventDefault()会被忽略/报警告，这里下拉时需要真的preventDefault()挡住iOS
 * WKWebView自己的橡皮筋回弹，不然会跟这个自定义指示器的动画同时出现，两层视觉打架。 */
export function usePullToRefresh<T extends HTMLElement>(onRefresh: (() => Promise<void>) | undefined) {
  const containerRef = useRef<T | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el || !onRefresh) return

    let startY: number | null = null
    let isRefreshing = false

    function onTouchStart(e: TouchEvent) {
      if (isRefreshing || !el || el.scrollTop > 0) return
      startY = e.touches[0].clientY
    }

    function onTouchMove(e: TouchEvent) {
      if (startY == null || isRefreshing || !el) return
      // 拉到一半松手又反手往上滑回正常滚动：容器已经不在顶部了，说明这是一次正常
      // 滚动而不是下拉手势，放弃追踪，让浏览器原生滚动接管
      if (el.scrollTop > 0) {
        startY = null
        setDragging(false)
        setPullDistance(0)
        return
      }
      const delta = e.touches[0].clientY - startY
      if (delta <= 0) {
        setDragging(false)
        setPullDistance(0)
        return
      }
      e.preventDefault()
      setDragging(true)
      setPullDistance(Math.min(MAX_PULL, delta * RESISTANCE))
    }

    function onTouchEnd() {
      if (startY == null) return
      startY = null
      setDragging(false)
      setPullDistance((current) => {
        if (current >= PULL_THRESHOLD) {
          isRefreshing = true
          setRefreshing(true)
          onRefresh!().finally(() => {
            isRefreshing = false
            setRefreshing(false)
            setPullDistance(0)
          })
          return PULL_THRESHOLD
        }
        return 0
      })
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [onRefresh])

  return { containerRef, pullDistance, refreshing, dragging, threshold: PULL_THRESHOLD }
}
