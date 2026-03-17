import { useState } from 'react'
import {
  User, Building2, Users, Bell, Camera, Save,
  Mail, Phone, MapPin, Globe, Plus, Trash2, Shield,
  Lock, Key, Smartphone, Monitor, Clock, AlertTriangle,
  CheckCircle2, XCircle, LogOut, Eye, EyeOff, ShieldCheck,
  History, FileText, ChevronDown, Download, Sun, Moon, Palette,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { toast } from '@/hooks/useToast'

type SettingsTab = 'profile' | 'agency' | 'team' | 'notifications' | 'security' | 'appearance'

const TABS: { id: SettingsTab; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'Profil personnel', icon: User },
  { id: 'appearance', label: 'Apparence', icon: Palette },
  { id: 'agency', label: 'Agence', icon: Building2 },
  { id: 'team', label: 'Équipe', icon: Users },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Sécurité', icon: Shield },
]

// ── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab({ fullName, email }: { fullName: string; email: string }) {
  const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  const [firstName, lastName] = fullName.split(' ')

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex items-center gap-5">
        <div className="relative">
          <div className="h-20 w-20 rounded-full bg-accent flex items-center justify-center">
            <span className="text-2xl font-semibold text-white">{initials}</span>
          </div>
          <button
            className="absolute bottom-0 right-0 h-7 w-7 bg-card border border-border rounded-full flex items-center justify-center shadow-card hover:bg-section transition-colors"
            aria-label="Changer la photo"
          >
            <Camera className="h-3.5 w-3.5 text-primary-600" aria-hidden="true" />
          </button>
        </div>
        <div>
          <p className="text-sm font-semibold text-primary-900">{fullName}</p>
          <p className="text-xs text-muted-foreground">Agent principal · MEGGA Real Estate</p>
        </div>
      </div>

      {/* Form */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-primary-900 mb-1.5">Prénom</label>
          <input
            id="firstName"
            type="text"
            defaultValue={firstName}
            className="w-full h-10 px-3 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-primary-900 mb-1.5">Nom</label>
          <input
            id="lastName"
            type="text"
            defaultValue={lastName}
            className="w-full h-10 px-3 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-primary-900 mb-1.5">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400" aria-hidden="true" />
            <input
              id="email"
              type="email"
              defaultValue={email}
              className="w-full h-10 pl-9 pr-3 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
            />
          </div>
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-primary-900 mb-1.5">Téléphone</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400" aria-hidden="true" />
            <input
              id="phone"
              type="tel"
              defaultValue="+41 22 123 45 67"
              className="w-full h-10 pl-9 pr-3 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
            />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="bio" className="block text-sm font-medium text-primary-900 mb-1.5">Bio</label>
        <textarea
          id="bio"
          rows={3}
          defaultValue="Agent immobilier spécialisé dans l'immobilier de prestige à Genève. Plus de 15 ans d'expérience."
          className="w-full px-3 py-2.5 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-none"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => toast.success('Profil mis à jour', 'Vos modifications ont été enregistrées.')}
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium px-5 py-2.5 rounded-button transition-colors"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          Enregistrer
        </button>
      </div>
    </div>
  )
}

// ── Appearance Tab ───────────────────────────────────────────────────────────

