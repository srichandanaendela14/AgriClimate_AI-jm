import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Bell,
  CloudRain,
  Droplets,
  LayoutDashboard,
  Menu,
  Sprout,
  Sun,
  User,
  X,
} from 'lucide-react'

export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/rainfall', label: 'Rainfall', icon: CloudRain },
  { to: '/irrigation', label: 'Irrigation', icon: Droplets },
  { to: '/drought', label: 'Drought', icon: Sun },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/profile', label: 'Profile', icon: User },
]

const MOBILE_TABS = NAV_ITEMS.filter((item) => item.to !== '/profile')

function navClass({ isActive }) {
  return `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-100 text-brand-800' : 'text-slate-600 hover:bg-brand-50 hover:text-brand-800'
  }`
}

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2" onClick={() => setMenuOpen(false)}>
            <span className="flex size-9 items-center justify-center rounded-lg bg-brand-700 text-white">
              <Sprout className="size-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-bold tracking-tight text-brand-900">
              AgriClimate <span className="text-brand-600">AI</span>
            </span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            className="rounded-lg p-2 text-slate-700 hover:bg-brand-50 lg:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>

        {menuOpen && (
          <nav id="mobile-menu" aria-label="Mobile" className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
            <div className="flex flex-col gap-1">
              <NavLink to="/" end className={navClass} onClick={() => setMenuOpen(false)}>
                Home
              </NavLink>
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.to} to={item.to} className={navClass} onClick={() => setMenuOpen(false)}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main key={location.pathname} className="flex-1 pb-24 lg:pb-0">
        <Outlet />
      </main>

      <footer className="hidden border-t border-slate-200 bg-brand-50 lg:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-sm text-slate-600">
          <p>AgriClimate AI – weather intelligence for farmers</p>
          <p>
            Weather data by{' '}
            <a href="https://open-meteo.com" target="_blank" rel="noreferrer" className="font-medium text-brand-700 underline">
              Open-Meteo
            </a>
          </p>
        </div>
      </footer>

      <nav
        aria-label="Quick"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="grid grid-cols-5">
          {MOBILE_TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2 text-xs font-medium ${
                  isActive ? 'text-brand-700' : 'text-slate-500'
                }`
              }
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
