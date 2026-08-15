/**
 * Réservation de l'appel d'accueil — le bloc complet, partagé par les deux surfaces
 * connectées qui le portent : l'étape 4 du wizard d'identité (StepRendezVous) et
 * l'écran `/dashboard/rendez-vous-accueil` (OnboardingCallPage), qui sert désormais
 * ceux qui ont franchi le wizard avant que l'étape n'existe, le bandeau de rappel du
 * CRM, et toute reprise ultérieure.
 *
 * Deux surfaces, un seul composant, parce que c'est le MÊME geste : sans ça, les deux
 * écrans divergeraient au premier correctif porté d'un seul côté. La page publique de
 * replanification (OnboardingCallManagePage) ne le monte pas — elle n'a ni téléphone
 * ni note à demander, et son jeton la fait passer par une autre edge — mais partage
 * avec lui le calendrier (OcSlotPicker) et la carte de confirmation (OcBookedCard).
 *
 * ÉTAT ET ÉCRITURE — DEUX MODES, parce que les deux surfaces n'ont pas la même suite.
 *
 * `immediate` (écran /dashboard/rendez-vous-accueil) : la réservation est engagée AU
 * CLIC sur Confirmer — l'edge écrit la ligne, envoie les e-mails et pose l'événement
 * d'agenda d'un bloc. Il n'y a rien après cet écran, différer n'aurait pas de sens.
 *
 * `deferred` (étape 4 du wizard d'identité) : le clic ne fait que RETENIR le créneau
 * (remonté à la coquille via `onChoiceChange`) ; c'est `handleSubmit`, APRÈS le
 * récapitulatif, qui réserve. Décision client du 15.08.2026, renversant celle du
 * 04.08 : réserver à l'étape 4 générait le lien Meet et l'e-mail de confirmation
 * AVANT que le dossier soit relu et soumis — un abandon au récapitulatif laissait un
 * rendez-vous confirmé pour un dossier jamais envoyé. Contrepartie assumée : un
 * créneau seulement retenu peut être pris entre-temps ; la soumission revérifie
 * (index unique côté base) et l'écran de sortie propose alors de rechoisir, au lieu
 * d'un refus au moment le plus sensible.
 *
 * HABILLAGE : MEGGA X. Suppose d'être rendu dans un conteneur `<MeggaX>`.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MxButton, MxField, MxInput, MxLink, MxSelect } from '@/components/megga-x'
import { useAuth } from '@/hooks/useAuth'
import { useAgencyIdentity } from '@/hooks/useAgencyIdentity'
import { COUNTRY_DIAL_CODES, PHONE_EXAMPLES, countryForDialCode, dialCodeOptions, splitDialCode } from '@/lib/countries'
import OcSlotPicker from './OcSlotPicker'
import OcBookedCard from './OcBookedCard'
import { dayKeyOf } from './ocDates'
import {
  useMyOnboardingCall,
  useOnboardingSlots,
  useBookOnboardingCall,
  browserTimezone,
} from '@/hooks/useOnboardingCall'

/** Refus que l'edge function nomme, et pour lesquels l'écran a une phrase propre. */
const KNOWN_BOOK_ERRORS = ['slot_taken', 'already_booked', 'no_host_available', 'slot_in_past']

/**
 * Ce que l'appelant doit savoir de l'état de la réservation, à chaque changement.
 *
 * `booked` gate le bouton Continuer de l'étape du wizard ; `nothingToBook` dit qu'il
 * n'y a RIEN à réserver (aucun hôte actif, ou plus aucun créneau sur l'horizon) et
 * lève cette exigence — sans quoi l'étape serait un cul-de-sac, ce qu'elle serait
 * aujourd'hui même : la table `onboarding_hosts` est vide en production.
 */
export interface OcBookingState {
  booked: boolean
  nothingToBook: boolean
}

/**
 * Le créneau RETENU en mode différé — tout ce que la réservation demandera, pour que
 * `handleSubmit` puisse appeler l'edge sans remonter chercher quoi que ce soit ici.
 * `durationMinutes` vient de la réponse de l'edge (créneaux) : le récapitulatif la
 * relit sans réinventer une durée côté navigateur.
 */
