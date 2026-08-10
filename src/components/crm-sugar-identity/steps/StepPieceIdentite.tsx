/**
 * Wizard « Identité légale » (KYB) — étape 3, l'identité du signataire.
 *
 * Peau MEGGA X (transcription verbatim de la vitrine, scopée `.megga-x`) : l'écran ne
 * pose aucune valeur de couleur, taille, rayon ou ombre. La coquille (IdentityShell)
 * l'enveloppe dans <MeggaX> ; cette étape ne rend que son contenu.
 *
 * ⛔ UN SEUL CHEMIN depuis le 05.08.2026 : la vérification chez le prestataire. Le
 * dépôt de pièce a été RETIRÉ — pas seulement retiré de l'offre, retiré tout court :
 * aucun état de cet écran ne peut plus faire apparaître un champ de fichier. C'était
 * la condition pour que le retrait soit réel ; ne plus le proposer laissait un échec
 * d'ouverture y ramener, et c'est ce que le dirigeant constatait.
 *
 * Ce que le prestataire ne sait pas traiter — pays émetteur hors de sa liste,
 * nationalité que ses conditions excluent, pièce qu'il ne reconnaît pas — passe par
 * IdentityBlockedCard : une demande de vérification manuelle qui ne réclame AUCUN
 * document. Le dossier part en revue humaine avec la même ligne de check qu'un dépôt
 * aurait produite, mais MEGGA ne détient rien. C'est tout l'objet de la décision.
 *
 * ⚠ Un refus SANS RECOURS ouvre cette sortie de lui-même (cf. le point d'appel dans
 * IdentityShell) : attendre que le dirigeant déclare ce que le système sait déjà
 * ferait de l'étape un cul-de-sac, le gate d'identité le maintenant hors du CRM.
 *
 * Purement contrôlée par IdentityShell : aucun accès Supabase ici, seulement des props.
 */
import { useTranslation } from 'react-i18next'
import { MxButton } from '@/components/megga-x'
import {
  knownVerificationError,
  type IdentityVerificationStatus, type VerificationStartFailure,
} from '@/hooks/useAgencyIdentity'
import type { KybIdReadRecord } from '@/types/kybIdRead'

interface StepPieceIdentiteProps {
  /** Statut de la vérification chez le prestataire — null si aucune n'a été lancée. */
  verificationStatus: IdentityVerificationStatus | null
  /** `last_error.code` du prestataire, pour expliquer un refus dans la langue de l'agent. */
  verificationErrorCode: string | null
  /** true pendant l'ouverture de la session (avant la navigation vers le prestataire). */
  startingVerification: boolean
  /**
   * Renseigné quand l'ouverture a ÉCHOUÉ : l'écran le DIT au lieu de rester muet.
   * Deux causes distinctes, deux phrases — le prestataire a répondu non, ou la
   * requête n'est jamais partie (cf. classifyVerificationStartError).
   */
  startFailure: VerificationStartFailure | null
  /**
   * true quand le dirigeant a déclaré que sa pièce ne peut PAS être vérifiée en ligne
   * (pays émetteur hors liste, nationalité que les conditions du prestataire excluent,
   * pièce non reconnue). L'étape devient alors franchissable SANS aucun document : le
   * dossier part en revue humaine à la soumission. C'est la SEULE issue hors
   * vérification depuis le 05.08.2026 — le dépôt de pièce a été retiré du parcours.
   */
  blockedDeclared: boolean
  /** true si aucun signataire n'est encore enregistré — défensif, l'étape 1 bloque avant. */
  disabled: boolean
  onStartVerification: () => void
  onDeclareBlocked: () => void
  onUndeclareBlocked: () => void
}

/**
 * Le pictogramme de la carte de vérification : un visage dans un cadre de scan.
 *
 * Dessiné sur `currentColor` et NON sur le `#000000` de la source : cet écran est un
 * canvas noir MEGGA X, un tracé noir y serait purement invisible. La couleur vient donc
 * du texte de la carte, et le pictogramme suit toute reteinte future sans retouche.
 *
 * `aria-hidden` : il redit le titre qui le suit, il n'ajoute rien pour un lecteur
 * d'écran. Pas d'`id` non plus — celui de la source (`Face Scan`) serait un identifiant
 * de document, dupliqué à chaque rendu.
 */
