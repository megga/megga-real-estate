/**
 * La ligne des acquéreurs compatibles de l'écran de fin de « Nouveau bien » (lot D1, conception §7) : elle cherche,
 * compte, ou dit qu'il n'y en a pas — et « Voir qui » ouvre la fiche sur « Qui pour ce bien ? ».
 *
 * Région vivante sur le TEXTE seul : `role="status"` est atomique — posé sur le conteneur, il annonçait aussi le
 * bouton (« 3 acquéreurs compatibles Voir qui »).
 */
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { encreAccent } from '@/components/matching-fil/filAffichage'
import type { EtatAcquereurs } from './acquereurs'

export default function LigneAcquereurs({ sp, etat, onVoirQui }: { sp: CrmPalette; etat: EtatAcquereurs; onVoirQui?: () => void }) {
  const { t } = useTranslation('listings')
  const texte = etat.genre === 'trouves' ? t('nouveauBien.fini.acquereurs.trouves', { count: etat.nombre })
    : etat.genre === 'aucun' ? t('nouveauBien.fini.acquereurs.aucun')
      : etat.genre === 'erreur' ? t('nouveauBien.fini.acquereurs.erreur')
        : t('nouveauBien.fini.acquereurs.recherche')
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 'var(--crm-space-md)', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: etat.genre === 'trouves' ? sp.ink : sp.sub }}>
      <span role="status">{texte}</span>
      {etat.genre === 'trouves' && onVoirQui && (
        <button type="button" onClick={onVoirQui}
          style={{ border: 0, background: 'transparent', padding: 0, fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: encreAccent(sp), cursor: 'pointer' }}>
          {t('nouveauBien.fini.acquereurs.voir')}
        </button>
      )}
    </div>
  )
}
