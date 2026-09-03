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
