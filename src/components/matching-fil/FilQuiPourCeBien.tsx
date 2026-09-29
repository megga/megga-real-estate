/**
 * « Qui pour ce bien ? » (lot C, conception de la boucle §4.2) — le panneau de l'en-tête d'un bien en mandat, dans le
 * fil : l'en-tête du bien (vignette, prix, signal, « Voir le bien »), puis les deux listes partagées avec les fiches
 * (`QuiPourCeBien`, lot D1) — les acquéreurs compatibles, qu'on ouvre en un clic s'ils sont une ligne du fil, et les
 * anciens prospects. Les prescripteurs attendent le modèle relationnel (étape 6) : pas de section vide.
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
import { encreAccent, MARGE_POINTS, prixBien, texteSignalBien } from './filAffichage'
import { signalBien } from './filSignaux'
import { FilVignette } from './filAtomes'
import QuiPourCeBien from './QuiPourCeBien'

/** Le temps qu'un en-tête reste choisi avant qu'on note ses anciens prospects : au-delà, on s'y arrête. */
const DELAI_PROSPECTS = 400

interface Props {
  sp: CrmPalette
  bien: FilBien
  /** Ses matchs connus du fil : à proposer, reportés, et ceux de la boucle. */
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
  const lien: CSSProperties = {
    border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
    marginTop: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: encreAccent(sp),
  }
  return (
    <section aria-label={t('fil.quiPour.titreAria', { titre: bien.titre })} style={{
      display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4xl)',
      padding: `var(--crm-space-6xl) ${MARGE_POINTS} var(--crm-space-6xl) var(--crm-space-6xl)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-2xl)' }}>
        <FilVignette sp={sp} photo={bien.photo} largeur={96} hauteur={72} />
        <div style={{ minWidth: 0 }}>
          <span style={{
            display: 'inline-block', padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)',
            border: `1px solid ${sp.cardBorder}`, fontSize: 'var(--crm-text-xs)', color: sp.sub,
          }}>
            {t('fil.quiPour.titre')}
          </span>
          <h2 style={{ margin: 0, marginTop: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: sp.ink }}>{bien.titre}</h2>
          <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', color: sp.sub }}>
            {[prixBien(bien, t), bien.adresse, bien.ville].filter(Boolean).join(' · ')}
          </p>
          {signal && (
            <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink }}>
              {texteSignalBien(signal, bien, t)}
            </p>
          )}
          <button type="button" onClick={onVoirBien} style={lien}>{t('fil.voirBien')}</button>
        </div>
      </div>

      <QuiPourCeBien sp={sp} bien={{ genre: 'mandat', id: bien.id, location: bien.location }} compatibles={compatibles}
        maintenant={maintenant} ouvrir={(m) => (peutOuvrir(m.id) ? () => onChoisir(m.id) : null)}
        onVoirContact={onVoirContact} delaiProspects={DELAI_PROSPECTS} avecAnciens />
    </section>
  )
}
