import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { LangProvider } from './lib/i18n.tsx'
import Landing from './pages/Landing.tsx'
import Portal from './pages/portal/Portal.tsx'
import Admin from './pages/admin/Admin.tsx'

export default function App() {
  return (
    <LangProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/portal/*" element={<Portal />} />
          <Route path="/admin/*" element={<Admin />} />
        </Routes>
      </BrowserRouter>
    </LangProvider>
  )
}
