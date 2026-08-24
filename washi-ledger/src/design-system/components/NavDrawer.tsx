import { NavLink } from 'react-router-dom'
import { APP_ICONS } from '../../lib/appIcons'
import { useAuth } from '../../features/auth/useAuth'
import { useI18n } from '../../lib/i18n'
import type { TranslationKey } from '../../lib/i18n'

interface NavDrawerProps {
  open: boolean
  onClose: () => void
}

// 左侧抽屉导航——照design-assets第二版_33做，放"低频/全局入口"：设置、汇率换算、关于。
// 主要3个页面(仪表盘/明细/统计)在底部悬浮胶囊导航，这里不重复放。
// R-18：汇率换算/设置/about这三个是"子页面"(AppLayout leftButton="back"，隐藏底部
// 导航栏+抽屉本身)，点进去时不关闭抽屉——共享的drawerOpen状态(见useDrawer.tsx)保持
// true，等用户从子页面点返回箭头回到这里时，抽屉自然还是展开的样子。/account不在
// 这三个之列(它是leftButton="home"，还是有底部导航栏的"主页面")，维持原来点了就关闭
// 抽屉的行为
const SUBPAGE_PATHS = new Set(['/rate', '/settings', '/about'])
const links: { to: string; icon: string; labelKey: TranslationKey }[] = [
  { to: '/rate', icon: APP_ICONS.rate, labelKey: 'rateNavLabel' },
  { to: '/settings', icon: APP_ICONS.settings, labelKey: 'settingsTitle' },
  { to: '/account', icon: APP_ICONS.account, labelKey: 'accountTitle' },
  { to: '/about', icon: APP_ICONS.about, labelKey: 'aboutTitle' },
]

export function NavDrawer({ open, onClose }: NavDrawerProps) {
  const { user, signedIn } = useAuth()
  const { t } = useI18n()

  return (
    <>
      <div
        className={`fixed inset-0 bg-inverse-surface/40 backdrop-blur-[2px] z-40 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-[78%] max-w-[320px] bg-surface
                    border-r-[1.5px] border-dashed border-outline-variant shadow-xl
                    flex flex-col overflow-y-auto overflow-x-hidden transition-transform duration-300 ease-out
                    ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center gap-sm p-md border-b-[1.5px] border-dashed border-outline-variant">
          <div className="w-11 h-11 rounded-full border-2 border-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl text-primary">
              {signedIn ? 'account_circle' : 'menu_book'}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-serif text-headline-md text-primary leading-tight">Washi Ledger</p>
            <p className="text-body-md text-on-surface-variant truncate">{signedIn ? user!.email : t('notSignedIn')}</p>
          </div>
        </div>
        <nav className="flex-1 py-sm flex flex-col font-body-lg text-body-lg text-on-surface">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => {
                if (!SUBPAGE_PATHS.has(link.to)) onClose()
              }}
              className={({ isActive }) =>
                `flex items-center gap-md mx-2 my-1 px-4 py-3 rounded-lg transition-colors active:opacity-70 ${
                  isActive
                    ? 'bg-secondary-container text-on-secondary-container font-bold'
                    : 'text-on-surface-variant hover:bg-surface-variant/30'
                }`
              }
            >
              <span className="material-symbols-outlined">{link.icon}</span>
              {t(link.labelKey)}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}
