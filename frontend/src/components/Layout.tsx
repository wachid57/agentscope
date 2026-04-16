import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Bot,
  Wrench,
  Github,
  ChevronLeft,
  ChevronRight,
  Bell,
  Settings,
  LogOut,
  User,
  ChevronDown,
  Menu,
  Zap,
} from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/agents', icon: Bot, label: 'Agents' },
  { to: '/tools', icon: Wrench, label: 'Tools' },
]

function usePageTitle() {
  const location = useLocation()
  const path = location.pathname
  if (path.startsWith('/agents') && path.includes('/chat')) return { title: 'Chat', icon: Bot }
  if (path.startsWith('/agents/')) return { title: 'Agent Detail', icon: Bot }
  if (path.startsWith('/agents')) return { title: 'Agents', icon: Bot }
  if (path.startsWith('/tools')) return { title: 'Tools', icon: Wrench }
  if (path.startsWith('/dashboard')) return { title: 'Dashboard', icon: LayoutDashboard }
  return { title: 'AgentScope', icon: Zap }
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const pageInfo = usePageTitle()

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside
        className={clsx(
          'bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 transition-all duration-300 ease-in-out relative',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        {/* Logo */}
        <div className={clsx('h-16 border-b border-slate-800 flex items-center shrink-0', collapsed ? 'justify-center px-2' : 'px-4')}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-lg shadow-brand-900/50">
              <Zap size={16} />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-semibold text-slate-100 text-sm leading-none">AgentScope</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Manager</p>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {!collapsed && (
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-3 py-2 mt-1">
              Navigation
            </p>
          )}
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg text-sm font-medium transition-all group relative',
                  collapsed ? 'justify-center px-0 py-2.5 mx-1' : 'px-3 py-2',
                  isActive
                    ? 'bg-brand-600/15 text-brand-400 border border-brand-800/40'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={clsx('shrink-0', isActive && 'drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]')} />
                  {!collapsed && <span>{label}</span>}
                  {/* Active indicator */}
                  {isActive && !collapsed && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400" />
                  )}
                  {/* Tooltip when collapsed */}
                  {collapsed && (
                    <span className="absolute left-full ml-3 px-2 py-1 bg-slate-800 text-slate-100 text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap border border-slate-700 shadow-xl z-50 transition-opacity">
                      {label}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className={clsx('p-2 border-t border-slate-800 space-y-0.5')}>
          <a
            href="https://github.com/modelscope/agentscope"
            target="_blank"
            rel="noreferrer"
            title={collapsed ? 'GitHub' : undefined}
            className={clsx(
              'flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition rounded-lg hover:bg-slate-800/80 group relative',
              collapsed ? 'justify-center px-0 py-2.5 mx-1' : 'px-3 py-2',
            )}
          >
            <Github size={14} className="shrink-0" />
            {!collapsed && 'GitHub'}
            {collapsed && (
              <span className="absolute left-full ml-3 px-2 py-1 bg-slate-800 text-slate-100 text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap border border-slate-700 shadow-xl z-50 transition-opacity">
                AgentScope on GitHub
              </span>
            )}
          </a>
        </div>

        {/* Collapse Toggle Button */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3 top-20 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-all shadow-md z-10"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Navbar / Topbar */}
        <header className="h-16 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 flex items-center px-6 gap-4 shrink-0 sticky top-0 z-20">
          {/* Mobile menu toggle */}
          <button
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
            onClick={() => setCollapsed(c => !c)}
          >
            <Menu size={18} />
          </button>

          {/* Breadcrumb / Page title area */}
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <pageInfo.icon size={16} className="text-slate-500 shrink-0" />
            <span className="text-sm font-semibold text-slate-200 truncate">{pageInfo.title}</span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button className="relative p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition">
              <Bell size={16} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-brand-500 rounded-full" />
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-slate-800 mx-1" />

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(o => !o)}
                className={clsx(
                  'flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl transition-all',
                  profileOpen ? 'bg-slate-800 text-slate-100' : 'hover:bg-slate-800 text-slate-300 hover:text-slate-100',
                )}
              >
                {/* Avatar */}
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold shadow-md">
                  A
                </div>
                <span className="text-sm font-medium hidden sm:block">Admin</span>
                <ChevronDown
                  size={14}
                  className={clsx('text-slate-500 transition-transform hidden sm:block', profileOpen && 'rotate-180')}
                />
              </button>

              {/* Dropdown Menu */}
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50 animate-in">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-sm font-bold shadow-md">
                        A
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-100">Admin</p>
                        <p className="text-xs text-slate-500">admin@agentscope.io</p>
                      </div>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="p-1.5">
                    <button
                      onClick={() => { setProfileOpen(false); navigate('/dashboard') }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
                    >
                      <User size={14} />
                      Profile
                    </button>
                    <button
                      onClick={() => { setProfileOpen(false) }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
                    >
                      <Settings size={14} />
                      Settings
                    </button>
                  </div>

                  <div className="p-1.5 border-t border-slate-800">
                    <button
                      onClick={() => { setProfileOpen(false) }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 transition"
                    >
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