function FaceScanGlyph() {
  return (
    <svg
      width="64" height="64" viewBox="0 0 24 24" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M3 8.46907V6.89189C3 4.74259 4.74259 3 6.89286 3H8.18205" />
      <path d="M3 15.5312V17.1084C3 19.2577 4.74259 21.0003 6.89286 21.0003H8.14994" />
      <path d="M21.0004 15.5312V17.1084C21.0004 19.2577 19.2578 21.0003 17.1075 21.0003H15.8184" />
      <path d="M20.9995 8.46907V6.89189C20.9995 4.74259 19.257 3 17.1067 3H15.8496" />
      <path d="M13.7624 16.043C13.2145 16.331 12.9522 17.8173 12.9522 17.8173" strokeLinejoin="miter" />
      <path d="M8.23834 17.1213C8.9253 15.5547 8.55371 13.9168 7.74922 12.4768C7.17425 11.4473 7.04693 10.3433 7.53317 9.22298C8.25599 7.55669 9.99998 6.78841 11.7304 6.74995C12.7678 6.72687 13.7525 6.90794 14.5634 7.59185C15.6044 8.46982 16.2133 9.54401 15.898 10.9724C15.73 11.7338 16.2859 12.5987 16.6798 13.1278C16.8532 13.3607 16.7658 13.6728 16.4948 13.7773L15.9821 13.9751C15.8341 14.0321 15.7261 14.1614 15.6962 14.3171L15.5247 15.7783C15.4678 16.1576 15.1454 16.3377 14.7852 16.2619L13.2458 15.9148C12.7425 15.8038 12.7645 15.3485 12.633 14.8721" strokeLinejoin="miter" />
    </svg>
  )
}

/**
 * Ce que la lecture assistée a trouvé — jamais un obstacle, toujours une remarque.
 *
 * Exporté et partagé avec le récapitulatif : le dirigeant doit lire la MÊME phrase aux
 * deux endroits, sans quoi la seconde ressemblerait à un second avis.
 *
 * Trois règles de fond, dans cet ordre :
 *  1. rien ici ne bloque le bouton Continuer, et la mention le dit en toutes lettres —
 *     c'est notre équipe conformité qui tranche, pas un modèle ;
 *  2. la péremption est une ligne À PART du verdict de concordance : une pièce
 *     périmée peut parfaitement appartenir à la bonne personne, et les confondre
 *     ferait chercher au dirigeant un problème d'identité qui n'existe pas ;
 *  3. « illisible » n'accuse personne — c'est une photo à reprendre, pas un soupçon.
 */
export function IdentityReadNotice({
  read, reading,
}: { read: KybIdReadRecord | null; reading: boolean }) {
  const { t } = useTranslation('onboarding')

  if (reading) {
    return (
      <div className="mg-top-3x-extra-small">
        <p className="paragraph-small text-color-neutral-600" role="status" aria-live="polite">
          {t('wizard.pieceIdentite.read.running')}
        </p>
      </div>
    )
  }
  if (read == null) return null

  return (
    <div className="mg-top-3x-extra-small">
      {/* `role="status"` et non `alert` même pour un mismatch : rien n'a échoué, et
          une alerte pousserait un lecteur d'écran à interrompre la saisie en cours. */}
      <p className="paragraph-small text-color-neutral-600" role="status" aria-live="polite">
        {t(`wizard.pieceIdentite.read.verdict.${read.verdict}`)}
      </p>
      {read.expired === true && (
        <p className="paragraph-small text-color-neutral-600">
          {t('wizard.pieceIdentite.read.expired', { date: swissDate(read.expiresOn) })}
        </p>
      )}
      {read.documentTypeMatches === false && (
        <p className="paragraph-small text-color-neutral-600">
          {t('wizard.pieceIdentite.read.typeDiffers')}
        </p>
      )}
      <p className="paragraph-small text-color-neutral-600">
        {t('wizard.pieceIdentite.read.disclaimer')}
      </p>
    </div>
  )
}

