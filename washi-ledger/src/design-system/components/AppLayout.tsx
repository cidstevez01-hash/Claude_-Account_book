import { useState, type ReactNode, type RefObject } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { NavDrawer } from './NavDrawer'
import { RateShortcutFab } from './RateShortcutFab'
import { ThemeIcon } from './ThemeIcon'
import { CloudDisconnectBanner } from './CloudDisconnectBanner'
import { APP_ICONS } from '../../lib/appIcons'
import { useI18n } from '../../lib/i18n'
import { useDrawer } from '../../hooks/useDrawer'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import { useAuth, hasEverSignedIn } from '../../features/auth/useAuth'
import { useSettings } from '../../hooks/useSettings'
import { getAvatarPreset } from '../../lib/avatarPresets'
import { loadAvatarId } from '../../lib/avatarStorage'

interface AppLayoutProps {
  title: string
  children: ReactNode
  /** 左上角按钮：'menu'(默认，点开抽屉导航)/'home'(小房子，直接跳回仪表盘，不带
   * 抽屉——我的账户页用这个，不需要再从这里进抽屉)/'back'(返回箭头，R-18：汇率换算/
   * 设置/about这三个从抽屉进来的子页面用这个——同时隐藏底部导航栏、右上角账户按钮、
   * 不渲染抽屉本身，跟"主页面"(仪表盘/明细/统计/我的账户)视觉上区分成两层) */
  leftButton?: 'menu' | 'home' | 'back'
  /** 下拉刷新(R-17)——只有传了这个才会启用手势监听/显示指示器，不传就是原来的普通
   * 页面(比如"我的账户"/"设置"这类没有"重新拉取数据"这个概念的页面)。四个大页面
   * (仪表盘/明细/统计/汇率换算)各自传自己的数据刷新函数，必须返回Promise——指示器
   * 转圈圈状态靠这个Promise什么时候resolve来收起，不是定时器估算 */
  onRefresh?: () => Promise<void>
  /** 明细页记忆筛选/滚动位置(B-12后续需求)要拿到真正在滚动的<main>节点自己读写
   * scrollTop——这个节点是AppLayout内部usePullToRefresh的containerRef，页面组件
   * 本来碰不到，通过这个可选prop把同一个DOM节点也同步给调用方 */
  mainRef?: RefObject<HTMLElement | null>
}

