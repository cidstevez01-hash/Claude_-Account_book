import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { I18nProvider } from './lib/i18n'
import { DashboardPage } from './features/ledger/DashboardPage'
import { HistoryPage } from './features/history/HistoryPage'
import { StatsPage } from './features/stats/StatsPage'
import { AddTransactionPage } from './features/add-entry/AddTransactionPage'
import { PlaceholderPage } from './design-system/components/PlaceholderPage'

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/add" element={<AddTransactionPage />} />
          <Route path="/rate" element={<PlaceholderPage title="汇率换算" note="照_6/_35做" />} />
          <Route path="/settings" element={<PlaceholderPage title="设置" note="照_18做" />} />
          <Route path="/account" element={<PlaceholderPage title="我的账户" note="照_30/_31/_32做" />} />
          <Route path="/about" element={<PlaceholderPage title="关于" note="照_19做" />} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  )
}
