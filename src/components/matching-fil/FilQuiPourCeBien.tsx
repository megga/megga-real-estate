/**
 * « Qui pour ce bien ? » (lot C, conception de la boucle §4.2) — le panneau de l'en-tête d'un bien en mandat, dans le
 * fil : l'en-tête du bien (vignette, titre en lien, prix, la pastille « Nouveau » d'un mandat neuf — le fil épuré,
 * 07.10.2026), puis les deux listes partagées avec les fiches (`QuiPourCeBien`, lot D1) — les acquéreurs compatibles,
 * qu'on ouvre en un clic s'ils sont une ligne du fil, et les anciens prospects. Les prescripteurs attendent le modèle
 * relationnel (étape 6) : pas de section vide.
 *
 * ⚠ Il ne s'ouvre que sur un mandat EN VENTE (lot E1) : un mandat qui ne l'est plus n'a plus d'en-tête dans « À
 * proposer » (`horsVente`). D'où les anciens prospects demandés d'office (`avecAnciens`) : le moteur ne les note que
 * pour un mandat actif.
 *
 * ⚠ Les anciens prospects ne se demandent au moteur qu'après `DELAI_PROSPECTS` sur l'en-tête : parcourir le fil aux
 * flèches passe sur chaque en-tête, et chaque passage relirait les recherches closes de l'agence. Le panneau est remonté
 * à chaque ligne (`key` du conteneur, `MatchingFil`) : quitter l'en-tête avant le délai n'appelle rien.
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import type { FilBien, FilMatch } from './filModele'
import { MARGE_POINTS, prixBien, texteSignalBien } from './filAffichage'
import { signalBien } from './filSignaux'
import { FilNouveau, FilVignette } from './filAtomes'
import QuiPourCeBien from './QuiPourCeBien'

/** Le temps qu'un en-tête reste choisi avant qu'on note ses anciens prospects : au-delà, on s'y arrête. */
const DELAI_PROSPECTS = 400

interface Props {
  sp: CrmPalette
  bien: FilBien
  /**
   * Ses acquéreurs compatibles connus du fil (`compatiblesDuFil`) : à proposer, reportés, revenus, proposés, intéressés,
   * en visite — pas ses refus, comme sur les fiches.
   */
  compatibles: FilMatch[]
  /** L'heure de la lecture du fil. */
  maintenant: number
  /** Le match est une ligne du fil telle qu'elle s'affiche (filtres compris) : « Ouvrir » ne mène qu'à ce qu'on voit. */
  peutOuvrir: (matchId: string) => boolean
  onChoisir: (matchId: string) => void
  onVoirBien: () => void
  onVoirContact: (contactId: string) => void
}

export default function FilQuiPourCeBien({ sp, bien, compatibles, maintenant, peutOuvrir, onChoisir, onVoirBien, onVoirContact }: Props) {
  const { t } = useTranslation('matching')
  const signal = signalBien(bien, maintenant)
  // Un mandat neuf : la pastille « Nouveau », son libellé au survol. Le fil n'ouvre ce panneau que sur un mandat, mais
  // une baisse n'y sera jamais une pastille « Nouveau » au libellé « Prix baissé de … » (règle des autres surfaces).
  const nouveau = signal && signal.genre !== 'baisse' ? texteSignalBien(signal, bien, t, true) : null
  const lien: CSSProperties = {
    border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
    fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit',
  }
  return (
    <section aria-label={t('fil.quiPour.titreAria', { titre: bien.titre })} style={{
      display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4xl)',
      padding: `var(--crm-space-6xl) ${MARGE_POINTS} var(--crm-space-6xl) var(--crm-space-6xl)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-2xl)' }}>
        <FilVignette sp={sp} photo={bien.photo} largeur={96} hauteur={72} />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: sp.ink }}>
            <button type="button" onClick={onVoirBien} style={lien}>{bien.titre}</button>
          </h2>
          <p style={{
            margin: 0, marginTop: 'var(--crm-space-2xs)', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
            fontSize: 'var(--crm-text-md)', color: sp.sub,
          }}>
            {prixBien(bien, t)}
            {nouveau && <FilNouveau sp={sp} libelle={nouveau} />}
          </p>
        </div>
      </div>

      <QuiPourCeBien sp={sp} bien={{ genre: 'mandat', id: bien.id, location: bien.location }} compatibles={compatibles}
        maintenant={maintenant} ouvrir={(m) => (peutOuvrir(m.id) ? () => onChoisir(m.id) : null)}
        onVoirContact={onVoirContact} delaiProspects={DELAI_PROSPECTS} avecAnciens />
    </section>
  )
}
