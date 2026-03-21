import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  FileText, ChevronRight, User,
  ArrowLeft, Sparkles, Loader2, Eye, Download, Check,
} from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface FieldConfig {
  name: string
  label: string
  type: 'text' | 'number' | 'date' | 'select' | 'textarea'
  placeholder?: string
  required?: boolean
  options?: { value: string; label: string }[]
  section: string
}

interface TemplateConfig {
  id: string
  name: string
  description: string
  fields: FieldConfig[]
}

// ─── TEMPLATE CONFIGS ───────────────────────────────────────────────────────

const TEMPLATE_CONFIGS: Record<string, TemplateConfig> = {
  'bon-visite': {
    id: 'bon-visite',
    name: 'Bon de visite',
    description: 'Attestation de visite signée par le visiteur.',
    fields: [
      { name: 'visitor_name', label: 'Nom du visiteur', type: 'text', required: true, section: 'Visiteur' },
      { name: 'visitor_email', label: 'Email', type: 'text', section: 'Visiteur' },
      { name: 'visitor_phone', label: 'Téléphone', type: 'text', section: 'Visiteur' },
      { name: 'property_address', label: 'Adresse du bien', type: 'text', required: true, section: 'Bien' },
      { name: 'property_city', label: 'Ville', type: 'text', required: true, section: 'Bien' },
      { name: 'property_type', label: 'Type', type: 'select', options: [
        { value: 'apartment', label: 'Appartement' },
        { value: 'house', label: 'Maison' },
        { value: 'villa', label: 'Villa' },
        { value: 'commercial', label: 'Commercial' },
      ], section: 'Bien' },
      { name: 'property_rooms', label: 'Pièces', type: 'number', section: 'Bien' },
      { name: 'property_surface', label: 'Surface (m²)', type: 'number', section: 'Bien' },
      { name: 'property_price', label: 'Prix (CHF)', type: 'number', section: 'Bien' },
      { name: 'visit_date', label: 'Date de visite', type: 'date', required: true, section: 'Visite' },
      { name: 'visit_time', label: 'Heure', type: 'text', placeholder: '14:00', section: 'Visite' },
      { name: 'agent_name', label: 'Agent', type: 'text', required: true, section: 'Visite' },
      { name: 'notes', label: 'Remarques', type: 'textarea', section: 'Visite' },
    ],
  },
  'offre-achat': {
    id: 'offre-achat',
    name: 'Offre d\'achat',
    description: 'Formulaire d\'offre avec conditions.',
    fields: [
      { name: 'buyer_name', label: 'Nom de l\'acquéreur', type: 'text', required: true, section: 'Acquéreur' },
      { name: 'buyer_address', label: 'Adresse', type: 'text', section: 'Acquéreur' },
      { name: 'buyer_email', label: 'Email', type: 'text', section: 'Acquéreur' },
      { name: 'buyer_phone', label: 'Téléphone', type: 'text', section: 'Acquéreur' },
      { name: 'property_address', label: 'Adresse du bien', type: 'text', required: true, section: 'Bien' },
      { name: 'property_city', label: 'Ville', type: 'text', required: true, section: 'Bien' },
      { name: 'asking_price', label: 'Prix demandé (CHF)', type: 'number', required: true, section: 'Offre' },
      { name: 'offer_price', label: 'Prix offert (CHF)', type: 'number', required: true, section: 'Offre' },
      { name: 'validity_days', label: 'Validité (jours)', type: 'number', placeholder: '10', section: 'Offre' },
      { name: 'conditions', label: 'Conditions suspensives', type: 'textarea', placeholder: 'Obtention du financement, résultats des expertises...', section: 'Offre' },
      { name: 'financing', label: 'Mode de financement', type: 'select', options: [
        { value: 'cash', label: 'Fonds propres' },
        { value: 'mortgage', label: 'Hypothèque bancaire' },
        { value: 'mixed', label: 'Mixte' },
      ], section: 'Offre' },
      { name: 'desired_date', label: 'Date d\'entrée souhaitée', type: 'date', section: 'Offre' },
    ],
  },
  'mandat-exclusif': {
    id: 'mandat-exclusif',
    name: 'Mandat de vente exclusif',
    description: 'Contrat de mandat exclusif.',
    fields: [
      { name: 'seller_name', label: 'Nom du vendeur', type: 'text', required: true, section: 'Vendeur' },
      { name: 'seller_address', label: 'Adresse', type: 'text', section: 'Vendeur' },
      { name: 'seller_email', label: 'Email', type: 'text', section: 'Vendeur' },
      { name: 'seller_phone', label: 'Téléphone', type: 'text', section: 'Vendeur' },
      { name: 'property_address', label: 'Adresse du bien', type: 'text', required: true, section: 'Bien' },
      { name: 'property_city', label: 'Ville', type: 'text', required: true, section: 'Bien' },
      { name: 'property_type', label: 'Type', type: 'select', options: [
        { value: 'apartment', label: 'Appartement' },
        { value: 'house', label: 'Maison' },
        { value: 'villa', label: 'Villa' },
      ], section: 'Bien' },
      { name: 'property_rooms', label: 'Pièces', type: 'number', section: 'Bien' },
      { name: 'property_surface', label: 'Surface (m²)', type: 'number', section: 'Bien' },
      { name: 'asking_price', label: 'Prix de vente (CHF)', type: 'number', required: true, section: 'Conditions' },
      { name: 'commission_pct', label: 'Commission (%)', type: 'number', placeholder: '3', section: 'Conditions' },
      { name: 'duration_months', label: 'Durée du mandat (mois)', type: 'number', placeholder: '6', section: 'Conditions' },
      { name: 'start_date', label: 'Date de début', type: 'date', required: true, section: 'Conditions' },
      { name: 'special_conditions', label: 'Conditions particulières', type: 'textarea', section: 'Conditions' },
    ],
  },
}

