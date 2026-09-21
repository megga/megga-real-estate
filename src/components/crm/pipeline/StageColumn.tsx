/**
 * MEGGA CRM — Pipeline v2 « Sugar Pure » : colonne kanban.
 * Port 1:1 du handoff crm-screen-pipeline-sugar.jsx §StageColumn.
 * Fond pastel teinté par étape (crmStageTint), aucune bordure ; en-tête pastille
 * vive + compteur teinté + bouton « + » (création inline) ; somme CHF X.XXM ;
 * zone vide pointillée qui devient cible de drop.
 */

import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { crmStageTint, type CrmPalette, type StageId, crmVoileEncre } from '../tokens'
import type { CrmDeal } from '../mockData'
import { DealCard, type DealCardActions } from './DealCard'

interface StageColumnProps extends DealCardActions {
  stage: StageId
  deals: CrmDeal[]
  sp: CrmPalette
  dark: boolean
  /**
   * La première colonne de l'entonnoir — elle seule n'a PAS de filet à gauche.
   *
   * ⚠ L'index vient du parent, pas d'un `:first-child` : les styles sont en
   * ligne. Et sans lui, la colonne 1 dessinerait un filet à un pixel de la
   * bordure du cadre, donc un double trait à l'entrée de l'entonnoir.
   */
  premiere?: boolean
  onOpenDeal: (id: string) => void
  draggingId: string | null
  signingId?: string | null
  signExit?: boolean
  dragOver: boolean
  onDragOver: () => void
  onDrop: () => void
  onDragLeave: () => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  /** Ouvre la carte fantôme de création inline dans cette colonne (bouton « + »).
   *  null = pas de bouton (ex. création inline désactivée). */
  onInlineOpen?: (() => void) | null
  /** Carte fantôme CrmInlineNewDeal rendue en tête de pile quand ouverte. */
  inlineForm?: ReactNode
}

