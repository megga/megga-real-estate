import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ChevronRight,
  ArrowLeft, Sparkles, Loader2, Eye, Download, Check, Save,
} from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useCustomTemplates } from '@/hooks/useCustomTemplates'
import { useContacts } from '@/hooks/useContacts'
import { useAgencyProperties } from '@/hooks/useProperties'

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface FieldConfig {
  name: string
  label: string
  type: 'text' | 'number' | 'date' | 'select' | 'textarea'
  placeholder?: string
  hint?: string
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
      { name: 'validity_days', label: 'Validité (jours)', type: 'number', placeholder: '10', hint: 'Durée standard : 10 jours ouvrables', section: 'Offre' },
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
      { name: 'commission_pct', label: 'Commission (%)', type: 'number', placeholder: '3', hint: 'Standard suisse : 3 à 5%', section: 'Conditions' },
      { name: 'duration_months', label: 'Durée du mandat (mois)', type: 'number', placeholder: '6', hint: 'Durée habituelle : 6 à 12 mois', section: 'Conditions' },
      { name: 'start_date', label: 'Date de début', type: 'date', required: true, section: 'Conditions' },
      { name: 'special_conditions', label: 'Conditions particulières', type: 'textarea', section: 'Conditions' },
    ],
  },
}

// ─── SECTION DOT COLORS ────────────────────────────────────────────────────

const SECTION_DOTS: Record<string, string> = {
  'Vendeur': 'bg-blue-500',
  'Acquéreur': 'bg-blue-500',
  'Visiteur': 'bg-blue-500',
  'Bien': 'bg-teal-500',
  'Conditions': 'bg-amber-500',
  'Offre': 'bg-amber-500',
  'Visite': 'bg-purple-500',
}

// ─── INPUT STYLES ──────────────────────────────────────────────────────────