/**
 * Date suisse (31.12.2030) depuis l'ISO rendu par la lecture.
 *
 * Réécriture de CHAÎNE, jamais `formatDate()` : mesuré le 03.08.2026, une date-seule
 * passée par `new Date()` puis réaffichée en heure locale sort la VEILLE dès que le
 * fuseau de la session est à l'ouest de UTC. Même piège, même parade qu'à la date de
 * naissance du récapitulatif (birthDate, StepRecapitulatif.tsx).
 */
function swissDate(iso: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso
}


/** Étape 3 du wizard identité : recto/verso de la pièce d'identité du signataire. */
export function StepPieceIdentite({
  verificationStatus, verificationErrorCode, startingVerification, startFailure,
  blockedDeclared, disabled, onStartVerification, onDeclareBlocked, onUndeclareBlocked,
}: StepPieceIdentiteProps) {
  const { t } = useTranslation('onboarding')

  return (
    <div className="inner-container _634px center">
      {/* Marge portée par le <h1> lui-même, comme aux autres étapes : la règle `h1`
          de la vitrine remet les marges à zéro, et sans cette classe le titre de
          CETTE étape seule démarrait 8 px plus haut que les trois autres — un saut
          visible au changement d'étape, la coquille ne bougeant pas autour. */}
      {/* Titre SEUL. « Passeport ou carte d'identité. La photo ne nous est jamais
          transmise. » a été retiré le 09.08.2026 : le prestataire redit les deux sur son
          propre écran, à l'instant où ça compte. Rétabli par erreur au rebase du 10, puis
          retiré de nouveau — avec sa clé, pour qu'il ne revienne pas une troisième fois. */}
      <h1 className="display-6 mg-top-4x-extra-small">{t('wizard.pieceIdentite.title')}</h1>

      {disabled ? (
        // Information, pas erreur : une carte neutre, jamais le pavé rouge de la
        // vitrine — rien n'a échoué, il manque seulement une étape en amont.
        <div className="mg-top-medium">
          <div className="card mx-idcard">
            <div className="pd---content-inside-card">
              <p className="paragraph-small text-color-neutral-600">
                {t('wizard.pieceIdentite.missingSignataire')}
              </p>
            </div>
          </div>
        </div>
      ) : blockedDeclared ? (
        // SORTIE DE SECOURS — déclarée par le dirigeant, jamais déduite. Elle passe
        // AVANT les deux autres branches : quelqu'un qui vient de dire « ma pièce n'est
        // pas acceptée » ne doit pas retrouver l'écran qu'il vient de quitter.
        <IdentityBlockedCard onUndeclare={onUndeclareBlocked} />
      ) : (
        // CHEMIN UNIQUE — la vérification chez le prestataire. Aucun fichier n'entre
        // chez MEGGA : c'est tout l'objet de la décision du 05.08.2026. Le dépôt de
        // pièce a été RETIRÉ du parcours, y compris comme repli — il ne suffisait pas
        // de ne plus le proposer, il fallait qu'aucun état ne puisse le ramener.
        // Ce que le prestataire ne sait pas traiter passe désormais par
        // IdentityBlockedCard, qui ouvre la revue humaine SANS document.
        <IdentityVerificationCard
          status={verificationStatus}
          errorCode={verificationErrorCode}
          starting={startingVerification}
          startFailure={startFailure}
          onStart={onStartVerification}
          onDeclareBlocked={onDeclareBlocked}
        />
      )}

    </div>
  )
}

/**
 * La carte du chemin principal : vérifier son identité chez le prestataire.
 *
 * Quatre états, et un seul geste par état — c'est la règle qui tient cet écran :
 *  · rien encore lancé -> « Vérifier mon identité » ;
 *  · `processing` -> Stripe traite ; on NE bloque PAS le parcours (cf.
 *    isIdentityVerificationSufficient), le verdict arrivera par webhook avant que le
 *    relecteur n'ouvre le dossier ;
 *  · `verified` -> c'est fait, plus rien à faire ici ;
 *  · `requires_input` -> le motif expliqué, et « Reprendre ».
 *
 * Le dépôt manuel est TOUJOURS proposé en second recours, jamais caché : le titre de
 * séjour n'est pas dans les types que Stripe accepte, et seul le dirigeant sait quelle
 * pièce il possède. Un parcours qui ne laisserait que la vérification exclurait
 * silencieusement les détenteurs de livret B/C — soit une part notable des dirigeants
 * d'agence à Genève.
 */