export function StageColumn({
  stage, deals, sp, dark, premiere, onOpenDeal,
  draggingId, signingId, signExit,
  dragOver, onDragOver, onDrop, onDragLeave, onDragStart, onDragEnd,
  onInlineOpen, inlineForm,
  onReassign, onArchive, onMarkLost, onScheduleVisit, onAskAiVisit,
}: StageColumnProps) {
  const { t } = useTranslation('pipeline')
  const label = t(`stages.${stage}`)
  const stageVal = deals.reduce((x, d) => x + (d.value || 0), 0)
  const tint = crmStageTint(stage, dark)

  return (
    <div
      onDragOver={e => { e.preventDefault(); onDragOver() }}
      onDrop={e => { e.preventDefault(); onDrop() }}
      onDragLeave={onDragLeave}
      style={{
        flex: '0 0 252px',
        height: '100%', minHeight: 0,
        display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)',
        position: 'relative',
        background: tint.panel,
        /**
         * ⛔ FEUILLE CONTINUE (15 août 2026) — les colonnes ne flottent plus.
         *
         * Elles étaient huit panneaux arrondis séparés par 14 px de rainure.
         * Mises bout à bout, leurs teintes d'étape forment la PROGRESSION de
         * l'entonnoir, du bleu au brun : ce que la rainure coupait, le filet
         * laisse lire.
         *
         * ⚠ LE FILET EST UN VOILE, pas un aplat — la surface qu'il borde est
         * TEINTÉE, et une couleur opaque y ferait une tache au lieu d'une
         * séparation. Même règle que les pastilles « + » de ces mêmes colonnes,
         * que la migration Graphite avait converties en palier opaque.
         *
         * ⚠ Gain mesuré : 160 px d'entonnoir visible en plus à largeur égale
         * (68 px de marge du cadre + 92 px de rainures), soit une demi-colonne.
         * Ce n'est PAS un gain de surface — le board défile.
         */
        borderRadius: 0,
        /**
         * ⛔ LE BALAYAGE DE L'ENTONNOIR, RENDU À LA GRAMMAIRE LIGNÉE (20.09.2026).
         *
         * Les panneaux teintés formaient, mis bout à bout, la PROGRESSION du
         * funnel — indigo → orange. En retirant leur fond, ce balayage est tombé
         * à huit pastilles de 9 px : l'étape restait LUE, elle n'était plus
         * BALAYÉE. Or `CRM_STAGE_HUE` ENCODE une information (cf. CLAUDE.md §3),
         * et un canal d'information réduit à un point de 9 px dans un kanban
         * qu'on scrute des heures est un recul.
         *
         * Il revient sous la forme que la grammaire autorise : un FILET. Les
         * colonnes étant bout à bout (`borderRadius: 0`, pas de rainure), ces
         * traits se touchent et reconstituent le dégradé continu en haut du
         * board — exactement ce que faisaient les fonds, en une ligne.
         *
         * ⚠ UN BALAYAGE A BESOIN DE CONTIGUÏTÉ. C'est pourquoi ce n'est pas le
         * libellé qui est teinté : huit mots colorés séparés par des colonnes ne
         * forment pas un dégradé que l'œil suit. Ne pas « simplifier » en
         * déplaçant la teinte sur le texte.
         *
         * ⚠ NE PAS LE REMPLIR JUSQU'À L'ÉTAPE COURANTE. `CLAUDE.md` §3 décrit
         * déjà une barre segmentée de 8 segments pour la fiche deal, qui dit
         * « CE deal est à l'étape N ». Ici chaque trait est ENTIÈREMENT teint et
         * attaché à SA colonne : un marqueur de colonne, pas une jauge de
         * progression. Les deux formes se ressembleraient au premier coup d'œil
         * et ne disent pas la même chose.
         *
         * Mesuré sur le canvas `#16181c`, seuil non-texte 3:1 : le pire cas est
         * l'indigo de « Nouveau lead » à 3,97:1. Les huit passent.
         */
        borderTop: `2px solid ${tint.hue}`,
        /**
         * ⚠ EN SOMBRE LE SÉPARATEUR PORTE SEUL (grammaire lignée, 20.09.2026) :
         * le panneau étant « limite transparent », cette ligne n'accompagne plus
         * une différence de fond, elle EST la différence. Mesuré sur le canvas
         * `#16181c` : le voile à 0,10 rend ΔL* 11,15 quand le filet du jeton en
         * vaut 16,45 — la colonne serait moins découpée que la carte qu'elle
         * contient. À 0,14 il rend 15,36, au niveau du jeton.
         * Le mode clair garde 0,10 : ses colonnes sont toujours remplies.
         */
        borderLeft: premiere ? 'none' : `1px solid ${crmVoileEncre(dark, dark ? 0.09 : 0.10)}`,
        padding: 'var(--crm-space-2xl) var(--crm-space-xl) var(--crm-space-xl)',
        boxSizing: 'border-box',
        boxShadow: dragOver && draggingId ? `0 0 0 2px ${tint.hue} inset` : 'none',
        transition: 'box-shadow .15s, transform .15s',
      }}>
      {/* En-tête — pastille teintée vive + libellé + compteur + « + » */}
      <div style={{ padding: '0 var(--crm-space-xs)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', minWidth: 0 }}>
          <span style={{ width: 9, height: 9, borderRadius: 'var(--crm-radius-pill)', background: tint.hue, flexShrink: 0 }} />
          <span style={{
            fontSize: 'var(--crm-text-lg)', fontWeight: 600, letterSpacing: -0.2, color: sp.ink,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{label}</span>
          <span style={{
            marginLeft: 'auto', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tint.tintInk,
            fontVariantNumeric: 'tabular-nums', flexShrink: 0,
          }}>{deals.length}</span>
          {onInlineOpen && (
            <button onClick={onInlineOpen} title={t('board.card.newDealInColumn', { stage: label })} style={{
              width: 22, height: 22, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', flexShrink: 0,
              background: crmVoileEncre(dark, dark ? 0.08 : 0.06),
              display: 'grid', placeItems: 'center', fontFamily: 'inherit', padding: 0,
            }}>
              <MEIcon name="plus" size={10} color={sp.ink} />
            </button>
          )}
        </div>
        <div style={{
          // ⛔ Le total est posé sur le VOILE de l'étape, pas sur la carte : il
          // prend donc l'encre du panneau (`tintInk`, celle du compteur juste
          // au-dessus), pas l'encre secondaire générique. Mesuré : `sp.sub`
          // plafonne à 4,39:1 sur l'indigo et 4,49:1 sur le bleu — les deux
          // teintes les plus froides — quand `tintInk` tient 5,22:1 au pire des
          // huit, dans les DEUX thèmes. Ce n'étaient pas deux colonnes
          // malchanceuses : la famille entière tenait dans 0,4 du plancher.
          paddingLeft: 'var(--crm-space-3xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tint.tintInk,
          fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {stageVal > 0 ? `CHF ${(stageVal / 1e6).toFixed(2)}M` : ''}
        </div>
      </div>

      {/* Cartes — scroll vertical interne */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)', margin: '0 -4px', padding: 'var(--crm-space-2xs) var(--crm-space-xs)',
      }}>
        {inlineForm}
        {deals.length === 0 && !inlineForm && (
          <div style={{
            padding: '32px 12px', textAlign: 'center', fontSize: 'var(--crm-text-sm)', fontWeight: 600,
            color: dragOver && draggingId ? tint.tintInk : sp.sub,
            border: `1.5px dashed ${dragOver && draggingId ? tint.hue : crmVoileEncre(dark, dark ? 0.18 : 0.14)}`,
            // Zone de drop : en sombre le voile blanc à .35 fabriquerait une
            // surface hors échelle — elle prend le palier « card ».
            borderRadius: 'var(--crm-radius-2xl)', background: dragOver && draggingId ? 'rgba(255,255,255,.35)' : 'transparent',
            transition: 'all .15s',
          }}>{dragOver && draggingId
            ? t('board.dropToStage', { stage: label })
            : t('board.dragDealHere')}</div>
        )}
        {deals.map(d => (
          <DealCard
            key={d.id} deal={d} sp={sp} dark={dark}
            signing={signingId === d.id} signExit={!!signExit && signingId === d.id}
            onClick={() => onOpenDeal(d.id)}
            isDragging={draggingId === d.id}
            onDragStart={() => onDragStart(d.id)}
            onDragEnd={onDragEnd}
            onReassign={onReassign} onArchive={onArchive} onMarkLost={onMarkLost}
            onScheduleVisit={onScheduleVisit} onAskAiVisit={onAskAiVisit}
          />
        ))}
      </div>
    </div>
  )
}
