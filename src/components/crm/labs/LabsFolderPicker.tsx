/**
 * « Ranger dans… » — le menu de classement du studio, le MÊME pour une production
 * seule (au survol d'une vignette) et pour une sélection entière (barre de gestes).
 *
 * ⛔ POURQUOI UN PORTAIL, ET PAS UN POPOVER LOCAL. La mosaïque vit dans un
 * `overflow-y: auto` posé dans un cadre en `overflow: hidden` : un menu positionné
 * DANS une vignette est coupé par les deux — mesuré, il ne dépasse jamais la tuile.
 * Il est donc porté dans `<body>` (CLAUDE.md §3) et placé d'après le rectangle du
 * déclencheur, replié vers le haut ou vers la gauche quand il toucherait un bord.
 *
 * ⛔ ET C'EST CE MENU QUI REND LE RANGEMENT POSSIBLE SANS LA VISIONNEUSE. Avant lui,
 * classer une production demandait de l'OUVRIR, de descendre au bloc « Informations »
 * et d'y trouver une liste déroulante : trois gestes et un aller-retour par image —
 * soit trente-six gestes pour ranger la douzaine qu'une séance de staging produit.
 * Personne ne range à ce prix-là.
 *
 * ⚠ « Nouveau dossier… » est DANS le menu, en dernier : on découvre qu'il manque un
 * dossier au moment où l'on cherche à ranger, jamais avant.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useEcranActif } from '@/hooks/useEcranActif'
import type { LabsFolder } from '@/types/labs'
import { LABS_PILL, LABS_TRANSITION, type LabsSurfaces } from './labsTokens'

const LARGEUR = 260
const MARGE = 8
/** En dessous de quoi on déroule vers le HAUT plutôt que vers le bas. */
const PLACE_MINI = 280

interface Props {
  ls: LabsSurfaces
  /** Le rectangle du déclencheur, en coordonnées de fenêtre. */
  ancre: DOMRect
  folders: LabsFolder[]
  /** Le dossier courant — `undefined` quand la sélection en mêle plusieurs. */
  folderId?: string | null
  onChoose: (folderId: string | null) => void
  onNewFolder: () => void
  onClose: () => void
}

export function LabsFolderPicker(p: Props) {
  const { t } = useTranslation('labs')
  const { ls } = p
  const boite = useRef<HTMLDivElement | null>(null)
  // ⛔ Écran caché muet : l'Échap d'un autre onglet ne ferme pas ce menu.
  const actif = useEcranActif()

  /**
   * ⛔ PLACÉ SANS SE MESURER. Un menu qui se mesure doit d'abord se rendre, puis poser
   * son état, puis se rendre encore — deux rendus et un saut visible à chaque
   * ouverture, pour un menu qu'on rouvre à chaque production rangée. Le repli vers le
   * haut s'ancre donc par le BAS (`bottom`), qui ne demande pas de connaître la
   * hauteur ; et la hauteur restante borne la liste, qui défile déjà.
   */
  const versLeBas = window.innerHeight - p.ancre.bottom > PLACE_MINI
  const place = {
    left: Math.max(MARGE, Math.min(p.ancre.left, window.innerWidth - LARGEUR - MARGE)),
    ...(versLeBas
      ? { top: p.ancre.bottom + MARGE, maxHeight: window.innerHeight - p.ancre.bottom - 2 * MARGE }
      : { bottom: window.innerHeight - p.ancre.top + MARGE, maxHeight: p.ancre.top - 2 * MARGE }),
  }

  useEffect(() => {
    if (!actif) return
    const onDoc = (e: MouseEvent) => { if (boite.current && !boite.current.contains(e.target as Node)) p.onClose() }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); p.onClose() } }
    // Un menu ancré à un rectangle figé ment dès que la page défile : on ferme.
    const onScroll = () => p.onClose()
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [actif, p])

  return createPortal(
    <div
      ref={boite}
      role="menu"
      aria-label={t('picker.title')}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', ...place, width: LARGEUR, zIndex: 95,
        background: ls.solid, border: `1px solid ${ls.solidBorder}`, borderRadius: 'var(--crm-radius-2xl)', boxShadow: ls.solidShadow,
        padding: 'var(--crm-space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)',
        fontFamily: 'var(--crm-font), sans-serif', color: ls.ink, overflow: 'hidden',
      }}
    >
      <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: ls.soft, padding: 'var(--crm-space-2xs) var(--crm-space-md)' }}>
        {t('picker.title')}
      </div>

      <Ligne ls={ls} icone="close" libelle={t('picker.none')} on={p.folderId === null} onClick={() => p.onChoose(null)} />

      <div className="scrollbar-hide" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)', minHeight: 0, overflowY: 'auto' }}>
        {p.folders.length === 0 && (
          <div style={{ padding: 'var(--crm-space-sm) var(--crm-space-md)', fontSize: 'var(--crm-text-sm)', color: ls.soft }}>{t('menu.noFolder')}</div>
        )}
        {p.folders.map((f) => (
          <Ligne key={f.id} ls={ls} icone="archive" libelle={f.name} on={p.folderId === f.id} onClick={() => p.onChoose(f.id)} />
        ))}
      </div>

      <button
        type="button"
        role="menuitem"
        onClick={p.onNewFolder}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-sm)', marginTop: 'var(--crm-space-2xs)',
          height: 34, border: `1px solid ${ls.bord}`, borderRadius: LABS_PILL, background: ls.elev, color: ls.ink,
          fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'pointer', transition: LABS_TRANSITION,
        }}
      >
        <MEIcon name="plus" size={13} color={ls.ink} />
        {t('picker.newFolder')}
      </button>
    </div>,
    document.body,
  )
}

function Ligne(p: { ls: LabsSurfaces; icone: 'archive' | 'close'; libelle: string; on: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  const { ls } = p
  const ink = p.on ? ls.accentInk : ls.ink
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={p.on}
      title={p.libelle}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={p.onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', height: 34, padding: '0 var(--crm-space-md)',
        border: 0, borderRadius: 'var(--crm-radius-md)', background: p.on ? ls.accent : hov ? ls.hover : 'transparent',
        color: ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: p.on ? 600 : 500,
        cursor: 'pointer', textAlign: 'left', transition: LABS_TRANSITION,
      }}
    >
      <MEIcon name={p.icone} size={13} color={ink} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.libelle}</span>
    </button>
  )
}
