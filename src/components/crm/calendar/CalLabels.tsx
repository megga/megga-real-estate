/**
 * Libellés du Calendrier (13.09.2026) — la section du rail et le menu d'un
 * événement. Retour de Julien : « fais comme les mails ».
 *
 * ⚠ LE CRÉATEUR ET LE MENU DU RAIL SONT CEUX DE LA MESSAGERIE (`MailLabelCreator`,
 * `MailLabelMenu`), importés tels quels, peints avec les surfaces de la Messagerie
 * (`mailSurfaces`, elles-mêmes dérivées de la palette MEGGA X du CRM). Un même
 * concept, un même geste : deux créateurs de libellé finiraient par diverger —
 * six pastilles ici, sept là, une teinte libre d'un seul côté.
 *
 * Rail : un clic MASQUE ou montre les événements du libellé, comme les types
 * juste au-dessus (le rail du Calendrier est une liste de filtres, pas de
 * dossiers). Clic droit : Renommer · Changer la couleur · Supprimer.
 *
 * Événement : clic droit → la liste des libellés ; recliquer le libellé courant
 * le retire (exclusif, un par événement — comme un fil de la Messagerie).
 */
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { MailLabelCreator } from '@/components/crm/messagerie/MailLabelCreator'
import { MAIL_TRANSITION, type MailSurfaces } from '@/components/crm/messagerie/mailTokens'
import type { CalendarLabel } from '@/hooks/useCalendarLabels'
import { useFermetureMenu } from '@/hooks/useFermetureMenu'
import { CalIcon } from './CalIcon'
import { useCalPalette } from './data'

/** Le créateur de la Messagerie attend un `MailLabel` : même forme, sans le drapeau « par défaut ». */
const pourCreateur = (l: CalendarLabel) => ({ ...l, is_default: false })

// ─── Section du rail ────────────────────────────────────────────────────────
interface SectionProps {
  ms: MailSurfaces
  labels: CalendarLabel[]
  /** Événements portant chaque libellé, dans la fenêtre affichée. */
  counts: Map<string, number>
  /** `false` = libellé masqué. */
  shown: Record<string, boolean>
  onToggle: (id: string) => void
  creatorOpen: boolean
  editLabel: CalendarLabel | null
  onOpenCreator: () => void
  onCloseCreator: () => void
  onSaveLabel: (v: { name: string; color: string }) => void
  busy: boolean
  onLabelContext: (e: React.MouseEvent, id: string) => void
  /** Première lecture en cours : ni liste ni invitation — une invitation à créer serait fausse. */
  isLoading: boolean
  /**
   * Lecture en échec (migration absente, réseau) : on le DIT, et « + » disparaît.
   * ⛔ Sans ça, une panne se lisait « Aucun libellé. Créez-en un avec + », et la
   * création échouait ensuite sans un mot.
   */
  unavailable: boolean
}

