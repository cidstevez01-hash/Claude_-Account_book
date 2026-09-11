import { Link } from 'react-router-dom'
import { useAppNavigate, viewTransitionLinkClick } from '../../hooks/useAppNavigate'
import { useI18n } from '../../lib/i18n'
import { useSettings } from '../../hooks/useSettings'
import { ThemeIcon } from './ThemeIcon'
import { AppIcon } from './AppIcon'

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
  const { settings } = useSettings()
  const isSummer = settings.themeSkin === 'summer'
  const navigate = useAppNavigate()
  return (
    <Link
      to="/rate"
      onClick={(e) => viewTransitionLinkClick(e, navigate, '/rate')}
      aria-label={t('rateShortcutAria')}
      className="rate-fab-shell fixed z-40 flex items-center justify-center w-12 h-12 rounded-full active:scale-90 transition-transform"
      style={{
        right: 'max(25px, calc(50% - 240px + 25px))',
        bottom: 'calc(6rem + 102px)',
        background: 'color-mix(in srgb, var(--color-surface-container-lowest) 55%, transparent)',
        backdropFilter: 'blur(8px) saturate(140%)',
        WebkitBackdropFilter: 'blur(8px) saturate(140%)',
        // B-XX：确认稿(design-assets/icons/summer-fireworks-icon-effects/final/)里
        // "改成珊瑚红"那版，虚线圆环本身也是珊瑚红，不是只换了光晕颜色——之前漏了
        // 这条虚线边框，只顾着改光晕，真机上圆环还是薄荷绿、跟图标/光晕对不上
        border: `1.5px dashed var(${isSummer ? '--color-primary' : '--color-secondary'})`,
        color: `var(${isSummer ? '--color-primary' : '--color-secondary'})`,
        boxShadow: '0 3px 10px -4px rgba(0,0,0,.3)',
      }}
    >
      {/* B-XX：这个呼吸光晕之前一直用--color-secondary(薄荷绿)——跟"夏 · 花火"图标
          光效整体的珊瑚红色板(--color-primary)不是同一个色源，是真的没对上，不是
          summer主题特意选的薄荷绿；呼吸节奏(rate-fab-breathe关键帧)本身不动，只在
          summer下把颜色来源换成--color-primary，其它主题保持原来的--color-secondary
          不受影响。
          B-XX：渐变末端之前写的是字面量transparent(=透明黑，不是"这个颜色但透明")，
          插值会经过一段发暗发浊的过渡色——真机上珊瑚红这版就是因为这个看起来"一片红"
          糊成一团，不是干净的向外发光。summer下直接写死rgba等值(--color-primary在
          summer下固定是#e85d4a，这个分支只在summer渲染，硬编码没有跨主题风险)；
          非summer分支颜色跟主题走、没法硬编码，改成color-mix(...0%, transparent)让
          "透明"也保持跟起始色同色相、只是alpha到0，规避同样的浑浊过渡 */}
      <span
        className="rate-fab-glow absolute rounded-full pointer-events-none"
        style={{
          inset: -8,
          background: isSummer
            ? 'radial-gradient(circle, rgba(232, 93, 74, 0.45) 0%, rgba(232, 93, 74, 0) 70%)'
            : 'radial-gradient(circle, color-mix(in srgb, var(--color-secondary) 45%, transparent) 0%, color-mix(in srgb, var(--color-secondary) 0%, transparent) 70%)',
        }}
        aria-hidden="true"
      />
      {isSummer ? (
        <AppIcon icon="currency_exchange" size={22} gradient className="relative" />
      ) : (
        <ThemeIcon icon="currency_exchange" className="relative w-6 h-6" style={{ fontSize: 22 }} />
      )}
    </Link>
  )
}