function AppearanceTab() {
  const { theme, setTheme } = useTheme()

  const options: { value: 'light' | 'dark' | 'system'; label: string; description: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Clair', description: 'Interface lumineuse sur fond blanc', icon: Sun },
    { value: 'dark', label: 'Sombre', description: 'Interface sombre, confortable de nuit', icon: Moon },
    { value: 'system', label: 'Système', description: 'Suit les préférences de votre appareil', icon: Monitor },
  ]

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-primary-900">Thème de l&apos;interface</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Choisissez comment MEGGA s&apos;affiche sur votre écran.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((opt) => {
          const Icon = opt.icon
          const isActive = theme === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                'flex flex-col items-center gap-3 p-5 rounded-card border-2 transition-all duration-200 text-center',
                isActive
                  ? 'border-accent bg-accent/5 shadow-card'
                  : 'border-border hover:border-primary-300 hover:bg-section/50'
              )}
            >
              <div className={cn(
                'h-12 w-12 rounded-full flex items-center justify-center',
                isActive ? 'bg-accent/10' : 'bg-section'
              )}>
                <Icon className={cn('h-6 w-6', isActive ? 'text-accent' : 'text-primary-400')} aria-hidden="true" />
              </div>
              <div>
                <p className={cn('text-sm font-semibold', isActive ? 'text-accent' : 'text-primary-900')}>
                  {opt.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
              </div>
              {isActive && (
                <div className="h-2 w-2 rounded-full bg-accent" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Agency Tab ───────────────────────────────────────────────────────────────

function AgencyTab() {
  return (
    <div className="space-y-6">
      {/* Agency logo */}
      <div className="flex items-center gap-5">
        <div className="relative">
          <div className="h-16 w-16 rounded-card bg-primary-900 flex items-center justify-center">
            <span className="text-lg font-bold text-white">GG</span>
          </div>
          <button
            className="absolute bottom-0 right-0 h-6 w-6 bg-card border border-border rounded-full flex items-center justify-center shadow-card hover:bg-section transition-colors"
            aria-label="Changer le logo"
          >
            <Camera className="h-3 w-3 text-primary-600" aria-hidden="true" />
          </button>
        </div>
        <div>
          <p className="text-sm font-semibold text-primary-900">MEGGA Real Estate</p>
          <p className="text-xs text-muted-foreground">Plan Pro · Genève</p>
        </div>
      </div>

      {/* Form */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="agencyName" className="block text-sm font-medium text-primary-900 mb-1.5">Nom de l&apos;agence</label>
          <input
            id="agencyName"
            type="text"
            defaultValue="MEGGA Real Estate"
            className="w-full h-10 px-3 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label htmlFor="agencyEmail" className="block text-sm font-medium text-primary-900 mb-1.5">Email de l&apos;agence</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400" aria-hidden="true" />
            <input
              id="agencyEmail"
              type="email"
              defaultValue="contact@megga.ch"
              className="w-full h-10 pl-9 pr-3 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
            />
          </div>
        </div>
        <div>
          <label htmlFor="agencyPhone" className="block text-sm font-medium text-primary-900 mb-1.5">Téléphone</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400" aria-hidden="true" />
            <input
              id="agencyPhone"
              type="tel"
              defaultValue="+41 22 700 00 00"
              className="w-full h-10 pl-9 pr-3 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
            />
          </div>
        </div>
        <div>
          <label htmlFor="agencyWebsite" className="block text-sm font-medium text-primary-900 mb-1.5">Site web</label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400" aria-hidden="true" />
            <input
              id="agencyWebsite"
              type="url"
              defaultValue="https://megga.ch"
              className="w-full h-10 pl-9 pr-3 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="agencyAddress" className="block text-sm font-medium text-primary-900 mb-1.5">Adresse</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400" aria-hidden="true" />
            <input
              id="agencyAddress"
              type="text"
              defaultValue="Rue du Rhône 42, 1204 Genève"
              className="w-full h-10 pl-9 pr-3 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
            />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="agencyDesc" className="block text-sm font-medium text-primary-900 mb-1.5">Description</label>
        <textarea
          id="agencyDesc"
          rows={3}
          defaultValue="MEGGA Real Estate — Premier portail immobilier suisse AI-first. Marketplace, CRM intégré, compliance LAB/KYC."
          className="w-full px-3 py-2.5 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-none"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => toast.success('Agence mise à jour', 'Les informations ont été enregistrées.')}
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium px-5 py-2.5 rounded-button transition-colors"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          Enregistrer
        </button>
      </div>
    </div>
  )
}

// ── Team Tab ─────────────────────────────────────────────────────────────────

const MOCK_TEAM = [
  { id: '1', name: 'Gregory Lyonnet', email: 'gregory@megga.ch', role: 'admin', avatar: 'bg-accent' },
  { id: '2', name: 'Sophie Martin', email: 'sophie@megga.ch', role: 'agent', avatar: 'bg-success' },
  { id: '3', name: 'Marc Dupont', email: 'marc@megga.ch', role: 'assistant', avatar: 'bg-warning' },
]

const ROLE_MAP: Record<string, { label: string; cls: string }> = {
  admin: { label: 'Admin', cls: 'bg-danger/10 text-danger' },
  manager: { label: 'Manager', cls: 'bg-warning/10 text-warning' },
  agent: { label: 'Agent', cls: 'bg-accent/10 text-accent' },
  assistant: { label: 'Assistant', cls: 'bg-primary-100 text-primary-600' },
}

function TeamTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-primary-900">Membres de l&apos;équipe</p>
          <p className="text-xs text-muted-foreground mt-0.5">{MOCK_TEAM.length} membres</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium px-4 py-2 rounded-button transition-colors">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Inviter
        </button>
      </div>

      <div className="space-y-3">
        {MOCK_TEAM.map((member) => {
          const initials = member.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
          const role = ROLE_MAP[member.role]
          return (
            <div key={member.id} className="bg-card rounded-card shadow-card p-4 flex items-center gap-4">
              <div className={cn('h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0', member.avatar)}>
                <span className="text-xs font-semibold text-white">{initials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-primary-900">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.email}</p>
              </div>
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-badge', role.cls)}>
                {role.label}
              </span>
              <select
                defaultValue={member.role}
                aria-label={`Rôle de ${member.name}`}
                className="h-8 px-2 text-xs bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="agent">Agent</option>
                <option value="assistant">Assistant</option>
              </select>
              {member.role !== 'admin' && (
                <button
                  className="p-1.5 rounded-md text-primary-400 hover:text-danger hover:bg-danger/10 transition-colors"
                  aria-label={`Retirer ${member.name}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Notifications Tab ────────────────────────────────────────────────────────

const NOTIF_SETTINGS = [
  { id: 'new_lead', label: 'Nouveau lead reçu', description: 'Quand un acheteur vous contacte via le portail', email: true, push: true },
  { id: 'visit_reminder', label: 'Rappel de visite', description: '30 minutes avant chaque visite planifiée', email: true, push: true },
  { id: 'offer_received', label: 'Offre reçue', description: 'Quand un acheteur soumet une offre', email: true, push: true },
  { id: 'kyc_update', label: 'Mise à jour KYC', description: 'Quand un document KYC est soumis ou validé', email: true, push: false },
  { id: 'deal_stage', label: 'Changement d\'étape pipeline', description: 'Quand un deal change d\'étape', email: false, push: true },
  { id: 'message', label: 'Nouveau message', description: 'Quand vous recevez un message d\'un contact', email: true, push: true },
]

function NotificationsTab() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Choisissez quand et comment vous souhaitez être notifié.
      </p>

      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-2">
        <div className="flex-1" />
        <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider w-16 text-center">Email</span>
        <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider w-16 text-center">Push</span>
      </div>

      <div className="space-y-2">
        {NOTIF_SETTINGS.map((setting) => (
          <div key={setting.id} className="bg-card rounded-card shadow-card px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary-900">{setting.label}</p>
              <p className="text-xs text-muted-foreground">{setting.description}</p>
            </div>
            <div className="w-16 flex justify-center">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked={setting.email}
                  className="sr-only peer"
                  aria-label={`${setting.label} par email`}
                />
                <div className="w-9 h-5 bg-primary-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent" />
              </label>
            </div>
            <div className="w-16 flex justify-center">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked={setting.push}
                  className="sr-only peer"
                  aria-label={`${setting.label} par push`}
                />
                <div className="w-9 h-5 bg-primary-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent" />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => toast.success('Notifications mises à jour', 'Vos préférences ont été enregistrées.')}
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium px-5 py-2.5 rounded-button transition-colors"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          Enregistrer
        </button>
      </div>
    </div>
  )
}

// ── Security Tab ─────────────────────────────────────────────────────────────

function ToggleSwitch({ defaultChecked, label }: { defaultChecked: boolean; label: string }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" defaultChecked={defaultChecked} className="sr-only peer" aria-label={label} />
      <div className="w-9 h-5 bg-primary-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent" />
    </label>
  )
}

function SecuritySection({
  icon: Icon,
  title,
  badge,
  defaultOpen = false,
  children,
  headerRight,
}: {
  icon: typeof Shield
  title: string
  badge?: { label: string; cls: string }
  defaultOpen?: boolean
  children: React.ReactNode
  headerRight?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="bg-card rounded-card border border-border overflow-hidden transition-shadow hover:shadow-card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-section/30"
        aria-expanded={open}
      >
        <div className="h-9 w-9 rounded-button bg-section flex items-center justify-center flex-shrink-0">
          <Icon className="h-4.5 w-4.5 text-primary-600" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-primary-900">{title}</h3>
            {badge && (
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-badge', badge.cls)}>
                {badge.label}
              </span>
            )}
          </div>
        </div>
        {headerRight && (
          <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
            {headerRight}
          </div>
        )}
        <ChevronDown
          className={cn('h-4 w-4 text-primary-400 flex-shrink-0 transition-transform duration-200', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="px-5 pb-5 pt-0">
          <div className="border-t border-border pt-4">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

const MOCK_SESSIONS = [
  {
    id: '1',
    device: 'MacBook Air — Safari',
    location: 'Genève, Suisse',
    ip: '178.197.xxx.xxx',
    lastActive: 'Actif maintenant',
    current: true,
    icon: Monitor,
  },
  {
    id: '2',
    device: 'iPhone 15 Pro — Safari',
    location: 'Genève, Suisse',
    ip: '178.197.xxx.xxx',
    lastActive: 'Il y a 2 heures',
    current: false,
    icon: Smartphone,
  },
  {
    id: '3',
    device: 'Windows PC — Chrome',
    location: 'Lausanne, Suisse',
    ip: '83.150.xxx.xxx',
    lastActive: 'Il y a 3 jours',
    current: false,
    icon: Monitor,
  },
]

const MOCK_ACTIVITY_LOG = [
  { id: '1', action: 'Connexion réussie', device: 'MacBook Air — Safari', ip: '178.197.xxx.xxx', time: 'Aujourd\'hui, 08:15', status: 'success' as const },
  { id: '2', action: 'Mot de passe modifié', device: 'MacBook Air — Safari', ip: '178.197.xxx.xxx', time: 'Hier, 16:30', status: 'success' as const },
  { id: '3', action: 'Tentative de connexion échouée', device: 'Inconnu — Firefox', ip: '91.108.xxx.xxx', time: 'Hier, 14:22', status: 'danger' as const },
  { id: '4', action: 'Connexion réussie', device: 'iPhone 15 Pro — Safari', ip: '178.197.xxx.xxx', time: '15.03.2026, 09:00', status: 'success' as const },
  { id: '5', action: 'Dossier KYC validé — Laurent Berset', device: 'MacBook Air — Safari', ip: '178.197.xxx.xxx', time: '14.03.2026, 11:45', status: 'success' as const },
  { id: '6', action: 'Export de données contacts', device: 'MacBook Air — Safari', ip: '178.197.xxx.xxx', time: '13.03.2026, 17:00', status: 'warning' as const },
]

const SECURITY_SCORE_ITEMS = [
  { label: 'Mot de passe fort', done: true },
  { label: '2FA activée', done: false },
  { label: 'Alertes connexion', done: true },
  { label: 'Timeout session', done: true },
  { label: 'Export sécurisé', done: true },
]

function SecurityTab({ email }: { email: string }) {
  const [showPassword, setShowPassword] = useState(false)

  const scoreCompleted = SECURITY_SCORE_ITEMS.filter((i) => i.done).length
  const scoreTotal = SECURITY_SCORE_ITEMS.length
  const scorePct = Math.round((scoreCompleted / scoreTotal) * 100)

  return (
    <div className="space-y-5">
      {/* ── Security Score Overview ── */}
      <div className="bg-gradient-to-r from-accent/5 to-accent/10 rounded-card border border-accent/15 p-5">
        <div className="flex items-start gap-5">
          {/* Score circle */}
          <div className="relative h-16 w-16 flex-shrink-0">
            <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="#E5E7EB" strokeWidth="4" />
              <circle
                cx="32" cy="32" r="28" fill="none"
                stroke={scorePct >= 80 ? '#059669' : scorePct >= 50 ? '#D97706' : '#DC2626'}
                strokeWidth="4"
                strokeDasharray={`${(scorePct / 100) * 175.9} 175.9`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-primary-900">{scorePct}%</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-primary-900">Score de sécurité</h3>
              <span className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded-badge',
                scorePct >= 80 ? 'bg-success/10 text-success' : scorePct >= 50 ? 'bg-warning/10 text-warning' : 'bg-danger/10 text-danger'
              )}>
                {scorePct >= 80 ? 'Bon' : scorePct >= 50 ? 'Moyen' : 'Faible'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 mb-3">
              {scoreCompleted}/{scoreTotal} mesures de sécurité activées
            </p>
            <div className="flex flex-wrap gap-2">
              {SECURITY_SCORE_ITEMS.map((item) => (
                <span
                  key={item.label}
                  className={cn(
                    'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-badge',
                    item.done ? 'bg-success/10 text-success' : 'bg-primary-100 text-primary-400'
                  )}
                >
                  {item.done ? (
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <XCircle className="h-3 w-3" aria-hidden="true" />
                  )}
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Accordion Sections ── */}

      {/* Password */}
      <SecuritySection
        icon={Key}
        title="Mot de passe"
        badge={{ label: '45 jours', cls: 'bg-warning/10 text-warning' }}
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="currentPassword" className="block text-xs font-medium text-primary-900 mb-1.5">
                Mot de passe actuel
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400" aria-hidden="true" />
                <input
                  id="currentPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full h-10 pl-9 pr-10 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-400 hover:text-primary-600 transition-colors"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div />
            <div>
              <label htmlFor="newPassword" className="block text-xs font-medium text-primary-900 mb-1.5">
                Nouveau mot de passe
              </label>
              <input
                id="newPassword"
                type="password"
                placeholder="Minimum 8 caractères"
                className="w-full h-10 px-3 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-medium text-primary-900 mb-1.5">
                Confirmer le nouveau mot de passe
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Retapez le mot de passe"
                className="w-full h-10 px-3 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
              />
            </div>
          </div>

          <div className="bg-section rounded-button p-3">
            <p className="text-xs font-medium text-primary-600 mb-2">Exigences :</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                'Minimum 8 caractères',
                'Une lettre majuscule',
                'Une lettre minuscule',
                'Un chiffre',
                'Un caractère spécial (!@#$...)',
                'Différent des 5 derniers',
              ].map((req) => (
                <div key={req} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-primary-300 flex-shrink-0" aria-hidden="true" />
                  {req}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => toast.success('Mot de passe modifié', 'Votre mot de passe a été mis à jour avec succès.')}
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-xs font-medium px-4 py-2 rounded-button transition-colors"
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              Modifier
            </button>
          </div>
        </div>
      </SecuritySection>

      {/* 2FA */}
      <SecuritySection
        icon={Smartphone}
        title="Authentification 2FA"
        badge={{ label: 'Non activée', cls: 'bg-danger/10 text-danger' }}
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-warning/5 border border-warning/15 rounded-button p-3">
            <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-primary-700">
              La double authentification protège votre compte même si votre mot de passe est compromis.
              Fortement recommandé pour les comptes avec accès aux données KYC.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => toast.info('Configuration 2FA', 'Scannez le QR code avec votre application d\'authentification.')}
              className="flex items-center gap-3 p-3.5 bg-section rounded-button border border-border hover:border-accent/30 hover:bg-accent/5 transition-colors group"
            >
              <Smartphone className="h-5 w-5 text-accent" aria-hidden="true" />
              <div className="text-left">
                <p className="text-sm font-medium text-primary-900 group-hover:text-accent transition-colors">Application TOTP</p>
                <p className="text-[11px] text-muted-foreground">Google Authenticator, Authy</p>
              </div>
            </button>
            <button
              onClick={() => toast.info('SMS 2FA', 'Un code sera envoyé à votre téléphone pour chaque connexion.')}
              className="flex items-center gap-3 p-3.5 bg-section rounded-button border border-border hover:border-accent/30 hover:bg-accent/5 transition-colors group"
            >
              <Mail className="h-5 w-5 text-accent" aria-hidden="true" />
              <div className="text-left">
                <p className="text-sm font-medium text-primary-900 group-hover:text-accent transition-colors">SMS / Email</p>
                <p className="text-[11px] text-muted-foreground">Code envoyé à {email}</p>
              </div>
            </button>
          </div>
        </div>
      </SecuritySection>

      {/* Active Sessions */}
      <SecuritySection
        icon={Monitor}
        title="Sessions actives"
        badge={{ label: `${MOCK_SESSIONS.length} appareils`, cls: 'bg-accent/10 text-accent' }}
        defaultOpen={false}
        headerRight={
          <button
            onClick={() => toast.warning('Sessions fermées', 'Toutes les autres sessions ont été déconnectées.')}
            className="text-[11px] font-medium text-danger hover:text-danger/80 transition-colors px-2 py-1"
          >
            Tout déconnecter
          </button>
        }
      >
        <div className="space-y-2">
          {MOCK_SESSIONS.map((session) => {
            const DeviceIcon = session.icon
            return (
              <div key={session.id} className="bg-section/50 rounded-button p-3 flex items-center gap-3">
                <div className={cn(
                  'h-9 w-9 rounded-button flex items-center justify-center flex-shrink-0',
                  session.current ? 'bg-success/10' : 'bg-primary-100'
                )}>
                  <DeviceIcon className={cn('h-4.5 w-4.5', session.current ? 'text-success' : 'text-primary-400')} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-primary-900">{session.device}</p>
                    {session.current && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-badge bg-success/10 text-success">
                        Actuelle
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {session.location} · {session.ip} · {session.lastActive}
                  </p>
                </div>
                {!session.current && (
                  <button
                    onClick={() => toast.success('Session fermée', `La session sur ${session.device} a été déconnectée.`)}
                    className="p-1.5 rounded-md text-primary-400 hover:text-danger hover:bg-danger/10 transition-colors"
                    aria-label={`Déconnecter ${session.device}`}
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </SecuritySection>

      {/* Security Preferences */}
      <SecuritySection
        icon={ShieldCheck}
        title="Préférences de sécurité"
        badge={{ label: '3/4 actives', cls: 'bg-success/10 text-success' }}
        defaultOpen={false}
      >
        <div className="space-y-2">
          {[
            {
              id: 'session_timeout',
              icon: Clock,
              label: 'Timeout de session',
              description: 'Déconnexion après 30 min d\'inactivité',
              enabled: true,
            },
            {
              id: 'login_alerts',
              icon: AlertTriangle,
              label: 'Alertes de connexion',
              description: 'Email lors d\'une connexion suspecte',
              enabled: true,
            },
            {
              id: 'ip_whitelist',
              icon: Shield,
              label: 'Restriction IP',
              description: 'Limiter l\'accès aux IP du bureau',
              enabled: false,
            },
            {
              id: 'export_approval',
              icon: FileText,
              label: 'Approbation exports',
              description: 'Confirmation requise pour les exports',
              enabled: true,
            },
          ].map((pref) => {
            const PrefIcon = pref.icon
            return (
              <div key={pref.id} className="flex items-center gap-3 px-3 py-2.5 rounded-button hover:bg-section/50 transition-colors">
                <PrefIcon className="h-4 w-4 text-primary-400 flex-shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary-900">{pref.label}</p>
                  <p className="text-[11px] text-muted-foreground">{pref.description}</p>
                </div>
                <ToggleSwitch defaultChecked={pref.enabled} label={pref.label} />
              </div>
            )
          })}
        </div>

        <div className="flex justify-end mt-3">
          <button
            onClick={() => toast.success('Préférences enregistrées', 'Vos paramètres de sécurité ont été mis à jour.')}
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-xs font-medium px-4 py-2 rounded-button transition-colors"
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            Enregistrer
          </button>
        </div>
      </SecuritySection>

      {/* Activity Log */}
      <SecuritySection
        icon={History}
        title="Journal d'activité"
        defaultOpen={false}
        headerRight={
          <button className="text-[11px] font-medium text-accent hover:text-accent/80 transition-colors px-2 py-1">
            Voir tout →
          </button>
        }
      >
        <div className="space-y-0.5">
          {MOCK_ACTIVITY_LOG.map((entry) => {
            const statusIcon = {
              success: CheckCircle2,
              danger: XCircle,
              warning: AlertTriangle,
            }[entry.status]
            const statusColor = {
              success: 'text-success',
              danger: 'text-danger',
              warning: 'text-warning',
            }[entry.status]
            const StatusIcon = statusIcon

            return (
              <div key={entry.id} className="flex items-center gap-3 px-2 py-2 rounded-button hover:bg-section/50 transition-colors">
                <StatusIcon className={cn('h-3.5 w-3.5 flex-shrink-0', statusColor)} aria-hidden="true" />
                <p className={cn('text-xs flex-1 min-w-0 truncate', entry.status === 'danger' ? 'font-medium text-danger' : 'text-primary-900')}>
                  {entry.action}
                </p>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">{entry.time}</span>
              </div>
            )
          })}
        </div>
      </SecuritySection>

      {/* ── Danger zone — compact row ── */}
      <div className="flex items-center gap-4 rounded-card border border-danger/20 bg-danger/5 px-5 py-4">
        <AlertTriangle className="h-4.5 w-4.5 text-danger flex-shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-danger">Zone dangereuse</p>
          <p className="text-[11px] text-muted-foreground">Export RGPD ou suppression définitive du compte</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => toast.info('Export RGPD', 'Votre export de données a été lancé. Vous recevrez un email.')}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-accent border border-accent/20 px-3 py-1.5 rounded-button hover:bg-accent/5 transition-colors"
          >
            <Download className="h-3 w-3" aria-hidden="true" />
            Exporter
          </button>
          <button className="text-[11px] font-medium text-danger border border-danger/30 px-3 py-1.5 rounded-button hover:bg-danger/10 transition-colors">
            Supprimer le compte
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Settings Page ───────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuth()
  const fullName = user?.user_metadata?.full_name ?? 'Agent'
  const email = user?.email ?? ''
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">Paramètres</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gérez votre profil et les paramètres de votre agence
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tab navigation */}
        <nav className="lg:w-56 flex-shrink-0" aria-label="Sections des paramètres">
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2.5 rounded-button text-sm font-medium transition-colors whitespace-nowrap',
                    activeTab === tab.id
                      ? 'bg-accent/10 text-accent'
                      : 'text-primary-600 hover:bg-section hover:text-primary-900'
                  )}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                >
                  <Icon className="h-[18px] w-[18px] flex-shrink-0" aria-hidden="true" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* spacer */}
          <div className="hidden lg:block mt-4" />
        </nav>

        {/* Tab content */}
        <div className="flex-1 bg-card rounded-card shadow-card p-6">
          {activeTab === 'profile' && <ProfileTab fullName={fullName} email={email} />}
          {activeTab === 'appearance' && <AppearanceTab />}
          {activeTab === 'agency' && <AgencyTab />}
          {activeTab === 'team' && <TeamTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'security' && <SecurityTab email={email} />}
        </div>
      </div>
    </div>
  )
}
