/**
 * La barre d'annulation d'un geste différé (« Je l'ai proposé », Plus tard, Écarter) : visible tant que
 * « Annuler » annule ENCORE — `MatchingFil` la retire avant la fin de la fenêtre d'écriture (§6.2).
 * « Je l'ai proposé » s'annule depuis qu'il n'envoie plus rien à l'acheteur (21.09.2026).
 *
 * ⚠ Pas de `role="status"` ici : une région vivante MONTÉE avec son texte n'est pas annoncée de façon
 * fiable. L'annonce passe par la région que `MatchingFil` garde montée en permanence.
 *
 * ⚠ EN OVERLAY, pas dans le flux : posée sous la liste/le panneau, elle poussait la barre d'actions
 * sticky de ~50 px à chaque apparition/disparition. `MatchingFil` pose `position: relative` sur sa
 * racine ; ici `position: absolute`, ancrée bas-gauche.
 */
import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { encreAccent } from './filAffichage'

export default function FilAnnulation({ sp, texte, onAnnuler }: { sp: CrmPalette; texte: string; onAnnuler: () => void }) {
  const { t } = useTranslation('matching')
  // ⛔ La barre est un OVERLAY posé SUR la liste (pas dans son flux) : « Annuler » la démonte, ce qui
  // découvre la ligne qui était dessous, exactement là où le curseur se trouve. Le second clic d'un
  // double clic, à la même position, tombe alors sur cette ligne — `detail` compte les clics du même
  // geste (2 au second) quel que soit l'élément qui les reçoit. Même garde sur les lignes (`FilListe`).
  const annuler = (e: MouseEvent<HTMLButtonElement>) => { if (e.detail > 1) return; onAnnuler() }
  return (
    <div style={{
      position: 'absolute', left: 'var(--crm-space-lg)', bottom: 'var(--crm-space-lg)', zIndex: 2, maxWidth: 360,
      display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-lg) var(--crm-space-2xl)',
      borderRadius: 'var(--crm-radius-lg)', border: `1px solid ${sp.cardBorder}`, background: sp.solidBg, boxShadow: sp.solidShadow,
    }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-sm)', color: sp.ink }}>{texte}</span>
      <button type="button" onClick={annuler} style={{
        border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)',
        fontWeight: 600, color: encreAccent(sp), padding: 'var(--crm-space-xs) var(--crm-space-sm)',
      }}>
        {t('fil.annuler')}
      </button>
    </div>
  )
}
