/**
 * La barre de gestes de la sélection — elle REMPLACE l'en-tête de la galerie dès
 * qu'une production est cochée, et disparaît quand la sélection se vide.
 *
 * ⚠ C'est la grammaire de la Messagerie, reprise telle quelle (`megga/messagerie-selection`,
 * 15.09.2026) : « la barre de la liste devient celle des gestes ». Deux écrans du même
 * CRM ne peuvent pas avoir deux façons d'agir sur plusieurs objets — l'agent apprend
 * une fois. Ce qui change ici, c'est la liste des gestes, pas leur mise en scène.
 *
 * ⚠ Le geste « favori » se RETOURNE quand tout est déjà étoilé : un bouton qui ajoute
 * ce qui est déjà là ne fait rien de visible, et l'agent le reclique.
 *
 * ⛔ Supprimer est le seul geste qui demande confirmation, et la confirmation NOMME
 * le nombre : douze productions effacées par un clic mal placé ne se rattrapent pas
 * depuis l'écran (la corbeille est douce en base, mais aucune UI ne la rouvre).
 */
import { type MouseEvent as ReactMouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { LABS_PILL, LABS_TRANSITION, type LabsSurfaces } from './labsTokens'

interface Props {
  ls: LabsSurfaces
  count: number
  /** Le nombre de productions cochées qui portent un fichier téléchargeable. */
  telechargeables: number
  toutesFavorites: boolean
  /** Vrai quand la sélection couvre déjà toute la liste visible. */
  toutCoche: boolean
  busy: boolean
  onToutCocher: () => void
  onRanger: (ancre: DOMRect) => void
  onFavori: () => void
  onTelecharger: () => void
  onSupprimer: () => void
  onAnnuler: () => void
}

export function LabsSelectionBar(p: Props) {
  const { t } = useTranslation('labs')
  const { ls } = p

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--crm-space-md) var(--crm-space-lg)', flex: 1, minWidth: 0 }}>
      <button
        type="button"
        onClick={p.onAnnuler}
        title={t('selection.cancel')}
        aria-label={t('selection.cancel')}
        style={{
          width: 32, height: 32, flexShrink: 0, display: 'grid', placeItems: 'center', border: 0,
          borderRadius: 'var(--crm-radius-md)', background: 'transparent', color: ls.sub, cursor: 'pointer', transition: LABS_TRANSITION,
        }}
      >
        <MEIcon name="close" size={14} color={ls.sub} />
      </button>

      <span
        aria-live="polite"
        style={{
          display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 var(--crm-space-lg)', borderRadius: LABS_PILL,
          background: ls.accent, color: ls.accentInk, fontSize: 'var(--crm-text-md)', fontWeight: 600, whiteSpace: 'nowrap',
        }}
      >
        {t('selection.count', { count: p.count })}
      </span>

      <button
        type="button"
        onClick={p.onToutCocher}
        style={{
          height: 30, padding: '0 var(--crm-space-md)', border: 0, borderRadius: LABS_PILL, background: 'transparent',
          color: ls.accentText, fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600,
          cursor: 'pointer', whiteSpace: 'nowrap', transition: LABS_TRANSITION,
        }}
      >
        {p.toutCoche ? t('selection.none') : t('selection.all')}
      </button>

      <div style={{ flex: 1, minWidth: 0 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', flexWrap: 'wrap' }}>
        {/* Le rectangle vient de l'ÉVÉNEMENT, jamais d'une référence passée en props :
            `currentTarget` EST le bouton cliqué, et c'est aussi ce que fait la vignette
            pour ouvrir le même menu — un seul idiome pour un seul geste. */}
        <Geste
          ls={ls}
          icone="archive"
          libelle={t('selection.move')}
          primaire
          busy={p.busy}
          onClick={(e) => p.onRanger(e.currentTarget.getBoundingClientRect())}
        />
        <Geste ls={ls} icone="star" libelle={p.toutesFavorites ? t('selection.unfavorite') : t('selection.favorite')} busy={p.busy} onClick={p.onFavori} />
        {p.telechargeables > 0 && (
          <Geste ls={ls} icone="download" libelle={t('selection.download', { count: p.telechargeables })} busy={p.busy} onClick={p.onTelecharger} />
        )}
        <Geste ls={ls} icone="trash" libelle={t('selection.delete')} danger busy={p.busy} onClick={p.onSupprimer} />
      </div>
    </div>
  )
}

interface GesteProps {
  ls: LabsSurfaces
  icone: MEIconName
  libelle: string
  primaire?: boolean
  danger?: boolean
  busy: boolean
  onClick: (e: ReactMouseEvent<HTMLButtonElement>) => void
}

function Geste(p: GesteProps) {
  const { ls } = p
  const ink = p.primaire ? ls.accentInk : p.danger ? ls.dangerText : ls.ink
  return (
    <button
      type="button"
      onClick={p.onClick}
      disabled={p.busy}
      title={p.libelle}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 32, padding: '0 var(--crm-space-lg)',
        border: p.primaire ? 0 : `1px solid ${ls.bord}`, borderRadius: LABS_PILL,
        background: p.primaire ? ls.accent : ls.elev, color: ink,
        fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600,
        cursor: p.busy ? 'wait' : 'pointer', opacity: p.busy ? 0.6 : 1, whiteSpace: 'nowrap', transition: LABS_TRANSITION,
      }}
    >
      <MEIcon name={p.icone} size={13} color={ink} />
      {p.libelle}
    </button>
  )
}
