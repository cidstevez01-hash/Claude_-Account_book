import { ThemeIcon } from '../../icons/Icon'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppLayout } from '../../design-system/components/AppLayout'
import { ConfirmDialog } from '../../design-system/components/ConfirmDialog'
import { useAppNavigate, viewTransitionLinkClick } from '../../hooks/useAppNavigate'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../../lib/supabase'
import { useI18n } from '../../lib/i18n'
import { getAvatarPreset } from '../../lib/avatarPresets'
import { loadAvatarId } from '../../lib/avatarStorage'

/** 我的账户——照design-assets-v2/_30/_31/_32的头像+列表布局做，但去掉了"Pro"徽章、
 * "Premium Subscription"、"Data Backup & Sync"这些设计稿里虚构的功能(我们的数据模型
 * 里没有会员/订阅这回事)。"加入天数"/"记录数"这两个统计原本是补的真实数据(不是编的假
 * 数据)，但用户看了反馈不需要，已去掉——这个页面不用再拉entries了。
 *
 * "Change Password"这个入口(_29)也没做——旧仓库index.html的真实云同步功能里根本没有
 * 改密码这个功能(只有登录/注册/退出登录三个)，不能凭空做一个没有实现的按钮
 *
 * 退出登录要有确认弹窗，避免误触(退出登录不会清空本地缓存的账目数据，见useEntries.ts
 * 里的真实缓存/同步逻辑，退出后账目照样能正常看) */
export function AccountPage() {
  const navigate = useAppNavigate()
  const { user, loading, signedIn } = useAuth()
  const { t, lang } = useI18n()
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [avatarId] = useState(() => loadAvatarId())
  const avatar = getAvatarPreset(avatarId)

  async function handleSignOut() {
    setConfirmSignOut(false)
    await supabase.auth.signOut()
    navigate('/')
  }

  if (loading) return null

  // signedIn排除了匿名session(user.is_anonymous)——匿名状态下这个页面要显示成
  // "未登录"(引导去登录/注册)，而不是显示一个没有email的"已登录"账户
  if (!signedIn) {
    return (
      <AppLayout title={t('accountTitle')} leftButton="back">
        <div className="flex flex-col items-center gap-md px-md py-xl text-center">
          <ThemeIcon className="material-symbols-outlined text-5xl text-outline" icon="account_circle" />
          <p className="text-body-lg text-on-surface-variant">{t('accountSignInHint')}</p>
          <div className="flex gap-sm w-full max-w-[280px]">
            <Link
              to="/signin"
              onClick={(e) => viewTransitionLinkClick(e, navigate, '/signin')}
              className="flex-1 h-11 flex items-center justify-center rounded-xl border border-primary text-action-ink text-body-lg"
            >
              {t('signInBtn')}
            </Link>
            <Link
              to="/register"
              onClick={(e) => viewTransitionLinkClick(e, navigate, '/register')}
              className="flex-1 h-11 flex items-center justify-center rounded-xl bg-action text-on-action text-body-lg"
            >
              {t('signUpBtn')}
            </Link>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title={t('accountTitle')} leftButton="back">
      <div className="flex flex-col items-center px-md pt-lg pb-lg">
        {/* 只裁切头像图片，编辑徽章及主题外圈光效保持完整。 */}
        <div className="relative w-20 h-20 mb-3">
          {/* 头像图片本身就有色彩/图案，不是"编辑中"状态，不需要再叠一圈border-primary
              装饰环——那圈环只该出现在ChangeAvatarPage选择网格里表示"当前选中哪一个" */}
          <div className="w-full h-full rounded-full overflow-hidden">
            <img src={avatar.src} alt={lang === 'ja' ? avatar.labelJa : avatar.labelZh} className="w-full h-full object-cover" />
          </div>
          <Link
            to="/account/avatar"
            onClick={(e) => viewTransitionLinkClick(e, navigate, '/account/avatar')}
            aria-label={t('changeAvatarAria')}
            className="absolute -right-[11px] -bottom-[9px] w-11 h-11 flex items-center justify-center rounded-full active:scale-90 transition-transform"
          >
            <span className="relative w-[26px] h-[26px] rounded-full bg-surface-container-lowest border-2 border-outline-variant flex items-center justify-center [--icon-size:26px]">
              <ThemeIcon className="material-symbols-outlined text-primary" style={{ fontSize: 12 }} icon="edit" size={12} effect="ring" fireflies />
            </span>
          </Link>
        </div>
        <h2 className="text-body-md text-on-surface-variant">{user!.email}</h2>
      </div>

      <div className="flex justify-center px-md">
        <button
          type="button"
          onClick={() => setConfirmSignOut(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-primary/40 text-action-ink text-body-md active:opacity-60 transition-opacity"
        >
          <ThemeIcon className="material-symbols-outlined text-[18px]" icon="logout" />
          {t('signOutBtn')}
        </button>
      </div>

      <ConfirmDialog
        open={confirmSignOut}
        title={t('confirmSignOutTitle')}
        message={t('confirmSignOutMessage')}
        confirmLabel={t('signOutBtn')}
        cancelLabel={t('cancelLabel')}
        icon="logout"
        tone="neutral"
        onConfirm={handleSignOut}
        onCancel={() => setConfirmSignOut(false)}
      />
    </AppLayout>
  )
}