export interface OcBookingChoice {
  slot: string
  durationMinutes: number
  phone?: string
  note?: string
  answers: Record<string, string>
}

export interface OcBookingProps {
  /** Remonté à chaque changement d'état — l'appelant en fait ce qu'il veut (gate, bouton). */
  onStateChange?: (state: OcBookingState) => void
  /**
   * `immediate` (défaut) réserve au clic ; `deferred` ne fait que retenir le créneau
   * et le remonte via `onChoiceChange` — cf. l'en-tête du fichier.
   */
  mode?: 'immediate' | 'deferred'
  /** Mode différé : le créneau déjà retenu, relu quand on revient sur l'étape. */
  choice?: OcBookingChoice | null
  /** Mode différé : remonte le créneau retenu à la coquille, qui en est la mémoire. */
  onChoiceChange?: (choice: OcBookingChoice | null) => void
  /**
   * Rendu SOUS le bloc quand rien n'est encore réservé : la sortie propre à chaque
   * surface (« Plus tard » sur l'écran du CRM, rien dans le wizard, où le pied
   * d'actions de la coquille porte déjà la navigation).
   */
  secondaryAction?: React.ReactNode
}

/** Bornes ISO du mois affiché — jamais de créneau déjà passé sur le mois courant. */
function monthBounds(month: Date): { from: string; to: string } {
  const from = new Date(month.getFullYear(), month.getMonth(), 1)
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 1)
  const now = new Date()
  return {
    from: (from < now ? now : from).toISOString(),
    to: to.toISOString(),
  }
}

