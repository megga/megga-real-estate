import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  Camera,
  Plus, X,
  Smartphone,
  Monitor, KeyRound,
  ShieldCheck, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useStripe } from '@/hooks/useStripe'
import { useAvatar } from '@/hooks/useAvatar'
import AvatarCropModal from '@/components/profile/AvatarCropModal'
import PageTransition from '@/components/layout/PageTransition'

/* ─── Tab Types ─── */

const TABS = ['profile', 'agency', 'team', 'notifications', 'security', 'subscription', 'integrations'] as const
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
    <div className="py-4 border-b border-theme-border flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8">
      <div className="sm:w-40 shrink-0">
        <p className="text-sm font-medium text-theme-primary">{t('profile.language')}</p>
        <p className="text-xs text-theme-tertiary mt-0.5">{t('profile.languageHint')}</p>
      </div>
      <div className="flex items-center gap-2">
        {LANGUAGES.map((lang) => {
          const isSelected = currentLang === lang.code
          return (
            <button
              key={lang.code}
              onClick={() => i18n.changeLanguage(lang.code)}
              title={lang.name}
              className={cn(
                'h-9 px-4 rounded-lg text-sm font-medium transition-colors',
                isSelected
                  ? 'bg-theme-primary text-theme-inverse'
                  : 'border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active'
              )}
            >
              {lang.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Profile Tab ─── */

function ProfileTab() {
  const { user, signOut } = useAuth()
  const { t } = useTranslation('settings')
  const { avatarUrl, saveDataUrl, removeAvatar, validateFile } = useAvatar()
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [pendingImage, setPendingImage] = useState<string | null>(null)

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarError(null)
    // Validate first
    const error = validateFile(file)
    if (error) { setAvatarError(error.message); e.target.value = ''; return }
    // Read as data URL and open crop modal
    const reader = new FileReader()
    reader.onload = () => {
      setPendingImage(reader.result as string)
      setCropModalOpen(true)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleEditExisting() {
    setPendingImage(null) // editing existing, not a new file
    setCropModalOpen(true)
  }

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
    <div className="space-y-4">
      {/* Profile section — bento transparent */}
      <div className={cn(cardClasses, 'p-6')}>
        <h2 className="text-base font-semibold text-theme-primary">{t('profile.title')}</h2>
        <p className="text-sm text-theme-tertiary mt-0.5">{t('profile.subtitle')}</p>

        {/* Avatar row */}
        <div className="flex items-center gap-5 mt-5 pb-5 border-b border-theme-border">
          <div className="relative group">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`${form.firstName} ${form.lastName}`}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center">
                <span className="text-xl font-bold text-white">
                  {(form.firstName?.[0] ?? '').toUpperCase()}{(form.lastName?.[0] ?? '').toUpperCase()}
                </span>
              </div>
            )}
            {avatarUrl ? (
              <button
                onClick={handleEditExisting}
                className="absolute inset-0 rounded-full cursor-pointer flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors"
              >
                <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ) : (
              <label className="absolute inset-0 rounded-full cursor-pointer flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
                <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleAvatarChange}
                  className="sr-only"
                />
              </label>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-theme-primary">{t('profile.photo')}</p>
            <p className="text-xs text-theme-tertiary mt-0.5">{t('profile.photoHint')}</p>
            {avatarError && (
              <p className="text-xs text-red-500 mt-1">{avatarError}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              <label className="text-xs font-medium text-accent hover:text-accent/80 cursor-pointer transition-colors">
                {avatarUrl ? 'Changer la photo' : 'Ajouter une photo'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleAvatarChange}
                  className="sr-only"
                />
              </label>
              {avatarUrl && (
                <button
                  onClick={() => { removeAvatar(); setCropModalOpen(false) }}
                  className="text-xs text-red-500 hover:text-red-600 transition-colors"
                >
                  Supprimer
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Avatar crop modal */}
        <AvatarCropModal
          open={cropModalOpen}
          imageSrc={pendingImage}
          existingAvatar={avatarUrl}
          onSave={(dataUrl) => { saveDataUrl(dataUrl); setCropModalOpen(false); setPendingImage(null) }}
          onDelete={() => { removeAvatar(); setCropModalOpen(false); setPendingImage(null) }}
          onClose={() => { setCropModalOpen(false); setPendingImage(null) }}
        />

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
      <div className={cn(cardClasses, 'p-6')}>
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

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="rounded-xl border border-theme-border bg-theme-page w-full max-w-md" onClick={e => e.stopPropagation()}>
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
    </div>,
    document.body
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
      className={cn(
        'relative w-10 h-6 rounded-full transition-colors shrink-0',
        enabled ? 'bg-emerald-500' : 'bg-theme-border'
      )}
    >
      <div className={cn(
        'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform',
        enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
      )} />
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
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [googleLinking, setGoogleLinking] = useState(false)

  // Check if Google is linked by looking at user identities
  const googleIdentity = user?.identities?.find(id => id.provider === 'google')
  const isGoogleLinked = !!googleIdentity
  const googleEmail = googleIdentity?.identity_data?.email as string | undefined
  const hasPassword = user?.identities?.some(id => id.provider === 'email')

  async function handleLinkGoogle() {
    setGoogleLinking(true)
    try {
      await supabase.auth.linkIdentity({
        provider: 'google',
        options: { redirectTo: window.location.href },
      })
    } catch {
      setGoogleLinking(false)
    }
  }

  async function handleUnlinkGoogle() {
    if (!googleIdentity) return
    if (!hasPassword) {
      alert(t('security.connectedAccounts.cannotUnlink'))
      return
    }
    if (!confirm(t('security.connectedAccounts.unlinkConfirm'))) return
    await supabase.auth.unlinkIdentity(googleIdentity)
    window.location.reload()
  }

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

      {/* ── Connected Accounts ── */}
      <div className={cn(cardClasses, 'p-6')}>
        <h2 className="text-base font-semibold text-theme-primary">{t('security.connectedAccounts.title')}</h2>
        <p className="text-sm text-theme-tertiary mt-0.5 mb-5">{t('security.connectedAccounts.subtitle')}</p>

        <div className="flex items-center justify-between py-3 border-t border-theme-border">
          <div className="flex items-center gap-3">
            {/* Google icon */}
            <div className="w-10 h-10 rounded-lg border border-theme-border flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-theme-primary">{t('security.connectedAccounts.google')}</p>
              {isGoogleLinked ? (
                <p className="text-xs text-emerald-500 mt-0.5">
                  {googleEmail ? t('security.connectedAccounts.linkedAs', { email: googleEmail }) : t('security.connectedAccounts.googleLinked')}
                </p>
              ) : (
                <p className="text-xs text-theme-tertiary mt-0.5">{t('security.connectedAccounts.linkHint')}</p>
              )}
            </div>
          </div>

          {isGoogleLinked ? (
            <button
              onClick={handleUnlinkGoogle}
              className="h-8 px-3 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10 border border-theme-border hover:border-red-500/30 transition-colors"
            >
              {t('security.connectedAccounts.unlink')}
            </button>
          ) : (
            <button
              onClick={handleLinkGoogle}
              disabled={googleLinking}
              className="h-8 px-3 rounded-lg text-xs font-medium text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active transition-colors disabled:opacity-50"
            >
              {googleLinking ? t('security.connectedAccounts.linking') : t('security.connectedAccounts.link')}
            </button>
          )}
        </div>
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
interface PlanConfig {
  planId: 'starter' | 'pro' | 'agency'
  nameKey: string
  descriptionKey: string
  monthlyPrice: number // 0 = free
  annualPrice: number  // 0 = free
  features: PlanFeature[]
  isCurrent?: boolean
  isPopular?: boolean
}

const PLANS: PlanConfig[] = [
  {
    planId: 'starter', nameKey: 'subscription.plans.starter.name', descriptionKey: 'subscription.plans.starter.description',
    monthlyPrice: 0, annualPrice: 0,
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
    planId: 'pro', nameKey: 'subscription.plans.pro.name', descriptionKey: 'subscription.plans.pro.description',
    monthlyPrice: 89, annualPrice: 71, isCurrent: true, isPopular: true,
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
    planId: 'agency', nameKey: 'subscription.plans.agency.name', descriptionKey: 'subscription.plans.agency.description',
    monthlyPrice: 249, annualPrice: 199,
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
  const { checkout, manageSubscription, isLoading: stripeLoading, error: stripeError } = useStripe()
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-theme-primary">{t('subscription.title')}</h2>
        <p className="text-sm text-theme-muted mt-1">{t('subscription.subtitle')}</p>
      </div>

      {/* Current plan — clean, no accent border */}
      <div className={cn(cardClasses, 'p-5')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-theme-primary">Plan Pro</h3>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">{t('subscription.currentBadge')}</span>
              </div>
              <p className="text-xs text-theme-muted mt-0.5">CHF 89{t('subscription.perMonth')} — {t('subscription.renewalDate', { date: '01.04.2026' })}</p>
            </div>
          </div>
          <button
            onClick={() => manageSubscription()}
            disabled={stripeLoading}
            className="h-8 px-3 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors disabled:opacity-50"
          >
            {stripeLoading ? t('subscription.redirecting') : t('subscription.manage')}
          </button>
        </div>
        {stripeError && <p className="text-xs text-danger mt-2">{stripeError}</p>}
      </div>

      {/* Billing toggle + Plans */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-theme-primary">{t('subscription.comparePlans')}</h3>

          {/* Monthly / Annual toggle */}
          <div className="flex items-center rounded-lg border border-theme-border p-0.5">
            <button
              onClick={() => setBilling('monthly')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                billing === 'monthly' ? 'bg-theme-active text-theme-primary' : 'text-theme-tertiary hover:text-theme-secondary'
              )}
            >
              {t('subscription.monthly')}
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5',
                billing === 'annual' ? 'bg-theme-active text-theme-primary' : 'text-theme-tertiary hover:text-theme-secondary'
              )}
            >
              {t('subscription.annual')}
              <span className="text-[10px] font-semibold text-emerald-500">{t('subscription.annualDiscount')}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map(plan => {
            const isFree = plan.monthlyPrice === 0
            const price = isFree ? t('subscription.free') : `CHF ${billing === 'monthly' ? plan.monthlyPrice : plan.annualPrice}`
            const monthlyOriginal = plan.monthlyPrice
            const annualSaving = isFree ? 0 : (plan.monthlyPrice - plan.annualPrice) * 12

            return (
              <div
                key={plan.planId}
                className={cn(
                  'rounded-xl border p-6 relative transition-colors',
                  plan.isPopular ? 'border-theme-primary' : 'border-theme-border',
                )}
              >
                {/* Popular badge — text only, no bg */}
                {plan.isPopular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-theme-page border border-theme-primary text-theme-primary">
                      {t('subscription.popular')}
                    </span>
                  </div>
                )}

                <div className="text-center mb-5 pt-1">
                  <h4 className="text-base font-semibold text-theme-primary">{t(plan.nameKey)}</h4>

                  {/* Price */}
                  <div className="mt-3">
                    <span className="text-3xl font-bold text-theme-primary">{price}</span>
                    {!isFree && <span className="text-sm text-theme-muted">{t('subscription.perMonth')}</span>}
                  </div>

                  {/* Annual savings */}
                  {!isFree && billing === 'annual' && (
                    <div className="mt-1.5 space-y-0.5">
                      <p className="text-xs text-theme-muted line-through">CHF {monthlyOriginal}{t('subscription.perMonth')}</p>
                      <p className="text-xs font-medium text-emerald-500">{t('subscription.annualSaving', { amount: `CHF ${annualSaving}` })}</p>
                    </div>
                  )}
                  {!isFree && billing === 'monthly' && (
                    <p className="text-xs text-theme-muted mt-1.5">{t(plan.descriptionKey)}</p>
                  )}
                  {isFree && (
                    <p className="text-xs text-theme-muted mt-1.5">{t(plan.descriptionKey)}</p>
                  )}
                </div>

                {/* Features — text with opacity, no icons */}
                <div className="space-y-2 mb-6">
                  {plan.features.map((feat, i) => (
                    <p key={i} className={cn(
                      'text-sm',
                      feat.included ? 'text-theme-primary' : 'text-theme-muted line-through'
                    )}>
                      {t(feat.textKey)}
                    </p>
                  ))}
                </div>

                {/* CTA */}
                {plan.isCurrent ? (
                  <button disabled className="w-full h-9 rounded-lg text-sm font-medium border border-theme-border text-theme-tertiary cursor-not-allowed opacity-50">
                    {t('subscription.currentPlan')}
                  </button>
                ) : (
                  <button
                    onClick={() => checkout(plan.planId)}
                    disabled={stripeLoading}
                    className="w-full h-9 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors disabled:opacity-50"
                  >
                    {stripeLoading ? t('subscription.redirecting') : t('subscription.choose')}
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
          className="inline-flex items-center h-9 px-4 mt-3 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
        >
          {t('subscription.custom.cta')}
        </a>
      </div>
    </div>
  )
}

/* ─── Integrations Tab ─── */

interface Integration {
  id: string
  nameKey: string
  descriptionKey: string
  featuresKeys: string[]
  connectHintKey: string
  isConnected: boolean
  category: 'essential' | 'recommended' | 'upcoming'
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'google-calendar',
    nameKey: 'integrations.googleCalendar.name',
    descriptionKey: 'integrations.googleCalendar.description',
    featuresKeys: [
      'integrations.googleCalendar.features.syncVisits',
      'integrations.googleCalendar.features.twoWaySync',
      'integrations.googleCalendar.features.reminders',
    ],
    connectHintKey: 'integrations.googleCalendar.connectHint',
    isConnected: false,
    category: 'essential',
  },
  {
    id: 'email',
    nameKey: 'integrations.email.name',
    descriptionKey: 'integrations.email.description',
    featuresKeys: [
      'integrations.email.features.autoFollowUp',
      'integrations.email.features.visitConfirmation',
      'integrations.email.features.propertyPresentation',
    ],
    connectHintKey: 'integrations.email.connectHint',
    isConnected: false,
    category: 'essential',
  },
  {
    id: 'portals',
    nameKey: 'integrations.portals.name',
    descriptionKey: 'integrations.portals.description',
    featuresKeys: [
      'integrations.portals.features.autoPublish',
      'integrations.portals.features.multiPortal',
      'integrations.portals.features.syncStatus',
    ],
    connectHintKey: 'integrations.portals.connectHint',
    isConnected: false,
    category: 'essential',
  },
  {
    id: 'crm-import',
    nameKey: 'integrations.crmImport.name',
    descriptionKey: 'integrations.crmImport.description',
    featuresKeys: [
      'integrations.crmImport.features.csvImport',
      'integrations.crmImport.features.crmMigration',
      'integrations.crmImport.features.dataExport',
    ],
    connectHintKey: 'integrations.crmImport.connectHint',
    isConnected: false,
    category: 'recommended',
  },
  {
    id: 'posthog',
    nameKey: 'integrations.posthog.name',
    descriptionKey: 'integrations.posthog.description',
    featuresKeys: [
      'integrations.posthog.features.pageViews',
      'integrations.posthog.features.featureAdoption',
      'integrations.posthog.features.teamInsights',
    ],
    connectHintKey: 'integrations.posthog.connectHint',
    isConnected: false,
    category: 'recommended',
  },
  {
    id: 'cloud-storage',
    nameKey: 'integrations.cloudStorage.name',
    descriptionKey: 'integrations.cloudStorage.description',
    featuresKeys: [
      'integrations.cloudStorage.features.docSync',
      'integrations.cloudStorage.features.autoOrganize',
      'integrations.cloudStorage.features.teamAccess',
    ],
    connectHintKey: 'integrations.cloudStorage.connectHint',
    isConnected: false,
    category: 'recommended',
  },
]

function IntegrationCard({ integration }: { integration: Integration }) {
  const { t } = useTranslation('settings')
  const [connected, setConnected] = useState(integration.isConnected)

  return (
    <div className={cn(cardClasses, 'p-5 group')}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-semibold text-theme-primary">{t(integration.nameKey)}</h3>
            <span className={cn(
              'w-2 h-2 rounded-full shrink-0',
              connected ? 'bg-emerald-500' : 'bg-theme-tertiary'
            )} />
            <span className={cn(
              'text-xs font-medium',
              connected ? 'text-emerald-500' : 'text-theme-tertiary'
            )}>
              {connected ? t('integrations.status.connected') : t('integrations.status.notConnected')}
            </span>
          </div>
          <p className="text-xs text-theme-tertiary mt-1">{t(integration.descriptionKey)}</p>
        </div>
        <button
          onClick={() => setConnected(!connected)}
          className={cn(
            'h-8 px-3 rounded-lg text-xs font-medium border transition-colors shrink-0',
            connected
              ? 'border-theme-border text-theme-tertiary hover:text-danger hover:border-danger/30'
              : 'border-accent/30 text-accent hover:bg-accent/5'
          )}
        >
          {connected ? t('integrations.status.disconnect') : t('integrations.status.configure')}
        </button>
      </div>

      {/* Features */}
      <div className="mt-4 flex flex-wrap gap-2">
        {integration.featuresKeys.map((fk) => (
          <span key={fk} className="text-xs text-theme-secondary px-2.5 py-1 rounded-lg border border-theme-border">
            {t(fk)}
          </span>
        ))}
      </div>

      {/* Hint */}
      <p className="text-xs text-theme-tertiary mt-3">{t(integration.connectHintKey)}</p>

    </div>
  )
}

function IntegrationsTab() {
  const { t } = useTranslation('settings')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-theme-primary">{t('integrations.title')}</h2>
        <p className="text-sm text-theme-muted mt-1">{t('integrations.subtitle')}</p>
      </div>

      {/* Essential integrations */}
      <div>
        <p className="text-xs font-medium text-theme-tertiary uppercase tracking-wider mb-3">{t('integrations.categories.essential')}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {INTEGRATIONS.filter(i => i.category === 'essential').map(integration => (
            <IntegrationCard key={integration.id} integration={integration} />
          ))}
        </div>
      </div>

      {/* Recommended integrations */}
      <div>
        <p className="text-xs font-medium text-theme-tertiary uppercase tracking-wider mb-3">{t('integrations.categories.recommended')}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {INTEGRATIONS.filter(i => i.category === 'recommended').map(integration => (
            <IntegrationCard key={integration.id} integration={integration} />
          ))}
        </div>
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
                    'px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap focus:outline-none focus-visible:outline-none',
                    isActive
                      ? 'border-theme-primary text-theme-primary'
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
          {activeTab === 'integrations' && <IntegrationsTab />}
        </div>
      </div>
    </PageTransition>
  )
}
