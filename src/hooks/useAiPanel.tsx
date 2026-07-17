/* eslint-disable react-refresh/only-export-components */
// Pont d'ouverture de MEGGA AI (panneau docké). Remplace le `window.meggaAskAI`
// de la maquette par un contexte React : n'importe quelle surface proactive
// (bandeaux « MEGGA AI a repéré », bouton ✦) appelle `askAi(question)` pour
// ouvrir le panneau + envoyer une question. L'écran courant est dérivé de la
// route (suivi de contexte — chantiers 5 & 6).

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { screenFromPath, entityFromPath, type RouteEntity } from '@/components/ai-copilot/panel/aiPanel'

interface AiPanelValue {
  /** true seulement sous le provider (sinon les surfaces retombent sur un fallback). */
  enabled: boolean
  isOpen: boolean
  seed: string | null
  screen: string
  /** Entité CRM ouverte (fiche contact/bien), dérivée de la route — cible des actions. */
  entity: RouteEntity | null
  /** Ouvre le panneau, éventuellement avec une question pré-remplie. */
  open: (seed?: string) => void
  close: () => void
  /** Raccourci : ouvre + envoie la question (surfaces proactives). */
  askAi: (question: string) => void
  /** Purge la graine après envoi (anti-doublon). */
  consumeSeed: () => void
}

const noop = () => {}
const AiPanelContext = createContext<AiPanelValue>({
  enabled: false, isOpen: false, seed: null, screen: 'today', entity: null,
  open: noop, close: noop, askAi: noop, consumeSeed: noop,
})

/** Provider du panneau MEGGA AI : dérive écran + entité de la route et expose open/close/askAi/seed. */
export function AiPanelProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const [seed, setSeed] = useState<string | null>(null)
  const screen = screenFromPath(location.pathname)
  // Mémoïsé par pathname → référence stable (sinon re-render à chaque render).
  const entity = useMemo(() => entityFromPath(location.pathname), [location.pathname])

  const open = useCallback((s?: string) => { setSeed(s ?? null); setIsOpen(true) }, [])
  const close = useCallback(() => setIsOpen(false), [])
  const askAi = useCallback((q: string) => { setSeed(q || null); setIsOpen(true) }, [])
  const consumeSeed = useCallback(() => setSeed(null), [])

  const value = useMemo<AiPanelValue>(() => ({
    enabled: true, isOpen, seed, screen, entity, open, close, askAi, consumeSeed,
  }), [isOpen, seed, screen, entity, open, close, askAi, consumeSeed])

  return <AiPanelContext.Provider value={value}>{children}</AiPanelContext.Provider>
}

/** Accès au contexte du panneau MEGGA AI (`enabled: false` hors provider → surfaces en fallback). */
export function useAiPanel(): AiPanelValue {
  return useContext(AiPanelContext)
}
