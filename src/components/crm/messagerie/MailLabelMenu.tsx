/**
 * Le menu d'un libellé du rail, au clic droit : Renommer · Changer la couleur ·
 * Supprimer (README §1d).
 *
 * ⚠ Ancré en `position: fixed` aux coordonnées du curseur, et porté sur
 * `document.body` : le rail défile (`overflowY: auto`), donc un menu rendu à
 * l'intérieur serait coupé par son conteneur.
 *
 * z-index 320 — au-dessus des modales (300) et de leurs popovers (310), parce
 * qu'un menu contextuel est toujours le dernier ouvert. Le voisinage a été lu
 * avant d'être choisi : chrome CRM 75, `CrmSearch` 200, dropdown de profil 9000.
 */
import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { MAIL_TRANSITION, type MailSurfaces } from './mailTokens'
import { useFermetureMenu } from '@/hooks/useFermetureMenu'

interface Props {
  ms: MailSurfaces
  x: number
  y: number
  onClose: () => void
  onRename: () => void
  onRecolor: () => void
  onDelete: () => void
}

/** Largeur du menu et hauteur de ses trois items — bornent le report au bord de fenêtre. */
const LARGEUR = 200
const MARGE_DROITE = 220
const MARGE_BAS = 140

export function MailLabelMenu({ ms, x, y, onClose, onRename, onRecolor, onDelete }: Props) {
  const { t } = useTranslation('messages')
  const ref = useRef<HTMLDivElement>(null)
  // Clic dehors et Échap ; armé au tick suivant — voir `useFermetureMenu`.
  useFermetureMenu(ref, onClose)

  const item = (label: string, fn: () => void, danger = false) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => { fn(); onClose() }}
      style={{
        display: 'block', width: '100%', textAlign: 'left', padding: 'var(--crm-space-sm) var(--crm-space-lg)',
        borderRadius: 'var(--crm-radius-lg)', background: 'transparent', border: 'none',
        color: danger ? ms.dangerText : ms.ink, fontSize: 'var(--crm-text-sm)', cursor: 'pointer',
        fontFamily: 'inherit', transition: MAIL_TRANSITION,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? ms.danger : ms.hover
        if (danger) e.currentTarget.style.color = ms.dangerInk
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = danger ? ms.dangerText : ms.ink
      }}
    >
      {label}
    </button>
  )

  return createPortal(
    <>
      {/* Voile : le clic qui ferme le menu ne déclenche pas ce qu'il y a dessous
          (même geste que `MailContextMenu`). */}
      <div onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 319 }} />
    <div
      ref={ref}
      role="menu"
      style={{
        position: 'fixed', left: Math.min(x, window.innerWidth - MARGE_DROITE), top: Math.min(y, window.innerHeight - MARGE_BAS),
        zIndex: 320, minWidth: LARGEUR, background: ms.solid, border: `1px solid ${ms.solidBorder}`,
        borderRadius: 'var(--crm-radius-xl)', boxShadow: ms.solidShadow, padding: 'var(--crm-space-2xs)',
        fontFamily: 'var(--crm-font)',
      }}
    >
      {item(t('mail.labels.rename'), onRename)}
      {item(t('mail.labels.recolor'), onRecolor)}
      {item(t('mail.labels.delete'), onDelete, true)}
    </div>
    </>,
    document.body,
  )
}