const inputClasses = 'w-full h-10 px-3 bg-transparent border border-theme-border rounded-lg text-sm text-theme-primary focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none transition-colors'

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export default function DocumentGenerator() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselected = searchParams.get('template')
  const { templates: customTemplates, incrementUsage } = useCustomTemplates()

  // Build configs for custom templates dynamically
  const allConfigs = useMemo(() => {
    const configs: Record<string, TemplateConfig> = { ...TEMPLATE_CONFIGS }
    for (const ct of customTemplates) {
      const fields: FieldConfig[] = []
      for (const section of ct.sections) {
        for (const field of section.fields) {
          fields.push({
            name: `${section.name.toLowerCase().replace(/\s+/g, '_')}_${field.label.toLowerCase().replace(/\s+/g, '_')}`,
            label: field.label,
            type: field.type,
            required: field.required,
            placeholder: field.placeholder || undefined,
            hint: field.hint || undefined,
            options: field.options,
            section: section.name,
          })
        }
      }
      configs[ct.id] = { id: ct.id, name: ct.name, description: ct.description, fields }
    }
    return configs
  }, [customTemplates])

  const hasPreselected = !!(preselected && allConfigs[preselected])

  const [step, setStep] = useState(hasPreselected ? 1 : 0)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(
    hasPreselected ? preselected : null
  )
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [selectedContact, setSelectedContact] = useState('')
  const [selectedProperty, setSelectedProperty] = useState('')

  // Hooks Supabase — remplace les anciens MOCK_CONTACTS / MOCK_PROPERTIES
  const { contacts } = useContacts()
  const { data: properties = [] } = useAgencyProperties()

  const templateConfig = selectedTemplate ? allConfigs[selectedTemplate] ?? null : null

  function handleFieldChange(name: string, value: string) {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  function handleSelectTemplate(id: string) {
    setSelectedTemplate(id)
    setFormData({})
    setStep(1)
  }

  function handlePrefillContact(contactId: string) {
    setSelectedContact(contactId)
    const contact = contacts.find(c => c.id === contactId)
    if (!contact) return
    const fullName = `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim()
    const mapping: Record<string, string> = {
      visitor_name: fullName,
      visitor_email: contact.email ?? '',
      visitor_phone: contact.phone ?? '',
      buyer_name: fullName,
      buyer_email: contact.email ?? '',
      buyer_phone: contact.phone ?? '',
      seller_name: fullName,
      seller_email: contact.email ?? '',
      seller_phone: contact.phone ?? '',
    }
    setFormData(prev => {
      const updated = { ...prev }
      for (const [key, val] of Object.entries(mapping)) {
        if (templateConfig?.fields.some(f => f.name === key)) {
          updated[key] = val
        }
      }
      return updated
    })
  }

  function handlePrefillProperty(propertyId: string) {
    setSelectedProperty(propertyId)
    const prop = properties.find(p => p.id === propertyId)
    if (!prop) return
    setFormData(prev => ({
      ...prev,
      property_address: prop.address ?? '',
      property_city: prop.city ?? '',
      property_type: prop.type ?? '',
      property_rooms: prop.rooms != null ? String(prop.rooms) : '',
      property_surface: prop.surface_m2 != null ? String(prop.surface_m2) : '',
      property_price: prop.price != null ? String(prop.price) : '',
      asking_price: prop.price != null ? String(prop.price) : '',
    }))
  }

  function handleGenerate() {
    setGenerating(true)
    if (selectedTemplate?.startsWith('custom-')) {
      incrementUsage(selectedTemplate)
    }
    setTimeout(() => {
      setGenerating(false)
      setGenerated(true)
      setStep(2)
    }, 1500)
  }

  function handleDownload() {
    const blob = new Blob(['Document preview'], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${templateConfig?.name || 'document'}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Group fields by section
  const sections = useMemo(() => {
    if (!templateConfig) return {}
    return templateConfig.fields.reduce<Record<string, FieldConfig[]>>((acc, field) => {
      if (!acc[field.section]) acc[field.section] = []
      acc[field.section].push(field)
      return acc
    }, {})
  }, [templateConfig])

  const sectionEntries = Object.entries(sections)

  // Step labels
  const stepLabels = ['Template', 'Informations', 'Aperçu']

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header with breadcrumb */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-theme-tertiary mb-3">
          <button onClick={() => navigate('/dashboard/documents')} className="hover:text-theme-primary transition-colors">Documents</button>
          <ChevronRight className="w-3 h-3" />
          {templateConfig ? (
            <>
              <span className="text-theme-secondary">{templateConfig.name}</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-theme-primary">{stepLabels[step]}</span>
            </>
          ) : (
            <span className="text-theme-primary">Nouveau document</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => step > 0 ? setStep(step - 1) : navigate('/dashboard/documents')}
            className="w-9 h-9 rounded-lg border border-theme-border flex items-center justify-center hover:bg-theme-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-theme-muted" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-theme-primary">
              {templateConfig ? templateConfig.name : 'Générer un document'}
            </h1>
            <p className="text-sm text-theme-tertiary mt-0.5">
              {templateConfig ? templateConfig.description : 'Sélectionnez un template pour commencer'}
            </p>
          </div>
        </div>
      </div>

      {/* Stepper — minimal monochrome */}
      <div className="flex items-center gap-8">
        {stepLabels.map((label, i) => {
          const isActive = i === step
          const isDone = i < step
          return (
            <button
              key={i}
              onClick={() => { if (isDone) setStep(i) }}
              className={cn(
                'flex flex-col items-center gap-1.5 pb-0',
                isDone ? 'cursor-pointer' : 'cursor-default'
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-sm tabular-nums',
                  isActive ? 'text-theme-primary font-semibold' :
                  isDone ? 'text-theme-primary font-medium' :
                  'text-theme-muted'
                )}>
                  {i + 1}.
                </span>
                <span className={cn(
                  'text-sm',
                  isActive ? 'text-theme-primary font-semibold' :
                  isDone ? 'text-theme-primary font-medium' :
                  'text-theme-muted'
                )}>
                  {label}
                </span>
              </div>
              <div className={cn(
                'h-0.5 w-full rounded-full transition-colors',
                isActive || isDone ? 'bg-theme-primary' : 'bg-transparent'
              )} />
            </button>
          )
        })}
      </div>

      {/* Step 0: Select template */}
      {step === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.values(allConfigs).map(t => (
            <button
              key={t.id}
              onClick={() => handleSelectTemplate(t.id)}
              className={cn(
                'text-left rounded-xl border p-5 transition-all cursor-pointer group',
                selectedTemplate === t.id ? 'border-accent ring-1 ring-accent/20' : 'border-theme-border hover:border-theme-active'
              )}
            >
              <h3 className="text-sm font-semibold text-theme-primary group-hover:text-accent transition-colors">
                {t.name}
              </h3>
              <p className="text-xs text-theme-tertiary mt-1.5 leading-relaxed">{t.description}</p>
              <div className="flex items-center gap-1 mt-3 text-xs text-accent font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Sélectionner
                <ChevronRight className="w-3 h-3" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step 1: Fill form */}
      {step === 1 && templateConfig && (
        <div className="space-y-5">
          {/* AI pre-fill banner with dropdowns */}
          <div className="rounded-xl border border-accent/15 bg-accent/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-accent shrink-0" />
              <p className="text-sm font-medium text-theme-primary">Pré-remplissage intelligent</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-theme-secondary mb-1">Contact existant</label>
                <select
                  value={selectedContact}
                  onChange={e => handlePrefillContact(e.target.value)}
                  className={inputClasses}
                >
                  <option value="">Sélectionner un contact...</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{`${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-theme-secondary mb-1">Bien existant</label>
                <select
                  value={selectedProperty}
                  onChange={e => handlePrefillProperty(e.target.value)}
                  className={inputClasses}
                >
                  <option value="">Sélectionner un bien...</option>
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.address}, {p.city}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Form sections with numbered headers and dots */}
          {sectionEntries.map(([sectionName, fields], sectionIdx) => {
            const dotColor = SECTION_DOTS[sectionName] || 'bg-theme-tertiary'
            return (
              <div key={sectionName} className="rounded-xl border border-theme-border overflow-hidden">
                <div className="px-5 py-3 border-b border-theme-border flex items-center gap-2.5">
                  <span className={cn('w-2 h-2 rounded-full shrink-0', dotColor)} />
                  <h3 className="text-sm font-semibold text-theme-primary">
                    {sectionIdx + 1}. {sectionName}
                  </h3>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                  {fields.map(field => (
                    <div key={field.name} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                      <label className="block text-sm font-medium text-theme-primary mb-1.5">
                        {field.label}
                        {field.required && <span className="text-danger ml-0.5">*</span>}
                      </label>
                      {field.type === 'select' ? (
                        <select
                          value={formData[field.name] || ''}
                          onChange={e => handleFieldChange(field.name, e.target.value)}
                          className={inputClasses}
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
                          className="w-full px-3 py-2.5 bg-transparent border border-theme-border rounded-lg text-sm text-theme-primary focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none resize-none transition-colors"
                        />
                      ) : (
                        <input
                          type={field.type}
                          value={formData[field.name] || ''}
                          onChange={e => handleFieldChange(field.name, e.target.value)}
                          placeholder={field.placeholder}
                          className={inputClasses}
                        />
                      )}
                      {field.hint && (
                        <p className="text-xs text-theme-tertiary mt-1">{field.hint}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(0)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2 text-theme-tertiary">
                <Save className="w-4 h-4" />
                <span className="hidden sm:inline">Brouillon</span>
              </Button>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Générer le document
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 2 && templateConfig && generated && (
        <div className="space-y-6">
          {/* Preview card */}
          <div className="rounded-xl border border-theme-border overflow-hidden">
            <div className="px-5 py-3 border-b border-theme-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-theme-primary">Aperçu du document</h3>
              <span className="text-xs font-medium text-theme-tertiary bg-theme-section px-2 py-0.5 rounded">PDF</span>
            </div>

            {/* Document preview */}
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
                {sectionEntries.map(([sectionName, fields]) => (
                  <div key={sectionName}>
                    <h3 className="text-sm font-semibold text-theme-primary mb-3 capitalize">
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
                  <p className="text-xs text-theme-tertiary mt-6 text-center">
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
              <Button onClick={() => navigate('/dashboard/documents')} className="gap-2">
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
