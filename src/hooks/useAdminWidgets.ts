import { useState, useCallback } from 'react'

export interface DashboardWidget {
  id: string
  label: string
  component: string
  visible: boolean
  order: number
}

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: 'kpis', label: 'KPIs globaux', component: 'kpis', visible: true, order: 0 },
  { id: 'billing', label: 'Revenus & Abonnements', component: 'billing', visible: true, order: 1 },
  { id: 'alerts', label: 'Alertes recentes', component: 'alerts', visible: true, order: 2 },
  { id: 'onboarding', label: 'Onboarding agences', component: 'onboarding', visible: true, order: 3 },
  { id: 'activity', label: 'Activite plateforme', component: 'activity', visible: true, order: 4 },
]

const STORAGE_KEY = 'megga-admin-widgets'

function loadWidgets(): DashboardWidget[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as DashboardWidget[]
      // Merge with defaults to pick up new widgets
      const ids = new Set(parsed.map(w => w.id))
      const merged = [...parsed]
      for (const dw of DEFAULT_WIDGETS) {
        if (!ids.has(dw.id)) merged.push(dw)
      }
      return merged.sort((a, b) => a.order - b.order)
    }
  } catch { /* ignore */ }
  return DEFAULT_WIDGETS
}

export function useAdminWidgets() {
  const [widgets, setWidgets] = useState<DashboardWidget[]>(loadWidgets)

  const save = useCallback((updated: DashboardWidget[]) => {
    setWidgets(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
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
    const temp = updated[idx].order
    updated[idx] = { ...updated[idx], order: updated[target].order }
    updated[target] = { ...updated[target], order: temp }
    save(updated.sort((a, b) => a.order - b.order))
  }, [widgets, save])

  const resetWidgets = useCallback(() => {
    save(DEFAULT_WIDGETS)
  }, [save])

  return {
    widgets,
    visibleWidgets: widgets.filter(w => w.visible),
    toggleWidget,
    moveWidget,
    resetWidgets,
  }
}
