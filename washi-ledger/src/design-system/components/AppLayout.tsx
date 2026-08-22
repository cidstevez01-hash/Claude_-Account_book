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
      {/* R-08真正要的只是标题文字本身带一点悬浮+阴影质感(text-shadow)，不是把整条header
          改成悬浮在内容上方的玻璃层——之前误把范围扩大到整个header的定位方式(absolute+
          backdrop-filter)，已经改回shrink-0的普通header，只在下面h1上加text-shadow */}
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
        <h1 className="font-serif text-headline-lg font-bold text-primary tracking-tight [text-shadow:0_2px_4px_rgba(35,26,19,0.18)]">
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

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain pb-32">{children}</main>

      <CloudDisconnectBanner />
      <BottomNav />
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
