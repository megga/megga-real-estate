import { useState } from 'react'
import {
  User, Building2, Users, Bell, CreditCard, Camera,
  Plus, X, Check, FileText,
  Shield, Calendar, MessageSquare, Eye,
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

const TAB_CONFIG: Record<SettingsTab, { label: string; icon: React.ElementType }> = {
  profile:       { label: 'Profil',        icon: User },
  agency:        { label: 'Agence',        icon: Building2 },
  team:          { label: 'Équipe',        icon: Users },
  notifications: { label: 'Notifications', icon: Bell },
  security:      { label: 'Sécurité',      icon: Shield },
  subscription:  { label: 'Abonnement',    icon: CreditCard },
}

/* ─── Shared Styles ─── */

const inputClasses = 'w-full h-11 px-3 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors'
const labelClasses = 'block text-sm font-medium text-theme-primary mb-1.5'
const readonlyClasses = 'w-full h-11 px-3 rounded-lg border border-theme-border bg-theme-input text-sm text-theme-muted cursor-not-allowed'
const cardClasses = 'rounded-xl border border-theme-border'

/* ─── Profile Tab ─── */

function ProfileTab() {
  const { user, signOut } = useAuth()

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
        <h2 className="text-base font-semibold text-theme-primary">Profil</h2>
        <p className="text-sm text-theme-tertiary mt-0.5">Gérez vos informations personnelles et votre profil public.</p>

        {/* Avatar row */}
        <div className="flex items-center gap-5 mt-5 pb-5 border-b border-theme-border">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center">
              <span className="text-xl font-bold text-white">GL</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-theme-primary">Photo de profil</p>
            <p className="text-xs text-theme-tertiary mt-0.5">JPG, PNG ou GIF. Max 2 Mo.</p>
          </div>
        </div>

        {/* Username-style row */}
        <div className="py-4 border-b border-theme-border flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8">
          <div className="sm:w-40 shrink-0">
            <p className="text-sm font-medium text-theme-primary">Prénom</p>
          </div>
          <input type="text" value={form.firstName} onChange={e => update('firstName', e.target.value)} className={inputClasses} />
        </div>

        <div className="py-4 border-b border-theme-border flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8">
          <div className="sm:w-40 shrink-0">
            <p className="text-sm font-medium text-theme-primary">Nom</p>
          </div>
          <input type="text" value={form.lastName} onChange={e => update('lastName', e.target.value)} className={inputClasses} />
        </div>

        <div className="py-4 border-b border-theme-border flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8">
          <div className="sm:w-40 shrink-0">
            <p className="text-sm font-medium text-theme-primary">Email</p>
            <p className="text-xs text-theme-tertiary">Identifiant de connexion</p>
          </div>
          <input type="email" value={form.email} readOnly className={readonlyClasses} />
        </div>

        <div className="py-4 border-b border-theme-border flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8">
          <div className="sm:w-40 shrink-0">
            <p className="text-sm font-medium text-theme-primary">Téléphone</p>
          </div>
          <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} className={inputClasses} />
        </div>

        <div className="py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8">
          <div className="sm:w-40 shrink-0">
            <p className="text-sm font-medium text-theme-primary">Rôle</p>
          </div>
          <input type="text" value={form.role} onChange={e => update('role', e.target.value)} className={inputClasses} />
        </div>
      </div>

      {/* Bio section */}
      <div className={cn(cardClasses, 'p-6 mt-4')}>
        <h2 className="text-base font-semibold text-theme-primary">Bio</h2>
        <p className="text-sm text-theme-tertiary mt-0.5 mb-4">Visible sur votre profil public.</p>
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
          Sauvegarder
        </button>
        <button
          onClick={async () => { await signOut() }}
          className="text-sm font-medium text-theme-tertiary hover:text-danger transition-colors"
        >
          Déconnexion
        </button>
      </div>
    </div>
  )
}

