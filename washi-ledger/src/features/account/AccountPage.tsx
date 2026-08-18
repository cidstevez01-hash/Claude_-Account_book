import { useNavigate, Link } from 'react-router-dom'
import { AppLayout } from '../../design-system/components/AppLayout'
import { useAuth } from '../auth/useAuth'
import { useEntries } from '../../hooks/useEntries'
import { supabase } from '../../lib/supabase'

function daysSince(iso: string): number {
  const start = new Date(iso).getTime()
  return Math.max(0, Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24)))
}

/** 我的账户——照design-assets-v2/_30/_31/_32的头像+列表布局做，但去掉了"Pro"徽章、
 * "Premium Subscription"、"Data Backup & Sync"这些设计稿里虚构的功能(我们的数据模型
 * 里没有会员/订阅这回事)。统计区块换成真实能算出来的数字：加入天数(从supabase auth
 * 的user.created_at算)、记录数(entries.length)，不是编的假数据。
 *
 * "Change Password"这个入口(_29)也没做——旧仓库index.html的真实云同步功能里根本没有
 * 改密码这个功能(只有登录/注册/退出登录三个)，不能凭空做一个没有实现的按钮 */
export function AccountPage() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const { entries } = useEntries(user?.id ?? null)

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (loading) return null

  if (!user) {
    return (
      <AppLayout title="我的账户">
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
      <div className="flex flex-col items-center px-md pt-lg pb-md">
        <div className="w-20 h-20 rounded-full border-2 border-primary flex items-center justify-center mb-3">
          <span className="material-symbols-outlined text-4xl text-primary">account_circle</span>
        </div>
        <h2 className="font-serif text-headline-md text-on-surface">{user.email}</h2>
      </div>

      <div className="flex justify-around px-md py-md border-y border-dashed border-outline-variant mb-md">
        <div className="text-center">
          <p className="text-label-caps font-sans text-on-surface-variant uppercase">加入天数</p>
          <p className="font-serif text-stat-figure text-primary">{daysSince(user.created_at)}</p>
        </div>
        <div className="w-px bg-outline-variant" />
        <div className="text-center">
          <p className="text-label-caps font-sans text-on-surface-variant uppercase">记录数</p>
          <p className="font-serif text-stat-figure text-primary">{entries.length}</p>
        </div>
      </div>

      <div className="px-md flex flex-col gap-2">
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center gap-sm p-sm rounded-lg border border-primary/40 text-primary"
        >
          <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center">
            <span className="material-symbols-outlined">logout</span>
          </div>
          <span className="text-body-lg">退出登录</span>
        </button>
      </div>
    </AppLayout>
  )
}
