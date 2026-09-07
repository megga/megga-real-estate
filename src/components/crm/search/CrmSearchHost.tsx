// MEGGA CRM Sugar — Host de la recherche immersive.
// Monté une seule fois dans AgentLayout. Gère l'ouverture via :
//   - ⌘/Ctrl + K (toggle global)
//   - l'événement 'megga:open-search' (émis par la ligne « Rechercher » de CrmSidebar)
// Le composant lourd (et ses requêtes) n'est monté que lorsqu'il est ouvert.

import { useEffect, useState } from 'react'
import CrmSearch from './CrmSearch'
import { OPEN_SEARCH_EVENT } from './openSearch'

export default function CrmSearchHost() {
  const [open, setOpen] = useState(false)
  // Amorce venue de l'émetteur (aujourd'hui : le champ du nouvel onglet).
  // ⚠ Elle n'a de sens qu'à l'OUVERTURE : `CrmSearch` est démonté quand la
  // palette est fermée, donc il relit cette valeur à chaque montage — c'est
  // exactement ce qu'on veut, et c'est ce qui évite de la remettre à zéro à la
  // fermeture (personne ne la lit plus).
  const [amorce, setAmorce] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        // ⚠ L'amorce est REMISE À ZÉRO ici, sans quoi un ⌘K rouvrirait la
        // palette pré-remplie avec ce que l'agent avait tapé dans un nouvel
        // onglet une heure plus tôt. Le raccourci global n'amorce rien.
        setAmorce('')
        setOpen(prev => !prev)
      }
    }
    const onOpen = (e: Event) => {
      const q = (e as CustomEvent<{ query?: string }>).detail?.query
      setAmorce(typeof q === 'string' ? q : '')
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen)
    }
  }, [])

  if (!open) return null
  return <CrmSearch open={open} amorce={amorce} onClose={() => setOpen(false)} />
}
