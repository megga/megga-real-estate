import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCustomTemplates } from '@/hooks/useCustomTemplates'

// ─── TYPES ──────────────────────────────────────────────────────────────────

type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea'

interface CustomField {
  id: string
  label: string
  type: FieldType
  required: boolean
  placeholder: string
  hint: string
  options: string
}

interface CustomSection {
  id: string
  name: string
  fields: CustomField[]
  collapsed: boolean
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Texte' },
  { value: 'number', label: 'Nombre' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Liste' },
  { value: 'textarea', label: 'Texte long' },
]

const CATEGORIES = [
  { value: 'mandat', label: 'Mandats' },
  { value: 'visite', label: 'Visites' },
  { value: 'offre', label: 'Offres' },
  { value: 'kyc', label: 'KYC / LAB' },
  { value: 'communication', label: 'Communication' },
  { value: 'autre', label: 'Autre' },
]

function makeId() { return Math.random().toString(36).slice(2, 10) }
function createField(): CustomField { return { id: makeId(), label: '', type: 'text', required: false, placeholder: '', hint: '', options: '' } }
function createSection(name = ''): CustomSection { return { id: makeId(), name, fields: [createField()], collapsed: false } }

// ─── STYLES ─────────────────────────────────────────────────────────────────

const inputCls = 'w-full h-10 px-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors text-theme-primary placeholder:text-theme-tertiary'
const labelCls = 'block text-sm font-medium text-theme-primary mb-1.5'

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export default function CustomTemplatePage() {
  const navigate = useNavigate()
  const { addTemplate } = useCustomTemplates()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('autre')
  const [sections, setSections] = useState<CustomSection[]>([createSection('Informations')])
  const [errors, setErrors] = useState<Record<string, string>>({})

  // ─── SECTION HANDLERS ─────────────────────────────────────────────────

  function addSection() { setSections(prev => [...prev, createSection()]) }
  function removeSection(id: string) { setSections(prev => prev.filter(s => s.id !== id)) }
  function updateSectionName(id: string, v: string) { setSections(prev => prev.map(s => s.id === id ? { ...s, name: v } : s)) }
  function toggleSection(id: string) { setSections(prev => prev.map(s => s.id === id ? { ...s, collapsed: !s.collapsed } : s)) }

  // ─── FIELD HANDLERS ───────────────────────────────────────────────────

  function addField(sId: string) { setSections(prev => prev.map(s => s.id === sId ? { ...s, fields: [...s.fields, createField()] } : s)) }
  function removeField(sId: string, fId: string) { setSections(prev => prev.map(s => s.id === sId ? { ...s, fields: s.fields.filter(f => f.id !== fId) } : s)) }
  function updateField(sId: string, fId: string, u: Partial<CustomField>) { setSections(prev => prev.map(s => s.id === sId ? { ...s, fields: s.fields.map(f => f.id === fId ? { ...f, ...u } : f) } : s)) }

  function moveField(sId: string, fId: string, dir: 'up' | 'down') {
    setSections(prev => prev.map(s => {
      if (s.id !== sId) return s
      const idx = s.fields.findIndex(f => f.id === fId)
      if (idx === -1) return s
      const newIdx = dir === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= s.fields.length) return s
      const arr = [...s.fields]
      const tmp = arr[idx]; arr[idx] = arr[newIdx]; arr[newIdx] = tmp
      return { ...s, fields: arr }
    }))
  }

