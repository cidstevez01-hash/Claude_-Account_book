import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { NavDrawer } from './NavDrawer'
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

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain pb-32">{children}</main>

      <BottomNav />
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
