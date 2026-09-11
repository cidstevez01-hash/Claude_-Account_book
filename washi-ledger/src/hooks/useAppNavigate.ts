import { useNavigate, type NavigateOptions, type To } from 'react-router-dom'
import { flushSync } from 'react-dom'
import type { MouseEvent } from 'react'

/** 页面跳转的"一跳一跳"根因排查后确认：RouteFade.tsx之前靠location.pathname当key
 * 逼React重新挂载整层节点——路由一变，旧页面这个节点在同一帧里被直接卸载销毁，
 * 新页面节点从opacity:0开始单独淡入。旧页面是"瞬间消失"不是"淡出"，新旧动画完全
 * 没有重叠，效果是"瞬间切到背景→再淡入新页面"，感觉上就是硬跳一下再补一个淡入，
 * 不是参考App那种新旧内容同时存在、真正交叉淡出淡入的连续感。
 *
 * 改用浏览器原生View Transitions API(document.startViewTransition)：它会自动截取
 * "旧DOM状态"和"新DOM状态"两张快照做交叉淡入淡出，不需要我们手动维护"同时挂载
 * 新旧两份内容"这套state。这个API不支持的机型(较老iOS WebKit)会自动跳过、直接
 * 执行传入的回调，不会报错——那种情况退回RouteFade.tsx自己的渐显兜底(见那边)。
 *
 * flushSync：startViewTransition要求"旧DOM状态"和"新DOM状态"这两张快照之间的DOM
 * 变化必须同步完成——React默认的setState是批量/异步生效的，不flushSync的话浏览器
 * 会在React真正把新一帧提交到屏幕之前就把"新状态"快照拍早了，看到的还是旧内容，
 * 交叉淡出淡入就不会生效。
 *
 * 保持返回函数签名跟useNavigate()原生的一致(navigate(to)/navigate(-1)都直接能用)，
 * 全站所有调用点只需要把import的useNavigate换成这个，不用改任何调用代码本身。 */
export function useAppNavigate() {
  const navigate = useNavigate()
  return (to: To | number, options?: NavigateOptions) => {
    const run = () => {
      if (typeof to === 'number') navigate(to)
      else navigate(to, options)
    }
    if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function') {
      run()
      return
    }
    document.startViewTransition(() => flushSync(run))
  }
}

/** 给<Link>/<NavLink>这类声明式跳转用——默认点击会走react-router自己的history
 * push，不经过上面这套View Transition包装。拦下普通左键点击(不拦截修饰键点击，
 * 保留浏览器原生"新开标签页"这类行为的语义，虽然Capacitor WebView里基本用不上，
 * 但保留是无害的标准做法)，改成手动调用上面的appNavigate完成跳转。 */
export function viewTransitionLinkClick(
  e: MouseEvent<HTMLAnchorElement>,
  appNavigate: ReturnType<typeof useAppNavigate>,
  to: string
) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  appNavigate(to)
}