  // ─── SAVE ─────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Nom requis'
    if (sections.length === 0) errs.sections = 'Au moins une section requise'
    for (const section of sections) {
      if (!section.name.trim()) errs[`s_${section.id}`] = 'Nom requis'
      for (const field of section.fields) {
        if (!field.label.trim()) errs[`f_${field.id}`] = 'Label requis'
        if (field.type === 'select' && !field.options.trim()) errs[`o_${field.id}`] = 'Options requises'
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSave() {
    if (!validate()) return
    addTemplate({
      name: name.trim(),
      description: description.trim(),
      category,
      sections: sections.map(s => ({
        name: s.name.trim(),
        fields: s.fields.map(f => ({
          label: f.label.trim(),
          type: f.type,
          required: f.required,
          placeholder: f.placeholder.trim(),
          hint: f.hint.trim(),
          ...(f.type === 'select' ? {
            options: f.options.split(',').map(o => o.trim()).filter(Boolean).map(o => ({ value: o.toLowerCase().replace(/\s+/g, '_'), label: o }))
          } : {}),
        })),
      })),
    })
    navigate('/dashboard/documents')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-theme-tertiary mb-3">
          <button onClick={() => navigate('/dashboard/documents')} className="hover:text-theme-primary transition-colors">Documents</button>
          <span>/</span>
          <span className="text-theme-primary">Nouveau template</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard/documents')}
            className="w-9 h-9 rounded-lg border border-theme-border flex items-center justify-center hover:bg-theme-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-theme-muted" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-theme-primary">Nouveau template personnalisé</h1>
            <p className="text-sm text-theme-tertiary mt-0.5">Définissez les sections et champs de votre document</p>
          </div>
        </div>
      </div>

      {/* ── Informations ── */}
      <div className="rounded-xl border border-theme-border p-5">
        <h2 className="text-sm font-semibold text-theme-primary mb-4">Informations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Nom du template *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Attestation de propriété"
              className={cn(inputCls, errors.name && 'border-red-500')}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className={labelCls}>Catégorie</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Courte description du template"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* ── Sections & Fields ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-theme-primary">Sections et champs</h2>
          {errors.sections && <p className="text-xs text-red-500">{errors.sections}</p>}
        </div>

        {sections.map((section, sIdx) => (
          <div key={section.id} className="rounded-xl border border-theme-border overflow-hidden">
            {/* Section header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-theme-section/30 border-b border-theme-border">
              <GripVertical className="w-3.5 h-3.5 text-theme-tertiary shrink-0" />
              <span className="text-xs font-semibold text-theme-tertiary w-5">{sIdx + 1}.</span>
              <input
                type="text"
                value={section.name}
                onChange={e => updateSectionName(section.id, e.target.value)}
                placeholder="Nom de la section"
                className={cn(
                  'flex-1 h-8 px-2 text-sm font-medium bg-transparent border border-transparent rounded-md focus:border-theme-border focus:outline-none text-theme-primary placeholder:text-theme-tertiary',
                  errors[`s_${section.id}`] && 'border-red-500'
                )}
              />
              <span className="text-xs text-theme-tertiary">{section.fields.length} champ{section.fields.length > 1 ? 's' : ''}</span>
              <button onClick={() => toggleSection(section.id)} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-theme-hover transition-colors">
                {section.collapsed ? <ChevronDown className="w-3.5 h-3.5 text-theme-muted" /> : <ChevronUp className="w-3.5 h-3.5 text-theme-muted" />}
              </button>
              {sections.length > 1 && (
                <button onClick={() => removeSection(section.id)} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-500/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </button>
              )}
            </div>

            {/* Fields */}
            {!section.collapsed && (
              <div className="p-4 space-y-2">
                {section.fields.map((field, fIdx) => (
                  <div key={field.id} className="rounded-lg border border-theme-border p-3">
                    {/* Row 1: label + type + required + actions — single line */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={field.label}
                        onChange={e => updateField(section.id, field.id, { label: e.target.value })}
                        placeholder="Label du champ"
                        className={cn(
                          'flex-1 h-8 px-2.5 text-sm bg-transparent border border-theme-border rounded-md focus:outline-none focus:border-accent text-theme-primary placeholder:text-theme-tertiary min-w-0',
                          errors[`f_${field.id}`] && 'border-red-500'
                        )}
                      />
                      <select
                        value={field.type}
                        onChange={e => updateField(section.id, field.id, { type: e.target.value as FieldType })}
                        className="h-8 px-2 text-xs bg-transparent border border-theme-border rounded-md focus:outline-none focus:border-accent text-theme-secondary w-24 shrink-0"
                      >
                        {FIELD_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                      </select>
                      <label className="flex items-center gap-1.5 text-xs text-theme-secondary cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={e => updateField(section.id, field.id, { required: e.target.checked })}
                          className="w-3.5 h-3.5 rounded border-theme-border accent-accent"
                        />
                        Requis
                      </label>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button onClick={() => moveField(section.id, field.id, 'up')} disabled={fIdx === 0} className="w-6 h-6 rounded flex items-center justify-center hover:bg-theme-hover disabled:opacity-30 transition-colors">
                          <ChevronUp className="w-3 h-3 text-theme-muted" />
                        </button>
                        <button onClick={() => moveField(section.id, field.id, 'down')} disabled={fIdx === section.fields.length - 1} className="w-6 h-6 rounded flex items-center justify-center hover:bg-theme-hover disabled:opacity-30 transition-colors">
                          <ChevronDown className="w-3 h-3 text-theme-muted" />
                        </button>
                        {section.fields.length > 1 && (
                          <button onClick={() => removeField(section.id, field.id)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-500/10 transition-colors">
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Row 2: select options (only for select type) */}
                    {field.type === 'select' && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={field.options}
                          onChange={e => updateField(section.id, field.id, { options: e.target.value })}
                          placeholder="Options séparées par des virgules : Option 1, Option 2, Option 3"
                          className={cn(
                            'w-full h-8 px-2.5 text-xs bg-transparent border border-theme-border rounded-md focus:outline-none focus:border-accent text-theme-secondary placeholder:text-theme-tertiary',
                            errors[`o_${field.id}`] && 'border-red-500'
                          )}
                        />
                      </div>
                    )}
                  </div>
                ))}

                {/* Add field */}
                <button
                  onClick={() => addField(section.id)}
                  className="w-full h-9 rounded-lg border border-dashed border-theme-border text-xs font-medium text-theme-tertiary hover:text-theme-secondary hover:border-theme-active transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3 h-3" />
                  Ajouter un champ
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Add section */}
        <button
          onClick={addSection}
          className="w-full h-10 rounded-xl border border-dashed border-theme-border text-sm font-medium text-theme-tertiary hover:text-theme-secondary hover:border-theme-active transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Ajouter une section
        </button>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-between pt-2 pb-8">
        <button
          onClick={() => navigate('/dashboard/documents')}
          className="h-9 px-4 rounded-lg text-sm font-medium text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active transition-colors"
        >
          Annuler
        </button>
        <button
          onClick={handleSave}
          className="h-9 px-5 rounded-lg text-sm font-medium text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active transition-colors"
        >
          Créer le template
        </button>
      </div>
    </div>
  )
}
