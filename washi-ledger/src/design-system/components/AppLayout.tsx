import type { ReactNode, RefObject } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { NavDrawer } from './NavDrawer'
import { CloudDisconnectBanner } from './CloudDisconnectBanner'
import { APP_ICONS } from '../../lib/appIcons'
import { useI18n } from '../../lib/i18n'
import { useDrawer } from '../../hooks/useDrawer'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'

interface AppLayoutProps {
  title: string
  children: ReactNode
  /** 左上角按钮：'menu'(默认，点开抽屉导航)/'home'(小房子，直接跳回仪表盘，不带
   * 抽屉——我的账户页用这个，不需要再从这里进抽屉)/'back'(返回箭头，R-18：汇率换算/
   * 设置/about这三个从抽屉进来的子页面用这个——同时隐藏底部导航栏、右上角账户按钮、
   * 不渲染抽屉本身，跟"主页面"(仪表盘/明细/统计/我的账户)视觉上区分成两层) */
  leftButton?: 'menu' | 'home' | 'back'
  /** 下拉刷新(R-17)——只有传了这个才会启用手势监听/显示指示器，不传就是原来的普通
   * 页面(比如"我的账户"/"设置"这类没有"重新拉取数据"这个概念的页面)。四个大页面
   * (仪表盘/明细/统计/汇率换算)各自传自己的数据刷新函数，必须返回Promise——指示器
   * 转圈圈状态靠这个Promise什么时候resolve来收起，不是定时器估算 */
  onRefresh?: () => Promise<void>
  /** 明细页记忆筛选/滚动位置(B-12后续需求)要拿到真正在滚动的<main>节点自己读写
   * scrollTop——这个节点是AppLayout内部usePullToRefresh的containerRef，页面组件
   * 本来碰不到，通过这个可选prop把同一个DOM节点也同步给调用方 */
  mainRef?: RefObject<HTMLElement | null>
}

