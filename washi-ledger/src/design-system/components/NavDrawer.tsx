import { NavLink } from 'react-router-dom'
import { APP_ICONS } from '../../lib/appIcons'

interface NavDrawerProps {
  open: boolean
  onClose: () => void
}

// 左侧抽屉导航——照design-assets第二版_33做，放"低频/全局入口"：设置、汇率换算、关于。
// 主要3个页面(仪表盘/明细/统计)在底部悬浮胶囊导航，这里不重复放。
const links = [
  { to: '/rate', icon: APP_ICONS.rate, label: '汇率换算' },
  { to: '/settings', icon: APP_ICONS.settings, label: '设置' },
  { to: '/account', icon: APP_ICONS.account, label: '我的账户' },
  { to: '/about', icon: APP_ICONS.about, label: '关于' },
]

export function NavDrawer({ open, onClose }: NavDrawerProps) {
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
                    flex flex-col overflow-y-auto transition-transform duration-300 ease-out
                    ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <nav className="flex-1 py-sm flex flex-col font-body-lg text-body-lg text-on-surface">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-md mx-2 my-1 px-4 py-3 rounded-lg transition-colors active:opacity-70 ${
                  isActive
                    ? 'bg-secondary-container text-on-secondary-container font-bold'
                    : 'text-on-surface-variant hover:bg-surface-variant/30'
                }`
              }
            >
              <span className="material-symbols-outlined">{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}
