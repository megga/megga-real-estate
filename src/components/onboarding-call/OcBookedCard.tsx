/**
 * Un rendez-vous d'accueil confirmé, en carte : quand, combien de temps, avec qui, et
 * de quoi le rejoindre.
 *
 * Partagé par les TROIS surfaces qui l'affichent — l'étape 4 du wizard (via OcBooking),
 * l'écran `/dashboard/rendez-vous-accueil` (via OcBooking également) et la page publique
 * à jeton — pour qu'un dirigeant relise partout la même ligne. Le récapitulatif du
 * wizard, lui, ne le monte PAS : il relit dans sa propre grammaire de paires
 * libellé/valeur, comme les trois sections qui le précèdent.
 *
 * HABILLAGE : MEGGA X. Suppose d'être rendu dans un conteneur `<MeggaX>`.
 */
import { useTranslation } from 'react-i18next'
import { bookedWhenLabel } from './ocDates'

export interface OcBookedCardProps {
  scheduledAt: string
  hostName: string
  durationMinutes: number
  meetingUrl: string | null
  timezone: string
  /** Phrase sous le rendez-vous — l'e-mail de confirmation, la limite de replanification… */
  note?: string
  /** Action secondaire optionnelle (replanifier, annuler), rendue sous la carte. */
  children?: React.ReactNode
}

export default function OcBookedCard({
  scheduledAt, hostName, durationMinutes, meetingUrl, timezone, note, children,
}: OcBookedCardProps) {
  const { t } = useTranslation('onboarding')

  return (
    <div className="card">
      <div className="pd---content-inside-card">
        <h2 className="display-3 semi-bold">{t('call.confirmed.title')}</h2>
        {/* `capitalize` : `Intl` rend « lundi 11 août » en minuscule. Jamais d'UPPERCASE
            (règle §3 du CLAUDE.md) — la capitale initiale suffit. */}
        <p className="paragraph-large text-paragraph capitalize mg-top-4x-extra-small">
          {bookedWhenLabel(scheduledAt, timezone)}
        </p>
        <p className="paragraph-small text-color-neutral-600">
          {t('call.confirmed.details', { duration: durationMinutes, host: hostName })}
        </p>

        {meetingUrl && (
          <div className="mg-top-small">
            {/* `<a class="primary-button">` et non MxButton : c'est une navigation vers
                un autre domaine (le service de visioconférence) et elle doit se
                comporter comme telle — ouvrable dans un nouvel onglet, copiable,
                annoncée comme un lien. C'est aussi le markup de la vitrine, dont tous
                les boutons sont des `<a>` (Webflow) ; `.primary-button` est un sélecteur
                de classe nu, il s'applique donc à l'ancre sans un caractère de CSS en
                plus. Rendre MxButton polymorphe pour ce seul cas alourdirait un atome
                dont le contrat est d'être une transcription fidèle. */}
            <a className="primary-button" href={meetingUrl} target="_blank" rel="noreferrer">
              {t('call.confirmed.join')}
            </a>
          </div>
        )}

        {note && (
          <p className="paragraph-small text-color-neutral-600 mg-top-small">{note}</p>
        )}

        {children && <div className="mg-top-small">{children}</div>}
      </div>
    </div>
  )
}
