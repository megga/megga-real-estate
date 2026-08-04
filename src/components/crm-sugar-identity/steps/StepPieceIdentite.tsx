/**
 * Wizard « Identité légale » (KYB) — étape 3, la pièce d'identité du signataire.
 *
 * Peau MEGGA X (transcription verbatim de la vitrine megga.ch, scopée `.megga-x`) :
 * l'écran ne pose plus aucune valeur de couleur, taille, rayon ou ombre — tout vient
 * des classes de la vitrine et des composants de src/components/megga-x/. La coquille
 * (IdentityShell) enveloppe le contenu dans <MeggaX>, c'est elle qui porte le fond et
 * la police ; cette étape ne rend que son contenu.
 *
 * L'écran demande D'ABORD la nature de la pièce (passeport / carte d'identité /
 * titre de séjour), et c'est elle qui décide combien de faces sont réclamées :
 * identityDocumentSidesFor (useAgencyIdentity.ts), la même fonction que celle qui
 * gate le bouton Continuer. Un passeport n'a qu'une page de données — l'exiger en
 * deux faces faisait photographier une couverture vierge. La réponse est écrite dans
 * `agency_related_persons.id_document_type`, colonne posée dès l'origine
 * (migration 20260729150200) et restée vide jusqu'au 3 août 2026.
 *
 * Téléversement recto/verso avec aperçu et remplacement — mais contrairement aux
 * étapes précédentes (texte tenu en brouillon React, écrit seulement au clic sur
 * Continuer), un fichier choisi est téléversé IMMÉDIATEMENT vers Storage (même motif
 * que le logo d'agence, AgencyFocusSection.tsx) : fermer l'onglet juste après avoir
 * choisi un fichier ne doit jamais le perdre, cf. la règle de persistance de
 * IdentityShell (son en-tête, « Persistance »). Il n'y a donc rien à « sauvegarder »
 * de plus au changement d'étape — persistCurrentStep (IdentityShell) ne fait ici que
 * vérifier la complétude.
 *
 * Purement contrôlée par IdentityShell, comme StepSignataire/StepAgence/
 * les étapes précédentes : aucun accès Supabase direct ici, seulement des props (aperçus
 * déjà résolus + callback de sélection) — IdentityShell détient
 * useIdentityDocuments()/uploadIdentityDocument() (useAgencyIdentity.ts, tâche 6).
 *
 * Aucun champ ici n'écrit dans agency_person_verification_checks : cette ligne de
 * check (check_type='id_document', source='manual', result='pending_manual_review')
 * ne peut être posée que par submit_agency_identity() (RPC SECURITY DEFINER, garde
 * 42501 sur les tables de checks) — l'étape 4 (récapitulatif, tâche 7) l'appellera au
 * moment de la soumission finale.
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
      <h1 className="display-6 mg-top-4x-extra-small">{t('wizard.pieceIdentite.title')}</h1>
      <div className="mg-top-4x-extra-small">
        <p className="paragraph-large text-paragraph">
          {t('wizard.pieceIdentite.subtitle')}
        </p>
      </div>

      {disabled ? (
        // Information, pas erreur : une carte neutre, jamais le pavé rouge de la
        // vitrine — rien n'a échoué, il manque seulement une étape en amont.
        <div className="mg-top-medium">
          <div className="card">
            <div className="pd---content-inside-card">
              <p className="paragraph-small text-color-neutral-600 text-center">
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
      <div className="card">
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

  return (
    <div className="mg-top-medium">
      <div className="card">
        <div className="pd---content-inside-card">
          <div className="display-2 semi-bold">
            {t(`wizard.pieceIdentite.verification.${done ? 'doneTitle' : pending ? 'pendingTitle' : 'title'}`)}
          </div>
          <div className="mg-top-4x-extra-small">
            <p className="paragraph-small text-color-neutral-600" role="status" aria-live="polite">
              {t(`wizard.pieceIdentite.verification.${done ? 'doneBody' : pending ? 'pendingBody' : 'body'}`)}
            </p>
          </div>


          {/* Le motif du refus, dans la langue de l'agent. Le code brut de Stripe
              (`selfie_document_missing_photo`) n'a aucun sens pour un dirigeant : tout
              code hors du catalogue traduit retombe sur une phrase générique. */}
          {/* Le motif du refus, ou la raison pour laquelle l'ouverture a échoué. Les
              deux atterrissent ici, à la même place et dans la même peau : l'écran ne
              change plus de forme, il explique. C'est ce qui remplace la bascule vers
              le dépôt, retirée le 05.08.2026. */}
          {startFailure ? (
            <div className="mg-top-4x-extra-small">
              <p className="paragraph-small text-color-neutral-600" role="status" aria-live="polite">
                {t(`wizard.pieceIdentite.verification.startFailed.${startFailure}`)}
              </p>
            </div>
          ) : retry ? (
            <div className="mg-top-4x-extra-small">
              <p className="paragraph-small text-color-neutral-600">
                {t(`wizard.pieceIdentite.verification.errors.${knownVerificationError(errorCode)}`)}
              </p>
            </div>
          ) : null}

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
