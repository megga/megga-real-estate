import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  Camera,
  X,
  Loader2,
  MoreHorizontal,
} from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { useAvatar } from '@/hooks/useAvatar'
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar'
import { useOutlookCalendar } from '@/hooks/useOutlookCalendar'
import { STRIPE_PRICES } from '@/lib/constants'
import AvatarCropModal from '@/components/profile/AvatarCropModal'
import AppearanceTab from '@/components/settings/AppearanceTab'
import PageTransition from '@/components/layout/PageTransition'

/* ─── Tab Types ─── */

const TABS = ['profile', 'appearance', 'agency', 'team', 'notifications', 'security', 'subscription', 'applications'] as const
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

const SPECIALTIES = [
  'Résidentiel', 'Commercial', 'Luxe', 'Neuf',
  'Terrain', 'Investissement', 'Location', 'Gestion',
] as const

const CANTONS = [
  'GE', 'VD', 'VS', 'NE', 'FR', 'BE', 'JU', 'BS', 'BL', 'AG', 'SO',
  'ZH', 'LU', 'ZG', 'SZ', 'NW', 'OW', 'UR', 'GL', 'SH', 'TG', 'AR',
  'AI', 'SG', 'GR', 'TI',
] as const

function AgencySectionCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-theme-border p-6">
      <h3 className="text-sm font-semibold text-theme-primary">{title}</h3>
      {hint && <p className="text-xs text-theme-tertiary mt-0.5 mb-5">{hint}</p>}
      {!hint && <div className="mb-5" />}
      {children}
    </div>
  )
}

