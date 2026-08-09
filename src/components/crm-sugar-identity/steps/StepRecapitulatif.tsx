/**
 * Wizard « Identité légale » (KYB) — étape 5, le récapitulatif et la soumission.
 *
 * Peau MEGGA X depuis la refonte visuelle de l'onboarding : l'étape ne compose plus
 * qu'avec des classes de la vitrine (`card`, `pd---content-inside-card`, `display-*`,
 * `flex-horizontal space-between`, `grid-1-column gap-row-*`) et les composants
 * `@/components/megga-x`. Elle suppose donc d'être rendue à l'intérieur du conteneur
 * `<MeggaX>` de la coquille — hors de ce scope, aucune de ces classes ne s'applique.
 * Aucune valeur (couleur, taille, rayon, ombre) n'est posée en style inline : ce qui
 * n'existe pas dans la vitrine n'est pas inventé ici, il est signalé au handoff.
 *
 * Relit tout ce qui a été saisi aux QUATRE étapes précédentes, section par section,
 * avec un bouton « Modifier » vers chacune (onEditStep délègue à goToStep,
 * IdentityShell.tsx). Ce qui est affiché ici DOIT correspondre à ce qui part : les
 * valeurs viennent des MÊMES brouillons (signataire, agencyDraft) que ceux que
 * persistCurrentStep a déjà écrits en base à chaque changement d'étape, jamais
 * un résumé recalculé séparément.
 *
 * La section « Rendez-vous » a été ajoutée le 4 août 2026 avec l'étape du même nom :
 * l'appel d'accueil se prenait jusque-là APRÈS la soumission, donc hors de toute
 * relecture. Elle suit la même règle que les autres — ce qui s'y lit est ce qui est en
 * base — à ceci près qu'elle relit une ligne (`onboarding_calls`) et non un brouillon,
 * la réservation étant déjà engagée au moment où on l'affiche. Purement contrôlée par IdentityShell, comme les
 * trois étapes précédentes : aucun accès Supabase direct ici, aucun état propre — y
 * compris la case d'attestation (attestationChecked/onAttestationChange), qui gate le
 * bouton Soumettre du pied de page (canSubmitIdentity, IdentityShell.tsx) tout en
 * vivant ici comme n'importe quel autre contrôle contrôlé.
 *
 * Le bouton Soumettre lui-même n'est PAS rendu ici : il vit dans le pied de page
 * partagé d'IdentityShell (comme le bouton Continuer des quatre étapes précédentes),
 * avec l'indicateur de sauvegarde et la bannière d'erreur déjà en place — cf. son
 * en-tête. Cette étape ne fait donc que relire et attester, jamais soumettre elle-même.
 *
 * Pièce d'identité : ne réaffiche pas un formulaire de dépôt (le fichier est déjà
 * durablement dans Storage depuis l'étape précédente, cf. l'en-tête de
 * StepPieceIdentite.tsx) mais son statut — présent/manquant, avec un aperçu quand
 * disponible. `identityDocumentsLoading`/`identityDocumentsError` reprennent
 * exactement les mêmes signaux que StepPieceIdentite (useIdentityDocuments,
 * useAgencyIdentity.ts) : les trois états chargement/vide/erreur sont donc couverts
 * ici aussi, pas seulement à l'étape où le fichier a été déposé.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { MxButton, MxCheckbox } from '@/components/megga-x'
import { countryName as countryLabel } from '@/lib/countries'
import VerifiedSeal, { VERIFIED_SEAL_ON_DARK } from '@/components/ui/VerifiedSeal'
import { useLegalForms } from '@/hooks/useLegalForms'
import {
  identityDocumentSidesFor, isIdentityVerificationSufficient,
  type IdentityDocumentPreview, type IdentityDocumentType, type IdentityVerificationStatus,
} from '@/hooks/useAgencyIdentity'
import type { OnboardingCallRow } from '@/hooks/useOnboardingCall'
import { bookedWhenLabel } from '@/components/onboarding-call/ocDates'
import type { KybIdReadRecord } from '@/types/kybIdRead'
import { IdentityReadNotice } from './StepPieceIdentite'
import type { SignataireDraft, AgencyDraft } from '../IdentityShell'

interface StepRecapitulatifProps {
  signataire: SignataireDraft
  agencyDraft: AgencyDraft
  /** Nature déclarée à l'étape 3 — décide aussi quelles faces sont relues ici. */
  documentType: IdentityDocumentType | null
  /** Verdict de la lecture assistée, relu tel quel depuis l'étape 3 — même phrase aux deux endroits. */
  identityRead: KybIdReadRecord | null
  /** Statut de la vérification chez le prestataire — décide si l'on relit des FICHIERS ou un STATUT. */
  verificationStatus: IdentityVerificationStatus | null
  /**
   * Nature de la pièce telle que le PRESTATAIRE l'a lue (`id_document_type`, posée par
   * le webhook), distincte de `documentType` qui est la nature DÉCLARÉE — nulle sur le
   * chemin Stripe, où l'on ne demande plus rien avant de partir.
   */
  verifiedDocumentType: IdentityDocumentType | null
  /** Horodatage de la vérification (`identity_verified_at`), posé par le webhook. */
  verifiedAt: string | null
  recto: IdentityDocumentPreview | null
  verso: IdentityDocumentPreview | null
  /** true tant que useIdentityDocuments() n'a pas encore résolu (même signal qu'à l'étape 3). */
  identityDocumentsLoading: boolean
  /** true si useIdentityDocuments() a échoué — état d'erreur dédié, jamais une absence de document affichée à tort. */
  identityDocumentsError: boolean
  /**
   * Le rendez-vous d'accueil pris à l'étape 4, relu depuis la BASE par IdentityShell —
   * `null` quand aucun n'a été pris (l'étape a été franchie parce qu'il n'y avait rien à
   * réserver : aucun hôte actif, ou aucun créneau libre sur l'horizon).
   */
  rendezVous: OnboardingCallRow | null
  /** Fuseau dans lequel l'heure du rendez-vous est relue — celui du navigateur. */
  rendezVousTimezone: string
  attestationChecked: boolean
  onAttestationChange: (checked: boolean) => void
  /** Ramène au step index donné (0 signataire, 1 agence, 2 pièce d'identité, 3 rendez-vous) — délègue à goToStep, IdentityShell.tsx. */
  onEditStep: (step: number) => void
}

