import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CreditCard, Camera,
  Plus, X, Check,
  Star, ChevronRight, Zap, Smartphone,
  Monitor, KeyRound,
  ShieldCheck, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

import { useAuth } from '@/hooks/useAuth'
import PageTransition from '@/components/layout/PageTransition'

/* ─── Tab Types ─── */

const TABS = ['profile', 'agency', 'team', 'notifications', 'security', 'subscription'] as const
type SettingsTab = typeof TABS[number]

/* ─── Shared Styles ─── */

const inputClasses = 'w-full h-11 px-3 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors'
const labelClasses = 'block text-sm font-medium text-theme-primary mb-1.5'
const readonlyClasses = 'w-full h-11 px-3 rounded-lg border border-theme-border bg-theme-input text-sm text-theme-muted cursor-not-allowed'
const cardClasses = 'rounded-xl border border-theme-border'

/* ─── Language Selector Component ─── */

const LANGUAGES = [
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'de', label: 'DE', name: 'Deutsch' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'it', label: 'IT', name: 'Italiano' },
] as const

function LanguageSelector() {
  const { t, i18n } = useTranslation('settings')
  const currentLang = i18n.language

  return (
    <div className="py-4 border-b border-theme-border flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-8">
      <div className="sm:w-40 shrink-0">
        <p className="text-sm font-medium text-theme-primary">{t('profile.language')}</p>
        <p className="text-xs text-theme-tertiary mt-0.5">{t('profile.languageHint')}</p>
      </div>
      <div className="flex-1">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {LANGUAGES.map((lang) => {
            const isSelected = currentLang === lang.code
            return (
              <button
                key={lang.code}
                onClick={() => i18n.changeLanguage(lang.code)}
                className={cn(
                  'rounded-xl border p-3 text-center cursor-pointer transition-all',
                  isSelected
                    ? 'border-accent bg-accent/5 text-accent'
                    : 'border-theme-border text-theme-secondary hover:border-theme-active hover:text-theme-primary'
                )}
              >
                <div className="text-sm font-semibold">{lang.label}</div>
                <div className={cn(
                  'text-xs mt-0.5',
                  isSelected ? 'text-accent/70' : 'text-theme-tertiary'
                )}>
                  {lang.name}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ─── Profile Tab ─── */

function ProfileTab() {
  const { user, signOut } = useAuth()
  const { t } = useTranslation('settings')

  const [form, setForm] = useState({
    firstName: 'Gregory',
    lastName: 'Lyonnet',
    email: user?.email ?? 'gregory.lyonnet@megga.ch',
    phone: '+41 22 310 45 67',
    role: 'Agent immobilier',
    bio: 'Agent immobilier spécialisé dans le marché genevois depuis 12 ans. Expertise en biens de prestige et transactions internationales.',
  })

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  return (
    <div className="space-y-0">
      {/* Profile section — bento transparent */}
      <div className={cn(cardClasses, 'p-6')}>
        <h2 className="text-base font-semibold text-theme-primary">{t('profile.title')}</h2>
        <p className="text-sm text-theme-tertiary mt-0.5">{t('profile.subtitle')}</p>

        {/* Avatar row */}
        <div className="flex items-center gap-5 mt-5 pb-5 border-b border-theme-border">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center">
              <span className="text-xl font-bold text-white">GL</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-theme-primary">{t('profile.photo')}</p>
            <p className="text-xs text-theme-tertiary mt-0.5">{t('profile.photoHint')}</p>
          </div>
        </div>

        {/* Username-style row */}
        <div className="py-4 border-b border-theme-border flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8">
          <div className="sm:w-40 shrink-0">
            <p className="text-sm font-medium text-theme-primary">{t('profile.firstName')}</p>
          </div>
          <input type="text" value={form.firstName} onChange={e => update('firstName', e.target.value)} className={inputClasses} />
        </div>

        <div className="py-4 border-b border-theme-border flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8">
          <div className="sm:w-40 shrink-0">
            <p className="text-sm font-medium text-theme-primary">{t('profile.lastName')}</p>
          </div>
          <input type="text" value={form.lastName} onChange={e => update('lastName', e.target.value)} className={inputClasses} />
        </div>

        <div className="py-4 border-b border-theme-border flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8">
          <div className="sm:w-40 shrink-0">
            <p className="text-sm font-medium text-theme-primary">{t('profile.email')}</p>
            <p className="text-xs text-theme-tertiary">{t('profile.emailHint')}</p>
          </div>
          <input type="email" value={form.email} readOnly className={readonlyClasses} />
        </div>

        <div className="py-4 border-b border-theme-border flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8">
          <div className="sm:w-40 shrink-0">
            <p className="text-sm font-medium text-theme-primary">{t('profile.phone')}</p>
          </div>
          <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} className={inputClasses} />
        </div>

        <div className="py-4 border-b border-theme-border flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8">
          <div className="sm:w-40 shrink-0">
            <p className="text-sm font-medium text-theme-primary">{t('profile.role')}</p>
          </div>
          <input type="text" value={form.role} onChange={e => update('role', e.target.value)} className={inputClasses} />
        </div>

        {/* Language selector */}
        <LanguageSelector />
      </div>

      {/* Bio section */}
      <div className={cn(cardClasses, 'p-6 mt-4')}>
        <h2 className="text-base font-semibold text-theme-primary">{t('profile.bio')}</h2>
        <p className="text-sm text-theme-tertiary mt-0.5 mb-4">{t('profile.bioHint')}</p>
        <textarea
          value={form.bio}
          onChange={e => update('bio', e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors resize-none placeholder:text-theme-tertiary"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-6">
        <button className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">
          {t('profile.save')}
        </button>
        <button
          onClick={async () => { await signOut() }}
          className="text-sm font-medium text-theme-tertiary hover:text-danger transition-colors"
        >
          {t('profile.logout')}
        </button>
      </div>
    </div>
  )
}

/* ─── Agency Tab ─── */

function AgencyTab() {
  const { t } = useTranslation('settings')

  const [form, setForm] = useState({
    name: 'MEGGA Real Estate',
    address: 'Rue du Rhône 42, 1204 Genève',
    phone: '+41 22 310 00 00',
    email: 'contact@megga.ch',
    website: 'www.megga.ch',
    description: 'Agence immobilière premium à Genève, spécialisée dans les biens de prestige et les transactions internationales.',
    ideNumber: 'CHE-123.456.789',
  })

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-theme-primary">{t('agency.title')}</h2>
        <p className="text-sm text-theme-muted mt-1">{t('agency.subtitle')}</p>
      </div>

      {/* Logo */}
      <div className="flex items-center gap-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-card bg-theme-primary flex items-center justify-center">
            <span className="text-lg font-bold text-theme-inverse">GG</span>
          </div>
          <button className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-theme-card border border-theme-border flex items-center justify-center hover:bg-theme-hover transition-colors">
            <Camera className="w-4 h-4 text-theme-muted" />
          </button>
        </div>
        <div>
          <p className="text-sm font-medium text-theme-primary">{t('agency.logo')}</p>
          <p className="text-xs text-theme-muted mt-0.5">{t('agency.logoHint')}</p>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className={labelClasses}>{t('agency.name')}</label>
          <input type="text" value={form.name} onChange={e => update('name', e.target.value)} className={inputClasses} />
        </div>
        <div className="md:col-span-2">
          <label className={labelClasses}>{t('agency.address')}</label>
          <input type="text" value={form.address} onChange={e => update('address', e.target.value)} className={inputClasses} />
        </div>
        <div>
          <label className={labelClasses}>{t('agency.phone')}</label>
          <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} className={inputClasses} />
        </div>
        <div>
          <label className={labelClasses}>{t('agency.email')}</label>
          <input type="email" value={form.email} onChange={e => update('email', e.target.value)} className={inputClasses} />
        </div>
        <div>
          <label className={labelClasses}>{t('agency.website')}</label>
          <input type="text" value={form.website} onChange={e => update('website', e.target.value)} className={inputClasses} />
        </div>
        <div>
          <label className={labelClasses}>{t('agency.ideNumber')}</label>
          <input type="text" value={form.ideNumber} onChange={e => update('ideNumber', e.target.value)} className={inputClasses} />
        </div>
      </div>

      <div>
        <label className={labelClasses}>{t('agency.description')}</label>
        <textarea
          value={form.description}
          onChange={e => update('description', e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-none"
        />
      </div>

      <div className="flex justify-end">
        <button className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">
          {t('agency.save')}
        </button>
      </div>
    </div>
  )
}

/* ─── Team Tab ─── */

interface TeamMember {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'agent' | 'assistant'
  status: 'active' | 'invited'
  addedAt: string
  initials: string
}

const MOCK_TEAM: TeamMember[] = [
  { id: '1', name: 'Gregory Lyonnet', email: 'gregory.lyonnet@megga.ch', role: 'admin', status: 'active', addedAt: '12.01.2025', initials: 'GL' },
  { id: '2', name: 'Sophie Martin', email: 'sophie.martin@megga.ch', role: 'agent', status: 'active', addedAt: '15.03.2025', initials: 'SM' },
  { id: '3', name: 'Lucas Bernard', email: 'lucas.bernard@megga.ch', role: 'agent', status: 'active', addedAt: '02.06.2025', initials: 'LB' },
  { id: '4', name: 'Emma Favre', email: 'emma.favre@megga.ch', role: 'assistant', status: 'invited', addedAt: '10.03.2026', initials: 'EF' },
]

function InviteMemberModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('settings')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamMember['role']>('agent')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="rounded-xl border border-theme-border bg-theme-elevated w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-theme-border">
          <h3 className="text-lg font-semibold text-theme-primary">{t('team.inviteModal.title')}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-theme-hover transition-colors">
            <X className="w-5 h-5 text-theme-muted" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={labelClasses}>{t('team.inviteModal.email')}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nom@agence.ch" className={inputClasses} />
          </div>
          <div>
            <label className={labelClasses}>{t('team.inviteModal.role')}</label>
            <select value={role} onChange={e => setRole(e.target.value as TeamMember['role'])} className={inputClasses}>
              <option value="admin">{t('team.roles.admin')}</option>
              <option value="manager">{t('team.roles.manager')}</option>
              <option value="agent">{t('team.roles.agent')}</option>
              <option value="assistant">{t('team.roles.assistant')}</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3 p-5 border-t border-theme-border">
          <button onClick={onClose} className="flex-1 h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">{t('team.inviteModal.cancel')}</button>
          <button disabled={!email.includes('@')} className={cn('flex-1 h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors', !email.includes('@') && 'opacity-50 cursor-not-allowed')}>
            {t('team.inviteModal.send')}
          </button>
        </div>
      </div>
    </div>
  )
}

function TeamTab() {
  const { t } = useTranslation('settings')
  const [showInvite, setShowInvite] = useState(false)

  const statusStyles: Record<TeamMember['status'], { classes: string }> = {
    active:  { classes: 'bg-success/10 text-success' },
    invited: { classes: 'bg-warning/10 text-warning' },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-theme-primary">{t('team.title')}</h2>
          <p className="text-sm text-theme-muted mt-1">{t('team.subtitle')}</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{t('team.invite')}</span>
          <span className="sm:hidden">{t('team.inviteShort')}</span>
        </button>
      </div>

      <div className={cn(cardClasses, 'overflow-hidden')}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-theme-border bg-theme-section/30">
              <th className="text-left text-xs font-medium text-theme-muted uppercase tracking-wider px-5 py-3">{t('team.table.member')}</th>
              <th className="text-left text-xs font-medium text-theme-muted uppercase tracking-wider px-5 py-3 hidden md:table-cell">{t('team.table.role')}</th>
              <th className="text-left text-xs font-medium text-theme-muted uppercase tracking-wider px-5 py-3 hidden sm:table-cell">{t('team.table.status')}</th>
              <th className="text-left text-xs font-medium text-theme-muted uppercase tracking-wider px-5 py-3 hidden lg:table-cell">{t('team.table.addedAt')}</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_TEAM.map((member, i) => (
              <tr key={member.id} className={cn('hover:bg-theme-hover transition-colors', i < MOCK_TEAM.length - 1 && 'border-b border-theme-border/50')}>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-accent">{member.initials}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-theme-primary truncate">{member.name}</p>
                      <p className="text-xs text-theme-muted truncate">{member.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 hidden md:table-cell">
                  <span className="text-sm text-theme-secondary">{t(`team.roles.${member.role}`)}</span>
                </td>
                <td className="px-5 py-4 hidden sm:table-cell">
                  <span className={cn('text-xs font-medium px-2 py-1 rounded-badge', statusStyles[member.status].classes)}>
                    {t(`team.status.${member.status}`)}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm text-theme-muted hidden lg:table-cell">{member.addedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showInvite && <InviteMemberModal onClose={() => setShowInvite(false)} />}
    </div>
  )
}

/* ─── Notifications Tab ─── */

const NOTIF_CATEGORY_KEYS = ['leads', 'messages', 'visits', 'offers', 'kyc', 'calendar'] as const

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={cn('relative w-10 h-6 rounded-full transition-colors shrink-0', enabled ? 'bg-accent' : 'bg-theme-border')}
    >
      <div className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-theme-card shadow-sm transition-transform', enabled ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  )
}

function NotificationsTab() {
  const { t } = useTranslation('settings')

  const [settings, setSettings] = useState<Record<string, { email: boolean; push: boolean }>>(
    Object.fromEntries(NOTIF_CATEGORY_KEYS.map(c => [c, { email: true, push: true }]))
  )

  const updateSetting = (id: string, channel: 'email' | 'push', value: boolean) => {
    setSettings(prev => ({ ...prev, [id]: { ...prev[id], [channel]: value } }))
  }

  return (
    <div className="space-y-0">
      <div className={cn(cardClasses, 'p-6')}>
        <h2 className="text-base font-semibold text-theme-primary">{t('notifications.title')}</h2>
        <p className="text-sm text-theme-tertiary mt-0.5 mb-1">{t('notifications.subtitle')}</p>

        {NOTIF_CATEGORY_KEYS.map((catKey, i) => {
          const s = settings[catKey]
          return (
            <div key={catKey} className={cn(
              'py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6',
              i < NOTIF_CATEGORY_KEYS.length - 1 && 'border-b border-theme-border'
            )}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-theme-primary">{t(`notifications.categories.${catKey}.label`)}</p>
                <p className="text-xs text-theme-tertiary mt-0.5">{t(`notifications.categories.${catKey}.description`)}</p>
              </div>
              <div className="flex items-center gap-6 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-theme-tertiary">{t('notifications.email')}</span>
                  <Toggle enabled={s.email} onChange={v => updateSetting(catKey, 'email', v)} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-theme-tertiary">{t('notifications.push')}</span>
                  <Toggle enabled={s.push} onChange={v => updateSetting(catKey, 'push', v)} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Security Tab ─── */

interface SessionDevice {
  id: string
  device: string
  icon: React.ElementType
  location: string
  lastActive: string
  isCurrent: boolean
}

const MOCK_SESSIONS: SessionDevice[] = [
  { id: 's1', device: 'MacBook Pro — Chrome', icon: Monitor, location: 'Genève, Suisse', lastActive: 'Actif maintenant', isCurrent: true },
  { id: 's2', device: 'iPhone 15 Pro — Safari', icon: Smartphone, location: 'Genève, Suisse', lastActive: 'Il y a 2 heures', isCurrent: false },
  { id: 's3', device: 'iPad Air — Safari', icon: Monitor, location: 'Lausanne, Suisse', lastActive: 'Il y a 3 jours', isCurrent: false },
]

interface SecurityEvent {
  id: string
  action: string
  detail: string
  date: string
  icon: React.ElementType
  iconColor: string
}

const MOCK_SECURITY_LOG: SecurityEvent[] = [
  { id: 'e1', action: 'Connexion réussie', detail: 'Chrome — MacBook Pro, Genève', date: "Aujourd'hui, 09:12", icon: ShieldCheck, iconColor: 'text-success bg-success/10' },
  { id: 'e2', action: 'Mot de passe modifié', detail: 'Via les paramètres du compte', date: '15.03.2026, 14:30', icon: KeyRound, iconColor: 'text-accent bg-accent/10' },
  { id: 'e3', action: 'Nouvelle session', detail: 'iPhone 15 Pro — Safari, Genève', date: '14.03.2026, 08:45', icon: Smartphone, iconColor: 'text-warning bg-warning/10' },
  { id: 'e4', action: 'Tentative de connexion échouée', detail: 'Mot de passe incorrect — 2 tentatives', date: '12.03.2026, 22:10', icon: AlertTriangle, iconColor: 'text-danger bg-danger/10' },
  { id: 'e5', action: 'Connexion réussie', detail: 'Safari — iPad Air, Lausanne', date: '10.03.2026, 11:00', icon: ShieldCheck, iconColor: 'text-success bg-success/10' },
]

function SecurityTab() {
  const { t } = useTranslation('settings')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)

  const passwordMatch = newPassword === confirmPassword
  const passwordValid = newPassword.length >= 6

  return (
    <div className="space-y-4">
      {/* ── Change Password ── */}
      <div className={cn(cardClasses, 'p-6')}>
        <h2 className="text-base font-semibold text-theme-primary">{t('security.password.title')}</h2>
        <p className="text-sm text-theme-tertiary mt-0.5 mb-5">{t('security.password.lastModified', { date: '15.03.2026' })}</p>

        <div className="space-y-4 max-w-md">
          <div>
            <label className={labelClasses}>{t('security.password.current')}</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••" className={inputClasses} />
          </div>
          <div>
            <label className={labelClasses}>{t('security.password.new')}</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t('security.password.newHint')} className={inputClasses} />
            {newPassword && !passwordValid && (
              <p className="text-xs text-danger mt-1">{t('security.password.minLength')}</p>
            )}
          </div>
          <div>
            <label className={labelClasses}>{t('security.password.confirm')}</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder={t('security.password.confirmHint')} className={inputClasses} />
            {confirmPassword && !passwordMatch && (
              <p className="text-xs text-danger mt-1">{t('security.password.mismatch')}</p>
            )}
          </div>

          <button
            disabled={!currentPassword || !passwordValid || !passwordMatch}
            className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('security.password.update')}
          </button>
        </div>
      </div>

      {/* ── Two-Factor Authentication ── */}
      <div className={cn(cardClasses, 'p-6')}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-theme-primary">{t('security.twoFactor.title')}</h2>
            <p className="text-sm text-theme-tertiary mt-0.5">
              {twoFactorEnabled ? t('security.twoFactor.enabled') : t('security.twoFactor.disabled')}
            </p>
          </div>
          <Toggle enabled={twoFactorEnabled} onChange={setTwoFactorEnabled} />
        </div>
        {!twoFactorEnabled && (
          <p className="text-xs text-theme-tertiary mt-3 border-t border-theme-border pt-3">
            {t('security.twoFactor.recommendation')}
          </p>
        )}
      </div>

      {/* ── Active Sessions ── */}
      <div className={cn(cardClasses, 'p-6')}>
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-base font-semibold text-theme-primary">{t('security.sessions.title')}</h2>
            <p className="text-sm text-theme-tertiary mt-0.5">{t('security.sessions.devicesConnected', { count: MOCK_SESSIONS.length })}</p>
          </div>
          <button className="text-xs font-medium text-theme-tertiary hover:text-danger transition-colors">
            {t('security.sessions.disconnectAll')}
          </button>
        </div>

        {MOCK_SESSIONS.map((session, i) => (
          <div key={session.id} className={cn(
            'py-4 flex items-center gap-4',
            i < MOCK_SESSIONS.length - 1 && 'border-b border-theme-border'
          )}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-theme-primary truncate">{session.device}</p>
                {session.isCurrent && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">{t('security.sessions.current')}</span>
                )}
              </div>
              <p className="text-xs text-theme-tertiary mt-0.5">{session.location} · {session.lastActive}</p>
            </div>
            {!session.isCurrent && (
              <button className="text-xs font-medium text-theme-tertiary hover:text-danger transition-colors">
                {t('security.sessions.revoke')}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ── Security Log ── */}
      <div className={cn(cardClasses, 'p-6')}>
        <h2 className="text-base font-semibold text-theme-primary">{t('security.log.title')}</h2>
        <p className="text-sm text-theme-tertiary mt-0.5 mb-1">{t('security.log.subtitle')}</p>

        {MOCK_SECURITY_LOG.map((event, i) => (
          <div key={event.id} className={cn(
            'py-3.5 flex items-center gap-3',
            i < MOCK_SECURITY_LOG.length - 1 && 'border-b border-theme-border'
          )}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-theme-primary">{event.action}</p>
              <p className="text-xs text-theme-tertiary mt-0.5">{event.detail}</p>
            </div>
            <span className="text-xs text-theme-tertiary whitespace-nowrap shrink-0">{event.date}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Subscription Tab ─── */

interface PlanFeature { textKey: string; included: boolean }
interface Plan {
  nameKey: string; priceKey: string; period: string; descriptionKey: string
  features: PlanFeature[]; isCurrent?: boolean; isPopular?: boolean
}

const PLANS: Plan[] = [
  {
    nameKey: 'subscription.plans.starter.name', priceKey: 'subscription.free', period: '', descriptionKey: 'subscription.plans.starter.description',
    features: [
      { textKey: 'subscription.features.activeProperties10', included: true },
      { textKey: 'subscription.features.contacts50', included: true },
      { textKey: 'subscription.features.basicSearch', included: true },
      { textKey: 'subscription.features.aiAssistance', included: false },
      { textKey: 'subscription.features.kycPipeline', included: false },
      { textKey: 'subscription.features.sellerPortal', included: false },
      { textKey: 'subscription.features.prioritySupport', included: false },
    ],
  },
  {
    nameKey: 'subscription.plans.pro.name', priceKey: 'CHF 89', period: 'subscription.perMonth', descriptionKey: 'subscription.plans.pro.description',
    isCurrent: true, isPopular: true,
    features: [
      { textKey: 'subscription.features.unlimitedProperties', included: true },
      { textKey: 'subscription.features.unlimitedContacts', included: true },
      { textKey: 'subscription.features.aiSearch', included: true },
      { textKey: 'subscription.features.aiCopilot', included: true },
      { textKey: 'subscription.features.fullKyc', included: true },
      { textKey: 'subscription.features.sellerPortal', included: true },
      { textKey: 'subscription.features.prioritySupport', included: false },
    ],
  },
  {
    nameKey: 'subscription.plans.agency.name', priceKey: 'CHF 249', period: 'subscription.perMonth', descriptionKey: 'subscription.plans.agency.description',
    features: [
      { textKey: 'subscription.features.allPro', included: true },
      { textKey: 'subscription.features.upTo10Agents', included: true },
      { textKey: 'subscription.features.agencyDashboard', included: true },
      { textKey: 'subscription.features.apiIntegrations', included: true },
      { textKey: 'subscription.features.customBranding', included: true },
      { textKey: 'subscription.features.dataExport', included: true },
      { textKey: 'subscription.features.support247', included: true },
    ],
  },
]

function SubscriptionTab() {
  const { t } = useTranslation('settings')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-theme-primary">{t('subscription.title')}</h2>
        <p className="text-sm text-theme-muted mt-1">{t('subscription.subtitle')}</p>
      </div>

      {/* Current plan */}
      <div className={cn(cardClasses, 'border-2 border-accent p-6')}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-theme-primary">Plan Pro</h3>
              <span className="text-xs font-medium px-2 py-0.5 rounded-badge bg-accent/10 text-accent">{t('subscription.currentBadge')}</span>
            </div>
            <p className="text-sm text-theme-muted">CHF 89/mois — renouvelé le 01.04.2026</p>
          </div>
          <button className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors gap-2 hidden sm:flex items-center">
            <CreditCard className="w-4 h-4" />
            {t('subscription.manage')}
          </button>
        </div>
        <button className="w-full h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center justify-center gap-2 sm:hidden mt-3">
          <CreditCard className="w-4 h-4" />
          {t('subscription.manage')}
        </button>
      </div>

      {/* Plan comparison */}
      <div>
        <h3 className="text-base font-semibold text-theme-primary mb-4">{t('subscription.comparePlans')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map(plan => {
            const isFreePlan = plan.priceKey.startsWith('subscription.')
            const price = isFreePlan ? t(plan.priceKey) : plan.priceKey
            return (
              <div
                key={plan.nameKey}
                className={cn(
                  'rounded-xl border p-6 relative transition-colors duration-200 border-2',
                  plan.isCurrent ? 'border-accent' : 'border-theme-border',
                )}
              >
                {plan.isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="text-xs font-medium px-3 py-1 rounded-full bg-accent text-white flex items-center gap-1">
                      <Star className="w-3 h-3" /> {t('subscription.popular')}
                    </span>
                  </div>
                )}
                <div className="text-center mb-4 pt-1">
                  <h4 className="text-lg font-semibold text-theme-primary">{t(plan.nameKey)}</h4>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-theme-primary">{price}</span>
                    {plan.period && <span className="text-sm text-theme-muted">{t(plan.period)}</span>}
                  </div>
                  <p className="text-xs text-theme-muted mt-2">{t(plan.descriptionKey)}</p>
                </div>
                <div className="space-y-2.5 mb-5">
                  {plan.features.map((feat, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {feat.included ? <Check className="w-4 h-4 text-success shrink-0" /> : <X className="w-4 h-4 text-theme-tertiary shrink-0" />}
                      <span className={feat.included ? 'text-theme-primary' : 'text-theme-tertiary'}>{t(feat.textKey)}</span>
                    </div>
                  ))}
                </div>
                {plan.isCurrent ? (
                  <button disabled className="w-full h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-tertiary cursor-not-allowed opacity-50">{t('subscription.currentPlan')}</button>
                ) : (
                  <button className="w-full h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center justify-center gap-1">
                    {t('subscription.choose')} <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Custom plan CTA */}
      <div className="rounded-xl border border-theme-border p-6 text-center">
        <p className="text-sm text-theme-primary font-medium">{t('subscription.custom.title')}</p>
        <p className="text-xs text-theme-tertiary mt-1">{t('subscription.custom.description')}</p>
        <a
          href="mailto:contact@megga.ch?subject=Plan sur mesure MEGGA"
          className="inline-flex items-center gap-1.5 h-9 px-4 mt-3 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
        >
          {t('subscription.custom.cta')}
        </a>
      </div>
    </div>
  )
}

/* ─── Main Component ─── */

export default function SettingsPage() {
  const { t } = useTranslation('settings')
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-theme-primary">{t('title')}</h1>
          <p className="text-sm text-theme-tertiary mt-1">{t('subtitle')}</p>
        </div>

        {/* Tabs — no icons, text only */}
        <div className="border-b border-theme-border overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {TABS.map(tab => {
              const isActive = activeTab === tab
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                    isActive
                      ? 'border-accent text-accent'
                      : 'border-transparent text-theme-tertiary hover:text-theme-primary hover:border-theme-active',
                  )}
                >
                  {t(`tabs.${tab}`)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'profile' && <ProfileTab />}
          {activeTab === 'agency' && <AgencyTab />}
          {activeTab === 'team' && <TeamTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'security' && <SecurityTab />}
          {activeTab === 'subscription' && <SubscriptionTab />}
        </div>
      </div>
    </PageTransition>
  )
}
