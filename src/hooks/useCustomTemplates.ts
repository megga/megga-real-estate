import { useState, useCallback } from 'react'

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface TemplateField {
  label: string
  type: 'text' | 'number' | 'date' | 'select' | 'textarea'
  required: boolean
  placeholder?: string
  hint?: string
  options?: { value: string; label: string }[]
}

interface TemplateSection {
  name: string
  fields: TemplateField[]
}

export interface CustomTemplate {
  id: string
  name: string
  description: string
  category: string
  sections: TemplateSection[]
  createdAt: string
  usageCount: number
}

interface AddTemplateInput {
  name: string
  description: string
  category: string
  sections: TemplateSection[]
}

// ─── STORAGE KEY ────────────────────────────────────────────────────────────

const STORAGE_KEY = 'megga-custom-templates'

function loadTemplates(): CustomTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as CustomTemplate[]
  } catch {
    return []
  }
}

function saveTemplates(templates: CustomTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

// ─── HOOK ───────────────────────────────────────────────────────────────────

export function useCustomTemplates() {
  const [templates, setTemplates] = useState<CustomTemplate[]>(loadTemplates)

  const addTemplate = useCallback((input: AddTemplateInput) => {
    const newTemplate: CustomTemplate = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: input.name,
      description: input.description,
      category: input.category,
      sections: input.sections,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    }
    setTemplates(prev => {
      const updated = [...prev, newTemplate]
      saveTemplates(updated)
      return updated
    })
    return newTemplate
  }, [])

  const removeTemplate = useCallback((id: string) => {
    setTemplates(prev => {
      const updated = prev.filter(t => t.id !== id)
      saveTemplates(updated)
      return updated
    })
  }, [])

  const incrementUsage = useCallback((id: string) => {
    setTemplates(prev => {
      const updated = prev.map(t =>
        t.id === id ? { ...t, usageCount: t.usageCount + 1 } : t
      )
      saveTemplates(updated)
      return updated
    })
  }, [])

  return { templates, addTemplate, removeTemplate, incrementUsage }
}
