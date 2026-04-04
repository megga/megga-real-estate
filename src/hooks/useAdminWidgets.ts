import { useState, useCallback } from 'react'

export interface DashboardWidget {
  id: string
  label: string
  component: string
  visible: boolean
  order: number
  height: number | null // null = auto, number = px
}

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: 'kpis', label: 'KPIs globaux', component: 'kpis', visible: true, order: 0, height: null },
  { id: 'alerts', label: 'Alertes recentes', component: 'alerts', visible: true, order: 1, height: null },
  { id: 'activity', label: 'Activite plateforme', component: 'activity', visible: true, order: 2, height: null },
  { id: 'billing', label: 'Revenus & Abonnements', component: 'billing', visible: true, order: 3, height: null },
  { id: 'report', label: 'Rapport hebdomadaire', component: 'report', visible: true, order: 4, height: null },
  { id: 'onboarding', label: 'Onboarding agences', component: 'onboarding', visible: true, order: 5, height: null },
]

const STORAGE_KEY = 'megga-admin-widgets'

function loadWidgets(): DashboardWidget[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as DashboardWidget[]
      const ids = new Set(parsed.map(w => w.id))
      const merged = [...parsed]
      for (const dw of DEFAULT_WIDGETS) {
        if (!ids.has(dw.id)) merged.push(dw)
      }
      return merged.map(w => ({ ...w, height: w.height ?? null })).sort((a, b) => a.order - b.order)
    }
  } catch { /* ignore */ }
  return DEFAULT_WIDGETS
}

export function useAdminWidgets() {
  const [widgets, setWidgets] = useState<DashboardWidget[]>(loadWidgets)

  const save = useCallback((updated: DashboardWidget[]) => {
    const reordered = updated.map((w, i) => ({ ...w, order: i }))
    setWidgets(reordered)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reordered))
  }, [])

  const toggleWidget = useCallback((id: string) => {
    save(widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w))
  }, [widgets, save])

  const moveWidget = useCallback((id: string, direction: 'up' | 'down') => {
    const idx = widgets.findIndex(w => w.id === id)
    if (idx < 0) return
    const target = direction === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= widgets.length) return
    const updated = [...widgets]
    const temp = updated[idx]
    updated[idx] = updated[target]
    updated[target] = temp
    save(updated)
  }, [widgets, save])

  const reorderWidgets = useCallback((activeId: string, overId: string) => {
    const oldIndex = widgets.findIndex(w => w.id === activeId)
    const newIndex = widgets.findIndex(w => w.id === overId)
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return
    const updated = [...widgets]
    const [moved] = updated.splice(oldIndex, 1)
    updated.splice(newIndex, 0, moved)
    save(updated)
  }, [widgets, save])

  const setWidgetHeight = useCallback((id: string, height: number | null) => {
    save(widgets.map(w => w.id === id ? { ...w, height } : w))
  }, [widgets, save])

  const resetWidgets = useCallback(() => {
    save(DEFAULT_WIDGETS)
  }, [save])

  return {
    widgets,
    visibleWidgets: widgets.filter(w => w.visible),
    toggleWidget,
    moveWidget,
    reorderWidgets,
    setWidgetHeight,
    resetWidgets,
  }
}
