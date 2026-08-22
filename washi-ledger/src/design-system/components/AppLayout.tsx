import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { NavDrawer } from './NavDrawer'
import { CloudDisconnectBanner } from './CloudDisconnectBanner'
import { APP_ICONS } from '../../lib/appIcons'
import { useI18n } from '../../lib/i18n'

interface AppLayoutProps {
  title: string
  children: ReactNode
  /** 左上角按钮：'menu'(默认，点开抽屉导航)/'home'(小房子，直接跳回仪表盘，不带
   * 抽屉——我的账户页用这个，不需要再从这里进抽屉) */
  leftButton?: 'menu' | 'home'
}

export function AppLayout({ title, children, leftButton = 'menu' }: AppLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const { t } = useI18n()

  return (
    <div
      className="fixed inset-0 mx-auto max-w-[480px] flex flex-col bg-surface overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* header用absolute悬浮在main上方(不是shrink-0占自己的flex行高)，main底下垫同等高度的
          padding-top——这样内容真正会从header底下滚动过去，透过app-header的backdrop-filter
          若隐若现，才是"悬浮"这个效果本身；之前header跟main是各占一块flex行的普通兄弟节点，
          压根没有重叠，玻璃模糊什么都照不到，等于加了css属性但视觉上跟没加一样。
          header的top必须写成env(safe-area-inset-top)，不能就写0——position:absolute的
          子元素定位是相对父级"padding box"算的，会直接无视父级(这个div)自己的padding-top，
          跟shrink-0的普通flow元素完全不是一回事；写0会让header贴到刘海/状态栏底下，
          整个被系统状态栏区域盖住点不到(真机上才会复现，这是真的踩过的坑)。main那边不用管，
          它还是普通flow元素，父级的padding-top对它照常生效 */}
      <header className="app-header absolute top-[env(safe-area-inset-top)] inset-x-0 z-10 flex items-center justify-between px-md h-16 w-full">
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
        <h1 className="font-serif text-headline-lg font-bold text-primary tracking-tight">
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

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain pt-16 pb-32">{children}</main>

      <CloudDisconnectBanner />
      <BottomNav />
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
