import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Search, Plus, Eye, Download, Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import PageTransition from '@/components/layout/PageTransition'

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface Template {
  id: string
  name: string
  description: string
  category: TemplateCategory
  format: 'PDF' | 'DOCX'
  lastUsed?: string
  usageCount: number
  isPremium: boolean
}

type TemplateCategory = 'mandat' | 'visite' | 'offre' | 'kyc' | 'communication' | 'autre'

// ─── DATA ───────────────────────────────────────────────────────────────────

const CATEGORIES: { value: TemplateCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'mandat', label: 'Mandats' },
  { value: 'visite', label: 'Visites' },
  { value: 'offre', label: 'Offres' },
  { value: 'kyc', label: 'KYC/LAB' },
  { value: 'communication', label: 'Communication' },
]

const TEMPLATES: Template[] = [
  { id: 'mandat-exclusif', name: 'Mandat de vente exclusif', description: 'Contrat de mandat exclusif avec conditions de vente, commission et durée.', category: 'mandat', format: 'PDF', lastUsed: '2026-03-15', usageCount: 24, isPremium: false },
  { id: 'mandat-simple', name: 'Mandat de vente simple', description: 'Mandat non-exclusif pour la mise en vente d\'un bien immobilier.', category: 'mandat', format: 'PDF', lastUsed: '2026-03-10', usageCount: 12, isPremium: false },
  { id: 'mandat-recherche', name: 'Mandat de recherche', description: 'Mandat confié par un acquéreur pour la recherche d\'un bien.', category: 'mandat', format: 'PDF', usageCount: 5, isPremium: true },
  { id: 'bon-visite', name: 'Bon de visite', description: 'Attestation de visite signée par le visiteur avec conditions de confidentialité.', category: 'visite', format: 'PDF', lastUsed: '2026-03-18', usageCount: 87, isPremium: false },
  { id: 'rapport-visite', name: 'Rapport de visite', description: 'Compte-rendu détaillé pour le vendeur : impressions, questions, intérêt.', category: 'visite', format: 'PDF', lastUsed: '2026-03-17', usageCount: 34, isPremium: false },
  { id: 'fiche-bien', name: 'Fiche bien détaillée', description: 'Présentation complète du bien : photos, plans, caractéristiques, quartier.', category: 'visite', format: 'PDF', usageCount: 45, isPremium: false },
  { id: 'offre-achat', name: 'Offre d\'achat', description: 'Formulaire d\'offre avec prix, conditions suspensives et délai de validité.', category: 'offre', format: 'PDF', lastUsed: '2026-03-14', usageCount: 18, isPremium: false },
  { id: 'contre-offre', name: 'Contre-offre', description: 'Réponse formelle à une offre avec nouveau prix et conditions modifiées.', category: 'offre', format: 'PDF', usageCount: 8, isPremium: true },
  { id: 'acceptation-offre', name: 'Acceptation d\'offre', description: 'Confirmation formelle d\'acceptation avec renvoi au notaire.', category: 'offre', format: 'PDF', usageCount: 6, isPremium: true },
  { id: 'formulaire-kyc-pp', name: 'Formulaire KYC — Personne physique', description: 'Questionnaire d\'identification et d\'origine des fonds pour particulier.', category: 'kyc', format: 'PDF', lastUsed: '2026-03-12', usageCount: 31, isPremium: false },
  { id: 'formulaire-kyc-pm', name: 'Formulaire KYC — Personne morale', description: 'Questionnaire complet pour société : ayants droit, RC, structure.', category: 'kyc', format: 'PDF', usageCount: 14, isPremium: false },
  { id: 'rapport-audit', name: 'Rapport d\'audit KYC', description: 'Export du journal d\'audit complet d\'un dossier de conformité.', category: 'kyc', format: 'PDF', usageCount: 9, isPremium: true },
  { id: 'email-suivi', name: 'Email de suivi post-visite', description: 'Template email de remerciement et suivi après une visite.', category: 'communication', format: 'DOCX', lastUsed: '2026-03-16', usageCount: 56, isPremium: false },
  { id: 'email-estimation', name: 'Email d\'estimation', description: 'Présentation des résultats d\'estimation avec argumentaire.', category: 'communication', format: 'DOCX', usageCount: 22, isPremium: false },
]

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const navigate = useNavigate()
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
    <PageTransition>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-theme-primary">Templates de documents</h1>
            <p className="text-sm text-theme-tertiary mt-0.5">{TEMPLATES.length} templates disponibles</p>
          </div>
          <button className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active transition-colors">
            <Plus className="h-3.5 w-3.5" />
            Template personnalisé
          </button>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
            />
          </div>

          <div className="flex items-center border border-theme-border rounded-lg p-0.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  category === cat.value
                    ? 'bg-theme-active text-theme-primary'
                    : 'text-theme-tertiary hover:text-theme-secondary'
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Templates list — Lovable style */}
        <div className="rounded-xl border border-theme-border">
          {/* Header row */}
          <div className="flex items-center px-4 py-2.5 border-b border-theme-border text-[11px] font-medium text-theme-tertiary uppercase tracking-wider">
            <span className="flex-1">Template</span>
            <span className="w-16 text-center">Format</span>
            <span className="w-16 text-center hidden sm:block">Utilisé</span>
            <span className="w-20 text-right">Actions</span>
          </div>

          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <FileText className="w-8 h-8 text-theme-tertiary mx-auto mb-2" />
              <p className="text-sm text-theme-tertiary">Aucun template trouvé</p>
            </div>
          ) : (
            filtered.map((template, i) => (
              <div
                key={template.id}
                onClick={() => navigate(`/dashboard/documents/generate?template=${template.id}`)}
                className={cn(
                  'flex items-center px-4 py-3.5 group hover:bg-theme-hover transition-colors cursor-pointer',
                  i < filtered.length - 1 && 'border-b border-theme-border'
                )}
              >
                {/* Name + description */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-theme-primary group-hover:text-accent transition-colors truncate">
                      {template.name}
                    </p>
                    {template.isPremium && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-500 shrink-0">
                        <Star className="w-2.5 h-2.5" />
                        Pro
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-theme-tertiary mt-0.5 truncate">{template.description}</p>
                </div>

                {/* Format badge */}
                <span className="w-16 text-center text-[10px] font-medium text-theme-tertiary">
                  {template.format}
                </span>

                {/* Usage count */}
                <span className="w-16 text-center text-xs text-theme-tertiary hidden sm:block">
                  {template.usageCount}x
                </span>

                {/* Actions — visible on hover */}
                <div className="w-20 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="w-7 h-7 rounded-lg hover:bg-theme-active flex items-center justify-center transition-colors">
                    <Eye className="w-3.5 h-3.5 text-theme-tertiary" />
                  </button>
                  <button className="w-7 h-7 rounded-lg hover:bg-theme-active flex items-center justify-center transition-colors">
                    <Download className="w-3.5 h-3.5 text-theme-tertiary" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PageTransition>
  )
}
