import { BrowserRouter, Route, Routes } from 'react-router'

import { AppShell } from '../routes/AppShell.js'
import { DashboardPage } from '../routes/DashboardPage.js'
import { LoginPage } from '../routes/LoginPage.js'
import { RequireAuth } from '../routes/RequireAuth.js'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
