/**
 * Wizard « Identité légale » (KYB) — étape 3, les bénéficiaires effectifs.
 *
 * Peau MEGGA X depuis le 02.08.2026 : cette étape ne porte plus la grammaire
 * Sugar v2 mais celle de la vitrine megga.ch, transcrite verbatim dans
 * src/styles/megga-x.generated.css (sélecteurs `.megga-x …`). Concrètement, tout
 * le rendu passe par des classes de la vitrine et les composants de
 * src/components/megga-x ; le fichier ne pose plus aucune valeur de couleur, de
 * taille ni de rayon. La coquille (IdentityShell) enveloppe le contenu dans
 * `<MeggaX>`, sans quoi ces classes ne s'appliquent pas — elles sont scopées.
 *
 * Étape CONDITIONNELLE : IdentityShell ne la monte jamais quand la forme juridique
 * choisie à l'étape 2 vaut `sole_proprietorship` (shouldSkipBeneficiairesStep) — ce
 * fichier n'a donc à se soucier que du cas où elle s'applique.
 *
 * Saisit la liste des personnes physiques qui détiennent ou contrôlent l'agence
 * (prénom, nom, date de naissance, nationalité, pourcentage de détention, déclaration
 * d'exposition politique). Contrôlée par IdentityShell (value/onChange), comme
 * StepSignataire/StepAgence : cette étape ne détient aucun état propre et n'écrit rien
 * elle-même — IdentityShell persiste le brouillon via savePerson/removePerson au
 * changement d'étape (cf. son en-tête, ubosToRemove et ubosToRevoke — correctif revue
 * tâche 5 — dans useAgencyIdentity.ts).
 *
 * Différence structurelle avec les deux étapes précédentes : celles-ci portent une
 * entité UNIQUE (le brouillon est un objet). Ici le brouillon est une LISTE — 0 à N
 * bénéficiaires, 0 étant une réponse valide (aucune personne physique ne détient seule
 * 25 % ou plus) — d'où `value: BeneficiaireDraft[]` / `onChange(next)` qui remplace le
 * tableau entier plutôt qu'un patch partiel.
 *
 * Cas central du brief (cf. IdentityShell.tsx) : la même personne peut être à la fois
 * signataire et bénéficiaire effectif (le fondateur, administrateur ET actionnaire
 * majoritaire, très fréquent en petite SA). Le bouton « reprendre le signataire »
 * ci-dessous ajoute une ligne pré-remplie avec l'identité déjà saisie à l'étape 1 et
 * SON id réel (`signataire.personId`) — c'est cet id, réutilisé tel quel par
 * IdentityShell au moment de sauvegarder (savePerson met à jour la personne existante
 * et ajoute un second rôle, il n'en crée pas une seconde), qui évite la duplication
 * d'identité que le découpage agency_related_persons / agency_person_roles existe
 * justement pour permettre.
 *
 * Champs à fournir avant de pouvoir avancer (gate : IdentityShell.isBeneficiairesStepComplete) :
 * pour CHAQUE ligne du brouillon, les 6 champs (tout ou rien, comme le signataire) —
 * mais la liste elle-même peut rester vide sans bloquer l'avancement.
 *
 * Seuil de 25 % (GAFI) : rappelé dans l'indication sous le champ de pourcentage, jamais
 * appliqué comme condition de validation (brief tâche 5, explicite) — une valeur en
 * dessous reste acceptée telle quelle.
 */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { MxButton, MxField, MxIcon, MxInput, MxRadio, MxSelect } from '@/components/megga-x'
import { COUNTRIES } from '@/lib/countries'
import { EMPTY_BENEFICIAIRE_DRAFT, type BeneficiaireDraft } from '../IdentityShell'

/**
 * Glyphes de la police d'icônes de la vitrine (Line Rounded Icon Font Brix),
 * relevés dans la table de caractères de la fonte livrée
 * (public/megga-x/fonts/…line-rounded-icon-font-brix.woff) : les noms de glyphes
 * y sont `plus` et `close`. Aucun dessin d'icône n'est donc ajouté ici.
 */
const MX_GLYPH_PLUS = 0xe8a4
const MX_GLYPH_CLOSE = 0xe83a

/** Identité du signataire déjà saisi à l'étape 1, telle qu'exposée par IdentityShell pour le bouton « reprendre ». */
export interface SignataireForReuse {
  personId: string
  firstName: string
  lastName: string
  dateOfBirth: string | null
  nationality: string | null
}

interface StepBeneficiairesProps {
  value: BeneficiaireDraft[]
  onChange: (next: BeneficiaireDraft[]) => void
  /** null tant qu'aucun signataire n'a encore été persisté (l'étape 1 bloque
   *  l'avancement avant que ça arrive — cf. canAdvanceFromIdentityStep — donc ce cas
   *  ne devrait pas se produire ici en pratique ; le composant reste défensif). */
  signataire: SignataireForReuse | null
}