export function AppLayout({ title, children, leftButton = 'menu', onRefresh, mainRef }: AppLayoutProps) {
  // R-18：抽屉展开状态改用跨路由共享的Context(见useDrawer.tsx)，不再是这个组件的
  // 本地state——汇率换算/设置/about这几个"从抽屉进来的子页面"各自有自己独立的
  // AppLayout实例(不同路由页面，不是同一个组件实例)，返回上一页时要"记得"抽屉当时
  // 是展开的，本地state做不到这一点(实例卸载就清空了)
  const { open: drawerOpen, setOpen: setDrawerOpen } = useDrawer()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useI18n()
  const { containerRef, pullDistance, refreshing, dragging, threshold } = usePullToRefresh<HTMLElement>(onRefresh)
  const isSubpage = leftButton === 'back'
  // 头像——设定头像后所有展示"账户"的地方都要跟着变，这里(每个主页面右上角进"我的
  // 账户"的入口图标)是其中一处；只在真实登录态显示(未登录时保留原来的通用图标，
  // 跟AccountPage/NavDrawer的"未登录不显示你的头像"逻辑一致)
  // B-47：signedIn冷启动时有一段"还没确认真实登录状态"的空窗期(初始是false，等
  // useAuth内部异步getSession()/匿名登录兜底跑完才更新)，这段时间会先渲染成未登录
  // 分支(通用图标)，等状态更新后再跳回头像——用户就会看到"头像闪一下变成默认图标"。
  // 照CloudDisconnectBanner.tsx同一个模式：loading期间只要hasEverSignedIn()是true
  // (本机以前真登录过)，就乐观地先按"已登录"显示头像，不等异步结果；真等loading
  // 结束才发现其实没登录，才切回未登录状态
  const { signedIn, loading } = useAuth()
  const showAvatar = signedIn || (loading && hasEverSignedIn())
  const [avatarId] = useState(() => loadAvatarId())
  const avatar = getAvatarPreset(avatarId)
  // R-29："夏 · 花火"主题下这个根容器背景要透明，才能让常驻挂在App.tsx根部的
  // FireworksBackground(星空+烟花canvas)透出来——main内容区(paper-grid-bg)本来
  // 就没有自己单独的背景色，一直是继承这里；header/底部导航栏胶囊/抽屉自己有
  // 各自的背景，不受这个影响，仍然是不透明的"纸面"，跟旧App的.header/.fw-bg-layer
  // 分层关系一致
  const { settings } = useSettings()
  const isSummer = settings.themeSkin === 'summer'

  return (
    <div
      className={`fixed inset-0 mx-auto max-w-[480px] flex flex-col overflow-hidden ${
        isSummer ? 'bg-transparent' : 'bg-surface'
      }`}
    >
      {/* B-08：paper-grid-bg之前贴在这个根容器上，顶部安全区(header上方那一小条，
          没有header遮住)会透出方格纹理，跟正下方header的纯色bg-surface不一致，看起来
          像缺了一块。改成只贴在真正的内容滚动区(main)上，根容器/header都保持纯色，
          这样安全区跟header视觉一致
          R-29：summer主题下header改成跟旧App`.header`一致的近乎透明+毛玻璃
          (`background:color-mix(in srgb, var(--paper) 1%, transparent); backdrop-filter:
          blur(1px) saturate(150%)`)——之前这里写死bg-surface不透明，把FireworksBackground
          星空/烟花挡住了一整条，是真bug，不是"跟旧App分层一致"(那条注释判断错了)
          B-XX：safe-area-inset-top这段padding之前留在根容器(bg-transparent，什么处理
          都没有)上，header自己另外套了一层背景/blur——真机上能看出这两段接缝：安全区
          那一条是FireworksBackground原始清晰画面，header那一条是模糊过的，中间一条
          明显的分界线。改成padding-top和背景/blur一起挪到包住safe-area+header的这层
          div上，两段用同一层玻璃质感，不再有接缝
          B-XX：路由切换的入场渐显(.route-fade)之前包在App.tsx整个<Routes>外面，连
          RateShortcutFab/BottomNav/NavDrawer这些"应该感觉持续存在、不随页面切换重新
          出现"的常驻元素也被一起罩进去——每次切tab，这些元素的opacity从0淡入，跟
          BottomNav自己.tab-bubble的滑动动画同时跑，两个动画叠在一起，真机上感觉
          "切换有凝滞感"。挪到这里，只包住header+main这两块真正算"页面内容"的部分，
          RateShortcutFab/BottomNav/NavDrawer/CloudDisconnectBanner留在这层外面
          (见下方渲染)，不再被这个渐显影响——它们本来就该像贴在App外壳上一样，感觉上
          是常驻不动的，不该随每次翻页重新淡入淡出 */}
      <div key={location.pathname} className="route-fade flex flex-col flex-1 min-h-0">
      <div
        style={
          isSummer
            ? {
                paddingTop: 'env(safe-area-inset-top)',
                background: 'color-mix(in srgb, var(--color-surface) 1%, transparent)',
                backdropFilter: 'blur(1px) saturate(150%)',
                WebkitBackdropFilter: 'blur(1px) saturate(150%)',
              }
            : { paddingTop: 'env(safe-area-inset-top)' }
        }
      >
      <header
        className={`flex items-center justify-between px-md h-16 w-full shrink-0 border-b-[1.5px] border-dashed border-outline-variant ${
          isSummer ? '' : 'bg-surface'
        }`}
      >
        {leftButton === 'menu' ? (
          <button
            type="button"
            aria-label={t('menuAria')}
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-app-title hover:bg-surface-variant/50 hover:-translate-y-0.5 active:bg-primary/25 active:scale-90 active:translate-y-0 transition-[background-color,transform]"
            onClick={() => setDrawerOpen(true)}
          >
            <ThemeIcon icon={APP_ICONS.menu} effect="bare" className="papercut-text-shadow" />
          </button>
        ) : leftButton === 'home' ? (
          <button
            type="button"
            aria-label={t('backToDashboardAria')}
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-app-title hover:bg-surface-variant/50 hover:-translate-y-0.5 active:bg-primary/25 active:scale-90 active:translate-y-0 transition-[background-color,transform]"
            onClick={() => navigate('/')}
          >
            <span className="material-symbols-outlined papercut-text-shadow">home</span>
          </button>
        ) : (
          // R-18：返回上一页(不是固定跳仪表盘)——这几个子页面是从抽屉哪个主页面点进来的
          // 不一定，navigate(-1)回到真正来源的那一页，抽屉展开状态本身靠上面的共享
          // Context自然"记得"，这里不用额外传状态
          <button
            type="button"
            aria-label={t('backLabel')}
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-app-title hover:bg-surface-variant/50 hover:-translate-y-0.5 active:bg-primary/25 active:scale-90 active:translate-y-0 transition-[background-color,transform]"
            onClick={() => navigate(-1)}
          >
            <ThemeIcon icon="arrow_back" effect="bare" className="papercut-text-shadow" />
          </button>
        )}
        {/* 照旧仓库index.html的.papercut真实效果复用(不是随手写的模糊阴影)：8层描边阴影
            用--color-surface(跟旧App--card同色调)在字形周围勾出一圈纸色轮廓，制造"从纸上
            剪下来贴上去"的贴纸感，再叠一层3px 4px偏移、不带模糊的深色阴影(旧App用--ink
            15%左右透明度)做投影厚度——纯高斯模糊text-shadow做不出这种硬边剪纸质感 */}
        <h1 className="font-serif text-headline-lg font-extrabold text-app-title tracking-tight papercut-text-shadow">
          {title}
        </h1>
        {/* R-18：右上角在子页面不显示任何东西——用一个等宽的空div占位，让标题(左右各
            靠一个w-10按钮/占位)还能居中，不是直接不渲染导致标题偏向左边 */}
        {isSubpage ? (
          <div className="w-10 h-10 -mr-2" />
        ) : (
          <Link
            to="/account"
            aria-label={t('accountTitle')}
            className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-app-title hover:bg-surface-variant/50 hover:-translate-y-0.5 active:bg-primary/25 active:scale-90 active:translate-y-0 transition-[background-color,transform]"
          >
            {/* 不需要border-primary装饰环——这里只是展示头像，不是选择/编辑状态 */}
            {showAvatar ? (
              // B-XX：光晕(.icon-ring-glow)贴着头像照片外沿发光，不能放进overflow-hidden
              // 的圆形照片容器内部——那样会被自己裁掉；外面单独包一层不裁切的div放光晕，
              // 照片圆形容器缩在里面保持原有裁切行为不变
              <span className="relative inline-block w-7 h-7">
                {isSummer && <span className="icon-ring-glow" aria-hidden="true" />}
                <span className="relative z-[1] block w-7 h-7 rounded-full overflow-hidden">
                  <img src={avatar.src} alt="" className="w-full h-full object-cover" />
                </span>
              </span>
            ) : (
              <ThemeIcon
                icon={APP_ICONS.account}
                effect="bare"
                size={28}
                className="material-symbols-outlined papercut-text-shadow w-7 h-7"
              />
            )}
          </Link>
        )}
      </header>
      </div>

      <main
        ref={(el) => {
          containerRef.current = el
          if (mainRef) mainRef.current = el
        }}
        className={`relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain pb-32 ${
          isSummer ? '' : 'paper-grid-bg'
        }`}
        style={
          onRefresh
            ? { paddingTop: pullDistance, transition: dragging ? 'none' : 'padding-top 0.2s ease' }
            : undefined
        }
      >
        {/* 下拉刷新指示器(R-17)——absolute定位不影响main的position:relative给其它
            fixed后代(比如仪表盘的记一笔悬浮按钮)当containing block；如果这里改用
            transform把children整体往下推，会连带把后代的fixed定位也变成"相对这个
            被transform的祖先"而不是相对视口，悬浮按钮会跟着被拉走位置——这个坑踩过，
            所以改用paddingTop推移content，指示器本身用absolute贴在main顶部的空隙里，
            两者都不会创建fixed的containing block。图标尺寸/克制程度照用户给的X App
            真机录屏调过——就是窄窄探出一个小箭头，不是大号Material圆环占一大块地方 */}
        {onRefresh && (
          <div
            className="absolute top-0 left-0 w-full flex items-center justify-center pointer-events-none overflow-hidden"
            style={{ height: pullDistance }}
          >
            {refreshing ? (
              // B-07：加载中改成iOS原生菊花转圈(.ios-spinner，真实实现见index.css)，
              // 不再用Material的refresh图标transform旋转那套
              <span className="ios-spinner text-primary">
                {Array.from({ length: 8 }, (_, i) => (
                  <i key={i} style={{ transform: `rotate(${i * 45}deg)`, animationDelay: `${i * 0.125 - 1}s` }} />
                ))}
              </span>
            ) : (
              <span
                className="material-symbols-outlined text-primary"
                style={{
                  fontSize: 24,
                  opacity: Math.min(1, pullDistance / threshold),
                  transform: `rotate(${Math.min(1, pullDistance / threshold) * 180}deg)`,
                }}
              >
                arrow_downward
              </span>
            )}
          </div>
        )}
        {children}
      </main>
      </div>

      <CloudDisconnectBanner />
      {/* R-18：子页面(汇率换算/设置/about)隐藏底部导航栏；抽屉本身也不渲染——这几个
          页面左上角是返回箭头，没有汉堡按钮能重新打开它，渲染了也永远打不开、纯粹
          多余的DOM，而且drawerOpen这个共享状态如果恰好是true(从主页面点进来时抽屉
          正展开着)，渲染出来反而会在子页面上叠一层不该出现的抽屉遮罩 */}
      {!isSubpage && (
        <>
          <RateShortcutFab />
          <BottomNav />
          <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        </>
      )}
    </div>
  )
}