export function AppLayout({ title, children, leftButton = 'menu', onRefresh, mainRef }: AppLayoutProps) {
  // R-18：抽屉展开状态改用跨路由共享的Context(见useDrawer.tsx)，不再是这个组件的
  // 本地state——汇率换算/设置/about这几个"从抽屉进来的子页面"各自有自己独立的
  // AppLayout实例(不同路由页面，不是同一个组件实例)，返回上一页时要"记得"抽屉当时
  // 是展开的，本地state做不到这一点(实例卸载就清空了)
  const { open: drawerOpen, setOpen: setDrawerOpen } = useDrawer()
  const navigate = useNavigate()
  const { t } = useI18n()
  const { containerRef, pullDistance, refreshing, dragging, threshold } = usePullToRefresh<HTMLElement>(onRefresh)
  const isSubpage = leftButton === 'back'

  return (
    <div
      className="fixed inset-0 mx-auto max-w-[480px] flex flex-col bg-surface overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* B-08：paper-grid-bg之前贴在这个根容器上，顶部安全区(header上方那一小条，
          没有header遮住)会透出方格纹理，跟正下方header的纯色bg-surface不一致，看起来
          像缺了一块。改成只贴在真正的内容滚动区(main)上，根容器/header都保持纯色，
          这样安全区跟header视觉一致 */}
      <header className="flex items-center justify-between px-md h-16 w-full shrink-0 bg-surface border-b-[1.5px] border-dashed border-outline-variant">
        {leftButton === 'menu' ? (
          <button
            type="button"
            aria-label={t('menuAria')}
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-primary hover:bg-surface-variant/50 active:bg-primary/25 active:scale-90 transition-[background-color,transform]"
            onClick={() => setDrawerOpen(true)}
          >
            <span className="material-symbols-outlined">{APP_ICONS.menu}</span>
          </button>
        ) : leftButton === 'home' ? (
          <button
            type="button"
            aria-label={t('backToDashboardAria')}
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-primary hover:bg-surface-variant/50 active:bg-primary/25 active:scale-90 transition-[background-color,transform]"
            onClick={() => navigate('/')}
          >
            <span className="material-symbols-outlined">home</span>
          </button>
        ) : (
          // R-18：返回上一页(不是固定跳仪表盘)——这几个子页面是从抽屉哪个主页面点进来的
          // 不一定，navigate(-1)回到真正来源的那一页，抽屉展开状态本身靠上面的共享
          // Context自然"记得"，这里不用额外传状态
          <button
            type="button"
            aria-label={t('backLabel')}
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-primary hover:bg-surface-variant/50 active:bg-primary/25 active:scale-90 transition-[background-color,transform]"
            onClick={() => navigate(-1)}
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        )}
        {/* 照旧仓库index.html的.papercut真实效果复用(不是随手写的模糊阴影)：8层描边阴影
            用--color-surface(跟旧App--card同色调)在字形周围勾出一圈纸色轮廓，制造"从纸上
            剪下来贴上去"的贴纸感，再叠一层3px 4px偏移、不带模糊的深色阴影(旧App用--ink
            15%左右透明度)做投影厚度——纯高斯模糊text-shadow做不出这种硬边剪纸质感 */}
        <h1 className="font-serif text-headline-lg font-extrabold text-primary tracking-tight [text-shadow:1.5px_0_0_var(--color-surface),-1.5px_0_0_var(--color-surface),0_1.5px_0_var(--color-surface),0_-1.5px_0_var(--color-surface),1px_1px_0_var(--color-surface),-1px_-1px_0_var(--color-surface),1px_-1px_0_var(--color-surface),-1px_1px_0_var(--color-surface),3px_4px_0_rgba(35,26,19,0.16)]">
          {title}
        </h1>
        {/* R-18：右上角在子页面不显示任何东西——用一个等宽的空div占位，让标题(左右各
            靠一个w-10按钮/占位)还能居中，不是直接不渲染导致标题偏向左边 */}
        {isSubpage ? (
          <div className="w-10 h-10 -mr-2" />
        ) : (
          <Link
            to="/account"
            aria-label={t('accountTitle')}
            className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-primary hover:bg-surface-variant/50 active:bg-primary/25 active:scale-90 transition-[background-color,transform]"
          >
            <span className="material-symbols-outlined">{APP_ICONS.account}</span>
          </Link>
        )}
      </header>

      <main
        ref={(el) => {
          containerRef.current = el
          if (mainRef) mainRef.current = el
        }}
        className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain pb-32 paper-grid-bg"
        style={
          onRefresh
            ? { paddingTop: pullDistance, transition: dragging ? 'none' : 'padding-top 0.2s ease' }
            : undefined
        }
      >
        {/* 下拉刷新指示器(R-17)——absolute定位不影响main的position:relative给其它
            fixed后代(比如仪表盘的记一笔悬浮按钮)当containing block；如果这里改用
            transform把children整体往下推，会连带把后代的fixed定位也变成"相对这个
            被transform的祖先"而不是相对视口，悬浮按钮会跟着被拉走位置——这个坑踩过，
            所以改用paddingTop推移content，指示器本身用absolute贴在main顶部的空隙里，
            两者都不会创建fixed的containing block。图标尺寸/克制程度照用户给的X App
            真机录屏调过——就是窄窄探出一个小箭头，不是大号Material圆环占一大块地方 */}
        {onRefresh && (
          <div
            className="absolute top-0 left-0 w-full flex items-center justify-center pointer-events-none overflow-hidden"
            style={{ height: pullDistance }}
          >
            {refreshing ? (
              // B-07：加载中改成iOS原生菊花转圈(.ios-spinner，真实实现见index.css)，
              // 不再用Material的refresh图标transform旋转那套
              <span className="ios-spinner text-primary">
                {Array.from({ length: 8 }, (_, i) => (
                  <i key={i} style={{ transform: `rotate(${i * 45}deg)`, animationDelay: `${i * 0.125 - 1}s` }} />
                ))}
              </span>
            ) : (
              <span
                className="material-symbols-outlined text-primary"
                style={{
                  fontSize: 24,
                  opacity: Math.min(1, pullDistance / threshold),
                  transform: `rotate(${Math.min(1, pullDistance / threshold) * 180}deg)`,
                }}
              >
                arrow_downward
              </span>
            )}
          </div>
        )}
        {children}
      </main>

      <CloudDisconnectBanner />
      {/* R-18：子页面(汇率换算/设置/about)隐藏底部导航栏；抽屉本身也不渲染——这几个
          页面左上角是返回箭头，没有汉堡按钮能重新打开它，渲染了也永远打不开、纯粹
          多余的DOM，而且drawerOpen这个共享状态如果恰好是true(从主页面点进来时抽屉
          正展开着)，渲染出来反而会在子页面上叠一层不该出现的抽屉遮罩 */}
      {!isSubpage && (
        <>
          <BottomNav />
          <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        </>
      )}
    </div>
  )
}
