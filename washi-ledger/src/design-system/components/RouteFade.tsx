import { useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

/** 路由切换入场渐显——见index.css的.route-fade。用location.pathname当key，逼
 * React在路由变化时把这一层当成全新节点重新挂载，天然触发一次CSS入场动画，不需要
 * 额外状态机/动画库。
 * 只包"页面内容"本身(header+可滚动内容区这类)，不要包BottomNav/RateShortcutFab/
 * NavDrawer这类应该感觉持续存在、不随页面切换重新出现的常驻元素——会跟它们自己的
 * 动画打架(见AppLayout.tsx的说明，B-48续排过这个坑)。也不要包各页面自己另外用
 * position:fixed贴在视口上的浮层(仪表盘"记一笔"FAB、记一笔页底部保存条这类)，
 * 只做opacity渐显不做transform——纯opacity不会有containing block副作用，加
 * transform会让这层变成内部fixed后代的新containing block，把它们的定位基准从
 * 视口错误地换成这一层
 *
 * B-XX：这层key remount+CSS渐显是"旧页面瞬间消失、新页面单独淡入"，没有真正的
 * 交叉淡出淡入(根因见useAppNavigate.ts的说明)——支持View Transitions API的机型
 * 现在全站导航都走useAppNavigate()，会由浏览器自己做真正的新旧内容交叉淡出淡入，
 * 这层key remount+.route-fade反而会跟浏览器原生那套动画打架(两层动画叠加，比
 * 单独一层更抖)，所以支持VT的机型这里直接跳过，什么都不做、只透传children。
 * 不支持VT的机型(较老iOS WebKit)保留原来的key remount+渐显当兜底，好歹有个
 * 过渡效果，不是硬切 */
const supportsViewTransition = typeof document !== 'undefined' && typeof document.startViewTransition === 'function'

export function RouteFade({ children, className }: { children: ReactNode; className?: string }) {
  const location = useLocation()
  if (supportsViewTransition) {
    return <div className={className}>{children}</div>
  }
  return (
    <div key={location.pathname} className={`route-fade ${className ?? ''}`}>
      {children}
    </div>
  )
}
