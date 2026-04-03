import { useState } from 'react'
import { X, Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── TYPES ──────────────────────────────────────────────────────────────────

type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea'

interface CustomField {
  id: string
  label: string
  type: FieldType
  required: boolean
  placeholder: string
  hint: string
  options: string // comma-separated for select
}

interface CustomSection {
  id: string
  name: string
  fields: CustomField[]
  collapsed: boolean
}

export interface CustomTemplateData {
  name: string
  description: string
  category: string
  sections: { name: string; fields: { label: string; type: FieldType; required: boolean; placeholder: string; hint: string; options?: { value: string; label: string }[] }[] }[]
}

interface CustomTemplateModalProps {
  open: boolean
  onClose: () => void
  onSave: (template: CustomTemplateData) => void
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Texte' },
  { value: 'number', label: 'Nombre' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Liste déroulante' },
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

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

function createField(): CustomField {
  return { id: makeId(), label: '', type: 'text', required: false, placeholder: '', hint: '', options: '' }
}

function createSection(name = ''): CustomSection {
  return { id: makeId(), name, fields: [createField()], collapsed: false }
}

// ─── INPUT STYLES ───────────────────────────────────────────────────────────

const inputCls = 'w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors text-theme-primary placeholder:text-theme-tertiary'
const selectCls = cn(inputCls, 'appearance-none')
const labelCls = 'block text-xs font-medium text-theme-secondary mb-1'

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export default function CustomTemplateModal({ open, onClose, onSave }: CustomTemplateModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('autre')
  const [sections, setSections] = useState<CustomSection[]>([createSection('Informations')])
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!open) return null

  // ─── SECTION HANDLERS ───────────────────────────────────────────────

  function addSection() {
    setSections(prev => [...prev, createSection()])
  }

  function removeSection(sectionId: string) {
    setSections(prev => prev.filter(s => s.id !== sectionId))
  }

  function updateSectionName(sectionId: string, newName: string) {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, name: newName } : s))
  }

  function toggleSection(sectionId: string) {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, collapsed: !s.collapsed } : s))
  }

  // ─── FIELD HANDLERS ─────────────────────────────────────────────────

  function addField(sectionId: string) {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, fields: [...s.fields, createField()] } : s
    ))
  }

  function removeField(sectionId: string, fieldId: string) {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, fields: s.fields.filter(f => f.id !== fieldId) } : s
    ))
  }

  function updateField(sectionId: string, fieldId: string, updates: Partial<CustomField>) {
    setSections(prev => prev.map(s =>
      s.id === sectionId
        ? { ...s, fields: s.fields.map(f => f.id === fieldId ? { ...f, ...updates } : f) }
        : s
    ))
  }

  function moveField(sectionId: string, fieldId: string, direction: 'up' | 'down') {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s
      const idx = s.fields.findIndex(f => f.id === fieldId)
      if (idx === -1) return s
      const newIdx = direction === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= s.fields.length) return s
      const newFields = [...s.fields]
      const temp = newFields[idx]
      newFields[idx] = newFields[newIdx]
      newFields[newIdx] = temp
      return { ...s, fields: newFields }
    }))
  }

  // ─── VALIDATION & SAVE ──────────────────────────────────────────────

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Nom requis'
    if (sections.length === 0) errs.sections = 'Au moins une section requise'

    for (const section of sections) {
      if (!section.name.trim()) errs[`section_${section.id}`] = 'Nom de section requis'
      for (const field of section.fields) {
        if (!field.label.trim()) errs[`field_${field.id}`] = 'Label requis'
        if (field.type === 'select' && !field.options.trim()) errs[`options_${field.id}`] = 'Options requises'
      }
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSave() {
    if (!validate()) return

    const template: CustomTemplateData = {
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
    }
    onSave(template)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-theme-page rounded-xl border border-theme-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-theme-border">
          <div>
            <h2 className="text-lg font-semibold text-theme-primary">Créer un template personnalisé</h2>
            <p className="text-xs text-theme-tertiary mt-0.5">Définissez les sections et champs de votre document</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-theme-hover transition-colors">
            <X className="w-4 h-4 text-theme-muted" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Basic info */}
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
              {errors.name && <p className="text-[11px] text-red-500 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className={labelCls}>Catégorie</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className={selectCls}>
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
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

          {/* Divider */}
          <div className="border-t border-theme-border" />

          {/* Sections */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-theme-primary">Sections et champs</h3>
              {errors.sections && <p className="text-[11px] text-red-500">{errors.sections}</p>}
            </div>

            {sections.map((section) => (
              <div key={section.id} className="rounded-xl border border-theme-border overflow-hidden">
                {/* Section header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-theme-section">
                  <GripVertical className="w-3.5 h-3.5 text-theme-tertiary shrink-0" />
                  <input
                    type="text"
                    value={section.name}
                    onChange={e => updateSectionName(section.id, e.target.value)}
                    placeholder="Nom de la section"
                    className={cn(
                      'flex-1 h-7 px-2 text-sm font-medium bg-transparent border border-transparent rounded focus:border-theme-border focus:outline-none focus:ring-2 focus:ring-accent/20 text-theme-primary placeholder:text-theme-tertiary',
                      errors[`section_${section.id}`] && 'border-red-500'
                    )}
                  />
                  <span className="text-[10px] text-theme-tertiary">{section.fields.length} champ{section.fields.length > 1 ? 's' : ''}</span>
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
                  <div className="p-4 space-y-3">
                    {section.fields.map((field, fIdx) => (
                      <div key={field.id} className="rounded-lg border border-theme-border p-3 space-y-2.5 group">
                        <div className="flex items-start gap-2">
                          {/* Field config row 1: label + type */}
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2">
                            <div>
                              <input
                                type="text"
                                value={field.label}
                                onChange={e => updateField(section.id, field.id, { label: e.target.value })}
                                placeholder="Label du champ"
                                className={cn(
                                  'w-full h-8 px-2.5 text-sm bg-transparent border border-theme-border rounded-md focus:outline-none focus:border-accent text-theme-primary placeholder:text-theme-tertiary',
                                  errors[`field_${field.id}`] && 'border-red-500'
                                )}
                              />
                            </div>
                            <select
                              value={field.type}
                              onChange={e => updateField(section.id, field.id, { type: e.target.value as FieldType })}
                              className="h-8 px-2 text-xs bg-transparent border border-theme-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-theme-secondary"
                            >
                              {FIELD_TYPES.map(ft => (
                                <option key={ft.value} value={ft.value}>{ft.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={() => moveField(section.id, field.id, 'up')}
                              disabled={fIdx === 0}
                              className="w-6 h-6 rounded flex items-center justify-center hover:bg-theme-hover disabled:opacity-30 transition-colors"
                            >
                              <ChevronUp className="w-3 h-3 text-theme-muted" />
                            </button>
                            <button
                              onClick={() => moveField(section.id, field.id, 'down')}
                              disabled={fIdx === section.fields.length - 1}
                              className="w-6 h-6 rounded flex items-center justify-center hover:bg-theme-hover disabled:opacity-30 transition-colors"
                            >
                              <ChevronDown className="w-3 h-3 text-theme-muted" />
                            </button>
                            {section.fields.length > 1 && (
                              <button
                                onClick={() => removeField(section.id, field.id)}
                                className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="w-3 h-3 text-red-500" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Row 2: options (for required + placeholder + hint) */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <label className="flex items-center gap-1.5 text-xs text-theme-secondary cursor-pointer">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={e => updateField(section.id, field.id, { required: e.target.checked })}
                              className="w-3.5 h-3.5 rounded border-theme-border accent-accent"
                            />
                            Obligatoire
                          </label>
                          <input
                            type="text"
                            value={field.placeholder}
                            onChange={e => updateField(section.id, field.id, { placeholder: e.target.value })}
                            placeholder="Placeholder (optionnel)"
                            className="h-7 px-2 text-xs bg-transparent border border-theme-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-theme-secondary placeholder:text-theme-tertiary flex-1 min-w-[120px]"
                          />
                          <input
                            type="text"
                            value={field.hint}
                            onChange={e => updateField(section.id, field.id, { hint: e.target.value })}
                            placeholder="Indice (optionnel)"
                            className="h-7 px-2 text-xs bg-transparent border border-theme-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-theme-secondary placeholder:text-theme-tertiary flex-1 min-w-[120px]"
                          />
                        </div>

                        {/* Select options */}
                        {field.type === 'select' && (
                          <div>
                            <input
                              type="text"
                              value={field.options}
                              onChange={e => updateField(section.id, field.id, { options: e.target.value })}
                              placeholder="Options séparées par des virgules : Option 1, Option 2, Option 3"
                              className={cn(
                                'w-full h-7 px-2 text-xs bg-transparent border border-theme-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-theme-secondary placeholder:text-theme-tertiary',
                                errors[`options_${field.id}`] && 'border-red-500'
                              )}
                            />
                            {errors[`options_${field.id}`] && <p className="text-[10px] text-red-500 mt-0.5">{errors[`options_${field.id}`]}</p>}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add field button */}
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

            {/* Add section button */}
            <button
              onClick={addSection}
              className="w-full h-10 rounded-xl border border-dashed border-theme-border text-sm font-medium text-theme-tertiary hover:text-theme-secondary hover:border-theme-active transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter une section
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-theme-border">
          <button onClick={onClose} className="h-9 px-4 rounded-lg text-sm font-medium text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active transition-colors">
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
    </div>
  )
}
