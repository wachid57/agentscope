import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useNavSubtitle } from '../context/NavSubtitle'
import { useNavActions } from '../context/NavActions'
import {
  LayoutDashboard, Bot, Wrench, ChevronLeft, ChevronRight,
  Bell, Settings, LogOut, User, ChevronDown, Menu, Zap,
  MonitorDot, HardDrive, Sun, Moon,
} from 'lucide-react'
import clsx from 'clsx'

// ── Theme ─────────────────────────────────────────────────────────────────────

function useTheme() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('theme')
    if (stored) return stored === 'dark'
    return false // light default
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return { dark, toggle: () => setDark(d => !d) }
}

// ── Nav config ────────────────────────────────────────────────────────────────

type NavItem =
  | { kind: 'link'; to: string; icon: React.ElementType; label: string }
  | { kind: 'group'; icon: React.ElementType; label: string; key: string; children: { to: string; icon: React.ElementType; label: string }[] }

const nav: NavItem[] = [
  { kind: 'link', to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { kind: 'link', to: '/agents',    icon: Bot,             label: 'Agents'    },
  { kind: 'link', to: '/tools',     icon: Wrench,          label: 'Tools'     },
  {
    kind: 'group', icon: MonitorDot, label: 'System', key: 'system',
    children: [{ to: '/system/resources', icon: HardDrive, label: 'Resources' }],
  },
]

// ── Page title ────────────────────────────────────────────────────────────────

function usePageMeta() {
  const { pathname } = useLocation()
  if (pathname.includes('/chat'))               return { title: 'Chat',         sub: '' }
  if (pathname.startsWith('/agents/'))          return { title: 'Agent Detail', sub: '' }
  if (pathname.startsWith('/agents'))           return { title: 'Agents',       sub: '' }
  if (pathname.startsWith('/tools'))            return { title: 'Tools',        sub: '' }
  if (pathname.startsWith('/system/resources')) return { title: 'Resources',    sub: '' }
  if (pathname.startsWith('/dashboard'))        return { title: 'Dashboard',    sub: 'Monitor your AgentScope deployment in real-time' }
  if (pathname.startsWith('/profile'))          return { title: 'Profile',      sub: '' }
  if (pathname.startsWith('/settings'))         return { title: 'Settings',     sub: '' }
  return { title: 'AgentScope', sub: '' }
}

// ── Sidebar nav link ──────────────────────────────────────────────────────────

function SideLink({ to, icon: Icon, label, collapsed, indent = false }: {
  to: string; icon: React.ElementType; label: string; collapsed: boolean; indent?: boolean
}) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) => clsx(
        'flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative',
        indent && !collapsed ? 'pl-9 pr-3 py-1.5' : collapsed ? 'justify-center p-2.5 mx-0.5' : 'px-3 py-2',
        isActive
          ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200',
      )}
    >
      {({ isActive }) => (
        <>
          <Icon size={indent ? 13 : 15} className={clsx('shrink-0', isActive && 'text-brand-600 dark:text-brand-400')} />
          {!collapsed && <span className="truncate">{label}</span>}
          {isActive && !collapsed && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
          )}
          {collapsed && (
            <span className="absolute left-full ml-2.5 px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap shadow-dropdown z-50 transition-opacity duration-150">
              {label}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

// ── Sidebar group ─────────────────────────────────────────────────────────────

function SideGroup({ item, collapsed, openGroups, toggleGroup }: {
  item: Extract<NavItem, { kind: 'group' }>
  collapsed: boolean
  openGroups: Set<string>
  toggleGroup: (key: string) => void
}) {
  const { pathname } = useLocation()
  const isChildActive = item.children.some(c => pathname.startsWith(c.to))
  const isOpen = openGroups.has(item.key) || isChildActive

  return (
    <div>
      <button
        onClick={() => !collapsed && toggleGroup(item.key)}
        title={collapsed ? item.label : undefined}
        className={clsx(
          'w-full flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative',
          collapsed ? 'justify-center p-2.5 mx-0.5' : 'px-3 py-2',
          isChildActive
            ? 'text-brand-600 dark:text-brand-400'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200',
        )}
      >
        <item.icon size={15} className="shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronDown size={12} className={clsx('text-slate-400 transition-transform duration-200', isOpen && 'rotate-180')} />
          </>
        )}
        {collapsed && (
          <span className="absolute left-full ml-2.5 px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap shadow-dropdown z-50 transition-opacity">
            {item.label}
          </span>
        )}
      </button>

      {!collapsed && isOpen && (
        <div className="mt-0.5 space-y-0.5">
          {item.children.map(c => (
            <SideLink key={c.to} to={c.to} icon={c.icon} label={c.label} collapsed={false} indent />
          ))}
        </div>
      )}
      {collapsed && (
        <div className="mt-0.5 space-y-0.5">
          {item.children.map(c => (
            <SideLink key={c.to} to={c.to} icon={c.icon} label={c.label} collapsed />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['system']))
  const profileRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { title: pageTitle, sub: staticSub } = usePageMeta()
  const { subtitle: dynSub } = useNavSubtitle()
  const { actions: navActions } = useNavActions()
  const pageSub = dynSub || staticSub
  const { dark, toggle: toggleTheme } = useTheme()

  const toggleGroup = (key: string) =>
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setProfileOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="flex h-full" style={{ background: 'var(--bg-base)' }}>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside className={clsx(
        'flex flex-col shrink-0 transition-all duration-300 ease-in-out relative border-r',
        collapsed ? 'w-[60px]' : 'w-[220px]',
      )} style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--sidebar-border)' }}>

        {/* Logo */}
        <div className={clsx(
          'h-14 flex items-center shrink-0 border-b',
          collapsed ? 'justify-center px-0' : 'px-4',
        )} style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-white shrink-0 shadow-sm">
              <Zap size={14} />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-none" style={{ color: 'var(--text-primary)' }}>AgentScope</p>
                <p className="text-[10px] mt-0.5 font-medium" style={{ color: 'var(--text-muted)' }}>Manager</p>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {!collapsed && (
            <p className="section-title px-3 pt-3 pb-2">Navigation</p>
          )}
          {nav.map(item =>
            item.kind === 'link' ? (
              <SideLink key={item.to} to={item.to} icon={item.icon} label={item.label} collapsed={collapsed} />
            ) : (
              <SideGroup key={item.key} item={item} collapsed={collapsed} openGroups={openGroups} toggleGroup={toggleGroup} />
            )
          )}
        </nav>


        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3 top-[68px] w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-card border bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 z-10"
          style={{ borderColor: 'var(--border-strong)' }}
        >
          {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
        </button>
      </aside>

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar */}
        <header className="h-14 flex items-center px-6 gap-4 shrink-0 sticky top-0 z-20 border-b backdrop-blur-md"
          style={{ background: 'var(--navbar-bg)', borderColor: 'var(--border)' }}>

          {/* Mobile */}
          <button
            className="lg:hidden p-1.5 rounded-lg transition text-slate-400 hover:text-slate-600"
            onClick={() => setCollapsed(c => !c)}
          >
            <Menu size={17} />
          </button>

          {/* Page title + subtitle */}
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold leading-none truncate" style={{ color: 'var(--text-primary)' }}>
              {pageTitle}
            </h1>
            {pageSub && (
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{pageSub}</p>
            )}
          </div>

          {/* Page-level actions slot */}
          {navActions && (
            <div className="flex items-center gap-2 mr-2">
              {navActions}
            </div>
          )}

          {/* Right actions */}
          <div className="flex items-center gap-1">

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg transition-all text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              title={dark ? 'Switch to light' : 'Switch to dark'}
            >
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Notifications */}
            <button className="relative p-2 rounded-lg transition-all text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
              <Bell size={15} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-brand-500 rounded-full" />
            </button>

            <div className="w-px h-5 mx-1" style={{ background: 'var(--border-strong)' }} />

            {/* Profile */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(o => !o)}
                className={clsx(
                  'flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-xl transition-all duration-150',
                  profileOpen
                    ? 'bg-slate-100 dark:bg-slate-800'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800',
                )}
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                  A
                </div>
                <span className="text-sm font-medium hidden sm:block" style={{ color: 'var(--text-primary)' }}>Admin</span>
                <ChevronDown size={13} className={clsx('transition-transform duration-200 hidden sm:block text-slate-400', profileOpen && 'rotate-180')} />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 rounded-xl shadow-dropdown border overflow-hidden z-50 animate-in"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                  <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                        A
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Admin</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>admin@agentscope.io</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-1.5">
                    {[
                      { icon: User, label: 'Profile', action: () => { setProfileOpen(false); navigate('/profile') } },
                      { icon: Settings, label: 'Settings', action: () => { setProfileOpen(false); navigate('/settings') } },
                    ].map(({ icon: Icon, label, action }) => (
                      <button key={label} onClick={action}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all hover:bg-slate-100 dark:hover:bg-slate-800"
                        style={{ color: 'var(--text-secondary)' }}>
                        <Icon size={13} /> {label}
                      </button>
                    ))}
                  </div>
                  <div className="p-1.5 border-t" style={{ borderColor: 'var(--border)' }}>
                    <button onClick={() => setProfileOpen(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all">
                      <LogOut size={13} /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