// ─── STEPS ──────────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Template', icon: FileText },
  { label: 'Informations', icon: User },
  { label: 'Prévisualisation', icon: Eye },
]

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export default function DocumentGenerator() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselected = searchParams.get('template')

  const [step, setStep] = useState(preselected && TEMPLATE_CONFIGS[preselected] ? 1 : 0)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(
    preselected && TEMPLATE_CONFIGS[preselected] ? preselected : null
  )
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)

  const templateConfig = selectedTemplate ? TEMPLATE_CONFIGS[selectedTemplate] : null

  function handleFieldChange(name: string, value: string) {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  function handleSelectTemplate(id: string) {
    setSelectedTemplate(id)
    setFormData({})
    setStep(1)
  }

  function handleGenerate() {
    setGenerating(true)
    setTimeout(() => {
      setGenerating(false)
      setGenerated(true)
      setStep(2)
    }, 1500)
  }

  function handleDownload() {
    // TODO: Generate actual PDF via Edge Function
    const blob = new Blob(['Document preview'], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${templateConfig?.name || 'document'}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Group fields by section
  const sections = templateConfig
    ? templateConfig.fields.reduce<Record<string, FieldConfig[]>>((acc, field) => {
        if (!acc[field.section]) acc[field.section] = []
        acc[field.section].push(field)
        return acc
      }, {})
    : {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard/templates')}
          className="w-9 h-9 rounded-lg border border-theme-border flex items-center justify-center hover:bg-theme-hover transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-theme-muted" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-theme-primary">Générer un document</h1>
          <p className="text-sm text-theme-tertiary mt-0.5">
            {templateConfig ? templateConfig.name : 'Sélectionnez un template'}
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 bg-theme-hover rounded-xl p-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const isActive = i === step
          const isDone = i < step
          return (
            <button
              key={i}
              onClick={() => {
                if (isDone) setStep(i)
              }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center',
                isActive
                  ? 'bg-theme-card text-theme-primary shadow-none'
                  : isDone
                    ? 'text-accent cursor-pointer hover:bg-theme-card/50'
                    : 'text-theme-tertiary cursor-default'
              )}
            >
              {isDone ? (
                <Check className="w-4 h-4 text-accent" />
              ) : (
                <Icon className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          )
        })}
      </div>

      {/* Step 0: Select template */}
      {step === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.values(TEMPLATE_CONFIGS).map(t => (
            <button
              key={t.id}
              onClick={() => handleSelectTemplate(t.id)}
              className={cn(
                'text-left bg-theme-card rounded-xl border p-5 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group',
                selectedTemplate === t.id ? 'border-accent ring-1 ring-accent/20' : 'border-theme-border-subtle'
              )}
            >
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-3">
                <FileText className="w-5 h-5 text-accent" />
              </div>
              <h3 className="text-sm font-semibold text-theme-primary group-hover:text-accent transition-colors">
                {t.name}
              </h3>
              <p className="text-xs text-theme-tertiary mt-1">{t.description}</p>
              <div className="flex items-center gap-1 mt-3 text-xs text-accent font-medium">
                Sélectionner
                <ChevronRight className="w-3 h-3" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step 1: Fill form */}
      {step === 1 && templateConfig && (
        <div className="space-y-6">
          {/* AI assist banner */}
          <div className="flex items-center gap-3 bg-accent/5 border border-accent/10 rounded-xl px-4 py-3">
            <Sparkles className="w-5 h-5 text-accent flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-theme-primary">Remplissage assisté par IA</p>
              <p className="text-xs text-theme-tertiary">Sélectionnez un contact ou un bien existant pour pré-remplir les champs.</p>
            </div>
          </div>

          {Object.entries(sections).map(([sectionName, fields]) => (
            <div key={sectionName} className="bg-theme-card rounded-xl border border-theme-border-subtle overflow-hidden">
              <div className="px-5 py-3 border-b border-theme-border-subtle bg-theme-hover/50">
                <h3 className="text-sm font-semibold text-theme-primary">{sectionName}</h3>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {fields.map(field => (
                  <div key={field.name} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                    <label className="block text-xs font-medium text-theme-muted mb-1.5">
                      {field.label}
                      {field.required && <span className="text-danger ml-0.5">*</span>}
                    </label>
                    {field.type === 'select' ? (
                      <select
                        value={formData[field.name] || ''}
                        onChange={e => handleFieldChange(field.name, e.target.value)}
                        className="w-full h-10 px-3 bg-theme-card border border-theme-border rounded-lg text-sm focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none"
                      >
                        <option value="">Sélectionner...</option>
                        {field.options?.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        value={formData[field.name] || ''}
                        onChange={e => handleFieldChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        rows={3}
                        className="w-full px-3 py-2 bg-theme-card border border-theme-border rounded-lg text-sm focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none resize-none"
                      />
                    ) : (
                      <input
                        type={field.type}
                        value={formData[field.name] || ''}
                        onChange={e => handleFieldChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full h-10 px-3 bg-theme-card border border-theme-border rounded-lg text-sm focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(0)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Générer le document
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 2 && templateConfig && generated && (
        <div className="space-y-6">
          {/* Preview card */}
          <div className="bg-theme-card rounded-xl border border-theme-border-subtle overflow-hidden">
            <div className="px-5 py-3 border-b border-theme-border-subtle bg-theme-hover/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-theme-primary">Aperçu du document</h3>
              <span className="text-[10px] font-medium text-theme-tertiary bg-theme-border px-2 py-0.5 rounded">PDF</span>
            </div>

            {/* Mock document preview */}
            <div className="p-8 md:p-12 max-w-2xl mx-auto">
              <div className="space-y-6">
                {/* Header */}
                <div className="text-center border-b border-theme-border pb-6">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <div className="h-8 w-8 bg-theme-primary rounded-lg flex items-center justify-center">
                      <span className="text-xs font-bold text-white">GG</span>
                    </div>
                    <span className="text-lg font-bold text-theme-primary">MEGGA</span>
                  </div>
                  <h2 className="text-xl font-bold text-theme-primary">{templateConfig.name}</h2>
                  <p className="text-sm text-theme-tertiary mt-1">
                    {new Date().toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>

                {/* Content sections */}
                {Object.entries(sections).map(([sectionName, fields]) => (
                  <div key={sectionName}>
                    <h3 className="text-sm font-semibold text-theme-primary mb-3 uppercase tracking-wider">
                      {sectionName}
                    </h3>
                    <div className="space-y-2">
                      {fields.map(field => {
                        const value = formData[field.name]
                        if (!value) return null

                        let displayValue = value
                        if (field.type === 'number' && field.name.includes('price')) {
                          displayValue = formatCHF(Number(value))
                        }
                        if (field.options) {
                          const opt = field.options.find(o => o.value === value)
                          if (opt) displayValue = opt.label
                        }

                        return (
                          <div key={field.name} className="flex items-start gap-2">
                            <span className="text-sm text-theme-muted w-40 flex-shrink-0">{field.label} :</span>
                            <span className="text-sm font-medium text-theme-primary">{displayValue}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {/* Footer */}
                <div className="border-t border-theme-border pt-6 mt-8">
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <p className="text-xs text-theme-tertiary mb-8">Signature du mandant</p>
                      <div className="border-b border-theme-border w-full" />
                    </div>
                    <div>
                      <p className="text-xs text-theme-tertiary mb-8">Signature de l'agent</p>
                      <div className="border-b border-theme-border w-full" />
                    </div>
                  </div>
                  <p className="text-[10px] text-theme-tertiary mt-6 text-center">
                    Document généré via MEGGA Real Estate — {new Date().toLocaleDateString('fr-CH')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Modifier
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleDownload} className="gap-2">
                <Download className="w-4 h-4" />
                Télécharger PDF
              </Button>
              <Button onClick={() => navigate('/dashboard/templates')} className="gap-2">
                <Check className="w-4 h-4" />
                Terminer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
