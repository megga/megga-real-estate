import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Search, Plus, ChevronRight, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import PageTransition from '@/components/layout/PageTransition'
import { useCustomTemplates } from '@/hooks/useCustomTemplates'

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
  isCustom?: boolean
}

type TemplateCategory = 'mandat' | 'visite' | 'offre' | 'kyc' | 'communication' | 'autre'

// ─── DATA ───────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<TemplateCategory, { label: string; description: string }> = {
  mandat: { label: 'Mandats', description: 'Contrats de mandat de vente et de recherche' },
  visite: { label: 'Visites', description: 'Bons de visite, rapports et fiches bien' },
  offre: { label: 'Offres', description: 'Offres d\'achat, contre-offres et acceptations' },
  kyc: { label: 'KYC / LAB', description: 'Formulaires de conformité et rapports d\'audit' },
  communication: { label: 'Communication', description: 'Templates d\'emails et de suivi' },
  autre: { label: 'Autre', description: 'Templates divers' },
}

const CATEGORY_ORDER: TemplateCategory[] = ['mandat', 'visite', 'offre', 'kyc', 'communication']

const FILTER_TABS: { value: TemplateCategory | 'all'; label: string }[] = [
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
  const { templates: customTemplates, removeTemplate } = useCustomTemplates()

  // Merge built-in + custom templates
  const allTemplates: Template[] = useMemo(() => {
    const customs: Template[] = customTemplates.map(ct => ({
      id: ct.id,
      name: ct.name,
      description: ct.description,
      category: (ct.category as TemplateCategory) || 'autre',
      format: 'PDF' as const,
      lastUsed: ct.createdAt.slice(0, 10),
      usageCount: ct.usageCount,
      isPremium: false,
      isCustom: true,
    }))
    return [...TEMPLATES, ...customs]
  }, [customTemplates])

  const filtered = useMemo(() => {
    return allTemplates.filter(t => {
      if (category !== 'all' && t.category !== category) return false
      if (search) {
        const q = search.toLowerCase()
        return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
      }
      return true
    })
  }, [category, search, allTemplates])

  // Group by category
  const grouped = useMemo(() => {
    const groups: Partial<Record<TemplateCategory, Template[]>> = {}
    for (const t of filtered) {
      if (!groups[t.category]) groups[t.category] = []
      groups[t.category]!.push(t)
    }
    return groups
  }, [filtered])

  // Include 'autre' for custom templates
  const visibleCategories = useMemo(() => {
    const base = CATEGORY_ORDER.filter(c => grouped[c]?.length)
    // Add 'autre' at the end if it has templates but isn't already in the order
    if (grouped['autre']?.length && !base.includes('autre')) {
      base.push('autre')
    }
    return base
  }, [grouped])

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-theme-primary">Templates de documents</h1>
            <p className="text-sm text-theme-tertiary mt-0.5">{allTemplates.length} templates disponibles</p>
          </div>
          <button
            onClick={() => navigate('/dashboard/documents/templates/new')}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active transition-colors"
          >
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
            {FILTER_TABS.map(cat => (
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

        {/* Templates grouped by category */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 rounded-xl border border-theme-border">
            <FileText className="w-8 h-8 text-theme-tertiary mx-auto mb-2" />
            <p className="text-sm text-theme-muted">Aucun template trouvé</p>
          </div>
        ) : (
          <div className="space-y-8">
            {visibleCategories.map(cat => {
              const meta = CATEGORY_META[cat]
              const templates = grouped[cat] ?? []

              return (
                <div key={cat}>
                  {/* Category header */}
                  <div className="mb-3">
                    <h2 className="text-sm font-semibold text-theme-primary">{meta.label}</h2>
                    <p className="text-xs text-theme-tertiary mt-0.5">{meta.description}</p>
                  </div>

                  {/* Cards grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {templates.map(template => (
                      <div
                        key={template.id}
                        onClick={() => navigate(`/dashboard/documents/generate?template=${template.id}`)}
                        className="rounded-xl border border-theme-border p-4 group hover:border-theme-active cursor-pointer transition-all"
                      >
                        {/* Row 1: title + badges */}
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-theme-primary group-hover:text-accent transition-colors leading-snug">
                            {template.name}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {template.isCustom && (
                              <span className="text-[10px] font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                                Perso
                              </span>
                            )}
                            {template.isPremium && (
                              <span className="text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                Pro
                              </span>
                            )}
                            <span className="text-[10px] font-medium text-theme-tertiary bg-theme-section px-1.5 py-0.5 rounded">
                              {template.format}
                            </span>
                          </div>
                        </div>

                        {/* Description — full, not truncated */}
                        <p className="text-xs text-theme-tertiary mt-2 leading-relaxed">
                          {template.description}
                        </p>

                        {/* Bottom: usage + CTA */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-theme-border">
                          <span className="text-[10px] text-theme-muted">
                            Utilisé {template.usageCount} fois
                          </span>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {template.isCustom && (
                              <button
                                onClick={e => { e.stopPropagation(); removeTemplate(template.id) }}
                                className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="w-3 h-3 text-red-500" />
                              </button>
                            )}
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                              Générer <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </PageTransition>
  )
}
