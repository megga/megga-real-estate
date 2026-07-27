/**
 * Wizard « Identité légale » (KYB) — étape 3, les bénéficiaires effectifs.
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
 * changement d'étape (cf. son en-tête et ubosToRemove dans useAgencyIdentity.ts).
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
import { useTranslation } from 'react-i18next'
import { SugarV2 } from '../tokens'
import { SgInput, SgGhostPill, SgCircleBtn, SgIcon } from '@/components/crm-sugar-wizard/primitives'
import { COUNTRIES } from '@/lib/countries'
import { EMPTY_BENEFICIAIRE_DRAFT, type BeneficiaireDraft } from '../IdentityShell'

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

const FIELD_LABEL_STYLE = {
  fontSize: 11,
  fontWeight: 600,
  color: SugarV2.muted,
  letterSpacing: 0.6,
  textTransform: 'uppercase' as const,
  marginBottom: 8,
}

const SELECT_STYLE = {
  width: '100%',
  boxSizing: 'border-box' as const,
  height: 48,
  padding: '0 16px',
  borderRadius: 14,
  border: 0,
  outline: 'none',
  fontFamily: 'inherit',
  background: SugarV2.cardSubtle,
  color: SugarV2.ink,
  fontSize: 15,
  fontWeight: 500,
  boxShadow: `inset 0 0 0 1px ${SugarV2.line}`,
}

/**
 * '' -> null (champ vidé). Sinon borne à [0, 100] : la colonne DB (ownership_pct
 * numeric(5,2)) refuse toute valeur hors de cet intervalle (CHECK, migration
 * 20260726130200) — la borne ici évite un aller-retour serveur pour une saisie que
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
    <div style={{ maxWidth: 720, margin: '0 auto', animation: 'sgPage .45s cubic-bezier(.2,.8,.2,1) both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: SugarV2.muted,
          letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
        }}>{t('wizard.beneficiaires.eyebrow')}</div>
        <h1 style={{
          margin: '0 0 14px', fontSize: 32, fontWeight: 700,
          color: SugarV2.ink, letterSpacing: -0.6, lineHeight: 1.15,
        }}>{t('wizard.beneficiaires.title')}</h1>
        <p style={{ margin: 0, fontSize: 15, color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
          {t('wizard.beneficiaires.subtitle')}
        </p>
      </div>

      {signataire && !signataireAlreadyAdded && (
        <div style={{ marginBottom: 20 }}>
          <SgGhostPill onClick={reuseSignataire} icon={<SgIcon name="plus" size={16} stroke={SugarV2.inkSoft} />}>
            {t('wizard.beneficiaires.reuseSignataire', { name: `${signataire.firstName} ${signataire.lastName}` })}
          </SgGhostPill>
        </div>
      )}

      {value.length === 0 ? (
        <p style={{
          margin: '0 0 20px', padding: '16px 20px', borderRadius: 16,
          background: SugarV2.cardSubtle, color: SugarV2.muted,
          fontSize: 13, fontWeight: 500, lineHeight: 1.5, textAlign: 'center',
        }}>
          {t('wizard.beneficiaires.emptyHint')}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
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

      <SgGhostPill onClick={addBlankEntry} icon={<SgIcon name="plus" size={16} stroke={SugarV2.inkSoft} />}>
        {t('wizard.beneficiaires.addButton')}
      </SgGhostPill>
    </div>
  )
}

/** Une ligne de bénéficiaire effectif — bento séparé sans bordure décorative, même grammaire que le reste du wizard (SugarV2.shadow). */
function BeneficiaireCard({
  entry, onChange, onRemove,
}: { entry: BeneficiaireDraft; onChange: (patch: Partial<BeneficiaireDraft>) => void; onRemove: () => void }) {
  const { t } = useTranslation('onboarding')

  return (
    <div style={{
      position: 'relative', background: SugarV2.card, borderRadius: 24, padding: 24,
      boxShadow: SugarV2.shadow, display: 'flex', flexDirection: 'column', gap: 18,
    }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <SgCircleBtn
          size={32}
          icon={<SgIcon name="close" size={14} stroke={SugarV2.muted} />}
          title={t('wizard.beneficiaires.removeButton')}
          onClick={onRemove}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, paddingRight: 40 }}>
        <SgInput
          label={t('wizard.beneficiaires.fields.firstName')}
          value={entry.firstName}
          onChange={(v) => onChange({ firstName: v })}
        />
        <SgInput
          label={t('wizard.beneficiaires.fields.lastName')}
          value={entry.lastName}
          onChange={(v) => onChange({ lastName: v })}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        <SgInput
          label={t('wizard.beneficiaires.fields.dateOfBirth')}
          type="date"
          value={entry.dateOfBirth ?? ''}
          onChange={(v) => onChange({ dateOfBirth: v || null })}
        />
        <label style={{ display: 'block' }}>
          <div style={FIELD_LABEL_STYLE}>{t('wizard.beneficiaires.fields.nationality')}</div>
          <select
            value={entry.nationality ?? ''}
            onChange={(e) => onChange({ nationality: e.target.value || null })}
            style={SELECT_STYLE}
          >
            <option value="">{t('wizard.beneficiaires.fields.nationalityPlaceholder')}</option>
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </label>
      </div>

      <div>
        <SgInput
          label={t('wizard.beneficiaires.fields.ownershipPct')}
          type="number"
          value={entry.ownershipPct != null ? String(entry.ownershipPct) : ''}
          onChange={(v) => onChange({ ownershipPct: parseOwnershipPct(v) })}
        />
        <div style={{ marginTop: 6, fontSize: 12, color: SugarV2.muted, fontWeight: 500, lineHeight: 1.4 }}>
          {t('wizard.beneficiaires.fields.ownershipPctHint')}
        </div>
      </div>

      <div>
        <div style={FIELD_LABEL_STYLE}>{t('wizard.beneficiaires.pep.label')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <PepCard
            selected={entry.pepSelfDeclared === true}
            label={t('wizard.beneficiaires.pep.yes')}
            hint={t('wizard.beneficiaires.pep.yesHint')}
            onClick={() => onChange({ pepSelfDeclared: true })}
          />
          <PepCard
            selected={entry.pepSelfDeclared === false}
            label={t('wizard.beneficiaires.pep.no')}
            hint={t('wizard.beneficiaires.pep.noHint')}
            onClick={() => onChange({ pepSelfDeclared: false })}
          />
        </div>
      </div>
    </div>
  )
}

/** Carte sélectionnable Oui/Non — même grammaire monochrome que SignaturePowerCard (StepSignataire) : pas de couleur décorative. */
function PepCard({
  selected, label, hint, onClick,
}: { selected: boolean; label: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        textAlign: 'left', borderRadius: 16, padding: '14px 16px', cursor: 'pointer',
        fontFamily: 'inherit', background: selected ? SugarV2.cardSubtle : 'transparent',
        border: `1.5px solid ${selected ? SugarV2.ink : SugarV2.line}`,
        transition: 'all .18s ease',
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 700, color: SugarV2.ink, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: SugarV2.muted, fontWeight: 500, lineHeight: 1.4 }}>{hint}</div>
    </button>
  )
}
