import { useLayoutEffect, useRef, type ReactNode } from 'react'

interface ScrollLegendListProps {
  children: ReactNode
  /** 超过这个行数才出现内部滚动，默认5——照旧仓库index.html「图例超过5条会出现内部
   * 滚动」的真实规则 */
  maxVisibleRows?: number
  /** 单行大致高度(px)，用来算`maxVisibleRows`行对应的max-height。新App各处图例行内边距/
   * 字号跟旧App不完全一样，这里给的是照实际markup估的近似值，不是量出来的精确值——沙盒里
   * 没法跑真机/浏览器逐像素核对，如果视觉上5行没卡准可以再调这个数字。 */
  rowHeight?: number
}

/** 图例超过5行出现内部滚动，iOS原生滚动指示条松手就淡出、不常驻，所以自己画一条
 * 极细的常驻滚动条(位置/高度跟着scrollTop/scrollHeight/clientHeight实时算)，逻辑照
 * 旧仓库index.html的updateLegendScrollThumb()搬：没有可滚动内容(条目数在5行以内)
 * 就整条隐藏，不占地方。
 *
 * 滚动条的位置/高度直接用ref写DOM style，不经过React state——旧版用useState存这几个
 * 数值，每次重算都new一个对象传给setState，即使数值没变也会触发重渲染，而重渲染又会
 * 让下面这个没有依赖数组的useLayoutEffect再跑一次、再setState一次，死循环触发React
 * "Maximum update depth exceeded"直接崩溃卸载整棵树——这是真机上"数据闪一下又白屏"的
 * 真实根因(图例条目数一旦超过5行、进入需要显示滚动条的分支就会必现)。改成ref直接写
 * style就没有这个循环了：DOM测量→写样式是纯副作用，不经过React重渲染这条路径。
 *
 * 数据源整体切换(比如切换支出/收入、切换统计维度)要滚回顶部，同一批数据被动刷新
 * (内容没变只是重渲染)要保留原有滚动位置——这条区分交给调用方处理：数据源切换时
 * 给这个组件一个新的`key`，让它重新挂载(滚动位置自然回到顶部)；不传新key的情况下
 * React会保留同一个DOM节点，滚动位置自然不受重渲染影响，不用这个组件内部额外记录。 */
export function ScrollLegendList({ children, maxVisibleRows = 5, rowHeight = 34 }: ScrollLegendListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)

  function recomputeThumb() {
    const el = scrollRef.current
    const thumb = thumbRef.current
    if (!el || !thumb) return
    const maxScroll = el.scrollHeight - el.clientHeight
    if (maxScroll <= 1) {
      thumb.style.display = 'none'
      return
    }
    const trackH = el.clientHeight
    const thumbH = Math.max(20, (trackH * trackH) / el.scrollHeight)
    const thumbTop = (trackH - thumbH) * (el.scrollTop / maxScroll)
    thumb.style.display = 'block'
    thumb.style.height = `${thumbH}px`
    thumb.style.top = `${thumbTop}px`
  }

  // 没有依赖数组、每次渲染后都重算——图例条目数变了(比如后台补数据)也要跟着更新，
  // 跟旧App「每次图例内容重新渲染都要调用一次」的要求一致。这里是安全的：内部是直接
  // 写DOM style，不触发state更新，不会像上面注释里说的旧版本那样死循环
  useLayoutEffect(() => {
    recomputeThumb()
  })

  return (
    <div className="relative w-full pr-3">
      <div
        ref={scrollRef}
        onScroll={recomputeThumb}
        className="overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ maxHeight: rowHeight * maxVisibleRows }}
      >
        {children}
      </div>
      <div
        ref={thumbRef}
        className="absolute right-0 w-[3px] rounded-full bg-outline/70 pointer-events-none"
        style={{ display: 'none' }}
      />
    </div>
  )
}
