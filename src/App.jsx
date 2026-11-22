import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Rainfall from './pages/Rainfall.jsx'
import Irrigation from './pages/Irrigation.jsx'
import Drought from './pages/Drought.jsx'
import Alerts from './pages/Alerts.jsx'
import Profile from './pages/Profile.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="rainfall" element={<Rainfall />} />
        <Route path="irrigation" element={<Irrigation />} />
        <Route path="drought" element={<Drought />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