/**
 * Ce que voit le dirigeant dont la pièce ne peut PAS passer la vérification en ligne.
 *
 * L'écran ne réclame RIEN. C'est délibéré, et c'est ce qui distingue cette sortie du
 * dépôt manuel : le dossier part en revue humaine avec la ligne `id_document /
 * pending_manual_review` que submit_agency_identity() pose déjà, et l'équipe conformité
 * établit l'identité par un autre canal. MEGGA ne détient aucune copie — le but même du
 * passage au prestataire.
 *
 * Le retour reste ouvert : la déclaration est un choix de l'utilisateur, pas un verdict
 * du système, et se reprendre ne doit jamais coûter un rechargement de page (défaut
 * corrigé le 04.08.2026 sur `manualFallback`, qu'on ne réintroduit pas ici).
 */
function IdentityBlockedCard({ onUndeclare }: { onUndeclare: () => void }) {
  const { t } = useTranslation('onboarding')
  return (
    <div className="mg-top-medium">
      {/* Même plancher que la carte principale : les deux branches se remplacent l'une
          l'autre au même endroit, et un pied d'actions qui saute au moment où le
          dirigeant clique « Ma pièce n'est pas acceptée » ferait douter du clic. */}
      <div className="card mx-idcard">
        <div className="pd---content-inside-card">
          <p className="display-1 medium">{t('wizard.pieceIdentite.verification.blocked.title')}</p>
          <div className="mg-top-4x-extra-small">
            <p className="paragraph-small text-color-neutral-600">
              {t('wizard.pieceIdentite.verification.blocked.body')}
            </p>
          </div>
          {/* Information, jamais le pavé rouge : rien n'a échoué du fait du dirigeant —
              même règle que la branche `disabled` en tête de fichier. */}
          <div className="mg-top-3x-extra-small">
            <p className="paragraph-small text-color-neutral-600" role="status" aria-live="polite">
              {t('wizard.pieceIdentite.verification.blocked.declared')}
            </p>
          </div>
          <div className="mg-top-4x-extra-small">
            <button type="button" className="link-single display-1 medium" onClick={onUndeclare}>
              {t('wizard.pieceIdentite.verification.blocked.back')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function IdentityVerificationCard({
  status, errorCode, starting, startFailure, onStart, onDeclareBlocked,
}: {
  status: IdentityVerificationStatus | null
  errorCode: string | null
  starting: boolean
  startFailure: VerificationStartFailure | null
  onStart: () => void
  onDeclareBlocked: () => void
}) {
  const { t } = useTranslation('onboarding')
  const done = status === 'verified'
  const pending = status === 'processing'
  const retry = status === 'requires_input'

  // La carte ne parle que si elle a un fait NOUVEAU à donner — un refus, une ouverture
  // impossible, un traitement en cours, une vérification faite. `null` dans l'état
  // d'accueil, et c'est le nettoyage principal de cet écran : ce qui est accepté
  // (passeport, carte d'identité) et ce que MEGGA ne reçoit jamais sont désormais écrits
  // UNE fois, sous le titre de l'étape. Les répéter sous l'icône remplissait la carte
  // sans rien apprendre, à deux lignes d'intervalle.
  const message = startFailure
    ? t(`wizard.pieceIdentite.verification.startFailed.${startFailure}`)
    : retry
      ? t(`wizard.pieceIdentite.verification.errors.${knownVerificationError(errorCode)}`)
      : done
        ? t('wizard.pieceIdentite.verification.doneBody')
        : pending
          ? t('wizard.pieceIdentite.verification.pendingBody')
          : null

  return (
    <div className="mg-top-medium">
      {/* `mx-idcard` : plancher de hauteur + centrage. Le contenu de cette étape est le
          plus court des cinq (une carte, un bouton) ; sans plancher, le pied
          d'actions remontait de 223 px par rapport aux étapes 1 et 2 et « Continuer »
          changeait de place d'une étape à l'autre. Détail au point 15 de
          megga-x-additions.css. */}
      <div className="card mx-idcard">
        <div className="pd---content-inside-card">
          <div className="mx-idcard__glyph" aria-hidden="true"><FaceScanGlyph /></div>
          {/* Un titre de carte SEULEMENT quand il dit ce que le titre de l'étape ne peut
              pas dire. Celui-ci est une consigne fixe (« Vérifiez votre identité ») ;
              `verified` et `processing` sont des ÉTATS, et l'écran doit pouvoir les
              annoncer. Dans l'état d'accueil, la carte se taisait pour redire le titre
              placé cent pixels plus haut — avec le rail qui affiche déjà « Vérification »,
              cela faisait trois formulations de la même idée l'une sous l'autre. */}
          {/* ⚠ La carte parle AUSSI à l'état d'accueil (rétabli le 10 août 2026, perdu
              lors d'un rebase). Elle n'y redit pas le titre de l'étape : elle dit où l'on
              VA. Ce bouton fait quitter le site pour un domaine que le dirigeant ne
              reconnaîtra pas (verify.stripe.com), au moment où on lui demande sa pièce —
              une redirection non annoncée est là la première cause d'abandon.
              Coupure explicite entre la destination et son apposition : chaque langue
              coupe où sa syntaxe le permet, une césure laissée au navigateur tomberait
              ailleurs à chaque largeur. */}
          <div className="display-2 semi-bold mg-top-3x-extra-small">
            {done || pending
              ? t(`wizard.pieceIdentite.verification.${done ? 'doneTitle' : 'pendingTitle'}`)
              : (
                <>
                  {t('wizard.pieceIdentite.verification.title')}
                  <br />
                  {t('wizard.pieceIdentite.verification.titleLine2')}
                </>
              )}
          </div>
          {/* La région vivante est déclarée MÊME VIDE, dès le premier rendu : un lecteur
              d'écran n'annonce de façon fiable que les changements survenus DANS une
              région déjà présente. La créer en même temps que le premier message — un
              refus, un passage en traitement — laisserait cette annonce-là passer
              inaperçue, la seule qui compte vraiment. `polite` et non `assertive` :
              rien ici n'a à interrompre une saisie en cours. */}
          <div role="status" aria-live="polite">
            {message && (
              <p className="paragraph-small text-color-neutral-600 mg-top-4x-extra-small">
                {message}
              </p>
            )}
          </div>

          {!done && (
            <div className="mg-top-3x-extra-small">
              <MxButton type="button" onClick={onStart} disabled={starting} aria-busy={starting || undefined}>
                {starting
                  ? t('wizard.footer.saving')
                  : t(`wizard.pieceIdentite.verification.${retry ? 'retryCta' : 'cta'}`)}
              </MxButton>
            </div>
          )}


          {/* LA SORTIE DE SECOURS — pour ce que le prestataire ne peut PAS traiter :
              pays émetteur hors liste, nationalité que ses conditions excluent, pièce
              non reconnue. Sans elle, ces dirigeants ne sont pas seulement bloqués sur
              cette étape : le gate d'identité les y renvoie indéfiniment, donc ils
              n'entrent JAMAIS dans le CRM.

              ⚠ Elle n'apparaît qu'APRÈS un refus (`retry`), et c'est le point du
              nettoyage du 05.08.2026 : l'écran d'accueil doit porter UNE action, pas
              trois. Proposée d'emblée, elle mettait au même rang « je vérifie » et « ça
              ne marchera pas », ce qui invitait à contourner la vérification avant même
              de l'avoir tentée. Offerte au moment où le prestataire vient de refuser,
              elle répond à une question que l'utilisateur se pose déjà. */}
          {(retry || startFailure) && (
            <div className="mg-top-4x-extra-small">
              <button type="button" className="link-single display-1 medium" onClick={onDeclareBlocked}>
                {t('wizard.pieceIdentite.verification.blocked.link')}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
