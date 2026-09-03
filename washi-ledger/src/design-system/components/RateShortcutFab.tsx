import { Link } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'
import { ThemeIcon } from './ThemeIcon'

/** R-20：汇率悬浮快捷入口——用户确认稿(design-assets/icons/rate-shortcut-fab/final/)，
 * 位置/图案取方案A(主"记一笔"FAB正上方20px、currency_exchange图标)，呼吸光晕取方案C。
 * 挂在AppLayout里、只在非子页面(仪表盘/明细/统计/我的账户)渲染——当前就在汇率页时
 * 走的是leftButton='back'分支(isSubpage=true)，AppLayout那边已经不渲染这个组件，
 * 这里不用再额外判断当前路径是不是/rate。
 *
 * 位置数值跟DashboardPage.tsx"记一笔"主FAB对齐：主FAB right取
 * max(20px, calc(50% - 240px + 20px))、宽58px，这个按钮宽48px，right在此基础上
 * +5px让两个圆的中心线对齐(不是简单复用同一个right值)；bottom在主FAB的
 * `bottom + 58px高度 + 20px间距`基础上算出。 */
export function RateShortcutFab() {
  const { t } = useI18n()
  return (
    <Link
      to="/rate"
      aria-label={t('rateShortcutAria')}
      className="fixed z-40 flex items-center justify-center w-12 h-12 rounded-full active:scale-90 transition-transform"
      style={{
        right: 'max(25px, calc(50% - 240px + 25px))',
        bottom: 'calc(6rem + 102px)',
        background: 'color-mix(in srgb, var(--color-surface-container-lowest) 55%, transparent)',
        backdropFilter: 'blur(8px) saturate(140%)',
        WebkitBackdropFilter: 'blur(8px) saturate(140%)',
        border: '1.5px dashed var(--color-secondary)',
        color: 'var(--color-secondary)',
        boxShadow: '0 3px 10px -4px rgba(0,0,0,.3)',
      }}
    >
      <span
        className="rate-fab-glow absolute rounded-full pointer-events-none"
        style={{
          inset: -8,
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--color-secondary) 45%, transparent) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />
      {/* R-29：跟NavDrawer汇率行同一个-fw资源，保持一致 */}
      <ThemeIcon
        icon="currency_exchange"
        fw="/icons/fw/ic-exchange-fw.svg"
        className="relative w-6 h-6"
        style={{ fontSize: 22 }}
      />
    </Link>
  )
}