/* ─── Agency Tab ─── */

function AgencyTab() {
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
        <h2 className="text-lg font-semibold text-theme-primary">Informations de l&apos;agence</h2>
        <p className="text-sm text-theme-muted mt-1">Configurez le profil public de votre agence.</p>
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
          <p className="text-sm font-medium text-theme-primary">Logo de l&apos;agence</p>
          <p className="text-xs text-theme-muted mt-0.5">SVG, PNG ou JPG. Format carré recommandé.</p>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className={labelClasses}>Nom de l&apos;agence</label>
          <input type="text" value={form.name} onChange={e => update('name', e.target.value)} className={inputClasses} />
        </div>
        <div className="md:col-span-2">
          <label className={labelClasses}>Adresse</label>
          <input type="text" value={form.address} onChange={e => update('address', e.target.value)} className={inputClasses} />
        </div>
        <div>
          <label className={labelClasses}>Téléphone</label>
          <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} className={inputClasses} />
        </div>
        <div>
          <label className={labelClasses}>Email</label>
          <input type="email" value={form.email} onChange={e => update('email', e.target.value)} className={inputClasses} />
        </div>
        <div>
          <label className={labelClasses}>Site web</label>
          <input type="text" value={form.website} onChange={e => update('website', e.target.value)} className={inputClasses} />
        </div>
        <div>
          <label className={labelClasses}>Numéro IDE / RC</label>
          <input type="text" value={form.ideNumber} onChange={e => update('ideNumber', e.target.value)} className={inputClasses} />
        </div>
      </div>

      <div>
        <label className={labelClasses}>Description</label>
        <textarea
          value={form.description}
          onChange={e => update('description', e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-none"
        />
      </div>

      <div className="flex justify-end">
        <button className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">
          Sauvegarder
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

const ROLE_LABELS: Record<TeamMember['role'], string> = {
  admin: 'Admin', manager: 'Manager', agent: 'Agent', assistant: 'Assistant',
}

const STATUS_STYLES: Record<TeamMember['status'], { label: string; classes: string }> = {
  active:  { label: 'Actif',  classes: 'bg-success/10 text-success' },
  invited: { label: 'Invité', classes: 'bg-warning/10 text-warning' },
}

const MOCK_TEAM: TeamMember[] = [
  { id: '1', name: 'Gregory Lyonnet', email: 'gregory.lyonnet@megga.ch', role: 'admin', status: 'active', addedAt: '12.01.2025', initials: 'GL' },
  { id: '2', name: 'Sophie Martin', email: 'sophie.martin@megga.ch', role: 'agent', status: 'active', addedAt: '15.03.2025', initials: 'SM' },
  { id: '3', name: 'Lucas Bernard', email: 'lucas.bernard@megga.ch', role: 'agent', status: 'active', addedAt: '02.06.2025', initials: 'LB' },
  { id: '4', name: 'Emma Favre', email: 'emma.favre@megga.ch', role: 'assistant', status: 'invited', addedAt: '10.03.2026', initials: 'EF' },
]

function InviteMemberModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamMember['role']>('agent')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="rounded-xl border border-theme-border bg-theme-elevated w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-theme-border">
          <h3 className="text-lg font-semibold text-theme-primary">Inviter un membre</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-theme-hover transition-colors">
            <X className="w-5 h-5 text-theme-muted" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={labelClasses}>Adresse email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nom@agence.ch" className={inputClasses} />
          </div>
          <div>
            <label className={labelClasses}>Rôle</label>
            <select value={role} onChange={e => setRole(e.target.value as TeamMember['role'])} className={inputClasses}>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="agent">Agent</option>
              <option value="assistant">Assistant</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3 p-5 border-t border-theme-border">
          <button onClick={onClose} className="flex-1 h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">Annuler</button>
          <button disabled={!email.includes('@')} className={cn('flex-1 h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors', !email.includes('@') && 'opacity-50 cursor-not-allowed')}>
            Envoyer l&apos;invitation
          </button>
        </div>
      </div>
    </div>
  )
}

