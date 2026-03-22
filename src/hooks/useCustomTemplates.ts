import { useState, useCallback, useEffect } from 'react'

// ─── TYPES ──────────────────────────────────────────────────────────────────

type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea'

interface CustomTemplateField {
  label: string
  type: FieldType
  required: boolean
  placeholder: string
  hint: string
  options?: { value: string; label: string }[]
}

interface CustomTemplateSection {
  name: string
  fields: CustomTemplateField[]
}

export interface StoredCustomTemplate {
  id: string
  name: string
  description: string
  category: string
  sections: CustomTemplateSection[]
  createdAt: string
  usageCount: number
}

const STORAGE_KEY = 'megga-custom-templates'

function loadTemplates(): StoredCustomTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as StoredCustomTemplate[]
  } catch {
    return []
  }
}

function saveTemplates(templates: StoredCustomTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

// ─── HOOK ───────────────────────────────────────────────────────────────────

export function useCustomTemplates() {
  const [templates, setTemplates] = useState<StoredCustomTemplate[]>(loadTemplates)

  // Sync across tabs
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setTemplates(loadTemplates())
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const addTemplate = useCallback((data: {
    name: string
    description: string
    category: string
    sections: CustomTemplateSection[]
  }) => {
    const newTemplate: StoredCustomTemplate = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: data.name,
      description: data.description,
      category: data.category,
      sections: data.sections,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    }
    setTemplates(prev => {
      const updated = [...prev, newTemplate]
      saveTemplates(updated)
      return updated
    })
    return newTemplate.id
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
      const updated = prev.map(t => t.id === id ? { ...t, usageCount: t.usageCount + 1 } : t)
      saveTemplates(updated)
      return updated
    })
  }, [])

  return { templates, addTemplate, removeTemplate, incrementUsage }
}
