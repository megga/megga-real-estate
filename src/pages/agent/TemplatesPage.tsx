import { useState } from 'react'
import {
  FileText, FileSignature, ClipboardList, Home, Users, Shield,
  Search, Plus, Eye, Download, Clock, Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface Template {
  id: string
  name: string
  description: string
  category: TemplateCategory
  icon: typeof FileText
  format: 'PDF' | 'DOCX'
  lastUsed?: string
  usageCount: number
  isPremium: boolean
}

type TemplateCategory = 'mandat' | 'visite' | 'offre' | 'kyc' | 'communication' | 'autre'

// ─── DATA ───────────────────────────────────────────────────────────────────

const CATEGORIES: { value: TemplateCategory | 'all'; label: string; icon: typeof FileText }[] = [
  { value: 'all', label: 'Tous', icon: FileText },
  { value: 'mandat', label: 'Mandats', icon: FileSignature },
  { value: 'visite', label: 'Visites', icon: Home },
  { value: 'offre', label: 'Offres', icon: ClipboardList },
  { value: 'kyc', label: 'KYC/LAB', icon: Shield },
  { value: 'communication', label: 'Communication', icon: Users },
]

const TEMPLATES: Template[] = [
  {
    id: 'mandat-exclusif',
    name: 'Mandat de vente exclusif',
    description: 'Contrat de mandat exclusif avec conditions de vente, commission et durée.',
    category: 'mandat',
    icon: FileSignature,
    format: 'PDF',
    lastUsed: '2026-03-15',
    usageCount: 24,
    isPremium: false,
  },
  {
    id: 'mandat-simple',
    name: 'Mandat de vente simple',
    description: 'Mandat non-exclusif pour la mise en vente d\'un bien immobilier.',
    category: 'mandat',
    icon: FileSignature,
    format: 'PDF',
    lastUsed: '2026-03-10',
    usageCount: 12,
    isPremium: false,
  },
  {
    id: 'mandat-recherche',
    name: 'Mandat de recherche',
    description: 'Mandat confié par un acquéreur pour la recherche d\'un bien.',
    category: 'mandat',
    icon: FileSignature,
    format: 'PDF',
    usageCount: 5,
    isPremium: true,
  },
  {
    id: 'bon-visite',
    name: 'Bon de visite',
    description: 'Attestation de visite signée par le visiteur avec conditions de confidentialité.',
    category: 'visite',
    icon: Home,
    format: 'PDF',
    lastUsed: '2026-03-18',
    usageCount: 87,
    isPremium: false,
  },
  {
    id: 'rapport-visite',
    name: 'Rapport de visite',
    description: 'Compte-rendu détaillé pour le vendeur : impressions, questions, intérêt.',
    category: 'visite',
    icon: Home,
    format: 'PDF',
    lastUsed: '2026-03-17',
    usageCount: 34,
    isPremium: false,
  },
  {
    id: 'fiche-bien',
    name: 'Fiche bien détaillée',
    description: 'Présentation complète du bien : photos, plans, caractéristiques, quartier.',
    category: 'visite',
    icon: Home,
    format: 'PDF',
    usageCount: 45,
    isPremium: false,
  },
  {
    id: 'offre-achat',
    name: 'Offre d\'achat',
    description: 'Formulaire d\'offre avec prix, conditions suspensives et délai de validité.',
    category: 'offre',
    icon: ClipboardList,
    format: 'PDF',
    lastUsed: '2026-03-14',
    usageCount: 18,
    isPremium: false,
  },
  {
    id: 'contre-offre',
    name: 'Contre-offre',
    description: 'Réponse formelle à une offre avec nouveau prix et conditions modifiées.',
    category: 'offre',
    icon: ClipboardList,
    format: 'PDF',
    usageCount: 8,
    isPremium: true,
  },
  {
    id: 'acceptation-offre',
    name: 'Acceptation d\'offre',
    description: 'Confirmation formelle d\'acceptation avec renvoi au notaire.',
    category: 'offre',
    icon: ClipboardList,
    format: 'PDF',
    usageCount: 6,
    isPremium: true,
  },
  {
    id: 'formulaire-kyc-pp',
    name: 'Formulaire KYC — Personne physique',
    description: 'Questionnaire d\'identification et d\'origine des fonds pour particulier.',
    category: 'kyc',
    icon: Shield,
    format: 'PDF',
    lastUsed: '2026-03-12',
    usageCount: 31,
    isPremium: false,
  },
  {
    id: 'formulaire-kyc-pm',
    name: 'Formulaire KYC — Personne morale',
    description: 'Questionnaire complet pour société : ayants droit, RC, structure.',
    category: 'kyc',
    icon: Shield,
    format: 'PDF',
    usageCount: 14,
    isPremium: false,
  },
  {
    id: 'rapport-audit',
    name: 'Rapport d\'audit KYC',
    description: 'Export du journal d\'audit complet d\'un dossier de conformité.',
    category: 'kyc',
    icon: Shield,
    format: 'PDF',
    usageCount: 9,
    isPremium: true,
  },
  {
    id: 'email-suivi',
    name: 'Email de suivi post-visite',
    description: 'Template email de remerciement et suivi après une visite.',
    category: 'communication',
    icon: Users,
    format: 'DOCX',
    lastUsed: '2026-03-16',
    usageCount: 56,
    isPremium: false,
  },
  {
    id: 'email-estimation',
    name: 'Email d\'estimation',
    description: 'Présentation des résultats d\'estimation avec argumentaire.',
    category: 'communication',
    icon: Users,
    format: 'DOCX',
    usageCount: 22,
    isPremium: false,
  },
]

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const [category, setCategory] = useState<TemplateCategory | 'all'>('all')
  const [search, setSearch] = useState('')

  const filtered = TEMPLATES.filter(t => {
    if (category !== 'all' && t.category !== category) return false
    if (search) {
      const q = search.toLowerCase()
      return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-theme-primary">Templates de documents</h1>
          <p className="text-sm text-theme-tertiary mt-1">{TEMPLATES.length} templates disponibles</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Template personnalisé
        </Button>
      </div>

      {/* Search + Categories */}
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-tertiary" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un template..."
            className="w-full pl-10 pr-4 h-10 bg-theme-card border border-theme-border rounded-lg text-sm focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer',
                category === cat.value
                  ? 'bg-theme-primary text-white'
                  : 'bg-theme-active text-theme-muted hover:bg-theme-border'
              )}
            >
              <cat.icon className="w-3 h-3" />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Templates grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(template => {
          const Icon = template.icon
          return (
            <div
              key={template.id}
              className="bg-theme-card rounded-xl border border-theme-border-subtle p-5 hover:shadow-md hover:-translate-y-0.5 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-accent" />
                </div>
                <div className="flex items-center gap-1.5">
                  {template.isPremium && (
                    <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                      <Star className="w-2.5 h-2.5" />
                      Pro
                    </span>
                  )}
                  <span className="text-[10px] font-medium text-theme-tertiary bg-theme-active px-1.5 py-0.5 rounded">
                    {template.format}
                  </span>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-theme-primary group-hover:text-accent transition-colors">
                {template.name}
              </h3>
              <p className="text-xs text-theme-tertiary mt-1 leading-relaxed line-clamp-2">
                {template.description}
              </p>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-theme-border-subtle">
                <div className="flex items-center gap-3 text-[11px] text-theme-tertiary">
                  {template.lastUsed && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(template.lastUsed).toLocaleDateString('fr-CH')}
                    </span>
                  )}
                  <span>{template.usageCount}x utilisé</span>
                </div>
                <div className="flex items-center gap-1">
                  <button className="w-7 h-7 rounded-lg hover:bg-theme-active flex items-center justify-center transition-colors cursor-pointer">
                    <Eye className="w-3.5 h-3.5 text-theme-tertiary" />
                  </button>
                  <button className="w-7 h-7 rounded-lg hover:bg-accent/10 flex items-center justify-center transition-colors cursor-pointer">
                    <Download className="w-3.5 h-3.5 text-accent" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-10 h-10 text-theme-tertiary mx-auto mb-3" />
          <p className="text-sm text-theme-tertiary">Aucun template trouvé</p>
        </div>
      )}
    </div>
  )
}
