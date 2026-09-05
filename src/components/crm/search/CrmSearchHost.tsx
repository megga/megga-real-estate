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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen)
    }
  }, [])

  if (!open) return null
  return <CrmSearch open={open} onClose={() => setOpen(false)} />
}