function TeamTab() {
  const [showInvite, setShowInvite] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-theme-primary">Équipe</h2>
          <p className="text-sm text-theme-muted mt-1">Gérez les membres de votre agence et leurs rôles.</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Inviter un membre</span>
          <span className="sm:hidden">Inviter</span>
        </button>
      </div>

      <div className={cn(cardClasses, 'overflow-hidden')}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-theme-border bg-theme-section/30">
              <th className="text-left text-xs font-medium text-theme-muted uppercase tracking-wider px-5 py-3">Membre</th>
              <th className="text-left text-xs font-medium text-theme-muted uppercase tracking-wider px-5 py-3 hidden md:table-cell">Rôle</th>
              <th className="text-left text-xs font-medium text-theme-muted uppercase tracking-wider px-5 py-3 hidden sm:table-cell">Statut</th>
              <th className="text-left text-xs font-medium text-theme-muted uppercase tracking-wider px-5 py-3 hidden lg:table-cell">Ajouté le</th>
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
                  <span className="text-sm text-theme-secondary">{ROLE_LABELS[member.role]}</span>
                </td>
                <td className="px-5 py-4 hidden sm:table-cell">
                  <span className={cn('text-xs font-medium px-2 py-1 rounded-badge', STATUS_STYLES[member.status].classes)}>
                    {STATUS_STYLES[member.status].label}
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

interface NotifCategory {
  id: string
  label: string
  description: string
  icon: React.ElementType
  emailDefault: boolean
  pushDefault: boolean
}

const NOTIF_CATEGORIES: NotifCategory[] = [
  { id: 'leads',    label: 'Nouveaux leads',           description: 'Quand un nouveau contact est assigné',         icon: Users,          emailDefault: true,  pushDefault: true },
  { id: 'messages', label: 'Messages reçus',           description: 'Quand un message est reçu dans la messagerie', icon: MessageSquare,  emailDefault: true,  pushDefault: true },
  { id: 'visits',   label: 'Visites planifiées',       description: 'Rappels avant les visites programmées',         icon: Eye,            emailDefault: true,  pushDefault: true },
  { id: 'offers',   label: 'Offres reçues',            description: 'Quand une offre est soumise sur un bien',       icon: FileText,       emailDefault: true,  pushDefault: true },
  { id: 'kyc',      label: 'Dossiers KYC à compléter', description: 'Quand un dossier KYC nécessite une action',     icon: Shield,         emailDefault: true,  pushDefault: true },
  { id: 'calendar', label: 'Rappels calendrier',       description: 'Rappels pour les événements à venir',           icon: Calendar,       emailDefault: true,  pushDefault: true },
]

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
  const [settings, setSettings] = useState<Record<string, { email: boolean; push: boolean }>>(
    Object.fromEntries(NOTIF_CATEGORIES.map(c => [c.id, { email: c.emailDefault, push: c.pushDefault }]))
  )

  const updateSetting = (id: string, channel: 'email' | 'push', value: boolean) => {
    setSettings(prev => ({ ...prev, [id]: { ...prev[id], [channel]: value } }))
  }

  return (
    <div className="space-y-0">
      <div className={cn(cardClasses, 'p-6')}>
        <h2 className="text-base font-semibold text-theme-primary">Notifications</h2>
        <p className="text-sm text-theme-tertiary mt-0.5 mb-1">Choisissez comment et quand vous souhaitez être notifié.</p>

        {NOTIF_CATEGORIES.map((cat, i) => {
          const s = settings[cat.id]
          return (
            <div key={cat.id} className={cn(
              'py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6',
              i < NOTIF_CATEGORIES.length - 1 && 'border-b border-theme-border'
            )}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-theme-primary">{cat.label}</p>
                <p className="text-xs text-theme-tertiary mt-0.5">{cat.description}</p>
              </div>
              <div className="flex items-center gap-6 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-theme-tertiary">Email</span>
                  <Toggle enabled={s.email} onChange={v => updateSetting(cat.id, 'email', v)} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-theme-tertiary">Push</span>
                  <Toggle enabled={s.push} onChange={v => updateSetting(cat.id, 'push', v)} />
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
        <h2 className="text-base font-semibold text-theme-primary">Mot de passe</h2>
        <p className="text-sm text-theme-tertiary mt-0.5 mb-5">Dernière modification : 15.03.2026</p>

        <div className="space-y-4 max-w-md">
          <div>
            <label className={labelClasses}>Mot de passe actuel</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••" className={inputClasses} />
          </div>
          <div>
            <label className={labelClasses}>Nouveau mot de passe</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="6 caractères minimum" className={inputClasses} />
            {newPassword && !passwordValid && (
              <p className="text-xs text-danger mt-1">Le mot de passe doit contenir au moins 6 caractères.</p>
            )}
          </div>
          <div>
            <label className={labelClasses}>Confirmer le nouveau mot de passe</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Retapez le mot de passe" className={inputClasses} />
            {confirmPassword && !passwordMatch && (
              <p className="text-xs text-danger mt-1">Les mots de passe ne correspondent pas.</p>
            )}
          </div>

          <button
            disabled={!currentPassword || !passwordValid || !passwordMatch}
            className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Mettre à jour
          </button>
        </div>
      </div>

      {/* ── Two-Factor Authentication ── */}
      <div className={cn(cardClasses, 'p-6')}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-theme-primary">Authentification à deux facteurs</h2>
            <p className="text-sm text-theme-tertiary mt-0.5">
              {twoFactorEnabled ? 'Activé — votre compte est protégé' : 'Désactivé — recommandé pour plus de sécurité'}
            </p>
          </div>
          <Toggle enabled={twoFactorEnabled} onChange={setTwoFactorEnabled} />
        </div>
        {!twoFactorEnabled && (
          <p className="text-xs text-theme-tertiary mt-3 border-t border-theme-border pt-3">
            Nous recommandons d&apos;activer la 2FA pour protéger votre compte, surtout pour un outil de conformité LAB/KYC.
          </p>
        )}
      </div>

      {/* ── Active Sessions ── */}
      <div className={cn(cardClasses, 'p-6')}>
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-base font-semibold text-theme-primary">Sessions actives</h2>
            <p className="text-sm text-theme-tertiary mt-0.5">{MOCK_SESSIONS.length} appareils connectés</p>
          </div>
          <button className="text-xs font-medium text-theme-tertiary hover:text-danger transition-colors">
            Tout déconnecter
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
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">Actuel</span>
                )}
              </div>
              <p className="text-xs text-theme-tertiary mt-0.5">{session.location} · {session.lastActive}</p>
            </div>
            {!session.isCurrent && (
              <button className="text-xs font-medium text-theme-tertiary hover:text-danger transition-colors">
                Révoquer
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ── Security Log ── */}
      <div className={cn(cardClasses, 'p-6')}>
        <h2 className="text-base font-semibold text-theme-primary">Journal de sécurité</h2>
        <p className="text-sm text-theme-tertiary mt-0.5 mb-1">Dernières activités sur votre compte</p>

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

interface PlanFeature { text: string; included: boolean }
interface Plan {
  name: string; price: string; period: string; description: string
  features: PlanFeature[]; isCurrent?: boolean; isPopular?: boolean
}

const PLANS: Plan[] = [
  {
    name: 'Starter', price: 'Gratuit', period: '', description: 'Pour les agents indépendants qui démarrent.',
    features: [
      { text: '10 biens actifs', included: true }, { text: '50 contacts', included: true },
      { text: 'Recherche basique', included: true }, { text: 'Assistance IA', included: false },
      { text: 'Pipeline KYC', included: false }, { text: 'Portail vendeur', included: false },
      { text: 'Support prioritaire', included: false },
    ],
  },
  {
    name: 'Pro', price: "CHF 89", period: '/mois', description: 'Pour les agents qui veulent aller plus loin.',
    isCurrent: true, isPopular: true,
    features: [
      { text: 'Biens illimités', included: true }, { text: 'Contacts illimités', included: true },
      { text: 'Recherche IA conversationnelle', included: true }, { text: 'Assistance IA copilote', included: true },
      { text: 'Pipeline KYC complet', included: true }, { text: 'Portail vendeur', included: true },
      { text: 'Support prioritaire', included: false },
    ],
  },
  {
    name: 'Agency', price: "CHF 249", period: '/mois', description: 'Pour les agences avec une équipe.',
    features: [
      { text: 'Tout du plan Pro', included: true }, { text: "Jusqu'à 10 agents", included: true },
      { text: 'Tableau de bord agence', included: true }, { text: 'API & intégrations', included: true },
      { text: 'Branding personnalisé', included: true }, { text: 'Export données', included: true },
      { text: 'Support prioritaire 24/7', included: true },
    ],
  },
]

function SubscriptionTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-theme-primary">Abonnement</h2>
        <p className="text-sm text-theme-muted mt-1">Gérez votre plan et votre facturation.</p>
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
              <span className="text-xs font-medium px-2 py-0.5 rounded-badge bg-accent/10 text-accent">Actuel</span>
            </div>
            <p className="text-sm text-theme-muted">CHF 89/mois — renouvelé le 01.04.2026</p>
          </div>
          <button className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors gap-2 hidden sm:flex items-center">
            <CreditCard className="w-4 h-4" />
            Gérer l&apos;abonnement
          </button>
        </div>
        <button className="w-full h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center justify-center gap-2 sm:hidden mt-3">
          <CreditCard className="w-4 h-4" />
          Gérer l&apos;abonnement
        </button>
      </div>

      {/* Plan comparison */}
      <div>
        <h3 className="text-base font-semibold text-theme-primary mb-4">Comparer les plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className={cn(
                'rounded-xl border p-6 relative transition-colors duration-200 border-2',
                plan.isCurrent ? 'border-accent' : 'border-theme-border',
              )}
            >
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-accent text-white flex items-center gap-1">
                    <Star className="w-3 h-3" /> Populaire
                  </span>
                </div>
              )}
              <div className="text-center mb-4 pt-1">
                <h4 className="text-lg font-semibold text-theme-primary">{plan.name}</h4>
                <div className="mt-2">
                  <span className="text-2xl font-bold text-theme-primary">{plan.price}</span>
                  {plan.period && <span className="text-sm text-theme-muted">{plan.period}</span>}
                </div>
                <p className="text-xs text-theme-muted mt-2">{plan.description}</p>
              </div>
              <div className="space-y-2.5 mb-5">
                {plan.features.map((feat, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {feat.included ? <Check className="w-4 h-4 text-success shrink-0" /> : <X className="w-4 h-4 text-theme-tertiary shrink-0" />}
                    <span className={feat.included ? 'text-theme-primary' : 'text-theme-tertiary'}>{feat.text}</span>
                  </div>
                ))}
              </div>
              {plan.isCurrent ? (
                <button disabled className="w-full h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-tertiary cursor-not-allowed opacity-50">Plan actuel</button>
              ) : (
                <button className="w-full h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center justify-center gap-1">
                  Choisir <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Main Component ─── */

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-theme-primary">Paramètres</h1>
          <p className="text-sm text-theme-tertiary mt-1">Configurez votre profil, votre agence et vos préférences.</p>
        </div>

        {/* Tabs — no icons, text only */}
        <div className="border-b border-theme-border overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {TABS.map(tab => {
              const config = TAB_CONFIG[tab]
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
                  {config.label}
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