/**
 * Libellé du code pays dans la langue de l'agent. Délègue à `countryName` de
 * lib/countries : français verbatim du design, autres langues via Intl (cf. son
 * JSDoc). La limitation « FR seulement » notée ici jusqu'au 9 août 2026 est levée.
 */
function countryNameIn(code: string | null, language: string): string {
  if (!code) return ''
  return countryLabel(code, language)
}

/**
 * Date de naissance au format suisse (16.03.1985). Le brouillon la porte en ISO
 * — c'est ce que rend un `<input type="date">`, et ce que la colonne attend —
 * mais cette étape est la RELECTURE : c'est là qu'un dirigeant doit reconnaître
 * sa propre date d'un coup d'œil avant d'attester qu'elle est exacte, pas
 * déchiffrer un format machine. Règle §6 du CLAUDE.md.
 *
 * ⚠ Réécriture de CHAÎNE, jamais `formatDate()` — mesuré le 03.08.2026 :
 * `formatDate('1980-05-15')` rend « 14.05.1980 » dès que le fuseau de la session
 * est à l'ouest de UTC. `new Date('1980-05-15')` parse en UTC minuit (spec ES,
 * pour la forme date-seule) puis `format()` réaffiche en heure LOCALE, et la
 * veille sort. Sans conséquence à Genève (UTC+1/+2), fausse pour un dirigeant
 * connecté depuis les Amériques — et une date de naissance est précisément ce
 * que la case d'attestation, deux blocs plus bas, lui demande de certifier exact.
 * Une date-seule n'a pas d'instant : la traiter comme tel est l'erreur.
 *
 * Toute forme inattendue est rendue telle quelle plutôt que réécrite de travers :
 * mieux vaut une date visiblement brute qu'une date plausible et fausse.
 */
