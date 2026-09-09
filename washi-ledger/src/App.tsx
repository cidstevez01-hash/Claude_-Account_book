import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { I18nProvider } from './lib/i18n'
import { SettingsProvider } from './hooks/useSettings'
import { CatalogProvider } from './hooks/useCatalog'
import { DrawerProvider } from './hooks/useDrawer'
import { FireworksBackground } from './design-system/components/FireworksBackground'
import { IconGradientDefs } from './design-system/components/IconGradientDefs'
import { DashboardPage } from './features/ledger/DashboardPage'
import { HistoryPage } from './features/history/HistoryPage'
import { StatsPage } from './features/stats/StatsPage'
import { AddTransactionPage } from './features/add-entry/AddTransactionPage'
import { RatePage } from './features/rate/RatePage'
import { SettingsPage } from './features/settings/SettingsPage'
import { ThemePage } from './features/settings/ThemePage'
import { AccountPage } from './features/account/AccountPage'
import { ChangeAvatarPage } from './features/account/ChangeAvatarPage'
import { SignInPage } from './features/auth/SignInPage'
import { SignUpPage } from './features/auth/SignUpPage'
import { AboutPage } from './features/about/AboutPage'

// B-XX：每个页面组件都是自己独立一整块"fixed inset-0"根容器(AppLayout或页面自己
// 写的同款根div)，之前Routes切换时旧页面瞬间卸载、新页面瞬间挂载，中间没有任何过渡，
// 视觉上是硬切"一跳一跳"。这里包一层用location.pathname当key的div——路由一变这个
// key跟着变，React会把它当成全新节点重新挂载，天然触发一次CSS入场动画(.route-fade)，
// 不需要额外状态机/动画库。只做opacity渐显，不用transform位移——AppLayout自己的根
// 也是fixed inset-0，且BottomNav/RateShortcutFab/NavDrawer这些fixed定位的后代都在它
// 内部，如果给这层包裹div加transform，会让它变成这些fixed后代新的containing block，
// 在移动端全屏(视口=这层div尺寸)问题不大，但宽屏预览下mx-auto max-w-[480px]会让
// 两者尺寸不一致，实际测过这个坑不值得为一个入场动效冒这个险，opacity不会有这个副作用
function AnimatedRoutes() {
  const location = useLocation()
  return (
    <div key={location.pathname} className="route-fade">
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/add" element={<AddTransactionPage />} />
        <Route path="/rate" element={<RatePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/theme" element={<ThemePage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/account/avatar" element={<ChangeAvatarPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/register" element={<SignUpPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      {/* R-29：常驻挂在这里(不是某个AppLayout实例内)，只根据themeSkin切换渲染，
          切页面/路由不会打断动效。渲染顺序在Routes前面，天然沉在下面——AppLayout
          根容器在"夏 · 花火"下会把自己背景改透明，才会真的透出来(见AppLayout.tsx) */}
      <FireworksBackground />
      <IconGradientDefs />
      <I18nProvider>
        <CatalogProvider>
          <BrowserRouter>
            <DrawerProvider>
              <AnimatedRoutes />
            </DrawerProvider>
          </BrowserRouter>
        </CatalogProvider>
      </I18nProvider>
    </SettingsProvider>
  )
}
