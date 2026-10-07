/**
 * La barre d'annulation d'un geste différé (« Je l'ai proposé », Plus tard, Écarter, Intéressé, Pas
 * intéressé) : visible tant que « Annuler » annule ENCORE — `MatchingFil` la retire avant la fin de la
 * fenêtre d'écriture (§6.2). « Je l'ai proposé » s'annule depuis qu'il n'envoie plus rien à l'acheteur
 * (21.09.2026). Elle peut offrir un second geste (« Planifier la visite » après « Intéressé », lot B), qui
 * fait partir l'écriture tout de suite.
 *
 * ⚠ Ce second geste porte sa TOUCHE écrite dessus, quand les boutons du fil la portent en infobulle depuis le fil
 * épuré (07.10.2026) : la barre est un overlay en fin de DOM, qu'on n'atteint au clavier qu'en traversant tout le
 * panneau. C'est `MatchingFil` qui l'écoute, et sa région vivante l'annonce avec le geste.
 *
 * ⚠ Pas de `role="status"` ici : une région vivante MONTÉE avec son texte n'est pas annoncée de façon
 * fiable. L'annonce passe par la région que `MatchingFil` garde montée en permanence.
 *
 * ⚠ EN OVERLAY, pas dans le flux : posée sous la liste/le panneau, elle poussait la barre d'actions
 * sticky de ~50 px à chaque apparition/disparition. `MatchingFil` pose `position: relative` sur sa
 * racine ; ici `position: absolute`, ancrée bas-gauche.
 *
 * ⛔ La barre est posée SUR la liste : un de ses boutons la démonte et découvre la ligne qui était dessous,
 * exactement sous le curseur. D'où la garde anti-double-clic du fil (`unSeulClic`) sur ses deux boutons.
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { encreAccent, unSeulClic } from './filAffichage'

export default function FilAnnulation({ sp, texte, action, onAnnuler }: {
  sp: CrmPalette; texte: string; action?: { libelle: string; touche: string; faire: () => void }; onAnnuler: () => void
}) {
  const { t } = useTranslation('matching')
  const bouton: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)',
    border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)',
    fontWeight: 600, color: encreAccent(sp), padding: 'var(--crm-space-xs) var(--crm-space-sm)', flex: 'none',
  }
  return (
    <div style={{
      position: 'absolute', left: 'var(--crm-space-lg)', bottom: 'var(--crm-space-lg)', zIndex: 2, maxWidth: 460,
      display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-lg) var(--crm-space-2xl)',
      borderRadius: 'var(--crm-radius-lg)', border: `1px solid ${sp.cardBorder}`, background: sp.solidBg, boxShadow: sp.solidShadow,
    }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-sm)', color: sp.ink }}>{texte}</span>
      {action && (
        <button type="button" onClick={unSeulClic(action.faire)} aria-keyshortcuts={action.touche}
          title={t('fil.actions.raccourci', { touche: action.touche })} style={bouton}>
          {action.libelle}
          <kbd aria-hidden style={{ fontFamily: 'inherit', fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub }}>{action.touche}</kbd>
        </button>
      )}
      <button type="button" onClick={unSeulClic(onAnnuler)} style={bouton}>{t('fil.annuler')}</button>
    </div>
  )
}
