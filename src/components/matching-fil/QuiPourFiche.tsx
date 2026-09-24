/**
 * « Qui pour ce bien ? » sur une fiche (lot D1, conception §7) : la lecture CIBLÉE des matchs du bien
 * (`useQuiPourCeBien`), ses états de lecture, et les listes partagées avec le fil (`QuiPourCeBien`). « Ouvrir » mène à la
 * place du match dans le fil (`lienPlace`) ; la fiche fait la navigation.
 *
 * ⚠ Une ligne sans place ne mène nulle part (conception §6, la règle de « Sa boucle ») : un match REPORTÉ est hors de
 * l'ordre du fil, et un compatible À PROPOSER sur une annonce RETIRÉE n'est dans aucune ligne « Marché » — le fil écarte
 * les annonces retirées (`ml.status is distinct from 'removed'`). « Ouvrir » mènerait alors à une ligne où ce bien n'est
 * pas. Un bien proposé ou intéressé garde sa place : « Retours de … » et « À conclure » ne filtrent pas l'annonce.
 */
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { useQuiPourCeBien } from '@/hooks/useQuiPourCeBien'
import { lienPlace } from './filLiens'
import { etatCompatible } from './filQuiPour'
import { FilBouton } from './filAtomes'
import QuiPourCeBien from './QuiPourCeBien'

interface Props {
  sp: CrmPalette
  genre: 'mandat' | 'annonce'
  /** `null` : pas de bien réel (banc de démonstration) — rien n'est lu. */
  bienId: string | null
  location: boolean
  /** Montrer les anciens prospects : un mandat ACTIF seulement (`QuiPourCeBien`) — une annonce n'en a jamais. */
  avecAnciens: boolean
  /** L'annonce du marché est retirée (`removed`) : un compatible à proposer n'a plus de place dans le fil. */
  retiree?: boolean
  /** Les acheteurs à ne pas lister : déjà en deal sur ce bien, la fiche les montre ailleurs. */
  exclure?: ReadonlySet<string>
  onOuvrirFil: (requete: string) => void
  onVoirContact: (contactId: string) => void
}

export default function QuiPourFiche({
  sp, genre, bienId, location, avecAnciens, retiree = false, exclure, onOuvrirFil, onVoirContact,
}: Props) {
  const { t } = useTranslation('matching')
  const q = useQuiPourCeBien(bienId ? { genre, id: bienId } : null)
  const aide = { margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub } as const
  const compatibles = exclure ? q.compatibles.filter((m) => !exclure.has(m.acheteur.id)) : q.compatibles
  // ⚠ L'erreur ne se dit que SANS données : un rafraîchissement en échec garde la liste déjà lue (`aDesDonnees`), et la
  // remplacer par un message ferait disparaître des acquéreurs bien réels le temps d'un réveil de portable.
  const corps = q.isLoading ? <p role="status" style={aide}>{t('fil.quiPour.chargementCompatibles')}</p>
    : q.isError && !q.aDesDonnees ? (
      <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', flexWrap: 'wrap' }}>
        <p style={aide}>{t('fil.quiPour.erreurCompatibles')}</p>
        <FilBouton sp={sp} compact onClick={() => { void q.refetch() }}>{t('fil.reessayer')}</FilBouton>
      </div>
    ) : (
      <QuiPourCeBien sp={sp} bien={{ genre, id: bienId ?? '', location }} compatibles={compatibles} maintenant={q.chargeLe}
        ouvrir={(m) => {
          const statut = m.suivi?.statut ?? 'suggested'
          if (retiree && statut === 'suggested') return null
          // Le report se juge par la règle même qui écrit « Reporté jusqu'au … » : libellé et absence d'« Ouvrir »
          // ne peuvent pas se contredire.
          const reporte = etatCompatible(m, q.chargeLe).cle === 'reporte'
          const requete = lienPlace({ id: m.id, statut, contactId: m.acheteur.id, marche: genre === 'annonce', reporte })
          return requete ? () => onOuvrirFil(requete) : null
        }}
        onVoirContact={onVoirContact} delaiProspects={0} avecAnciens={avecAnciens} />
    )
  // `position: relative` : les libellés `sr-only` des boutons sont en `position: absolute`. Sans ancêtre positionné
  // DANS le conteneur qui défile, leur bloc conteneur était le cadre de la fiche d'un mandat (`overflow: hidden`) :
  // ils échappaient au rognage de sa colonne et lui prêtaient un débordement fantôme (1 024 px au banc) — que
  // `scrollIntoView` (`?qui=1`) faisait défiler, en cachant l'en-tête de la fiche.
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4xl)' }}>
      {/* Retirée, ses acquéreurs à proposer perdent « Ouvrir » : la ligne dit pourquoi, sinon l'absence du geste se
          lirait comme une panne. */}
      {retiree && <p style={aide}>{t('fil.quiPour.retiree')}</p>}
      {corps}
    </div>
  )
}
