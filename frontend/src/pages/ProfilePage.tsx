import { useState } from 'react'
import { User, Mail, Key, Shield, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSetNavSubtitle } from '../context/NavSubtitle'

export default function ProfilePage() {
  useSetNavSubtitle('Manage your account information')

  const [form, setForm] = useState({
    name: 'Admin',
    email: 'admin@agentscope.io',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    toast.success('Profile updated')
  }

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (form.newPassword !== form.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (form.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    toast.success('Password changed')
    setForm(f => ({ ...f, currentPassword: '', newPassword: '', confirmPassword: '' }))
  }

  return (
    <div className="p-8 max-w-2xl mx-auto w-full">
      <div className="space-y-5">

        {/* Avatar + name */}
        <div className="card flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-2xl font-bold shadow-sm shrink-0">
            A
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{form.name}</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{form.email}</p>
            <span className="badge-blue mt-1.5">Administrator</span>
          </div>
        </div>

        {/* Profile info */}
        <div className="card">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-elevated)' }}>
              <User size={15} className="text-brand-500" />
            </div>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Profile Information</h3>
          </div>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input
                className="input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  className="input pl-9"
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" className="btn-primary">
                <Save size={14} /> Save Changes
              </button>
            </div>
          </form>
        </div>

        {/* Change password */}
        <div className="card">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-elevated)' }}>
              <Key size={15} className="text-brand-500" />
            </div>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Change Password</h3>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="label">Current Password</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={form.currentPassword}
                onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">New Password</label>
              <input
                className="input"
                type="password"
                placeholder="Min. 8 characters"
                value={form.newPassword}
                onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={form.confirmPassword}
                onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
              />
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" className="btn-primary">
                <Shield size={14} /> Update Password
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  )
}
