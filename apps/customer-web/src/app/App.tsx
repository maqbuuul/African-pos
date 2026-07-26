import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import { AppShell } from '../routes/AppShell.js'
import { EntryPage } from '../routes/EntryPage.js'
import { FeedbackPage } from '../routes/FeedbackPage.js'
import { MenuPage } from '../routes/MenuPage.js'
import { OrderStatusPage } from '../routes/OrderStatusPage.js'
import { PaymentPage } from '../routes/PaymentPage.js'
import { RequireSession } from '../routes/RequireSession.js'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/welcome" element={<EntryPage />} />
        <Route element={<RequireSession />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<MenuPage />} />
            <Route path="/order" element={<OrderStatusPage />} />
            <Route path="/payment" element={<PaymentPage />} />
            <Route path="/feedback" element={<FeedbackPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