function AgencyTab() {
  const { t } = useTranslation('settings')

  const [form, setForm] = useState({
    name: 'MEGGA Real Estate',
    slogan: 'L\'immobilier de prestige à Genève',
    address: 'Rue du Rhône 42',
    city: 'Genève',
    canton: 'GE',
    postalCode: '1204',
    phone: '+41 22 310 00 00',
    email: 'contact@megga.ch',
    website: 'www.megga.ch',
    description: 'Agence immobilière premium à Genève, spécialisée dans les biens de prestige et les transactions internationales. Notre équipe de courtiers expérimentés vous accompagne à chaque étape de votre projet immobilier.',
    ideNumber: 'CHE-123.456.789',
    specialties: ['Résidentiel', 'Luxe'] as string[],
    certifications: 'SVIT, USPI Genève',
    linkedin: 'https://linkedin.com/company/megga-real-estate',
    instagram: '',
    facebook: '',
  })

  const [savedForm, setSavedForm] = useState(form)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm)

  const handleSave = () => {
    setSaveState('saving')
    // Simulate Supabase save (replace with real call later)
    setTimeout(() => {
      setSavedForm(form)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    }, 600)
  }

  const handleCancel = () => {
    setForm(savedForm)
    setSaveState('idle')
  }

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  const toggleSpecialty = (s: string) => {
    setForm(prev => ({
      ...prev,
      specialties: prev.specialties.includes(s)
        ? prev.specialties.filter(x => x !== s)
        : [...prev.specialties, s],
    }))
  }

  const textareaClasses = 'w-full px-3 py-2.5 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-none'

  return (
    <div className="space-y-5 pb-16">

      {/* ── Card 1: Profile Preview (cover + logo + name live) ── */}
      <AgencySectionCard title={t('agency.profilePreview')} hint={t('agency.profilePreviewHint')}>
        {/* Live preview mimicking the public profile header */}
        <div className="rounded-xl border border-theme-border overflow-hidden">
          {/* Cover */}
          <div className="relative h-28 bg-gradient-to-r from-theme-section to-theme-hover group cursor-pointer">
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-theme-overlay/20">
              <div className="flex items-center gap-2 text-xs text-white bg-black/40 px-3 py-1.5 rounded-lg">
                <Camera className="w-3.5 h-3.5" />
                {t('agency.changeCover')}
              </div>
            </div>
          </div>
          {/* Logo + info overlay */}
          <div className="px-5 pb-4 -mt-6">
            <div className="flex items-end gap-4">
              <div className="relative group cursor-pointer">
                <div className="w-14 h-14 rounded-xl bg-theme-primary flex items-center justify-center border-2 border-theme-card">
                  <span className="text-sm font-bold text-theme-inverse">GG</span>
                </div>
                <div className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                  <Camera className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0 pt-7">
                <p className="text-sm font-semibold text-theme-primary truncate">{form.name || 'Nom de l\'agence'}</p>
                <p className="text-xs text-theme-tertiary truncate">{form.slogan || 'Slogan'} · {form.city}{form.canton ? `, ${form.canton}` : ''}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Name + Slogan inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <div>
            <label className={labelClasses}>{t('agency.name')}</label>
            <input type="text" value={form.name} onChange={e => update('name', e.target.value)} className={inputClasses} />
          </div>
          <div>
            <label className={labelClasses}>{t('agency.slogan')}</label>
            <input type="text" value={form.slogan} onChange={e => update('slogan', e.target.value)} className={inputClasses} placeholder={t('agency.sloganPlaceholder')} />
          </div>
        </div>
      </AgencySectionCard>

      {/* ── Card 2: Localisation ── */}
      <AgencySectionCard title={t('agency.locationTitle')} hint={t('agency.locationHint')}>
        <div className="space-y-4">
          <div>
            <label className={labelClasses}>{t('agency.address')}</label>
            <input type="text" value={form.address} onChange={e => update('address', e.target.value)} className={inputClasses} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClasses}>{t('agency.city')}</label>
              <input type="text" value={form.city} onChange={e => update('city', e.target.value)} className={inputClasses} />
            </div>
            <div>
              <label className={labelClasses}>{t('agency.canton')}</label>
              <select
                value={form.canton}
                onChange={e => update('canton', e.target.value)}
                className={inputClasses}
              >
                {CANTONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClasses}>{t('agency.postalCode')}</label>
              <input type="text" value={form.postalCode} onChange={e => update('postalCode', e.target.value)} className={inputClasses} />
            </div>
          </div>
        </div>
      </AgencySectionCard>

      {/* ── Card 3: Contact ── */}
      <AgencySectionCard title={t('agency.contactTitle')} hint={t('agency.contactHint')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </AgencySectionCard>

      {/* ── Card 4: Présentation ── */}
      <AgencySectionCard title={t('agency.presentationTitle')} hint={t('agency.presentationHint')}>
        <div className="space-y-5">
          <div>
            <label className={labelClasses}>{t('agency.description')}</label>
            <textarea
              value={form.description}
              onChange={e => update('description', e.target.value)}
              rows={4}
              className={textareaClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>{t('agency.specialties')}</label>
            <p className="text-xs text-theme-tertiary mb-3">{t('agency.specialtiesHint')}</p>
            <div className="flex flex-wrap gap-2">
              {SPECIALTIES.map(s => (
                <button
                  key={s}
                  onClick={() => toggleSpecialty(s)}
                  className={cn(
                    'h-8 px-3.5 rounded-lg text-sm transition-colors',
                    form.specialties.includes(s)
                      ? 'bg-theme-active text-theme-primary font-medium'
                      : 'text-theme-secondary border border-theme-border hover:text-theme-primary hover:border-theme-active'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClasses}>{t('agency.certifications')}</label>
            <input type="text" value={form.certifications} onChange={e => update('certifications', e.target.value)} className={inputClasses} placeholder="SVIT, USPI, etc." />
          </div>
        </div>
      </AgencySectionCard>

      {/* ── Card 5: Réseaux sociaux ── */}
      <AgencySectionCard title={t('agency.socialLinks')} hint={t('agency.socialLinksHint')}>
        <div className="space-y-3">
          {[
            { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/...' },
            { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/...' },
            { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/...' },
          ].map(({ key, label, placeholder }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="w-20 text-xs font-medium text-theme-secondary shrink-0">{label}</span>
              <input
                type="url"
                value={form[key as keyof typeof form] as string}
                onChange={e => update(key, e.target.value)}
                className={inputClasses}
                placeholder={placeholder}
              />
            </div>
          ))}
        </div>
      </AgencySectionCard>

      {/* ── Sticky save bar (portal to body, offset for sidebar) ── */}
      {(isDirty || saveState === 'saved') && createPortal(
        <div className={cn(
          'fixed bottom-0 right-0 z-[100] border-t border-theme-border bg-theme-card/95 backdrop-blur-sm animate-in slide-in-from-bottom-2 duration-200',
          'left-0 md:left-16 lg:left-64',
        )}>
          <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
            {/* Left: status indicator */}
            <div className="flex items-center gap-2">
              {saveState === 'saved' ? (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-xs text-emerald-500 font-medium">{t('agency.saved')}</span>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-xs text-theme-secondary">{t('agency.unsavedChanges')}</span>
                </>
              )}
            </div>

            {/* Right: actions */}
            {saveState !== 'saved' && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCancel}
                  className="text-xs text-theme-tertiary hover:text-theme-primary transition-colors"
                >
                  {t('agency.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saveState === 'saving'}
                  className={cn(
                    'h-9 px-5 rounded-lg text-sm font-medium border transition-colors',
                    saveState === 'saving'
                      ? 'border-theme-border text-theme-tertiary cursor-wait'
                      : 'border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active'
                  )}
                >
                  {saveState === 'saving' ? t('agency.saving') : t('agency.save')}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

/* ─── Team Tab ─── */

import {
  useTeamMembers,
  useTeamInvitations,
  useAgencyPlan,
  useInviteTeamMember,
  useResendInvitation,
  useCancelInvitation,
  useChangeTeamRole,
  useRemoveTeamMember,
} from '@/hooks/useTeam'
import type { TeamMember as TeamMemberType, TeamInvitation } from '@/hooks/useTeam'

type TeamRole = 'admin' | 'manager' | 'agent' | 'assistant'

const TEAM_ROLES: TeamRole[] = ['admin', 'manager', 'agent', 'assistant']

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0] || '').join('').toUpperCase().slice(0, 2)
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

function RolePermissions({ role }: { role: TeamRole }) {
  const { t } = useTranslation('settings')
  const permissions = t(`team.permissions.${role}`, { returnObjects: true }) as string[]
  if (!Array.isArray(permissions)) return null

  return (
    <ul className="mt-2 space-y-1">
      {permissions.map((p, i) => (
        <li key={i} className="text-xs text-theme-tertiary flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-theme-muted shrink-0" />
          {p}
        </li>
      ))}
    </ul>
  )
}

function InviteMemberModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('settings')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamRole>('agent')
  const [error, setError] = useState('')
  const inviteMutation = useInviteTeamMember()

  const handleSubmit = async () => {
    setError('')
    try {
      await inviteMutation.mutateAsync({ email, role })
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      if (msg === 'already_member') setError(t('team.inviteModal.alreadyMember'))
      else if (msg === 'already_invited') setError(t('team.inviteModal.alreadyInvited'))
      else setError(t('team.inviteModal.error'))
    }
  }

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
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError('') }} placeholder="nom@agence.ch" className={inputClasses} />
          </div>
          <div>
            <label className={labelClasses}>{t('team.inviteModal.role')}</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {TEAM_ROLES.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    'h-9 px-4 rounded-lg text-sm transition-colors',
                    role === r ? 'bg-theme-active text-theme-primary font-medium' : 'text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active'
                  )}
                >
                  {t(`team.roles.${r}`)}
                </button>
              ))}
            </div>
            <p className="text-xs text-theme-tertiary mt-2">{t(`team.roleDescriptions.${role}`)}</p>
            <RolePermissions role={role} />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex items-center gap-3 p-5 border-t border-theme-border">
          <button onClick={onClose} className="flex-1 h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">{t('team.inviteModal.cancel')}</button>
          <button
            disabled={!email.includes('@') || inviteMutation.isPending}
            onClick={handleSubmit}
            className={cn('flex-1 h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors', (!email.includes('@') || inviteMutation.isPending) && 'opacity-50 cursor-not-allowed')}
          >
            {inviteMutation.isPending ? t('team.inviteModal.sending') : t('team.inviteModal.send')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function ChangeRoleModal({ member, onClose, onConfirm }: { member: TeamMemberType; onClose: () => void; onConfirm: (role: TeamRole) => void }) {
  const { t } = useTranslation('settings')
  const [selectedRole, setSelectedRole] = useState<TeamRole>(member.role)
  const changeRoleMutation = useChangeTeamRole()

  const handleConfirm = async () => {
    try {
      await changeRoleMutation.mutateAsync({ memberId: member.id, newRole: selectedRole })
      onConfirm(selectedRole)
    } catch { /* RLS will block unauthorized changes */ }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="rounded-xl border border-theme-border bg-theme-page w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-theme-border">
          <h3 className="text-base font-semibold text-theme-primary">{t('team.changeRole.title')}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-theme-hover transition-colors">
            <X className="w-4 h-4 text-theme-muted" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-theme-secondary">{t('team.changeRole.subtitle', { name: member.full_name })}</p>
          <div className="flex flex-wrap gap-2">
            {TEAM_ROLES.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRole(r)}
                className={cn(
                  'h-9 px-4 rounded-lg text-sm transition-colors',
                  selectedRole === r ? 'bg-theme-active text-theme-primary font-medium' : 'text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active'
                )}
              >
                {t(`team.roles.${r}`)}
              </button>
            ))}
          </div>
          <p className="text-xs text-theme-tertiary">{t(`team.roleDescriptions.${selectedRole}`)}</p>
          <RolePermissions role={selectedRole} />
        </div>
        <div className="flex items-center gap-3 p-5 border-t border-theme-border">
          <button onClick={onClose} className="flex-1 h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">{t('team.inviteModal.cancel')}</button>
          <button
            disabled={selectedRole === member.role || changeRoleMutation.isPending}
            onClick={handleConfirm}
            className={cn('flex-1 h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors', (selectedRole === member.role || changeRoleMutation.isPending) && 'opacity-50 cursor-not-allowed')}
          >
            {t('team.changeRole.confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function RemoveMemberModal({ member, onClose, onConfirm }: { member: TeamMemberType; onClose: () => void; onConfirm: () => void }) {
  const { t } = useTranslation('settings')
  const removeMutation = useRemoveTeamMember()

  const handleConfirm = async () => {
    try {
      await removeMutation.mutateAsync(member.id)
      onConfirm()
    } catch { /* handled by React Query */ }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="rounded-xl border border-theme-border bg-theme-page w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="p-5 space-y-3">
          <h3 className="text-base font-semibold text-theme-primary">{t('team.remove.title')}</h3>
          <p className="text-sm text-theme-secondary">{t('team.remove.message', { name: member.full_name })}</p>
        </div>
        <div className="flex items-center gap-3 p-5 border-t border-theme-border">
          <button onClick={onClose} className="flex-1 h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">{t('team.inviteModal.cancel')}</button>
          <button
            disabled={removeMutation.isPending}
            onClick={handleConfirm}
            className={cn('flex-1 h-9 px-4 rounded-lg text-sm font-medium text-red-500 border border-red-500/30 hover:border-red-500 transition-colors', removeMutation.isPending && 'opacity-50 cursor-not-allowed')}
          >
            {t('team.remove.confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function TeamMemberRow({ member, isCurrentUser, onChangeRole, onRemove }: {
  member: TeamMemberType
  isCurrentUser: boolean
  onChangeRole: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation('settings')
  const [showMenu, setShowMenu] = useState(false)
  const initials = getInitials(member.full_name)

  return (
    <div className="group flex items-center gap-3 py-3.5 px-5">
      <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
        {member.avatar_url
          ? <img src={member.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
          : <span className="text-xs font-semibold text-accent">{initials}</span>
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-theme-primary truncate">{member.full_name}</p>
          {isCurrentUser && <span className="text-[10px] text-theme-tertiary">({t('team.you')})</span>}
        </div>
        <p className="text-xs text-theme-muted truncate">{member.email}</p>
      </div>
      <div className="hidden sm:flex items-center gap-3">
        <span className="text-xs text-theme-secondary">{t(`team.roles.${member.role}`)}</span>
      </div>
      <div className="hidden lg:block text-xs text-theme-muted">{formatDateShort(member.created_at)}</div>

      {/* Actions (hover) */}
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={cn(
            'p-1.5 rounded-lg transition-all',
            showMenu ? 'bg-theme-hover' : 'opacity-0 group-hover:opacity-100 hover:bg-theme-hover'
          )}
        >
          <MoreHorizontal className="w-4 h-4 text-theme-muted" />
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-[50]" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-1 z-[51] w-48 rounded-lg border border-theme-border bg-theme-card py-1">
              <button
                onClick={() => { setShowMenu(false); onChangeRole() }}
                className="w-full text-left px-3 py-2 text-sm text-theme-secondary hover:text-theme-primary hover:bg-theme-hover transition-colors"
              >
                {t('team.actions.changeRole')}
              </button>
              {!isCurrentUser && (
                <button
                  onClick={() => { setShowMenu(false); onRemove() }}
                  className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-theme-hover transition-colors"
                >
                  {t('team.actions.remove')}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function InvitationRow({ invitation }: { invitation: TeamInvitation }) {
  const { t } = useTranslation('settings')
  const [showMenu, setShowMenu] = useState(false)
  const resendMutation = useResendInvitation()
  const cancelMutation = useCancelInvitation()
  const initials = invitation.email.slice(0, 2).toUpperCase()

  return (
    <div className="group flex items-center gap-3 py-3.5 px-5">
      <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
        <span className="text-xs font-semibold text-amber-500">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-theme-primary truncate">{invitation.email}</p>
        <p className="text-xs text-theme-muted">{t('team.invitation.expiresOn', { date: formatDateShort(invitation.expires_at) })}</p>
      </div>
      <div className="hidden sm:flex items-center gap-3">
        <span className="text-xs text-theme-secondary">{t(`team.roles.${invitation.role}`)}</span>
        <span className="text-xs font-medium text-amber-500">{t('team.status.invited')}</span>
      </div>

      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={cn(
            'p-1.5 rounded-lg transition-all',
            showMenu ? 'bg-theme-hover' : 'opacity-0 group-hover:opacity-100 hover:bg-theme-hover'
          )}
        >
          <MoreHorizontal className="w-4 h-4 text-theme-muted" />
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-[50]" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-1 z-[51] w-48 rounded-lg border border-theme-border bg-theme-card py-1">
              <button
                disabled={resendMutation.isPending}
                onClick={async () => { setShowMenu(false); await resendMutation.mutateAsync(invitation.id) }}
                className="w-full text-left px-3 py-2 text-sm text-theme-secondary hover:text-theme-primary hover:bg-theme-hover transition-colors"
              >
                {resendMutation.isPending ? t('team.actions.resending') : t('team.actions.resend')}
              </button>
              <button
                disabled={cancelMutation.isPending}
                onClick={async () => { setShowMenu(false); await cancelMutation.mutateAsync(invitation.id) }}
                className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-theme-hover transition-colors"
              >
                {t('team.actions.cancel')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function TeamTab({ onSwitchTab }: { onSwitchTab: (tab: SettingsTab) => void }) {
  const { t } = useTranslation('settings')
  const { profile } = useAuth()
  const [showInvite, setShowInvite] = useState(false)
  const [changeRoleMember, setChangeRoleMember] = useState<TeamMemberType | null>(null)
  const [removeMemberTarget, setRemoveMemberTarget] = useState<TeamMemberType | null>(null)

  const { data: members = [], isLoading: loadingMembers } = useTeamMembers()
  const { data: invitations = [], isLoading: loadingInvitations } = useTeamInvitations()
  const { maxMembers } = useAgencyPlan()

  const totalCount = members.length + invitations.length
  const limitReached = totalCount >= maxMembers

  return (
    <div className="space-y-6">
      {/* Header + plan limit */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-theme-primary">{t('team.title')}</h2>
          <p className="text-sm text-theme-muted mt-1">
            {t('team.memberCount', { current: totalCount, max: maxMembers })}
          </p>
        </div>
        {limitReached ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-theme-tertiary hidden sm:inline">{t('team.limitReached')}</span>
            <button onClick={() => onSwitchTab('subscription')} className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">
              {t('team.upgrade')}
            </button>
          </div>
        ) : (
          <button onClick={() => setShowInvite(true)} className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">
            <span className="hidden sm:inline">{t('team.invite')}</span>
            <span className="sm:hidden">{t('team.inviteShort')}</span>
          </button>
        )}
      </div>

      {/* Loading */}
      {(loadingMembers || loadingInvitations) && (
        <p className="text-sm text-theme-muted py-8 text-center">{t('team.loading')}</p>
      )}

      {/* Active members bento */}
      {!loadingMembers && members.length > 0 && (
        <div className={cardClasses}>
          <div className="px-5 py-3 border-b border-theme-border rounded-t-xl">
            <h3 className="text-sm font-medium text-theme-primary">{t('team.activeMembers')}</h3>
          </div>
          <div className="divide-y divide-theme-border/50">
            {members.map(member => (
              <TeamMemberRow
                key={member.id}
                member={member}
                isCurrentUser={member.id === profile?.id}
                onChangeRole={() => setChangeRoleMember(member)}
                onRemove={() => setRemoveMemberTarget(member)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loadingMembers && members.length === 0 && (
        <p className="text-sm text-theme-muted py-8 text-center">{t('team.empty')}</p>
      )}

      {/* Pending invitations bento */}
      {!loadingInvitations && invitations.length > 0 && (
        <div className={cardClasses}>
          <div className="px-5 py-3 border-b border-theme-border rounded-t-xl">
            <h3 className="text-sm font-medium text-theme-primary">{t('team.pendingInvitations')}</h3>
          </div>
          <div className="divide-y divide-theme-border/50">
            {invitations.map(inv => (
              <InvitationRow key={inv.id} invitation={inv} />
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showInvite && <InviteMemberModal onClose={() => setShowInvite(false)} />}
      {changeRoleMember && (
        <ChangeRoleModal
          member={changeRoleMember}
          onClose={() => setChangeRoleMember(null)}
          onConfirm={() => setChangeRoleMember(null)}
        />
      )}
      {removeMemberTarget && (
        <RemoveMemberModal
          member={removeMemberTarget}
          onClose={() => setRemoveMemberTarget(null)}
          onConfirm={() => setRemoveMemberTarget(null)}
        />
      )}
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
        enabled ? 'bg-theme-active' : 'bg-theme-border'
      )}
    >
      <div className={cn(
        'absolute top-0.5 w-5 h-5 rounded-full bg-theme-elevated transition-transform',
        enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
      )} />
    </button>
  )
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'w-4 h-4 rounded border transition-colors flex items-center justify-center',
        checked ? 'bg-theme-primary border-theme-primary' : 'border-theme-border bg-transparent'
      )}
    >
      {checked && (
        <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-theme-inverse" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 6l3 3 5-5" />
        </svg>
      )}
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

  const allEmail = NOTIF_CATEGORY_KEYS.every(k => settings[k].email)
  const allPush = NOTIF_CATEGORY_KEYS.every(k => settings[k].push)
  const allEnabled = allEmail && allPush

  const toggleAll = (value: boolean) => {
    setSettings(Object.fromEntries(NOTIF_CATEGORY_KEYS.map(c => [c, { email: value, push: value }])))
  }

  return (
    <div className="space-y-0">
      <div className={cn(cardClasses, 'p-6')}>
        <h2 className="text-base font-semibold text-theme-primary">{t('notifications.title')}</h2>
        <p className="text-sm text-theme-tertiary mt-0.5 mb-5">{t('notifications.subtitle')}</p>

        {/* Master toggle + column headers */}
        <div className="flex items-center py-2 mb-1">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <Checkbox checked={allEnabled} onChange={toggleAll} />
            <span className="text-xs font-medium text-theme-secondary">{t('notifications.enableAll')}</span>
          </div>
          <div className="flex items-center gap-8 shrink-0">
            <span className="text-[11px] font-medium text-theme-muted uppercase tracking-wider w-10 text-center">{t('notifications.email')}</span>
            <span className="text-[11px] font-medium text-theme-muted uppercase tracking-wider w-10 text-center">{t('notifications.push')}</span>
          </div>
        </div>

        <div className="border-t border-theme-border-subtle" />

        {/* Category rows */}
        {NOTIF_CATEGORY_KEYS.map((catKey) => {
          const s = settings[catKey]
          return (
            <div key={catKey} className="flex items-center py-2.5">
              <p className="text-sm text-theme-primary flex-1 min-w-0">{t(`notifications.categories.${catKey}.label`)}</p>
              <div className="flex items-center gap-8 shrink-0">
                <div className="w-10 flex justify-center">
                  <Checkbox checked={s.email} onChange={v => updateSetting(catKey, 'email', v)} />
                </div>
                <div className="w-10 flex justify-center">
                  <Checkbox checked={s.push} onChange={v => updateSetting(catKey, 'push', v)} />
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
  location: string
  lastActive: string
  isCurrent: boolean
}

const MOCK_SESSIONS: SessionDevice[] = [
  { id: 's1', device: 'MacBook Pro — Chrome', location: 'Genève, Suisse', lastActive: 'Actif maintenant', isCurrent: true },
  { id: 's2', device: 'iPhone 15 Pro — Safari', location: 'Genève, Suisse', lastActive: 'Il y a 2 heures', isCurrent: false },
  { id: 's3', device: 'iPad Air — Safari', location: 'Lausanne, Suisse', lastActive: 'Il y a 3 jours', isCurrent: false },
]

function SecurityTab() {
  const { t } = useTranslation('settings')
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordChanging, setPasswordChanging] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [googleLinking, setGoogleLinking] = useState(false)
  const [googleMessage, setGoogleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [securityLog, setSecurityLog] = useState<{ id: string; action: string; detail: string; date: string }[]>([])
  const [logLoading, setLogLoading] = useState(true)

  // Check if Google is linked by looking at user identities
  const googleIdentity = user?.identities?.find(id => id.provider === 'google')
  const isGoogleLinked = !!googleIdentity
  const googleEmail = googleIdentity?.identity_data?.email as string | undefined
  const hasPassword = user?.identities?.some(id => id.provider === 'email')

  // Load security log from activity_events
  useEffect(() => {
    async function loadSecurityLog() {
      if (!user?.id) return
      const { data } = await supabase
        .from('activity_events')
        .select('id, action, metadata, created_at')
        .or('entity_type.eq.auth,action.like.login%,action.like.password%,action.like.session%,action.like.google%')
        .eq('actor_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (data && data.length > 0) {
        setSecurityLog(data.map(e => ({
          id: e.id,
          action: e.action,
          detail: (e.metadata as Record<string, string>)?.detail || '',
          date: formatRelativeDate(e.created_at),
        })))
      } else {
        setSecurityLog([])
      }
      setLogLoading(false)
    }
    loadSecurityLog()
  }, [user?.id])

  async function handleChangePassword() {
    if (!newPassword || !passwordValid || !passwordMatch) return
    setPasswordChanging(true)
    setPasswordMessage(null)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage({ type: 'success', text: t('security.password.success') })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('security.password.error')
      setPasswordMessage({ type: 'error', text: message })
    } finally {
      setPasswordChanging(false)
    }
  }

  async function handleLinkGoogle() {
    setGoogleLinking(true)
    setGoogleMessage(null)
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: { redirectTo: window.location.href },
      })
      if (error) {
        setGoogleMessage({ type: 'error', text: error.message })
        setGoogleLinking(false)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('security.connectedAccounts.linkError')
      setGoogleMessage({ type: 'error', text: message })
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
    setGoogleMessage(null)
    const { error } = await supabase.auth.unlinkIdentity(googleIdentity)
    if (error) {
      setGoogleMessage({ type: 'error', text: error.message })
      return
    }
    setGoogleMessage({ type: 'success', text: t('security.connectedAccounts.unlinkSuccess') })
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

          {passwordMessage && (
            <p className={cn('text-xs mt-1', passwordMessage.type === 'success' ? 'text-emerald-500' : 'text-red-500')}>
              {passwordMessage.text}
            </p>
          )}

          <button
            onClick={handleChangePassword}
            disabled={!currentPassword || !passwordValid || !passwordMatch || passwordChanging}
            className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {passwordChanging ? t('security.password.changing') : t('security.password.update')}
          </button>
        </div>
      </div>

      {/* ── Two-Factor Authentication ── */}
      <div className={cn(cardClasses, 'p-6')}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-theme-primary">{t('security.twoFactor.title')}</h2>
            <p className="text-sm text-theme-tertiary mt-0.5">
              {t('security.twoFactor.comingSoon')}
            </p>
          </div>
          <Toggle enabled={false} onChange={() => {}} />
        </div>
        <p className="text-xs text-theme-tertiary mt-3 border-t border-theme-border pt-3">
          {t('security.twoFactor.recommendation')}
        </p>
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
              className="h-8 px-3 rounded-lg text-xs font-medium text-red-500 border border-theme-border hover:border-red-500 transition-colors"
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

        {googleMessage && (
          <p className={cn('text-xs mt-3 pt-3 border-t border-theme-border', googleMessage.type === 'success' ? 'text-emerald-500' : 'text-red-500')}>
            {googleMessage.text}
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
          <button disabled className="text-xs font-medium text-theme-muted cursor-not-allowed" title={t('security.sessions.comingSoon')}>
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
                  <span className="text-[10px] font-medium text-theme-secondary">{t('security.sessions.current')}</span>
                )}
              </div>
              <p className="text-xs text-theme-tertiary mt-0.5">{session.location} · {session.lastActive}</p>
            </div>
            {!session.isCurrent && (
              <button disabled className="text-xs font-medium text-theme-muted cursor-not-allowed" title={t('security.sessions.comingSoon')}>
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

        {logLoading ? (
          <p className="text-sm text-theme-tertiary py-4">{t('security.log.loading')}</p>
        ) : securityLog.length === 0 ? (
          <p className="text-sm text-theme-tertiary py-4">{t('security.log.empty')}</p>
        ) : securityLog.map((event, i) => (
          <div key={event.id} className={cn(
            'py-3.5 flex items-center gap-3',
            i < securityLog.length - 1 && 'border-b border-theme-border'
          )}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-theme-primary">{event.action}</p>
              {event.detail && <p className="text-xs text-theme-tertiary mt-0.5">{event.detail}</p>}
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
  planId: 'starter' | 'pro' | 'entreprise'
  nameKey: string
  descriptionKey: string
  monthlyPrice: number // 0 = free
  annualPrice: number  // per month when billed annually
  features: PlanFeature[]
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
    monthlyPrice: 89, annualPrice: 890, isPopular: true,
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
    planId: 'entreprise', nameKey: 'subscription.plans.entreprise.name', descriptionKey: 'subscription.plans.entreprise.description',
    monthlyPrice: 249, annualPrice: 2490,
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
  const {
    subscription,
    isLoading: subLoading,
    error: subError,
    currentPlan,
    isActive,
    createCheckout,
    isCheckoutLoading,
    openPortal,
    isPortalLoading,
    invalidate,
  } = useSubscription()
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  // Handle return from Stripe Checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    if (params.get('success') === 'true') {
      invalidate()
    }

    if (params.get('canceled') === 'true') {
      // User cancelled — no action needed beyond cleanup
    }

    // Clean up query params
    if (params.has('success') || params.has('canceled')) {
      window.history.replaceState({}, '', window.location.pathname + '?tab=abonnement')
    }
  }, [invalidate])

  const handleCheckout = async (priceId: string | undefined) => {
    setCheckoutError(null)
    if (!priceId) {
      setCheckoutError('Configuration Stripe manquante. Contactez le support.')
      return
    }
    try {
      await createCheckout(priceId)
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const handlePortal = async () => {
    setCheckoutError(null)
    try {
      await openPortal()
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const isStripeLoading = isCheckoutLoading || isPortalLoading

  // Format renewal date
  const renewalDate = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null

  // Plan display info
  const planLabels: Record<string, string> = {
    starter: 'Starter',
    pro: 'Pro',
    entreprise: 'Entreprise',
  }
  const planPrices: Record<string, string> = {
    starter: 'Gratuit',
    pro: subscription?.billing_period === 'yearly' ? 'CHF 890/an' : 'CHF 89/mois',
    entreprise: subscription?.billing_period === 'yearly' ? "CHF 2'490/an" : 'CHF 249/mois',
  }

  // Determine CTA for each plan card
  const getPlanCta = (plan: PlanConfig) => {
    const isCurrent = plan.planId === currentPlan
    if (isCurrent) return 'current'

    // Starter: if current plan is paid, user should use portal to downgrade
    if (plan.planId === 'starter' && currentPlan !== 'starter') return 'portal'

    // Upgrade from starter → direct checkout
    if (currentPlan === 'starter') return 'checkout'

    // Plan change between paid plans → portal
    return 'portal'
  }

  const getPriceId = (planId: 'pro' | 'entreprise'): string | undefined => {
    const period = billing === 'annual' ? 'yearly' : 'monthly'
    return STRIPE_PRICES[planId]?.[period]
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-theme-primary">{t('subscription.title')}</h2>
        <p className="text-sm text-theme-muted mt-1">{t('subscription.subtitle')}</p>
      </div>

      {/* Current plan */}
      <div className={cn(cardClasses, 'p-5')}>
        {subLoading && !subError ? (
          <div className="flex items-center gap-2 text-theme-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Chargement...</span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-theme-primary">Plan {planLabels[currentPlan]}</h3>
                  {isActive && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">{t('subscription.currentBadge')}</span>
                  )}
                  {subscription?.status === 'past_due' && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/10 text-red-500">Paiement échoué</span>
                  )}
                  {subscription?.cancel_at_period_end && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">Annulation prévue</span>
                  )}
                </div>
                <p className="text-xs text-theme-muted mt-0.5">
                  {planPrices[currentPlan]}
                  {renewalDate && !subscription?.cancel_at_period_end && ` — Renouvelé le ${renewalDate}`}
                  {renewalDate && subscription?.cancel_at_period_end && ` — Annulation prévue le ${renewalDate}`}
                </p>
              </div>
            </div>
            {currentPlan !== 'starter' && (
              <button
                onClick={handlePortal}
                disabled={isStripeLoading}
                className="h-8 px-3 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isPortalLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                {isPortalLoading ? 'Redirection...' : t('subscription.manage')}
              </button>
            )}
            {subscription?.status === 'past_due' && (
              <button
                onClick={handlePortal}
                disabled={isStripeLoading}
                className="h-8 px-3 rounded-lg text-xs font-medium border border-red-500/30 text-red-500 hover:border-red-500 transition-colors disabled:opacity-50"
              >
                Mettre à jour le moyen de paiement
              </button>
            )}
          </div>
        )}
        {checkoutError && <p className="text-xs text-red-500 mt-2">{checkoutError}</p>}
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
              Mensuel
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5',
                billing === 'annual' ? 'bg-theme-active text-theme-primary' : 'text-theme-tertiary hover:text-theme-secondary'
              )}
            >
              Annuel
              <span className="text-[10px] font-semibold text-emerald-500">2 mois offerts</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map(plan => {
            const isFree = plan.monthlyPrice === 0
            const price = isFree
              ? 'Gratuit'
              : billing === 'monthly'
                ? `CHF ${plan.monthlyPrice}`
                : `CHF ${plan.annualPrice >= 1000 ? plan.annualPrice.toLocaleString('fr-CH') : plan.annualPrice}`
            const period = isFree ? '' : billing === 'monthly' ? '/mois' : '/an'
            const ctaType = getPlanCta(plan)

            return (
              <div
                key={plan.planId}
                className={cn(
                  'rounded-xl border p-6 relative transition-colors',
                  plan.isPopular ? 'border-theme-primary' : 'border-theme-border',
                )}
              >
                {/* Popular badge */}
                {plan.isPopular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-theme-page border border-theme-primary text-theme-primary">
                      Populaire
                    </span>
                  </div>
                )}

                <div className="text-center mb-5 pt-1">
                  <h4 className="text-base font-semibold text-theme-primary">{t(plan.nameKey)}</h4>

                  {/* Price */}
                  <div className="mt-3">
                    <span className="text-3xl font-bold text-theme-primary">{price}</span>
                    {!isFree && <span className="text-sm text-theme-muted">{period}</span>}
                  </div>

                  {/* Annual savings */}
                  {!isFree && billing === 'annual' && (
                    <div className="mt-1.5 space-y-0.5">
                      <p className="text-xs text-theme-muted line-through">CHF {plan.monthlyPrice * 12}/an</p>
                      <p className="text-xs font-medium text-emerald-500">2 mois offerts</p>
                    </div>
                  )}
                  {(isFree || billing === 'monthly') && (
                    <p className="text-xs text-theme-muted mt-1.5">{t(plan.descriptionKey)}</p>
                  )}
                </div>

                {/* Features */}
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
                {ctaType === 'current' ? (
                  <button disabled className="w-full h-9 rounded-lg text-sm font-medium border border-theme-border text-theme-tertiary cursor-not-allowed opacity-50">
                    Plan actuel
                  </button>
                ) : ctaType === 'checkout' && plan.planId !== 'starter' ? (
                  <button
                    onClick={() => handleCheckout(getPriceId(plan.planId as 'pro' | 'entreprise'))}
                    disabled={isStripeLoading}
                    className="w-full h-9 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isCheckoutLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {isCheckoutLoading
                      ? 'Redirection...'
                      : plan.planId === 'pro' ? 'Passer au Pro' : 'Passer à Entreprise'}
                  </button>
                ) : ctaType === 'portal' ? (
                  <button
                    onClick={handlePortal}
                    disabled={isStripeLoading}
                    className="w-full h-9 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isPortalLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {isPortalLoading ? 'Redirection...' : 'Changer de plan'}
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {/* Custom plan CTA */}
      <div className="rounded-xl border border-theme-border p-6 text-center">
        <p className="text-sm text-theme-primary font-medium">Besoin d'un plan sur mesure ?</p>
        <p className="text-xs text-theme-tertiary mt-1">Pour les grandes agences ou les besoins spécifiques, nous proposons des solutions personnalisées.</p>
        <a
          href="mailto:contact@megga.ch?subject=Plan sur mesure MEGGA"
          className="inline-flex items-center h-9 px-4 mt-3 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
        >
          Contactez-nous
        </a>
      </div>
    </div>
  )
}

/* ─── Applications Tab (Stripe Marketplace style) ─── */

type AppCategory = 'calendar' | 'crm' | 'tools'

interface AppIntegration {
  id: string
  category: AppCategory
  isConnected: boolean
  comingSoon?: boolean
}

const APPS: AppIntegration[] = [
  // Calendar
  { id: 'google-calendar', category: 'calendar', isConnected: false },
  { id: 'outlook-calendar', category: 'calendar', isConnected: false },
  // CRM
  { id: 'hubspot', category: 'crm', isConnected: false, comingSoon: true },
  { id: 'pipedrive', category: 'crm', isConnected: false, comingSoon: true },
  // Tools
  { id: 'csv-import', category: 'tools', isConnected: false, comingSoon: true },
  { id: 'posthog', category: 'tools', isConnected: false, comingSoon: true },
  { id: 'google-drive', category: 'tools', isConnected: false, comingSoon: true },
  { id: 'onedrive', category: 'tools', isConnected: false, comingSoon: true },
]

// ── Official SVG Logos ──

function AppLogo({ id, className }: { id: string; className?: string }) {
  const size = className ?? 'w-8 h-8'
  switch (id) {
    // Google Calendar — multicolor calendar icon (blue/green/yellow/red)
    case 'google-calendar':
      return <svg className={size} viewBox="0 0 24 24"><path d="M18 3h-1V1.5h-2V3H9V1.5H7V3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" fill="#fff"/><path d="M6 3h12a2 2 0 0 1 2 2v2H4V5a2 2 0 0 1 2-2z" fill="#4285F4"/><rect x="4" y="7" width="16" height="14" rx="0" fill="#fff" stroke="#E0E0E0" strokeWidth="0.3"/><rect x="6" y="9" width="3" height="2.5" rx="0.5" fill="#EA4335" opacity="0.8"/><rect x="10.5" y="9" width="3" height="2.5" rx="0.5" fill="#FBBC04" opacity="0.8"/><rect x="15" y="9" width="3" height="2.5" rx="0.5" fill="#34A853" opacity="0.8"/><rect x="6" y="13" width="3" height="2.5" rx="0.5" fill="#4285F4" opacity="0.8"/><rect x="10.5" y="13" width="3" height="2.5" rx="0.5" fill="#EA4335" opacity="0.6"/><rect x="15" y="13" width="3" height="2.5" rx="0.5" fill="#FBBC04" opacity="0.6"/><rect x="6" y="17" width="3" height="2.5" rx="0.5" fill="#34A853" opacity="0.6"/><rect x="10.5" y="17" width="3" height="2.5" rx="0.5" fill="#4285F4" opacity="0.6"/></svg>
    // Outlook — blue envelope with "O" shield
    case 'outlook-calendar':
      return <svg className={size} viewBox="0 0 24 24"><path d="M22 7.5v9a1.5 1.5 0 0 1-1.5 1.5H10V6h10.5A1.5 1.5 0 0 1 22 7.5z" fill="#0078D4"/><path d="M10 6l6 4.5L10 18V6z" fill="#0A5EB5"/><path d="M22 7.5L16 12l-6-4.5V6h10.5A1.5 1.5 0 0 1 22 7.5z" fill="#28A8EA"/><path d="M22 7.5L16 12l6 4.5V7.5z" fill="#0364B8"/><rect x="2" y="5" width="10" height="14" rx="1.5" fill="#0078D4"/><ellipse cx="7" cy="12" rx="3" ry="3.5" fill="none" stroke="#fff" strokeWidth="1.5"/></svg>
    // HubSpot — sprocket gear icon (official orange)
    case 'hubspot':
      return <svg className={size} viewBox="0 0 24 24"><path d="M16.5 8.2V5.5a1.5 1.5 0 1 0-1.5-1.5 1.5 1.5 0 0 0 .3.9v2.5a5 5 0 0 0-3.3 1.8l-5-3.2a2 2 0 1 0-1 1.6l4.8 3.1a5 5 0 0 0 0 3.6l-4.8 3.1A2 2 0 1 0 8 19a2 2 0 0 0-.1-.6l4.9-3.1a5 5 0 1 0 3.7-7.1zM15 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" fill="#FF7A59"/></svg>
    // Pipedrive — green "speech bubble" / droplet mark
    case 'pipedrive':
      return <svg className={size} viewBox="0 0 24 24"><path d="M12 2C7.6 2 4 5.4 4 9.6c0 2.5 1.3 4.8 3.3 6.2l-.3 4.1a.5.5 0 0 0 .8.4l3.5-2.5c.2 0 .5.1.7.1 4.4 0 8-3.4 8-7.7S16.4 2 12 2z" fill="#017737"/><circle cx="9.5" cy="9.5" r="1.5" fill="#fff"/><circle cx="14.5" cy="9.5" r="1.5" fill="#fff"/></svg>
    // CSV Import — spreadsheet/table icon (theme-aware)
    case 'csv-import':
      return <svg className={size} viewBox="0 0 24 24" fill="none"><path d="M4 4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z" stroke="currentColor" strokeWidth="1.5" className="text-theme-secondary"/><path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="text-theme-secondary"/><path d="M8 13h8M8 16h8M8 13v6M12 13v6M16 13v6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="text-theme-muted"/></svg>
    // PostHog — hedgehog mark (official: yellow hedgehog on dark blue)
    case 'posthog':
      return <svg className={size} viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="4" fill="#1D4AFF"/><path d="M7 16l2-3.5 2 1.5 2-4 2 2.5 2-3" stroke="#F9BD2B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="17" cy="8" r="1.5" fill="#F9BD2B"/></svg>
    // Google Drive — official triangle logo (yellow, green, blue)
    case 'google-drive':
      return <svg className={size} viewBox="0 0 24 24"><path d="M8.6 3.5h6.8l6.1 10.5h-6.8L8.6 3.5z" fill="#FBBC04"/><path d="M2.5 14L8.6 3.5l3.4 5.9L5.9 20 2.5 14z" fill="#34A853"/><path d="M5.9 20h13.6l3.1-6H8.6L5.9 20z" fill="#4285F4"/><path d="M12 9.4l2.4 4.6H8.6L12 9.4z" fill="#EA4335" opacity="0.25"/></svg>
    // OneDrive — official double-cloud icon (two-tone blue)
    case 'onedrive':
      return <svg className={size} viewBox="0 0 24 24"><path d="M19.5 16.5h.5a3 3 0 0 0 0-6h-.2a4.5 4.5 0 0 0-8.3-2A3.5 3.5 0 0 0 8 9a3.5 3.5 0 0 0-3.4 2.7A3 3 0 0 0 5 17.5h14.5z" fill="#0364B8"/><path d="M9 16.5h10.5a3 3 0 0 0 .3-6A4.5 4.5 0 0 0 11.5 8.5 3.5 3.5 0 0 0 8 9a3.5 3.5 0 0 0-2 .8" fill="#0078D4"/></svg>
    default:
      return <div className={cn(size, 'rounded bg-theme-hover')} />
  }
}

// ── App Card ──

function AppCard({ app }: { app: AppIntegration }) {
  const { t } = useTranslation('settings')

  return (
    <div className={cn(
      cardClasses, 'p-5 flex flex-col items-center text-center transition-colors hover:border-theme-active',
      app.comingSoon && 'opacity-50',
    )}>
      {/* Logo */}
      <div className="mb-3">
        <AppLogo id={app.id} />
      </div>

      {/* Name */}
      <p className="text-sm font-semibold text-theme-primary">{t(`apps.${app.id}.name`)}</p>
      <p className="text-xs text-theme-tertiary mt-1 line-clamp-2">{t(`apps.${app.id}.desc`)}</p>

      {/* Status */}
      <div className="mt-auto pt-4">
        {app.isConnected ? (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-emerald-500">{t('apps.status.connected')}</span>
          </div>
        ) : app.comingSoon ? (
          <span className="text-xs font-medium text-theme-muted">{t('apps.status.comingSoon')}</span>
        ) : (
          <button className="h-7 px-3 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">
            {t('apps.status.connect')}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Google Calendar Card (special — has connect/sync/disconnect) ──

function GoogleCalendarAppCard() {
  const { t } = useTranslation('settings')
  const { isConnected, isLoading, googleEmail, connectGoogleCalendar, disconnectGoogleCalendar, isDisconnecting, syncAll, isSyncing, lastSyncAt } = useGoogleCalendar()

  return (
    <div className={cn(cardClasses, 'p-5 flex flex-col items-center text-center transition-colors hover:border-theme-active')}>
      <div className="mb-3">
        {isLoading ? <Loader2 className="w-8 h-8 animate-spin text-theme-muted" /> : <AppLogo id="google-calendar" />}
      </div>

      <p className="text-sm font-semibold text-theme-primary">{t('apps.google-calendar.name')}</p>
      <p className="text-xs text-theme-tertiary mt-1 line-clamp-2">
        {isConnected && googleEmail ? googleEmail : t('apps.google-calendar.desc')}
      </p>

      <div className="mt-auto pt-4 flex flex-col items-center gap-2">
        {isConnected ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-emerald-500">{t('apps.status.connected')}</span>
            </div>
            {lastSyncAt && <span className="text-[10px] text-theme-muted">{t('apps.googleCalendar.lastSync', { date: formatRelativeDate(lastSyncAt) })}</span>}
            <div className="flex gap-1.5">
              <button onClick={() => syncAll()} disabled={isSyncing} className="h-6 px-2 rounded text-[10px] font-medium border border-theme-border text-theme-secondary hover:text-theme-primary transition-colors disabled:opacity-50">
                {isSyncing ? '...' : t('apps.googleCalendar.syncNow')}
              </button>
              <button onClick={() => { if (confirm(t('apps.googleCalendar.disconnectConfirm'))) disconnectGoogleCalendar() }} disabled={isDisconnecting} className="h-6 px-2 rounded text-[10px] font-medium text-red-500 border border-theme-border hover:border-red-500 transition-colors disabled:opacity-50">
                {t('apps.googleCalendar.disconnect')}
              </button>
            </div>
          </>
        ) : isLoading ? null : (
          <button onClick={connectGoogleCalendar} className="h-7 px-3 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">
            {t('apps.status.connect')}
          </button>
        )}
      </div>
    </div>
  )
}

function OutlookCalendarAppCard() {
  const { t } = useTranslation('settings')
  const { isConnected, isLoading, outlookEmail, connectOutlookCalendar, disconnectOutlookCalendar, isDisconnecting, syncAll, isSyncing, lastSyncAt } = useOutlookCalendar()

  return (
    <div className={cn(cardClasses, 'p-5 flex flex-col items-center text-center transition-colors hover:border-theme-active')}>
      <div className="mb-3">
        {isLoading ? <Loader2 className="w-8 h-8 animate-spin text-theme-muted" /> : <AppLogo id="outlook-calendar" />}
      </div>

      <p className="text-sm font-semibold text-theme-primary">{t('apps.outlook-calendar.name')}</p>
      <p className="text-xs text-theme-tertiary mt-1 line-clamp-2">
        {isConnected && outlookEmail ? outlookEmail : t('apps.outlook-calendar.desc')}
      </p>

      <div className="mt-auto pt-4 flex flex-col items-center gap-2">
        {isConnected ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-emerald-500">{t('apps.status.connected')}</span>
            </div>
            {lastSyncAt && <span className="text-[10px] text-theme-muted">{t('apps.outlookCalendar.lastSync', { date: formatRelativeDate(lastSyncAt) })}</span>}
            <div className="flex gap-1.5">
              <button onClick={() => syncAll()} disabled={isSyncing} className="h-6 px-2 rounded text-[10px] font-medium border border-theme-border text-theme-secondary hover:text-theme-primary transition-colors disabled:opacity-50">
                {isSyncing ? '...' : t('apps.outlookCalendar.syncNow')}
              </button>
              <button onClick={() => { if (confirm(t('apps.outlookCalendar.disconnectConfirm'))) disconnectOutlookCalendar() }} disabled={isDisconnecting} className="h-6 px-2 rounded text-[10px] font-medium text-red-500 border border-theme-border hover:border-red-500 transition-colors disabled:opacity-50">
                {t('apps.outlookCalendar.disconnect')}
              </button>
            </div>
          </>
        ) : isLoading ? null : (
          <button onClick={connectOutlookCalendar} className="h-7 px-3 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">
            {t('apps.status.connect')}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Applications Tab ──

type AppFilter = 'all' | 'connected' | AppCategory

function ApplicationsTab() {
  const { t } = useTranslation('settings')
  const [filter, setFilter] = useState<AppFilter>('all')

  const filters: { key: AppFilter; labelKey: string }[] = [
    { key: 'all', labelKey: 'apps.filters.all' },
    { key: 'connected', labelKey: 'apps.filters.connected' },
    { key: 'calendar', labelKey: 'apps.filters.calendar' },
    { key: 'crm', labelKey: 'apps.filters.crm' },
    { key: 'tools', labelKey: 'apps.filters.tools' },
  ]

  const filtered = APPS.filter(app => {
    if (filter === 'all') return true
    if (filter === 'connected') return app.isConnected
    return app.category === filter
  })

  return (
    <div className="space-y-5">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'h-8 px-3.5 rounded-lg text-xs font-medium transition-colors',
              filter === f.key
                ? 'bg-theme-active text-theme-primary'
                : 'text-theme-secondary hover:text-theme-primary'
            )}
          >
            {t(f.labelKey)}
            {f.key === 'connected' && <span className="ml-1.5 text-theme-muted">{APPS.filter(a => a.isConnected).length}</span>}
          </button>
        ))}
      </div>

      {/* Apps grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map(app =>
          app.id === 'google-calendar'
            ? <GoogleCalendarAppCard key={app.id} />
            : app.id === 'outlook-calendar'
            ? <OutlookCalendarAppCard key={app.id} />
            : <AppCard key={app.id} app={app} />
        )}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-theme-muted text-center py-8">{t('apps.empty')}</p>
      )}
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
          {activeTab === 'appearance' && <AppearanceTab />}
          {activeTab === 'agency' && <AgencyTab />}
          {activeTab === 'team' && <TeamTab onSwitchTab={setActiveTab} />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'security' && <SecurityTab />}
          {activeTab === 'subscription' && <SubscriptionTab />}
          {activeTab === 'applications' && <ApplicationsTab />}
        </div>
      </div>
    </PageTransition>
  )
}
