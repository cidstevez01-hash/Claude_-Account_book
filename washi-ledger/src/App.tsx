import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { I18nProvider } from './lib/i18n'
import { DashboardPage } from './features/ledger/DashboardPage'
import { HistoryPage } from './features/history/HistoryPage'
import { StatsPage } from './features/stats/StatsPage'
import { AddTransactionPage } from './features/add-entry/AddTransactionPage'
import { RatePage } from './features/rate/RatePage'
import { SettingsPage } from './features/settings/SettingsPage'
import { AccountPage } from './features/account/AccountPage'
import { SignInPage } from './features/auth/SignInPage'
import { SignUpPage } from './features/auth/SignUpPage'
import { AboutPage } from './features/about/AboutPage'

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/add" element={<AddTransactionPage />} />
          <Route path="/rate" element={<RatePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/register" element={<SignUpPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  )
}
