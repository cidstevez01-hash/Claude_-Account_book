import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AppLayout } from '../../design-system/components/AppLayout'
import { ConfirmDialog } from '../../design-system/components/ConfirmDialog'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../../lib/supabase'

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
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [confirmSignOut, setConfirmSignOut] = useState(false)

  async function handleSignOut() {
    setConfirmSignOut(false)
    await supabase.auth.signOut()
    navigate('/')
  }

  if (loading) return null

  if (!user) {
    return (
      <AppLayout title="我的账户" leftButton="home">
        <div className="flex flex-col items-center gap-md px-md py-xl text-center">
          <span className="material-symbols-outlined text-5xl text-outline">account_circle</span>
          <p className="text-body-lg text-on-surface-variant">登录后可以在多个设备间同步账本</p>
          <div className="flex gap-sm w-full max-w-[280px]">
            <Link
              to="/signin"
              className="flex-1 h-11 flex items-center justify-center rounded-xl border border-primary text-primary text-body-lg"
            >
              登录
            </Link>
            <Link
              to="/register"
              className="flex-1 h-11 flex items-center justify-center rounded-xl bg-primary text-on-primary text-body-lg"
            >
              注册
            </Link>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="我的账户">
      <div className="flex flex-col items-center px-md pt-lg pb-lg">
        <div className="w-20 h-20 rounded-full border-2 border-primary flex items-center justify-center mb-3">
          <span className="material-symbols-outlined text-4xl text-primary">account_circle</span>
        </div>
        <h2 className="text-body-md text-on-surface-variant">{user.email}</h2>
      </div>

      <div className="flex justify-center px-md">
        <button
          type="button"
          onClick={() => setConfirmSignOut(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-primary/40 text-primary text-body-md active:opacity-60 transition-opacity"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          退出登录
        </button>
      </div>

      <ConfirmDialog
        open={confirmSignOut}
        title="确定要退出登录吗？"
        message="退出登录后仍可以查看本机已缓存的账目，重新登录后会自动与云端同步。"
        confirmLabel="退出登录"
        cancelLabel="取消"
        icon="logout"
        tone="neutral"
        onConfirm={handleSignOut}
        onCancel={() => setConfirmSignOut(false)}
      />
    </AppLayout>
  )
}
