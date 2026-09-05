/**
 * La coquille commune des sept modales de la Messagerie : portail sur
 * `document.body`, voile assombrissant, carte, piège de focus et Échap — le
 * modèle de `WhatsAppConnectModal.tsx:70-101`.
 *
 * z-index 300 par défaut (règle 3 du lot 2) : au-dessus du chrome CRM (rail et
 * barre à 75, `CrmSearch` à 200), sous le dropdown de profil (9000). Les
 * popovers internes montent à 310, les menus contextuels à 320.
 *
 * ⚠ `crmVoileAssombrissant` et NON `crmVoileEncre` : ce dernier rend « ce qui
 * s'oppose à la surface », donc du BLANC en sombre — un drap blanc sur l'écran
 * au lieu de l'assombrir. Gardé par `voile-modale.spec.ts`.
 */
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { crmVoileAssombrissant } from '@/components/crm/tokens'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { MailSurfaces } from './mailTokens'

interface Props {
  ms: MailSurfaces
  open: boolean
  onClose: () => void
  /** largeur maximale de la carte, en pixels (README : 420 à 720 selon la modale) */
  width: number
  ariaLabel: string
  zIndex?: number
  /** opacité du voile (README : .12 / .14 / .28 selon la modale) */
  veil?: number
  blur?: number
  children: ReactNode
  /** colonne : la carte ne défile pas, c'est son contenu qui le fait (« Rapprocher ») */
  column?: boolean
}

/** Portail + voile + carte. Rend `null` fermée : aucun nœud résiduel dans le body. */
export function MailModalShell({ ms, open, onClose, width, ariaLabel, zIndex = 300, veil = 0.4, blur = 6, children, column }: Props) {
  // ⚠ `useFocusTrap(active, onEscape?)` REND la ref — le plan la lui passait en
  // premier argument, ce qui aurait compilé (la ref est truthy) tout en piégeant
  // le mauvais nœud. Signature vérifiée dans `src/hooks/useFocusTrap.ts`.
  const ref = useFocusTrap(open, onClose)
  // Échap est déjà géré par le piège ; on ne double pas l'écouteur. Ce qui reste
  // à faire ici est de rendre la page immobile sous la modale.
  useEffect(() => {
    if (!open) return
    const precedent = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = precedent }
  }, [open])
  if (!open) return null
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex, display: 'grid', placeItems: 'center', padding: 'var(--crm-space-7xl)',
        background: crmVoileAssombrissant(veil), backdropFilter: `blur(${blur}px)`, WebkitBackdropFilter: `blur(${blur}px)`,
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: `min(${width}px, 100%)`, maxHeight: '100%',
          overflowY: column ? 'hidden' : 'auto', display: column ? 'flex' : 'block', flexDirection: 'column',
          background: ms.card, border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-6xl)', boxShadow: ms.solidShadow,
          padding: 'var(--crm-space-7xl)', color: ms.ink, fontFamily: 'var(--crm-font)',
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** Le bouton rond de fermeture (32 px, fond creusé) commun aux sept modales. */
export function MailCloseButton({ ms, onClick, label }: { ms: MailSurfaces; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 32, height: 32, borderRadius: '50%', background: ms.elev, border: `1px solid ${ms.bord}`,
        color: ms.ink, cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-lg)',
        lineHeight: 1, fontFamily: 'inherit', transition: 'background .12s, color .12s',
      }}
    >
      ×
    </button>
  )
}