/**
 * '' -> null (champ vidé). Sinon borne à [0, 100] : la colonne DB (ownership_pct
 * numeric(5,2)) refuse toute valeur hors de cet intervalle (CHECK, migration
 * 20260728102000) — la borne ici évite un aller-retour serveur pour une saisie que
 * l'utilisateur corrigerait de toute façon. NaN (texte non numérique) -> null, jamais
 * une valeur invalide silencieusement propagée.
 */
function parseOwnershipPct(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw)
  if (Number.isNaN(n)) return null
  return Math.min(100, Math.max(0, n))
}

/** Étape 3 du wizard identité : liste des bénéficiaires effectifs. */
export function StepBeneficiaires({ value, onChange, signataire }: StepBeneficiairesProps) {
  const { t } = useTranslation('onboarding')

  const signataireAlreadyAdded = signataire != null && value.some((b) => b.personId === signataire.personId)

  const updateEntry = (index: number, patch: Partial<BeneficiaireDraft>) => {
    onChange(value.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)))
  }
  const removeEntry = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }
  const addBlankEntry = () => {
    onChange([...value, EMPTY_BENEFICIAIRE_DRAFT])
  }
  const reuseSignataire = () => {
    if (!signataire) return
    onChange([...value, {
      personId: signataire.personId,
      firstName: signataire.firstName,
      lastName: signataire.lastName,
      dateOfBirth: signataire.dateOfBirth,
      nationality: signataire.nationality,
      ownershipPct: null,
      pepSelfDeclared: null,
    }])
  }

  return (
    <div className="inner-container _634px center">
      <div className="mg-top-4x-extra-small">
        <h1 className="display-6">{t('wizard.beneficiaires.title')}</h1>
      </div>
      <div className="mg-top-4x-extra-small">
        <p className="paragraph-large text-paragraph">{t('wizard.beneficiaires.subtitle')}</p>
      </div>

      {signataire && !signataireAlreadyAdded && (
        <div className="mg-top-small">
          <MxButton variant="secondary" size="small" type="button" onClick={reuseSignataire}>
            <div className="link-content-flex">
              {/* Le glyphe ne porte aucune information que le libellé ne dise déjà. */}
              <MxIcon code={MX_GLYPH_PLUS} aria-hidden="true" />
              <div>{t('wizard.beneficiaires.reuseSignataire', { name: `${signataire.firstName} ${signataire.lastName}` })}</div>
            </div>
          </MxButton>
        </div>
      )}

      <div className="mg-top-small">
        {value.length === 0 ? (
          <div className="card empty-state">
            {/* `.empty-state` monte à 20 px : trop lourd pour ce rappel de trois lignes. */}
            <p className="paragraph-small">{t('wizard.beneficiaires.emptyHint')}</p>
          </div>
        ) : (
          <div className="grid-1-column">
            {value.map((entry, index) => (
              <BeneficiaireCard
                key={entry.personId ?? `new-${index}`}
                entry={entry}
                onChange={(patch) => updateEntry(index, patch)}
                onRemove={() => removeEntry(index)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mg-top-small">
        <MxButton variant="secondary" size="small" type="button" onClick={addBlankEntry}>
          <div className="link-content-flex">
            <MxIcon code={MX_GLYPH_PLUS} aria-hidden="true" />
            <div>{t('wizard.beneficiaires.addButton')}</div>
          </div>
        </MxButton>
      </div>
    </div>
  )
}

/** Une ligne de bénéficiaire effectif — carte `.card` de la vitrine, contenu à son gabarit de padding. */
function BeneficiaireCard({
  entry, onChange, onRemove,
}: { entry: BeneficiaireDraft; onChange: (patch: Partial<BeneficiaireDraft>) => void; onRemove: () => void }) {
  const { t } = useTranslation('onboarding')
  // Un groupe de radios par ligne : sans nom distinct, cocher « Oui » sur une ligne
  // décocherait celui de la précédente (les radios d'un même `name` sont exclusifs).
  const pepGroupName = useId()
  const nameId = useId()

  const removeLabel = t('wizard.beneficiaires.removeButton')
  const pepLabel = t('wizard.beneficiaires.pep.label')
  // La ligne est identifiée par ce que l'agent a saisi, pas par un numéro d'ordre :
  // rien n'est inventé quand les deux champs sont encore vides, l'en-tête reste nu.
  const displayName = [entry.firstName, entry.lastName].filter(Boolean).join(' ')

  return (
    <div className="card">
      <div className="pd---content-inside-card">
        <div className="flex-horizontal space-between">
          <div className="display-3 medium" id={nameId}>{displayName}</div>
          {/* Le libellé i18n est le même sur toutes les lignes : listés hors contexte,
              N boutons « Retirer ce bénéficiaire effectif » seraient indiscernables.
              D'où la description qui rattache le bouton au nom saisi juste à gauche —
              vide tant que les champs le sont, donc jamais de nom inventé. */}
          <button
            type="button"
            className="circle-button-secondary small"
            title={removeLabel}
            aria-label={removeLabel}
            aria-describedby={nameId}
            onClick={onRemove}
          >
            <MxIcon code={MX_GLYPH_CLOSE} aria-hidden="true" />
          </button>
        </div>

        <div className="grid-2-columns mg-top-small">
          <MxField label={t('wizard.beneficiaires.fields.firstName')}>
            {(id) => (
              <MxInput
                id={id}
                value={entry.firstName}
                onChange={(e) => onChange({ firstName: e.target.value })}
              />
            )}
          </MxField>
          <MxField label={t('wizard.beneficiaires.fields.lastName')}>
            {(id) => (
              <MxInput
                id={id}
                value={entry.lastName}
                onChange={(e) => onChange({ lastName: e.target.value })}
              />
            )}
          </MxField>
        </div>

        <div className="grid-2-columns mg-top-small">
          <MxField label={t('wizard.beneficiaires.fields.dateOfBirth')}>
            {(id) => (
              <MxInput
                id={id}
                type="date"
                value={entry.dateOfBirth ?? ''}
                onChange={(e) => onChange({ dateOfBirth: e.target.value || null })}
              />
            )}
          </MxField>
          <MxField label={t('wizard.beneficiaires.fields.nationality')}>
            {(id) => (
              <MxSelect
                id={id}
                value={entry.nationality ?? ''}
                onChange={(e) => onChange({ nationality: e.target.value || null })}
                options={[
                  { value: '', label: t('wizard.beneficiaires.fields.nationalityPlaceholder') },
                  ...COUNTRIES.map((c) => ({ value: c.code, label: c.name })),
                ]}
              />
            )}
          </MxField>
        </div>

        <div className="mg-top-small">
          <MxField
            label={t('wizard.beneficiaires.fields.ownershipPct')}
            help={t('wizard.beneficiaires.fields.ownershipPctHint')}
          >
            {(id) => (
              <MxInput
                id={id}
                type="number"
                value={entry.ownershipPct != null ? String(entry.ownershipPct) : ''}
                onChange={(e) => onChange({ ownershipPct: parseOwnershipPct(e.target.value) })}
              />
            )}
          </MxField>
        </div>

        <div className="mg-top-small">
          {/* Enfant en nœud simple et non en fonction : un `for` unique n'aurait pas de
              sens pour deux radios (cf. l'API de MxField). Contrepartie : le <label>
              que MxField pose ne désigne alors aucun contrôle, et la question ne serait
              jamais annoncée avec les réponses — d'où le rôle et le nom portés ici par
              le groupe lui-même. */}
          <MxField label={pepLabel}>
            <div className="grid-2-columns" role="radiogroup" aria-label={pepLabel}>
              <PepChoice
                groupName={pepGroupName}
                value="yes"
                selected={entry.pepSelfDeclared === true}
                label={t('wizard.beneficiaires.pep.yes')}
                hint={t('wizard.beneficiaires.pep.yesHint')}
                onSelect={() => onChange({ pepSelfDeclared: true })}
              />
              <PepChoice
                groupName={pepGroupName}
                value="no"
                selected={entry.pepSelfDeclared === false}
                label={t('wizard.beneficiaires.pep.no')}
                hint={t('wizard.beneficiaires.pep.noHint')}
                onSelect={() => onChange({ pepSelfDeclared: false })}
              />
            </div>
          </MxField>
        </div>
      </div>
    </div>
  )
}

/**
 * Une réponse à la question PEP. La précision reste HORS du libellé du radio : la
 * vitrine étiquette ses radios avec un `<span>`, et y glisser un paragraphe
 * produirait un DOM que le navigateur réécrit.
 */
function PepChoice({
  groupName, value, selected, label, hint, onSelect,
}: {
  groupName: string
  value: string
  selected: boolean
  label: string
  hint: string
  onSelect: () => void
}) {
  return (
    <div>
      <MxRadio
        name={groupName}
        value={value}
        checked={selected}
        onSelect={onSelect}
        label={<span className="display-2 medium">{label}</span>}
      />
      <div className="mg-top-5x-extra-small">
        <p className="paragraph-small text-color-neutral-600">{hint}</p>
      </div>
    </div>
  )
}
