import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { NavDrawer } from './NavDrawer'
import { APP_ICONS } from '../../lib/appIcons'

interface AppLayoutProps {
  title: string
  children: ReactNode
  /** 明细/统计等次级页面不一定需要显示汉堡菜单，默认显示 */
  showMenuButton?: boolean
}

export function AppLayout({ title, children, showMenuButton = true }: AppLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div
      className="fixed inset-0 mx-auto max-w-[480px] flex flex-col bg-surface overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header className="flex items-center justify-between px-md h-16 w-full shrink-0 bg-surface border-b-[1.5px] border-dashed border-outline-variant">
        {showMenuButton ? (
          <button
            type="button"
            aria-label="菜单"
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-primary hover:bg-surface-variant/50 transition-colors"
            onClick={() => setDrawerOpen(true)}
          >
            <span className="material-symbols-outlined">{APP_ICONS.menu}</span>
          </button>
        ) : (
          <div className="w-10" />
        )}
        <h1 className="font-serif text-headline-lg font-bold text-primary tracking-tight">
          {title}
        </h1>
        <Link
          to="/account"
          aria-label="我的账户"
          className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-primary hover:bg-surface-variant/50 transition-colors"
        >
          <span className="material-symbols-outlined">{APP_ICONS.account}</span>
        </Link>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain pb-32">{children}</main>

      <BottomNav />
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