/**
 * Date de la vérification, dans la langue et le fuseau du lecteur.
 *
 * ⚠ À l'INVERSE de `birthDate` ci-dessous : `identity_verified_at` est un
 * `timestamptz`, donc un INSTANT. Le convertir en heure locale est ici correct, et
 * c'est même la seule lecture juste — une vérification faite à 00h30 UTC a bien eu
 * lieu la veille pour qui la relit depuis les Amériques. Une date de naissance, elle,
 * n'a pas d'instant : c'est ce que le commentaire de `birthDate` explique.
 */
function verifiedOn(iso: string, language: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(language, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-recap-birthdate.spec.ts), même motif que isSignataireStepComplete.
export function birthDate(iso: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${m[3]}.${m[2]}.${m[1]}`
}

/** Étape 4 du wizard identité : relecture complète, attestation, préparation de la soumission. */
export function StepRecapitulatif({
  signataire, agencyDraft, documentType, identityRead, verificationStatus,
  verifiedDocumentType, verifiedAt,
  recto, verso, identityDocumentsLoading, identityDocumentsError,
  rendezVous, rendezVousTimezone,
  attestationChecked, onAttestationChange, onEditStep,
}: StepRecapitulatifProps) {
  const { t, i18n } = useTranslation('onboarding')
  // Même requête (clé ['legal-forms', code]) que StepAgence pour ce même pays — déjà
  // chargée par l'étape agence, donc résolue en pratique dès qu'on atteint le récapitulatif.
  const { options: legalFormOptions } = useLegalForms(agencyDraft.country)
  const legalFormLabel = legalFormOptions.find((o) => o.id === agencyDraft.legalFormId)?.label ?? agencyDraft.legalFormId

  return (
    // `_932px` et non `_634px` comme les quatre autres étapes : celle-ci LIT au lieu
    // de saisir, et c'est la seule dont le contenu tient en deux colonnes. À 634 px de
    // large, la relecture faisait 1016 px de haut pour une zone de 559 — l'attestation
    // et « Soumettre » vivaient sous la ligne de flottaison, sur l'écran précis où l'on
    // engage sa responsabilité. Largeur prise dans l'échelle de la vitrine, pas inventée.
    <div className="inner-container _932px center">
      {/* Titre seul, comme aux étapes 3 et 4 : le sous-titre disait « Relisez chaque
          section. Vous pouvez encore modifier une étape. » — la première moitié
          paraphrasait le titre, la seconde annonçait les quatre boutons « Modifier »
          qu'on voit déjà. Retiré le 9 août 2026, avec sa clé. */}
      <h1 className="display-6 mg-top-4x-extra-small">{t('wizard.recap.title')}</h1>

      {/* Deux colonnes : Signataire | Agence, puis Vérification | Rendez-vous. Les
          sections n'ont pas la même hauteur et c'est sans conséquence — `grid-2-columns`
          aligne en `start`, chacune s'arrête où elle finit.
          `mx-equal-columns` (point 13) : sans lui, `1fr` cède devant la largeur
          intrinsèque du contenu, et l'adresse sur une ligne écraserait sa voisine. */}
      <div className="mg-top-medium grid-2-columns mx-equal-columns">
        {/* ⚠ Verrouillée elle aussi une fois l'identité vérifiée : ce sont ces champs-là
            — prénom, nom, date de naissance — que le prestataire a confrontés au document.
            Les rouvrir après coup permettrait de faire porter une vérification par un nom
            qui n'est plus celui qu'elle atteste.
            Effet de bord assumé : le RÔLE dans l'agence, qui vit sur la même carte et que
            personne n'a vérifié, se ferme avec elle. */}
        <RecapSection
          title={t('wizard.steps.signataire')}
          onEdit={verificationStatus === 'verified' ? null : () => onEditStep(0)}
        >
          <RecapRow label={t('wizard.signataire.fields.firstName')} value={signataire.firstName} />
          <RecapRow label={t('wizard.signataire.fields.lastName')} value={signataire.lastName} />
          <RecapRow label={t('wizard.signataire.fields.dateOfBirth')} value={birthDate(signataire.dateOfBirth)} />
          <RecapRow label={t('wizard.signataire.fields.nationality')} value={countryNameIn(signataire.nationality, i18n.language)} />
          <RecapRow
            label={t('wizard.signataire.fields.agencyRole')}
            value={signataire.agencyRole ? t(`wizard.signataire.agencyRole.${signataire.agencyRole}`) : ''}
          />
        </RecapSection>

        <RecapSection title={t('wizard.steps.agence')} onEdit={() => onEditStep(1)}>
          <RecapRow label={t('wizard.agence.fields.country')} value={countryNameIn(agencyDraft.country, i18n.language)} />
          <RecapRow label={t('wizard.agence.fields.legalFormId')} value={legalFormLabel} />
          <RecapRow label={t('wizard.agence.fields.legalName')} value={agencyDraft.legal} />
          <RecapRow label={t('wizard.agence.fields.businessRegistrationNumber')} value={agencyDraft.businessRegistrationNumber} />
          <RecapRow
            label={t('wizard.agence.fields.address')}
            value={`${agencyDraft.address}, ${agencyDraft.postal} ${agencyDraft.city}, ${agencyDraft.canton}`}
          />
        </RecapSection>

        {/* ⚠ PAS de « Modifier » quand l'identité est vérifiée : l'étape 3 n'offre alors
            aucune action — on ne dévérifie pas une pièce, et le bouton ramenait à un
            écran qui ne fait que constater. Un bouton qui ne peut rien changer est une
            promesse fausse, sur l'écran où l'on atteste que tout est exact. */}
        <RecapSection
          title={t('wizard.steps.pieceIdentite')}
          onEdit={verificationStatus === 'verified' ? null : () => onEditStep(2)}
        >
          {identityDocumentsLoading ? (
            // Texte seul, sans roue d'attente : la vitrine n'a aucun indicateur de
            // progression indéterminé, et son écran d'attente équivalent
            // (IdentityPreparingScreen) annonce lui aussi le chargement en toutes lettres.
            <p className="paragraph-small text-color-neutral-600" role="status" aria-live="polite">
              {t('wizard.recap.pieceIdentite.loading')}
            </p>
          ) : identityDocumentsError ? (
            <p className="paragraph-small mx-field__error" role="alert">
              {t('wizard.recap.pieceIdentite.loadFailed')}
            </p>
          ) : (
            <>
              {documentType != null && (
                <RecapRow
                  label={t('wizard.pieceIdentite.documentType.label')}
                  value={t(`wizard.pieceIdentite.documentType.options.${documentType}`)}
                />
              )}

              {/* Deux parcours, deux relectures — et surtout PAS la seconde quand c'est
                  la première qui a servi. Le chemin Stripe ne dépose aucun fichier chez
                  nous : afficher les tuiles recto/verso y rendait « manquant », EN
                  ROUGE, sur un dossier dont l'identité venait d'être vérifiée avec
                  succès. Le dirigeant lisait un reproche là où tout allait bien. */}
              {isIdentityVerificationSufficient(verificationStatus) ? (
                // Trois faits plutôt qu'une ligne : le statut ne remplissait qu'un tiers
                // de sa colonne à côté des cinq lignes du signataire, et la relecture d'une
                // vérification d'identité a plus à dire que « c'est fait ». La nature de la
                // pièce et la date viennent du prestataire, par le webhook — jamais d'une
                // déclaration, c'est tout l'intérêt de les relire ici.
                <>
                  <RecapRow
                    label={t('wizard.recap.pieceIdentite.statusLabel')}
                    value={t(`wizard.recap.pieceIdentite.${verificationStatus === 'verified' ? 'verified' : 'processing'}`)}
                    seal={verificationStatus === 'verified'}
                  />
                  {verifiedDocumentType != null && (
                    <RecapRow
                      label={t('wizard.pieceIdentite.documentType.label')}
                      value={t(`wizard.pieceIdentite.documentType.options.${verifiedDocumentType}`)}
                    />
                  )}
                  {verifiedAt != null && (
                    <RecapRow
                      label={t('wizard.recap.pieceIdentite.verifiedAtLabel')}
                      value={verifiedOn(verifiedAt, i18n.language)}
                    />
                  )}
                </>
              ) : (
                // Les mêmes faces qu'à l'étape 3, décidées par la même fonction : un
                // récapitulatif qui réclamerait un verso de passeport contredirait
                // l'écran qui vient de ne pas le demander.
                // ⚠ `documentType == null` = AUCUNE pièce n'a jamais été déclarée, donc
                // aucune déposée : c'est l'état de tout dossier passé par le chemin Stripe,
                // seul chemin depuis le 05.08.2026. Les tuiles y affichaient « Recto :
                // Manquant / Verso : Manquant » — un reproche pour un dépôt que l'écran
                // précédent ne demande même plus. Le test porte donc sur la DÉCLARATION,
                // pas sur le nombre de faces : `identityDocumentSidesFor(null)` rend deux
                // faces, pas zéro.
                // Gris et jamais rouge : rien n'a échoué de son fait, le dossier part en
                // revue humaine. Même règle que « Aucun rendez-vous » plus bas.
                documentType == null ? (
                  <p className="paragraph-small text-color-neutral-600">
                    {t('wizard.recap.pieceIdentite.manualReview')}
                  </p>
                ) : (
                <div className="flex align-top gap-small">
                  {identityDocumentSidesFor(documentType).map((side) => (
                    <PieceIdentiteRecapRow
                      key={side}
                      label={documentType === 'passport'
                        ? t('wizard.pieceIdentite.sides.dataPage')
                        : t(`wizard.pieceIdentite.sides.${side}`)}
                      preview={side === 'recto' ? recto : verso}
                    />
                  ))}
                </div>
                )
              )}
              <IdentityReadNotice read={identityRead} reading={false} />
            </>
          )}
        </RecapSection>

        {/* Le rendez-vous d'accueil, relu comme le reste avant d'attester — c'est tout
            l'objet de son déplacement dans le parcours (il se prenait après la
            soumission jusqu'au 4 août 2026). Relu dans la grammaire du récapitulatif,
            en paires libellé/valeur, et non via OcBookedCard : la carte de confirmation
            porte un bouton « Rejoindre » et une ligne d'e-mail qui n'ont rien à faire
            dans une relecture, et son titre ferait doublon avec celui de la section. */}
        <RecapSection title={t('wizard.steps.rendezVous')} onEdit={() => onEditStep(3)}>
          {rendezVous ? (
            <>
              {/* `capitalize` : `Intl` rend « lundi 11 août » en minuscule. */}
              <RecapRow
                label={t('wizard.recap.rendezVous.whenLabel')}
                value={bookedWhenLabel(rendezVous.scheduled_at, rendezVousTimezone)}
                capitalizeValue
              />
              <RecapRow
                label={t('wizard.recap.rendezVous.hostLabel')}
                value={rendezVous.host_display_name}
              />
              <RecapRow
                label={t('wizard.recap.rendezVous.durationLabel')}
                // `minutes` et non `count` : ce dernier déclencherait la pluralisation
                // d'i18next, qui exigerait des clés `_one`/`_other` dans les quatre
                // langues pour une valeur qui ne s'accorde jamais (« 30 min »).
                value={t('wizard.recap.rendezVous.duration', { minutes: rendezVous.duration_minutes })}
              />
            </>
          ) : (
            // Pas une erreur, et surtout pas en rouge : l'étape a été franchie parce
            // qu'il n'y avait rien à réserver. Le dire, plutôt que de laisser une
            // section vide que le dirigeant lirait comme un oubli de sa part.
            <p className="paragraph-small text-color-neutral-600">
              {t('wizard.recap.rendezVous.none')}
            </p>
          )}
        </RecapSection>

      </div>

      {/* HORS de la grille, sur toute la largeur : c'est un engagement juridique et le
          verrou du bouton Soumettre, pas une cinquième section de relecture. Le mettre
          en colonne l'aurait rangé à côté d'un contenu qu'on parcourt, alors que c'est
          la dernière chose qu'on lit. */}
      <div className="card mg-top-small">
        <div className="pd---content-inside-card">
          <MxCheckbox
            className="paragraph-small"
            checked={attestationChecked}
            onCheckedChange={onAttestationChange}
            label={t('wizard.recap.attestation')}
          />
        </div>
      </div>
    </div>
  )
}

/** Carte d'une section relue — même gabarit que les cartes de la vitrine (`card` > `pd---content-inside-card`), avec un bouton Modifier vers l'étape source. */
function RecapSection({ title, onEdit, children }: { title: string; onEdit: (() => void) | null; children: ReactNode }) {
  const { t } = useTranslation('onboarding')
  return (
    <section className="card">
      <div className="pd---content-inside-card">
        <div className="flex-horizontal space-between gap-16px">
          <h2 className="display-3 semi-bold">{title}</h2>
          {/* Le petit bouton secondaire est le seul bouton discret de la vitrine :
              elle n'a ni bouton fantôme ni lien-action. Reste un <button>, pas un
              <a href="#"> — l'action ne navigue pas, elle ramène à une étape. */}
          {/* `null` = section scellée : pas de bouton grisé, pas de bouton du tout. Un
              contrôle désactivé invite à chercher comment l'activer ; son absence dit
              simplement qu'il n'y a rien à faire ici. */}
          {onEdit != null && (
            <MxButton type="button" variant="secondary" size="small" onClick={onEdit}>
              {t('common:actions.edit')}
            </MxButton>
          )}
        </div>
        <div className="mg-top-2x-extra-small grid-1-column gap-row-3x-extra-small">{children}</div>
      </div>
    </section>
  )
}

/**
 * Une paire libellé/valeur en lecture seule — jamais un input, cette étape ne fait que
 * relire.
 *
 * `capitalizeValue` sert les valeurs rendues par `Intl` (dates longues, « lundi 11 août
 * »), que la locale met en minuscule alors que la vitrine capitalise ses intitulés.
 * Jamais d'UPPERCASE (règle §3 du CLAUDE.md) : la capitale initiale suffit.
 */
function RecapRow({ label, value, capitalizeValue = false, seal = false }: { label: string; value: string; capitalizeValue?: boolean; seal?: boolean }) {
  const { t } = useTranslation('onboarding')
  return (
    <div className="flex-horizontal space-between gap-16px">
      {/* Le LIBELLÉ reste gris, la VALEUR passe à l'encre pleine (9 août 2026). Les
          deux portaient `text-color-neutral-600` : dix-sept lignes du même gris, où
          « Prénom » pesait autant que « Gregory ». Or on ne relit pas un récapitulatif
          pour vérifier les intitulés — on le parcourt pour repérer ce qui cloche, et
          c'est la valeur qu'on cherche. Le libellé n'est plus qu'un repère de position. */}
      <span className="display-1 text-color-neutral-600">{label}</span>
      <span className={cn('display-1 semi-bold', capitalizeValue && 'capitalize')} style={seal ? { display: 'inline-flex', alignItems: 'center', gap: 6 } : undefined}>
        {value}
        {/* Le même sceau qu'à l'écran de retour du prestataire : le dirigeant l'a déjà
            vu après sa vérification, il le retrouve ici. */}
        {seal && <VerifiedSeal size={16} color={VERIFIED_SEAL_ON_DARK} ariaLabel={t('gate.verificationReturn.sealAria')} />}
      </span>
    </div>
  )
}

/**
 * Statut d'un côté (recto/verso) de la pièce d'identité. L'aperçu n'est rendu que
 * pour une image : un PDF ou un côté manquant n'a pas de vignette de repli, faute
 * d'icône dont le glyphe soit attesté dans la vitrine — le statut en toutes lettres
 * porte alors seul l'information (défensif : isPieceIdentiteStepComplete a déjà
 * bloqué l'avancement si un côté manque).
 */
function PieceIdentiteRecapRow({ label, preview }: { label: string; preview: IdentityDocumentPreview | null }) {
  const { t } = useTranslation('onboarding')
  const isPdf = preview != null && preview.path.toLowerCase().endsWith('.pdf')

  return (
    <div className="grid-1-column gap-row-4x-extra-small">
      {preview != null && !isPdf && (
        <div className="card logo-icon-card">
          {/* `link-item-image _w-h-100` : sans elles l'image garde sa hauteur
              intrinsèque et déborde la tuile (128 px fixes), que `overflow:hidden`
              rognerait alors de façon différente pour le recto et le verso. */}
          <img className="link-item-image _w-h-100" src={preview.signedUrl} alt={label} />
        </div>
      )}
      <span className="display-1 medium text-color-neutral-600">{label}</span>
      <p className={cn('paragraph-small', preview ? 'text-color-neutral-600' : 'mx-field__error')}>
        {preview ? t('wizard.recap.pieceIdentite.uploaded') : t('wizard.recap.pieceIdentite.missing')}
      </p>
    </div>
  )
}