/** « Libellés » du rail : titre et « + », créateur en ligne, une ligne par libellé. */
export function CalLabelSection(p: SectionProps) {
  const SP = useCalPalette()
  const { t } = useTranslation('calendar')
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--crm-space-sm)', paddingLeft: 'var(--crm-space-xs)' }}>
        <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: SP.muted }}>{t('labels.title')}</span>
        {!p.unavailable && <button
          type="button"
          onClick={p.onOpenCreator}
          title={t('labels.new')}
          aria-label={t('labels.new')}
          style={{ width: 22, height: 22, borderRadius: 'var(--crm-radius-pill)', border: 0, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
          onMouseEnter={e => { e.currentTarget.style.background = SP.cardSubtle }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <CalIcon name="plus" size={13} stroke={SP.inkSoft} sw={2.2} />
        </button>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
        {p.creatorOpen && !p.editLabel && (
          <MailLabelCreator ms={p.ms} onCancel={p.onCloseCreator} onSave={p.onSaveLabel} busy={p.busy} />
        )}
        {p.labels.map(l => {
          // Renommer ou recolorer REMPLACE la ligne par le créateur, comme dans la Messagerie.
          if (p.creatorOpen && p.editLabel?.id === l.id) {
            return <MailLabelCreator key={l.id} ms={p.ms} initial={pourCreateur(l)} onCancel={p.onCloseCreator} onSave={p.onSaveLabel} busy={p.busy} />
          }
          const visible = p.shown[l.id] !== false
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => p.onToggle(l.id)}
              onContextMenu={e => { e.preventDefault(); p.onLabelContext(e, l.id) }}
              aria-pressed={visible}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-md) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-md)', border: 0,
                background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = SP.cardSubtle }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              {/* Même carré que les types : plein = montré, creux = masqué. */}
              <span style={{
                width: 13, height: 13, borderRadius: 'var(--crm-radius-xs)', flexShrink: 0,
                background: visible ? l.color : 'transparent',
                boxShadow: visible ? 'none' : `inset 0 0 0 1.5px ${l.color}`,
              }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: visible ? SP.ink : SP.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</span>
              <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: SP.muted, fontVariantNumeric: 'tabular-nums' }}>{p.counts.get(l.id) ?? 0}</span>
            </button>
          )
        })}
        {(p.unavailable || (p.labels.length === 0 && !p.creatorOpen && !p.isLoading)) && (
          <div style={{ fontSize: 'var(--crm-text-sm)', color: SP.muted, padding: 'var(--crm-space-xs) var(--crm-space-lg)', lineHeight: 1.4 }}>
            {p.unavailable ? t('labels.unavailable') : t('labels.empty')}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Menu d'un événement ────────────────────────────────────────────────────
interface MenuProps {
  ms: MailSurfaces
  x: number
  y: number
  labels: CalendarLabel[]
  currentId: string | null
  /** `null` retire le libellé. */
  onPick: (id: string | null) => void
  /** Aucun libellé encore : ouvre le créateur du rail. */
  onCreate: () => void
  onClose: () => void
}

/** Hauteur d'une ligne du menu — sert au report quand il toucherait le bas de la fenêtre. */
const H_LIGNE = 34
/** Largeur FIXE : un nom long s'ellipse au lieu d'élargir le menu hors de l'écran. */
const LARGEUR = 220
/** Marge gardée entre le menu et les bords de la fenêtre. */
const BORD = 8

/**
 * Le menu du clic droit sur un événement.
 *
 * ⚠ z-index 4100 : il s'ouvre aussi DEPUIS la bulle de l'événement, qui est à
 * 4000 — sous elle, il serait invisible. Porté dans `document.body` et placé au
 * curseur, comme le menu des libellés de la Messagerie. Un VOILE à 4099 reçoit le
 * clic qui le ferme : sans lui, ce clic créait un événement sur le créneau vide
 * dessous, ou ouvrait la bulle d'un autre bloc — et le menu, resté ouvert sur le
 * premier, libellait alors le mauvais événement.
 *
 * Clavier : le focus entre sur le libellé courant (ou le premier), ↑ ↓ Début Fin
 * s'y déplacent, Entrée choisit, Échap ferme — et le focus revient d'où il venait.
 */
export function CalEventLabelMenu({ ms, x, y, labels, currentId, onPick, onCreate, onClose }: MenuProps) {
  const { t } = useTranslation('calendar')
  const ref = useRef<HTMLDivElement>(null)
  // Clic dehors et Échap ; armé au tick suivant — voir `useFermetureMenu`.
  useFermetureMenu(ref, onClose)

  // Le focus entre dans le menu à l'ouverture, et revient à son point de départ
  // (le bloc, ou la ligne « Libellé » de la bulle) à la fermeture.
  useEffect(() => {
    const avant = document.activeElement as HTMLElement | null
    const cible = ref.current?.querySelector<HTMLElement>('[aria-checked="true"]') ?? ref.current?.querySelector<HTMLElement>('[role^="menuitem"]')
    cible?.focus()
    return () => { if (avant && document.contains(avant)) avant.focus() }
  }, [])

  const clavier = (e: React.KeyboardEvent) => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])]
    if (!items.length) return
    const i = items.indexOf(document.activeElement as HTMLElement)
    const aller = (j: number) => { e.preventDefault(); items[(j + items.length) % items.length]!.focus() }
    if (e.key === 'ArrowDown') aller(i + 1)
    else if (e.key === 'ArrowUp') aller(i - 1)
    else if (e.key === 'Home') aller(0)
    else if (e.key === 'End') aller(items.length - 1)
  }

  const lignes = Math.max(1, labels.length) + (currentId ? 1 : 0) + 1
  const hauteur = Math.min(lignes * H_LIGNE + 16, window.innerHeight - 2 * BORD)
  const item = (key: string, contenu: React.ReactNode, fn: () => void, opts: { radio?: boolean; coche?: boolean } = {}) => (
    <button
      key={key}
      type="button"
      role={opts.radio ? 'menuitemradio' : 'menuitem'}
      aria-checked={opts.radio ? !!opts.coche : undefined}
      onClick={() => { fn(); onClose() }}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', width: '100%', minWidth: 0, textAlign: 'left',
        padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', background: 'transparent', border: 'none',
        color: ms.ink, fontSize: 'var(--crm-text-sm)', cursor: 'pointer', fontFamily: 'inherit', transition: MAIL_TRANSITION,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = ms.hover }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      onFocus={e => { e.currentTarget.style.background = ms.hover }}
      onBlur={e => { e.currentTarget.style.background = 'transparent' }}
    >
      {contenu}
      <span style={{ marginLeft: 'auto', display: 'grid', placeItems: 'center', width: 14, flexShrink: 0 }}>
        {opts.coche && <CalIcon name="check" size={13} stroke={ms.ink} sw={2.6} />}
      </span>
    </button>
  )

  return createPortal(
    <>
      <div onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 4099 }} />
      <div
        ref={ref}
        role="menu"
        aria-label={t('labels.menuTitle')}
        onKeyDown={clavier}
        style={{
          position: 'fixed',
          left: Math.max(BORD, Math.min(x, window.innerWidth - LARGEUR - BORD)),
          top: Math.max(BORD, Math.min(y, window.innerHeight - hauteur - BORD)),
          zIndex: 4100, width: LARGEUR, maxHeight: window.innerHeight - 2 * BORD, overflowY: 'auto', boxSizing: 'border-box',
          background: ms.solid, border: `1px solid ${ms.solidBorder}`,
          borderRadius: 'var(--crm-radius-xl)', boxShadow: ms.solidShadow, padding: 'var(--crm-space-2xs)',
          fontFamily: 'var(--crm-font)',
        }}
      >
        <div style={{ padding: 'var(--crm-space-sm) var(--crm-space-lg) var(--crm-space-2xs)', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: ms.mut }}>
          {t('labels.menuTitle')}
        </div>
        {labels.length === 0
          ? item('creer', <><CalIcon name="plus" size={12} stroke={ms.ink} sw={2.4} /><span>{t('labels.create')}</span></>, onCreate)
          : labels.map(l => item(
            l.id,
            <>
              <span style={{ width: 10, height: 10, borderRadius: 'var(--crm-radius-pill)', background: l.color, flexShrink: 0 }} />
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
            </>,
            () => onPick(currentId === l.id ? null : l.id),
            { radio: true, coche: currentId === l.id },
          ))}
        {currentId && item('aucun', <span style={{ color: ms.mut }}>{t('labels.none')}</span>, () => onPick(null))}
      </div>
    </>,
    document.body,
  )
}
