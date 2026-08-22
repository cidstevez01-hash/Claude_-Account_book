import { Link } from 'react-router-dom'
import { hasEverSignedIn, useAuth } from '../../features/auth/useAuth'
import { useI18n } from '../../lib/i18n'

/** Point 1方案落地——真实账户(排除匿名session)曾经登录过、现在却掉线了才提示，
 * 第一次打开App从没登录过是正常的未登录状态，不该被当成"掉线"报警。
 * 照抄旧App index.html B-02修复引入的同款可见性兜底：不能只在"我的账户"页悄悄
 * 切换登录/未登录两个区块的显示，那样用户根本不会主动点进那个页面去发现，
 * 这正是B-02这次事故拖了好几天才被发现的根本原因。放在AppLayout里全局渲染，
 * 主要页面都能看到，不是埋起来的。 */
export function CloudDisconnectBanner() {
  const { signedIn, loading } = useAuth()
  const { t } = useI18n()

  if (loading || signedIn || !hasEverSignedIn()) return null

  return (
    <div className="absolute top-16 inset-x-0 z-[5] px-md pt-2">
      <Link
        to="/account"
        className="flex items-center gap-2 rounded-full bg-tertiary-fixed border border-tertiary/30 px-3 py-2 text-body-md text-on-tertiary-fixed shadow-sm active:opacity-80 transition-opacity"
      >
        <span className="material-symbols-outlined text-[18px] shrink-0">cloud_off</span>
        <span className="flex-1 truncate">{t('cloudDisconnectBannerText')}</span>
        <span className="shrink-0 font-bold underline underline-offset-2">{t('cloudReconnectBtn')}</span>
      </Link>
    </div>
  )
}