export default function OcBooking({ onStateChange, mode = 'immediate', choice = null, onChoiceChange, secondaryAction }: OcBookingProps) {
  const { t, i18n } = useTranslation('onboarding')
  const deferred = mode === 'deferred'
  /**
   * Mode différé, un créneau déjà retenu : la carte « Créneau retenu » s'affiche tant
   * que le dirigeant ne demande pas à MODIFIER. Un état local et non une remise à
   * `null` du choix chez l'appelant : le choix reste valide (le bouton Continuer de la
   * coquille reste actif) pendant qu'on le retouche — l'annuler pour le rééditer
   * ferait clignoter le gate.
   */
  const [enModification, setEnModification] = useState(false)

  // Le fuseau du navigateur n'est qu'un POINT DE DÉPART : un dirigeant en déplacement,
  // ou qui reçoit un associé à l'étranger, doit pouvoir lire les créneaux dans le fuseau
  // qui l'intéresse. Même raison pour le format 12 h : lire « 14:00 » quand on pense en
  // am/pm fait manquer un appel.
  const [timezone, setTimezone] = useState(() => browserTimezone())
  const [hour12, setHour12] = useState(false)
  // Hydratés depuis le créneau RETENU quand il existe (mode différé, retour sur
  // l'étape) : « Modifier » doit rouvrir le formulaire tel qu'il a été laissé, pas
  // demander de tout retaper. L'étape se démonte entre deux passages, l'état local
  // seul ne survivrait pas.
  const [month, setMonth] = useState(() => (choice ? new Date(choice.slot) : new Date()))
  const [selectedDay, setSelectedDay] = useState<string | null>(() => (choice ? dayKeyOf(choice.slot, browserTimezone()) : null))
  const [selectedSlot, setSelectedSlot] = useState<string | null>(() => choice?.slot ?? null)
  /**
   * Le numéro WhatsApp, en DEUX contrôles : l'indicatif se choisit, le reste se tape.
   *
   * Un champ libre laissait arriver « 079 874 94 84 », « 0041 79… » et « +41 79… » dans
   * la même colonne — or c'est un numéro d'ENVOI, pas une note : la passerelle attend un
   * format international, et un zéro de tête suisse ne s'y traduit pas tout seul.
   *
   * Suisse par défaut, parce que c'est le marché ; la liste suit l'ordre des pays et non
   * celui des indicatifs, un dirigeant cherchant son pays par son nom.
   */
  const [paysTel, setPaysTel] = useState(() => {
    const dial = choice?.phone ? splitDialCode(choice.phone).dial : null
    return (dial ? countryForDialCode(dial) : null) ?? 'CH'
  })
  const [numeroLocal, setNumeroLocal] = useState(() => (choice?.phone ? splitDialCode(choice.phone).local : ''))
  const indicatif = `+${COUNTRY_DIAL_CODES[paysTel] ?? '41'}`
  // 195 options traduites et RETRIÉES : sans mémoïsation, la liste entière serait
  // reconstruite à chaque frappe dans les champs voisins.
  const optionsIndicatif = useMemo(() => dialCodeOptions(i18n.language), [i18n.language])
  // Ce qui part à l'edge : la concaténation, jamais les deux morceaux. Le zéro de tête
  // (079…) est retiré — il n'existe qu'en composition nationale et casserait le numéro
  // une fois l'indicatif devant.
  const phone = numeroLocal.trim() === '' ? '' : `${indicatif}${numeroLocal.replace(/\D/g, '').replace(/^0+/, '')}`
  const setPhone = (valeur: string) => {
    const { dial, local } = splitDialCode(valeur)
    const iso = dial ? countryForDialCode(dial) : null
    if (iso) setPaysTel(iso)
    setNumeroLocal(local)
  }
  const telPrerempli = useRef(choice?.phone != null)
  const [note, setNote] = useState(() => choice?.note ?? '')

  // Deux temps, comme le plan de référence : on choisit QUAND, puis on dit QUI.
  // Tout demander sur un seul écran faisait cohabiter un calendrier et sept champs,
  // et noyait le seul geste qui compte à la première seconde — prendre une date.
  const [etape, setEtape] = useState<'creneau' | 'formulaire'>(() => (choice ? 'formulaire' : 'creneau'))

  /**
   * Préremplissage du nom, à DEUX sources qui ne se valent pas.
   *
   * 1. Le SIGNATAIRE (`agency_related_persons`) quand sa pièce a été vérifiée : c'est
   *    ce nom-là, et lui seul, que le prestataire a confronté au document. Les champs
   *    sont alors VERROUILLÉS — le laisser modifiable permettrait de réserver sous un
   *    nom que rien n'atteste, deux écrans après l'avoir fait attester.
   * 2. `profile.full_name` sinon, coupé au premier espace, et modifiable. C'est un
   *    libellé de compte, pas une identité vérifiée : personne ne l'a confronté à quoi
   *    que ce soit, et un nom composé n'a pas à être deviné juste.
   *
   * ⚠ Le verrou suit le STATUT, pas l'écran. Tant que la vérification est `processing`
   * ou n'a pas abouti, les champs restent ouverts : sceller un nom sur un verdict qui
   * n'est pas rendu enfermerait le dirigeant dans une faute de frappe sans issue.
   *
   * ⚠ Ce n'est pas le nom LU par le prestataire — il n'est stocké nulle part (cf.
   * l'en-tête d'IdentityVerificationReturnScreen). C'est le nom déclaré, dont la
   * concordance avec le document a été établie.
   */
  const { profile } = useAuth()
  const { persons } = useAgencyIdentity()
  const signataireVerifie = persons.find(
    (p) => p.verificationStatus === 'verified' && p.roles.some((r) => r.role === 'signatory'),
  ) ?? null
  const identiteVerrouillee = signataireVerifie != null

  /**
   * L'e-mail est VERROUILLÉ dès qu'on en tient un : ce n'est pas une saisie, c'est
   * l'adresse du compte, confirmée à l'inscription et par laquelle le dirigeant est
   * authentifié à l'instant même. La laisser modifiable permettait d'envoyer la
   * confirmation ailleurs que là où la session existe.
   *
   * ⚠ Conditionné à la présence de l'adresse, et pas seulement au fait d'être connecté.
   * Le champ est EXIGÉ (identiteComplete) : le verrouiller vide ferait un cul-de-sac —
   * un bouton Confirmer inerte au-dessus d'un champ qu'on ne peut pas remplir.
   */
  const emailVerrouille = (profile?.email ?? '').trim() !== ''

  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  useEffect(() => {
    if (!profile) return
    const parts = (profile.full_name ?? '').trim().split(/\s+/)
    setPrenom((p) => p || parts[0] || '')
    setNom((n) => n || parts.slice(1).join(' '))
    setEmail((e) => e || profile.email || '')
    // `setPhone` n'est plus un setter d'état mais un décomposeur (indicatif + local) :
    // il ne prend pas de fonction de mise à jour, et lire `numeroLocal` ici ferait de
    // lui une dépendance de l'effet — donc un préremplissage rejoué à chaque frappe.
    // Un drapeau de passage, posé une fois : le profil ne remplit QUE le champ vierge.
    if (profile.phone && !telPrerempli.current) {
      telPrerempli.current = true
      setPhone(profile.phone)
    }
  }, [profile])

  // ÉCRASE le repli dès que le signataire vérifié est connu — `setPrenom(p => p || …)`
  // ne suffirait pas ici : le profil arrive le premier, et son libellé de compte
  // resterait en place devant le nom qui a été attesté.
  useEffect(() => {
    if (!signataireVerifie) return
    setPrenom(signataireVerifie.firstName)
    setNom(signataireVerifie.lastName)
  }, [signataireVerifie])

  // Les réponses calibrent le CRM (Focus, matching) et préparent l'appel. Stockées
  // telles quelles dans `attendee_answers` : ce sont des CHOIX, pas des mesures — les
  // interpréter ici figerait une lecture que le produit n'a pas encore arrêtée.
  const [reponses, setReponses] = useState<Record<string, string>>(() => {
    if (!choice) return {}
    // L'identité voyage dans le même objet answers (contrat de l'edge) mais a ses
    // propres champs à l'écran : la réinjecter ici doublerait chaque valeur.
    const { first_name: _prenom, last_name: _nom, email: _email, ...rest } = choice.answers
    return rest
  })
  const repondre = (cle: string, valeur: string) => setReponses((r) => ({ ...r, [cle]: valeur }))

  const bounds = useMemo(() => monthBounds(month), [month])
  const existing = useMyOnboardingCall()
  const slotsQuery = useOnboardingSlots(bounds.from, bounds.to)
  const book = useBookOnboardingCall()

  const slots = useMemo(() => slotsQuery.data?.slots ?? [], [slotsQuery.data])

  // Ouvrir sur le premier jour qui a quelque chose à proposer : demander à
  // l'utilisateur de chercher lui-même le prochain jour ouvert est du travail qu'on
  // sait faire pour lui.
  useEffect(() => {
    if (selectedDay || slots.length === 0) return
    setSelectedDay(dayKeyOf(slots[0], timezone))
  }, [slots, selectedDay, timezone])

  // Le rendez-vous qui vient d'être pris l'emporte sur celui qui a été lu au montage :
  // la lecture est mise en cache 60 s, elle peut encore répondre « aucun » juste après
  // une réservation réussie.
  const booked = book.data
    ? {
        scheduledAt: book.data.scheduled_at,
        hostName: book.data.host_name,
        meetingUrl: book.data.meeting_url,
        durationMinutes: book.data.duration_minutes,
      }
    : existing.data
      ? {
          scheduledAt: existing.data.scheduled_at,
          hostName: existing.data.host_display_name,
          meetingUrl: existing.data.meeting_url,
          durationMinutes: existing.data.duration_minutes,
        }
      : null

  const poolEmpty = slotsQuery.data?.pool_empty === true
  const nothingFree = !slotsQuery.isLoading && !poolEmpty && slots.length === 0
  const nothingToBook = poolEmpty || nothingFree

  // Remontée à l'appelant. Les deux booléens sont dérivés du rendu courant, donc
  // l'effet ne fait que les transmettre — jamais de second état parallèle à tenir.
  useEffect(() => {
    onStateChange?.({ booked: booked != null, nothingToBook })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onStateChange est une prop
    // que l'appelant recrée à chaque rendu (fonction inline) : la mettre en dépendance
    // relancerait l'effet en boucle. Seuls les deux faits transmis comptent.
  }, [booked != null, nothingToBook])

  const errorKey = book.error instanceof Error ? book.error.message : null
  const knownError = errorKey && KNOWN_BOOK_ERRORS.includes(errorKey)
    ? errorKey
    : errorKey
      ? 'generic'
      : null

  if (booked) {
    return (
      <OcBookedCard
        scheduledAt={booked.scheduledAt}
        hostName={booked.hostName}
        durationMinutes={booked.durationMinutes}
        meetingUrl={booked.meetingUrl}
        timezone={timezone}
        note={t('call.confirmed.emailSent')}
      />
    )
  }

  // Mode différé, créneau retenu : la carte tient lieu de clôture d'étape — la vraie
  // confirmation (e-mail, lien de visioconférence) n'existera qu'à la soumission du
  // dossier, et la carte le DIT pour que personne n'attende un e-mail qui n'est pas
  // parti. Aucun hôte nommé : il n'est attribué qu'à l'écriture (pickHostForSlot).
  if (deferred && choice && !enModification) {
    return (
      <div className="card">
        <div className="pd---content-inside-card text-center">
          <h2 className="display-3 semi-bold">{t('call.chosen.title')}</h2>
          <div className="mg-top-3x-extra-small">
            <p className="display-2 semi-bold capitalize">{longSlotLabel(choice.slot, timezone, hour12)}</p>
          </div>
          <div className="mg-top-3x-extra-small">
            <p className="paragraph-small text-color-neutral-600">{t('call.chosen.body')}</p>
          </div>
          <div className="mg-top-small">
            <MxButton type="button" variant="secondary" size="small" onClick={() => setEnModification(true)}>
              {t('call.chosen.change')}
            </MxButton>
          </div>
        </div>
      </div>
    )
  }

  // Les cinq questions. Déclarées ici et non en dur dans le JSX : le jour où Gregory
  // les arbitrera, c'est cette liste qu'on édite, et l'écran suit sans être retouché.
  const QUESTIONS = [
    { cle: 'portfolio', options: ['1-5', '6-20', '21-50', '50+'] },
    { cle: 'business', options: ['sale', 'rent', 'both'] },
    { cle: 'team', options: ['1', '2-5', '6-15', '15+'] },
    { cle: 'priority', options: ['mandates', 'buyers', 'admin', 'compliance'] },
  ] as const

  const identiteComplete = prenom.trim() !== '' && nom.trim() !== '' && email.trim() !== '' && phone.trim() !== ''

  /* Volet gauche — l'hôte. IDENTIQUE d'un écran à l'autre, à ceci près que le créneau
     retenu s'y ajoute au second : c'est ce qui fait que passer au formulaire ne
     ressemble pas à un changement de page mais à un pas de plus. */
  const voletHote = (
    <div className="mx-book__host">
      {/* Le monogramme, centré sur le dégradé qui habille tout le volet. Il tient la
          place que le produit de référence donne à la photo de l'hôte — nous n'en
          avons pas : l'appel est pris avec une ÉQUIPE, et le visage d'une personne
          promettrait de parler à celle-là.

          Le wordmark MEGGA qui le surmontait a été RETIRÉ : `/megga-logo.svg` est un
          tracé noir, invisible sur ce fond, et il redisait ce que « Avec l'équipe
          MEGGA » écrit deux lignes plus bas.

          `aria-hidden` : décoratif, le nom de l'équipe est juste dessous. */}
      <div className="mx-book__mark" aria-hidden="true">
        <img src="/megga-gg.svg" alt="" />
      </div>
      {/* Le surtitre « Avec l'équipe MEGGA » a été retiré le 10 août 2026 : la vignette
          juste au-dessus porte déjà la marque, et l'hôte se relit sur la carte de
          confirmation une fois le créneau pris. */}
      <div className="mg-top-small">
        <p className="display-2 semi-bold">{t('call.book.title')}</p>
      </div>
      <div className="mg-top-small">
        <div className="mx-book__fact">
          <ClockGlyph />
          <p className="paragraph-small">{t('call.book.duration', { count: 30 })}</p>
        </div>
        <div className="mx-book__fact mg-top-5x-extra-small">
          <VideoGlyph />
          <p className="paragraph-small">{t('call.book.video')}</p>
        </div>
        {etape === 'formulaire' && selectedSlot && (
          <div className="mx-book__fact mg-top-5x-extra-small">
            <CalendarGlyph />
            <p className="paragraph-small">{longSlotLabel(selectedSlot, timezone, hour12)}</p>
          </div>
        )}
      </div>
      <div className="mg-top-small">
        <p className="paragraph-small text-color-neutral-600">{t('call.book.about')}</p>
      </div>
    </div>
  )

  return (
    <div className="card">
      <div className="pd---content-inside-card">
        <div className="mx-book">
          {voletHote}

          {etape === 'creneau' ? (
            <div>
              <p className="display-2 semi-bold">{t('call.book.pickTitle')}</p>

              {/* Rien à réserver ? On le DIT, on ne ferme pas la porte. Cet état
                  remplaçait tout le calendrier par un pavé de texte : le visiteur
                  perdait la navigation par mois, donc le seul geste qui pouvait
                  encore aboutir — regarder plus loin. Un calendrier vide se lit ;
                  un écran sans calendrier ne se parcourt pas. */}
              {nothingToBook && (
                <p className="paragraph-small text-color-neutral-600 mg-top-4x-extra-small" role="status" aria-live="polite">
                  {t(poolEmpty ? 'call.empty.noHost' : 'call.empty.noSlot')}
                </p>
              )}

              <div className="mg-top-small">
                <OcSlotPicker
                  slots={slots}
                  month={month}
                  onMonthChange={(next) => { setMonth(next); setSelectedDay(null); setSelectedSlot(null) }}
                  selectedDay={selectedDay}
                  onSelectDay={(day) => { setSelectedDay(day); setSelectedSlot(null) }}
                  selectedSlot={selectedSlot}
                  onSelectSlot={setSelectedSlot}
                  timezone={timezone}
                  onTimezoneChange={setTimezone}
                  hour12={hour12}
                  onHour12Change={setHour12}
                  loading={slotsQuery.isLoading}
                  slotAction={(
                    <MxButton type="button" size="small" onClick={() => setEtape('formulaire')}>
                      {t('call.book.next')}
                    </MxButton>
                  )}
                />
              </div>
              {secondaryAction && <div className="mg-top-small">{secondaryAction}</div>}
            </div>
          ) : (
            <div>
              <MxLink onClick={() => setEtape('creneau')}>{t('call.book.back')}</MxLink>
              <p className="display-2 semi-bold mg-top-4x-extra-small">{t('call.book.formTitle')}</p>
              {/* POURQUOI on demande tout ça. Sans cette ligne, neuf champs après le choix
                  d'un créneau ressemblent à de la collecte ; avec elle, ce sont des minutes
                  rendues au rendez-vous.

                  ⚠ Elle ne dit PLUS ce qui est exigé (retrait du 9 août 2026). Le gate reste
                  `identiteComplete` — prénom, nom, e-mail, téléphone — et les cinq questions
                  restent libres, mais l'écran ne l'annonce nulle part. */}
              <p className="paragraph-small mx-field__help mg-top-5x-extra-small">
                {t('call.book.formIntro')}
              </p>

              <div className="grid-2-columns mg-top-small">
                <MxField label={t('call.form.firstName')}>
                  {(id) => <MxInput id={id} value={prenom} onChange={(e) => setPrenom(e.target.value)} readOnly={identiteVerrouillee} />}
                </MxField>
                <MxField label={t('call.form.lastName')}>
                  {(id) => <MxInput id={id} value={nom} onChange={(e) => setNom(e.target.value)} readOnly={identiteVerrouillee} />}
                </MxField>
              </div>

              <MxField className="mg-top-4x-extra-small" label={t('call.form.email')}>
                {(id) => <MxInput id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} readOnly={emailVerrouille} />}
              </MxField>

              {/* Le SEUL champ qui n'est pas prérempli : le profil ne porte pas de numéro
                  WhatsApp, et supposer que le téléphone du compte en est un enverrait les
                  confirmations dans le vide. */}
              <MxField className="mg-top-4x-extra-small" label={t('call.form.whatsapp')}>
                {(id) => (
                  // `mx-equal-columns` (point 13) : sans lui, `1fr` cède devant la largeur
                  // intrinsèque du <select>, et la colonne du numéro se fait écraser par
                  // la plus longue option de la liste.
                  <div className="grid-2-columns mx-equal-columns" style={{ gridTemplateColumns: 'minmax(0, 11rem) minmax(0, 1fr)' }}>
                    <MxSelect
                      value={paysTel}
                      onChange={(e) => setPaysTel(e.target.value)}
                      options={optionsIndicatif}
                      aria-label={t('call.form.dialCode')}
                    />
                    {/* L'exemple suit le pays : le groupement des chiffres n'est pas
                        décoratif, il diffère d'un pays à l'autre et c'est lui qu'on
                        recopie. Vide pour un pays dont le format n'a pas été vérifié —
                        cf. PHONE_EXAMPLES, un exemple faux vaut moins que pas d'exemple. */}
                    <MxInput id={id} type="tel" inputMode="tel" value={numeroLocal} onChange={(e) => setNumeroLocal(e.target.value)} placeholder={PHONE_EXAMPLES[paysTel] ?? ''} />
                  </div>
                )}
              </MxField>

              {QUESTIONS.map((q) => (
                <MxField key={q.cle} className="mg-top-4x-extra-small" label={t(`call.questions.${q.cle}.label`)}>
                  {(id) => (
                    <MxSelect
                      id={id}
                      value={reponses[q.cle] ?? ''}
                      onChange={(e) => repondre(q.cle, e.target.value)}
                      options={[
                        { value: '', label: t('call.questions.placeholder') },
                        ...q.options.map((o) => ({ value: o, label: t(`call.questions.${q.cle}.options.${o}`) })),
                      ]}
                    />
                  )}
                </MxField>
              ))}

              <MxField className="mg-top-4x-extra-small" label={t('call.questions.cantons.label')}>
                {(id) => (
                  <MxInput id={id} value={reponses.cantons ?? ''} onChange={(e) => repondre('cantons', e.target.value)} placeholder={t('call.questions.cantons.placeholder')} />
                )}
              </MxField>

              <MxField className="mg-top-4x-extra-small" label={t('call.form.note')}>
                {(id) => <MxInput id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('call.form.notePlaceholder')} />}
              </MxField>

              {knownError && (
                <p className="paragraph-small mx-field__error mg-top-3x-extra-small" role="alert">
                  {t(`call.errors.${knownError}`)}
                </p>
              )}

              <div className="mg-top-small">
                <MxButton
                  type="button"
                  onClick={() => {
                    if (!selectedSlot) return
                    const saisie = {
                      slot: selectedSlot,
                      phone: phone.trim() || undefined,
                      note: note.trim() || undefined,
                      answers: { ...reponses, first_name: prenom.trim(), last_name: nom.trim(), email: email.trim() },
                    }
                    // Différé : rien ne part — le créneau est RETENU chez l'appelant,
                    // l'edge ne sera appelée qu'à la soumission du dossier.
                    if (deferred) {
                      onChoiceChange?.({ ...saisie, durationMinutes: slotsQuery.data?.duration_minutes ?? 30 })
                      setEnModification(false)
                      return
                    }
                    book.mutate(saisie)
                  }}
                  disabled={!selectedSlot || !identiteComplete || book.isPending}
                >
                  {deferred
                    ? t('call.actions.choose')
                    : book.isPending ? t('call.actions.confirming') : t('call.actions.confirm')}
                </MxButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Horodatage long du volet hôte : « mercredi 5 août 2026, 10:30 – 11:00 ». */
function longSlotLabel(iso: string, timezone: string, hour12: boolean): string {
  const d = new Date(iso)
  const jour = new Intl.DateTimeFormat('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: timezone }).format(d)
  // Même paire de locales que hourLabel, et pour la même raison : `fr-CH` ne rend
  // jamais le suffixe am/pm, il produirait un horaire ambigu à midi.
  const h = (at: Date) => new Intl.DateTimeFormat(hour12 ? 'en-US' : 'fr-CH', {
    hour: '2-digit', minute: '2-digit', hour12, timeZone: timezone,
  }).format(at)
  return `${jour}, ${h(d)} – ${h(new Date(d.getTime() + 30 * 60_000))}`
}

/* Trois pictogrammes du volet hôte, tracés sur `currentColor` — mêmes conventions que
   le chevron d'OcSlotPicker : la vitrine n'a pas d'icône d'horloge ni de caméra. */
function ClockGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  )
}

function VideoGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3" />
    </svg>
  )
}

function CalendarGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  )
}
