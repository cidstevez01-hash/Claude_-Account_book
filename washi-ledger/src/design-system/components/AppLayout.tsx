import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { NavDrawer } from './NavDrawer'
import { CloudDisconnectBanner } from './CloudDisconnectBanner'
import { APP_ICONS } from '../../lib/appIcons'
import { useI18n } from '../../lib/i18n'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'

interface AppLayoutProps {
  title: string
  children: ReactNode
  /** 左上角按钮：'menu'(默认，点开抽屉导航)/'home'(小房子，直接跳回仪表盘，不带
   * 抽屉——我的账户页用这个，不需要再从这里进抽屉) */
  leftButton?: 'menu' | 'home'
  /** 下拉刷新(R-17)——只有传了这个才会启用手势监听/显示指示器，不传就是原来的普通
   * 页面(比如"我的账户"/"设置"这类没有"重新拉取数据"这个概念的页面)。四个大页面
   * (仪表盘/明细/统计/汇率换算)各自传自己的数据刷新函数，必须返回Promise——指示器
   * 转圈圈状态靠这个Promise什么时候resolve来收起，不是定时器估算 */
  onRefresh?: () => Promise<void>
}

export function AppLayout({ title, children, leftButton = 'menu', onRefresh }: AppLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const { t } = useI18n()
  const { containerRef, pullDistance, refreshing, dragging, threshold } = usePullToRefresh<HTMLElement>(onRefresh)

  return (
    <div
      className="fixed inset-0 mx-auto max-w-[480px] flex flex-col bg-surface paper-grid-bg overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header className="flex items-center justify-between px-md h-16 w-full shrink-0 bg-surface border-b-[1.5px] border-dashed border-outline-variant">
        {leftButton === 'menu' ? (
          <button
            type="button"
            aria-label={t('menuAria')}
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-primary hover:bg-surface-variant/50 transition-colors"
            onClick={() => setDrawerOpen(true)}
          >
            <span className="material-symbols-outlined">{APP_ICONS.menu}</span>
          </button>
        ) : (
          <button
            type="button"
            aria-label={t('backToDashboardAria')}
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-primary hover:bg-surface-variant/50 transition-colors"
            onClick={() => navigate('/')}
          >
            <span className="material-symbols-outlined">home</span>
          </button>
        )}
        {/* 照旧仓库index.html的.papercut真实效果复用(不是随手写的模糊阴影)：8层描边阴影
            用--color-surface(跟旧App--card同色调)在字形周围勾出一圈纸色轮廓，制造"从纸上
            剪下来贴上去"的贴纸感，再叠一层3px 4px偏移、不带模糊的深色阴影(旧App用--ink
            15%左右透明度)做投影厚度——纯高斯模糊text-shadow做不出这种硬边剪纸质感 */}
        <h1 className="font-serif text-headline-lg font-extrabold text-primary tracking-tight [text-shadow:1.5px_0_0_var(--color-surface),-1.5px_0_0_var(--color-surface),0_1.5px_0_var(--color-surface),0_-1.5px_0_var(--color-surface),1px_1px_0_var(--color-surface),-1px_-1px_0_var(--color-surface),1px_-1px_0_var(--color-surface),-1px_1px_0_var(--color-surface),3px_4px_0_rgba(35,26,19,0.16)]">
          {title}
        </h1>
        <Link
          to="/account"
          aria-label={t('accountTitle')}
          className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-primary hover:bg-surface-variant/50 transition-colors"
        >
          <span className="material-symbols-outlined">{APP_ICONS.account}</span>
        </Link>
      </header>

      <main
        ref={containerRef}
        className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain pb-32"
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
            两者都不会创建fixed的containing block */}
        {onRefresh && (
          <div
            className="absolute top-0 left-0 w-full flex items-center justify-center pointer-events-none overflow-hidden"
            style={{ height: pullDistance }}
          >
            {refreshing ? (
              <span className="material-symbols-outlined animate-spin text-2xl text-primary">progress_activity</span>
            ) : (
              <span
                className="material-symbols-outlined text-2xl text-primary"
                style={{
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
      <BottomNav />
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
