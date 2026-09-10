import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { I18nProvider } from './lib/i18n'
import { SettingsProvider } from './hooks/useSettings'
import { CatalogProvider } from './hooks/useCatalog'
import { DrawerProvider } from './hooks/useDrawer'
import { FireworksBackground } from './design-system/components/FireworksBackground'
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

export default function App() {
  return (
    <SettingsProvider>
      {/* R-29：常驻挂在这里(不是某个AppLayout实例内)，只根据themeSkin切换渲染，
          切页面/路由不会打断动效。渲染顺序在Routes前面，天然沉在下面——AppLayout
          根容器在"夏 · 花火"下会把自己背景改透明，才会真的透出来(见AppLayout.tsx) */}
      <FireworksBackground />
      <I18nProvider>
        <CatalogProvider>
          <BrowserRouter>
            <DrawerProvider>
              {/* B-XX：路由切换的入场渐显(.route-fade)之前包在这一层，连
                  BottomNav/RateShortcutFab/NavDrawer这些"应该感觉持续存在、不随页面
                  切换重新出现"的常驻元素也被一起罩进去了——每次切tab，这些元素的
                  opacity从0淡入的同时，.tab-bubble自己的Web Animations API滑动动画
                  也在跑，两个动画叠在一起，视觉上就是真机反馈的"切换有凝滞感"。
                  渐显效果挪到AppLayout.tsx内部，只包住header+main这两块真正的"页面
                  内容"，不再包住这些常驻的fixed定位元素，见那边的说明 */}
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
            </DrawerProvider>
          </BrowserRouter>
        </CatalogProvider>
      </I18nProvider>
    </SettingsProvider>
  )
}
