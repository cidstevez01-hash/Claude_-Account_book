import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { APP_ICONS } from '../../lib/appIcons'
import { useAuth } from '../../features/auth/useAuth'
import { useI18n } from '../../lib/i18n'
import { getAvatarPreset } from '../../lib/avatarPresets'
import { loadAvatarId } from '../../lib/avatarStorage'
import type { TranslationKey } from '../../lib/i18n'

interface NavDrawerProps {
  open: boolean
  onClose: () => void
}

// 左侧抽屉导航——照design-assets第二版_33做，放"低频/全局入口"：设置、汇率换算、关于。
// 主要3个页面(仪表盘/明细/统计)在底部悬浮胶囊导航，这里不重复放。"我的账户"这里
// 不再重复放一个入口(R-24)——头部右上角账户图标已经是独立入口，两处都能进同一个
// 页面没必要，去掉这里这个
// R-18：汇率换算/设置/about这三个是"子页面"(AppLayout leftButton="back"，隐藏底部
// 导航栏+抽屉本身)，点进去时不关闭抽屉——共享的drawerOpen状态(见useDrawer.tsx)保持
// true，等用户从子页面点返回箭头回到这里时，抽屉自然还是展开的样子
const SUBPAGE_PATHS = new Set(['/rate', '/settings', '/about'])
const links: { to: string; icon: string; labelKey: TranslationKey }[] = [
  { to: '/rate', icon: APP_ICONS.rate, labelKey: 'rateNavLabel' },
  { to: '/settings', icon: APP_ICONS.settings, labelKey: 'settingsTitle' },
  { to: '/about', icon: APP_ICONS.about, labelKey: 'aboutTitle' },
]

export function NavDrawer({ open, onClose }: NavDrawerProps) {
  const { user, signedIn } = useAuth()
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  // B-34：点这三行(汇率换算/设置/关于)本来指望能看到"点中的这行变绿高亮"这个点击
  // 反馈，但这三个都是SUBPAGE_PATHS——AppLayout.tsx对子页面完全不渲染NavDrawer
  // (isSubpage分支)，之前用NavLink直接同步跳转，路由一变、这个组件立刻从DOM里
  // 消失，浏览器根本没机会把"isActive=true"这一帧真的画出来，用户看到的就是"点了
  // 没反应"。改成点击先用pendingTo这个本地state让对应行立刻显示高亮态(这一帧稳定
  // 画出来)，停顿一小段时间再真正调用navigate()跳转，让绿色反馈有时间被看到 */
  const [pendingTo, setPendingTo] = useState<string | null>(null)
  // 头像——设定头像后所有展示"账户"的地方都要跟着变，这里(抽屉头部)是其中一处；
  // 只在真实登录态显示(未登录是引导注册/登录，不该显示"你的"头像)
  const [avatarId] = useState(() => loadAvatarId())
  const avatar = getAvatarPreset(avatarId)

  function handleClick(to: string) {
    setPendingTo(to)
    window.setTimeout(() => {
      navigate(to)
      if (!SUBPAGE_PATHS.has(to)) onClose()
      setPendingTo(null)
    }, 150)
  }

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
          {signedIn ? (
            <div className="w-11 h-11 rounded-full border-2 border-primary overflow-hidden shrink-0">
              <img src={avatar.src} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-11 h-11 rounded-full border-2 border-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl text-primary">menu_book</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="font-serif text-headline-md text-primary leading-tight">PigBang</p>
            <p className="text-body-md text-on-surface-variant truncate">{signedIn ? user!.email : t('notSignedIn')}</p>
          </div>
        </div>
        <nav className="flex-1 py-sm flex flex-col font-body-lg text-body-lg text-on-surface">
          {links.map((link) => {
            // 有pendingTo(刚点过某一行、还没真正跳转)时，只有被点中的那行算active，
            // 不看真实路由——避免停顿这150ms内因为路由还没变、显示成上一个页面对应
            // 的行还亮着，跟"我刚点的是哪行"对不上
            const isActive = pendingTo != null ? pendingTo === link.to : location.pathname === link.to
            return (
              <button
                key={link.to}
                type="button"
                onClick={() => handleClick(link.to)}
                className={`flex items-center gap-md mx-2 my-1 px-4 py-3 rounded-lg transition-colors active:opacity-70 text-left ${
                  isActive
                    ? 'bg-secondary-container text-on-secondary-container font-bold'
                    : 'text-on-surface-variant hover:bg-surface-variant/30'
                }`}
              >
                <span className="material-symbols-outlined">{link.icon}</span>
                {t(link.labelKey)}
              </button>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
