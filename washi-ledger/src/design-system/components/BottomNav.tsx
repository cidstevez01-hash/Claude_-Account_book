import { NavLink } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'
import { APP_ICONS } from '../../lib/appIcons'

// 悬浮胶囊样式——DESIGN.md原文"A floating capsule with a backdrop-filter"。
// 3个tab：仪表盘/明细/统计，设置+汇率不在这里，放左侧抽屉导航(见NavDrawer)。
// 这条规则来自washi_ledger_markdown.md"交互逻辑提醒"一节，详见HANDOFF文档。
const items = [
  { to: '/', icon: APP_ICONS.dashboard, labelKey: 'tabDashboard' as const },
  { to: '/history', icon: APP_ICONS.history, labelKey: 'tabHistory' as const },
  { to: '/stats', icon: APP_ICONS.stats, labelKey: 'tabStats' as const },
]

export function BottomNav() {
  const { t } = useI18n()
  return (
    <nav
      className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[400px] z-50
                 flex items-center justify-around px-lg py-xs
                 bg-surface/80 backdrop-blur-md border border-white/20 rounded-full shadow-lg"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 py-2 px-3 transition-colors ${
              isActive ? 'text-primary' : 'text-on-surface-variant'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                {item.icon}
              </span>
              <span className="text-tab-label font-sans font-semibold">{t(item.labelKey)}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
