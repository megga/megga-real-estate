import { useState } from 'react'
import {
  User, Building2, Users, Bell, CreditCard, Camera,
  Plus, X, Check, Mail, FileText,
  Shield, Calendar, MessageSquare, Eye,
  Star, ChevronRight, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/* ─── Tab Types ─── */

const TABS = ['profile', 'agency', 'team', 'notifications', 'subscription'] as const
type SettingsTab = typeof TABS[number]

const TAB_CONFIG: Record<SettingsTab, { label: string; icon: React.ElementType }> = {
  profile:       { label: 'Profil',        icon: User },
  agency:        { label: 'Agence',        icon: Building2 },
  team:          { label: 'Équipe',        icon: Users },
  notifications: { label: 'Notifications', icon: Bell },
  subscription:  { label: 'Abonnement',    icon: CreditCard },
}

/* ─── Shared Styles ─── */

const inputClasses = 'w-full h-11 px-3 rounded-input border border-border bg-white text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors'
const labelClasses = 'block text-sm font-medium text-primary-900 mb-1.5'
const readonlyClasses = 'w-full h-11 px-3 rounded-input border border-border bg-gray-50 text-sm text-gray-500 cursor-not-allowed'

/* ─── Profile Tab ─── */

function ProfileTab() {
  const [form, setForm] = useState({
    firstName: 'Gregory',
    lastName: 'Lyonnet',
    email: 'gregory.lyonnet@megga.ch',
    phone: '+41 22 310 45 67',
    role: 'Agent principal',
    bio: 'Agent immobilier spécialisé dans le marché genevois depuis 12 ans. Expertise en biens de prestige et transactions internationales.',
  })

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary-900">Profil personnel</h2>
        <p className="text-sm text-gray-500 mt-1">Gérez vos informations personnelles et votre profil public.</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center">
            <span className="text-2xl font-bold text-white">GL</span>
          </div>
          <button className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white border border-border shadow-card flex items-center justify-center hover:bg-gray-50 transition-colors">
            <Camera className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div>
          <p className="text-sm font-medium text-primary-900">Photo de profil</p>
          <p className="text-xs text-gray-500 mt-0.5">JPG, PNG ou GIF. Max 2 Mo.</p>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClasses}>Prénom</label>
          <input type="text" value={form.firstName} onChange={e => update('firstName', e.target.value)} className={inputClasses} />
        </div>
        <div>
          <label className={labelClasses}>Nom</label>
          <input type="text" value={form.lastName} onChange={e => update('lastName', e.target.value)} className={inputClasses} />
        </div>
        <div>
          <label className={labelClasses}>Email</label>
          <input type="email" value={form.email} readOnly className={readonlyClasses} />
        </div>
        <div>
          <label className={labelClasses}>Téléphone</label>
          <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} className={inputClasses} />
        </div>
        <div>
          <label className={labelClasses}>Titre / Rôle</label>
          <input type="text" value={form.role} onChange={e => update('role', e.target.value)} className={inputClasses} />
        </div>
      </div>

      <div>
        <label className={labelClasses}>Bio</label>
        <textarea
          value={form.bio}
          onChange={e => update('bio', e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 rounded-input border border-border bg-white text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors resize-none"
        />
      </div>

      <div className="flex justify-end">
        <Button className="gap-2 bg-accent hover:bg-accent/90 text-white rounded-button">
          <Check className="w-4 h-4" />
          Sauvegarder
        </Button>
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
    description: 'Agence immobilière premium à Genève, spécialisée dans les biens de prestige et les transactions internationales. Service personnalisé et accompagnement complet.',
    ideNumber: 'CHE-123.456.789',
  })

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary-900">Informations de l&apos;agence</h2>
        <p className="text-sm text-gray-500 mt-1">Configurez le profil public de votre agence.</p>
      </div>

      {/* Logo */}
      <div className="flex items-center gap-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-card bg-primary-900 flex items-center justify-center">
            <span className="text-lg font-bold text-white">GG</span>
          </div>
          <button className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white border border-border shadow-card flex items-center justify-center hover:bg-gray-50 transition-colors">
            <Camera className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div>
          <p className="text-sm font-medium text-primary-900">Logo de l&apos;agence</p>
          <p className="text-xs text-gray-500 mt-0.5">SVG, PNG ou JPG. Format carré recommandé.</p>
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
          className="w-full px-3 py-2.5 rounded-input border border-border bg-white text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors resize-none"
        />
      </div>

      <div className="flex justify-end">
        <Button className="gap-2 bg-accent hover:bg-accent/90 text-white rounded-button">
          <Check className="w-4 h-4" />
          Sauvegarder
        </Button>
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
  admin: 'Admin',
  manager: 'Manager',
  agent: 'Agent',
  assistant: 'Assistant',
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
  const selectClasses = 'w-full h-11 px-3 rounded-input border border-border bg-white text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors appearance-none'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-card shadow-modal w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-semibold text-primary-900">Inviter un membre</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={labelClasses}>Adresse email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nom@agence.ch"
              className={inputClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Rôle</label>
            <select value={role} onChange={e => setRole(e.target.value as TeamMember['role'])} className={selectClasses}>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="agent">Agent</option>
              <option value="assistant">Assistant</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3 p-5 border-t border-border">
          <Button variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
          <Button
            disabled={!email.includes('@')}
            className={cn('flex-1 gap-2 bg-accent text-white rounded-button', email.includes('@') ? 'hover:bg-accent/90' : 'opacity-50 cursor-not-allowed')}
          >
            <Mail className="w-4 h-4" />
            Envoyer l&apos;invitation
          </Button>
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
          <h2 className="text-lg font-semibold text-primary-900">Équipe</h2>
          <p className="text-sm text-gray-500 mt-1">Gérez les membres de votre agence et leurs rôles.</p>
        </div>
        <Button onClick={() => setShowInvite(true)} className="gap-2 bg-accent hover:bg-accent/90 text-white rounded-button">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Inviter un membre</span>
          <span className="sm:hidden">Inviter</span>
        </Button>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-card shadow-card border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-gray-50/50">
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Membre</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Rôle</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Statut</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Ajouté le</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_TEAM.map((member, i) => (
              <tr key={member.id} className={cn('hover:bg-gray-50/50 transition-colors', i < MOCK_TEAM.length - 1 && 'border-b border-border/50')}>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-accent">{member.initials}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary-900 truncate">{member.name}</p>
                      <p className="text-xs text-gray-500 truncate">{member.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <select
                    defaultValue={member.role}
                    className="text-sm border border-border rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
                  >
                    {Object.entries(ROLE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-5 py-4">
                  <span className={cn('text-xs font-medium px-2 py-1 rounded-badge', STATUS_STYLES[member.status].classes)}>
                    {STATUS_STYLES[member.status].label}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm text-gray-500">{member.addedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {MOCK_TEAM.map(member => (
          <div key={member.id} className="bg-white rounded-card shadow-card border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-semibold text-accent">{member.initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-primary-900 truncate">{member.name}</p>
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-badge', STATUS_STYLES[member.status].classes)}>
                    {STATUS_STYLES[member.status].label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">{member.email}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
              <span className="text-xs text-gray-500">{ROLE_LABELS[member.role]}</span>
              <span className="text-xs text-gray-400">Ajouté le {member.addedAt}</span>
            </div>
          </div>
        ))}
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
  { id: 'leads',        label: 'Nouveaux leads',             description: 'Quand un nouveau contact est assigné',       icon: Users,          emailDefault: true,  pushDefault: true },
  { id: 'messages',     label: 'Messages reçus',             description: 'Quand un message est reçu dans la messagerie', icon: MessageSquare,  emailDefault: true,  pushDefault: true },
  { id: 'visits',       label: 'Visites planifiées',         description: 'Rappels avant les visites programmées',       icon: Eye,            emailDefault: true,  pushDefault: true },
  { id: 'offers',       label: 'Offres reçues',              description: 'Quand une offre est soumise sur un bien',     icon: FileText,       emailDefault: true,  pushDefault: true },
  { id: 'kyc',          label: 'Dossiers KYC à compléter',   description: 'Quand un dossier KYC nécessite une action',   icon: Shield,         emailDefault: true,  pushDefault: true },
  { id: 'calendar',     label: 'Rappels calendrier',         description: 'Rappels pour les événements à venir',         icon: Calendar,       emailDefault: true,  pushDefault: true },
]

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative w-10 h-6 rounded-full transition-colors shrink-0',
        enabled ? 'bg-accent' : 'bg-gray-200',
      )}
    >
      <div className={cn(
        'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform',
        enabled ? 'translate-x-[18px]' : 'translate-x-0.5',
      )} />
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
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary-900">Préférences de notifications</h2>
        <p className="text-sm text-gray-500 mt-1">Choisissez comment et quand vous souhaitez être notifié.</p>
      </div>

      {/* Header */}
      <div className="hidden sm:grid grid-cols-[1fr_80px_80px] gap-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
        <span>Catégorie</span>
        <span className="text-center">Email</span>
        <span className="text-center">Push</span>
      </div>

      {/* Categories */}
      <div className="space-y-1">
        {NOTIF_CATEGORIES.map(cat => {
          const Icon = cat.icon
          const s = settings[cat.id]
          return (
            <div key={cat.id} className="bg-white rounded-card border border-border/50 p-4 sm:grid sm:grid-cols-[1fr_80px_80px] sm:gap-4 sm:items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-primary-900">{cat.label}</p>
                  <p className="text-xs text-gray-500">{cat.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 sm:mt-0 sm:justify-center">
                <span className="text-xs text-gray-500 sm:hidden">Email</span>
                <Toggle enabled={s.email} onChange={v => updateSetting(cat.id, 'email', v)} />
              </div>
              <div className="flex items-center gap-4 mt-2 sm:mt-0 sm:justify-center">
                <span className="text-xs text-gray-500 sm:hidden">Push</span>
                <Toggle enabled={s.push} onChange={v => updateSetting(cat.id, 'push', v)} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Subscription Tab ─── */

interface PlanFeature {
  text: string
  included: boolean
}

interface Plan {
  name: string
  price: string
  period: string
  description: string
  features: PlanFeature[]
  isCurrent?: boolean
  isPopular?: boolean
}

const PLANS: Plan[] = [
  {
    name: 'Starter',
    price: 'Gratuit',
    period: '',
    description: 'Pour les agents indépendants qui démarrent.',
    features: [
      { text: '10 biens actifs', included: true },
      { text: '50 contacts', included: true },
      { text: 'Recherche basique', included: true },
      { text: 'Assistance IA', included: false },
      { text: 'Pipeline KYC', included: false },
      { text: 'Portail vendeur', included: false },
      { text: 'Support prioritaire', included: false },
    ],
  },
  {
    name: 'Pro',
    price: "CHF 89",
    period: '/mois',
    description: 'Pour les agents qui veulent aller plus loin.',
    isCurrent: true,
    isPopular: true,
    features: [
      { text: 'Biens illimités', included: true },
      { text: 'Contacts illimités', included: true },
      { text: 'Recherche IA conversationnelle', included: true },
      { text: 'Assistance IA copilote', included: true },
      { text: 'Pipeline KYC complet', included: true },
      { text: 'Portail vendeur', included: true },
      { text: 'Support prioritaire', included: false },
    ],
  },
  {
    name: 'Agency',
    price: "CHF 249",
    period: '/mois',
    description: 'Pour les agences avec une équipe.',
    features: [
      { text: 'Tout du plan Pro', included: true },
      { text: 'Jusqu\'à 10 agents', included: true },
      { text: 'Tableau de bord agence', included: true },
      { text: 'API & intégrations', included: true },
      { text: 'Branding personnalisé', included: true },
      { text: 'Export données', included: true },
      { text: 'Support prioritaire 24/7', included: true },
    ],
  },
]

function SubscriptionTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary-900">Abonnement</h2>
        <p className="text-sm text-gray-500 mt-1">Gérez votre plan et votre facturation.</p>
      </div>

      {/* Current plan card */}
      <div className="bg-white rounded-card border-2 border-accent p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-primary-900">Plan Pro</h3>
              <span className="text-xs font-medium px-2 py-0.5 rounded-badge bg-accent/10 text-accent">Actuel</span>
            </div>
            <p className="text-sm text-gray-500">CHF 89/mois — renouvelé le 01.04.2026</p>
          </div>
          <Button variant="outline" className="ml-auto gap-2 hidden sm:flex">
            <CreditCard className="w-4 h-4" />
            Gérer l&apos;abonnement
          </Button>
        </div>
        <Button variant="outline" className="w-full gap-2 sm:hidden mt-3">
          <CreditCard className="w-4 h-4" />
          Gérer l&apos;abonnement
        </Button>
      </div>

      {/* Plan comparison */}
      <div>
        <h3 className="text-base font-semibold text-primary-900 mb-4">Comparer les plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className={cn(
                'bg-white rounded-card border p-5 relative',
                plan.isCurrent ? 'border-accent shadow-card-hover' : 'border-border shadow-card',
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
                <h4 className="text-lg font-semibold text-primary-900">{plan.name}</h4>
                <div className="mt-2">
                  <span className="text-2xl font-bold text-primary-900">{plan.price}</span>
                  {plan.period && <span className="text-sm text-gray-500">{plan.period}</span>}
                </div>
                <p className="text-xs text-gray-500 mt-2">{plan.description}</p>
              </div>

              <div className="space-y-2.5 mb-5">
                {plan.features.map((feat, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {feat.included ? (
                      <Check className="w-4 h-4 text-success shrink-0" />
                    ) : (
                      <X className="w-4 h-4 text-gray-300 shrink-0" />
                    )}
                    <span className={feat.included ? 'text-primary-900' : 'text-gray-400'}>{feat.text}</span>
                  </div>
                ))}
              </div>

              {plan.isCurrent ? (
                <Button variant="outline" className="w-full" disabled>
                  Plan actuel
                </Button>
              ) : (
                <Button variant="outline" className="w-full gap-1 hover:bg-accent hover:text-white hover:border-accent transition-all">
                  Choisir <ChevronRight className="w-4 h-4" />
                </Button>
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
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
          <User className="w-5 h-5 text-accent" />
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold text-primary-900">Paramètres</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-border overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map(tab => {
            const config = TAB_CONFIG[tab]
            const Icon = config.icon
            const isActive = activeTab === tab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-accent text-accent'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                )}
              >
                <Icon className="w-4 h-4" />
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
        {activeTab === 'subscription' && <SubscriptionTab />}
      </div>
    </div>
  )
}
