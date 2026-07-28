/**
 * Wizard « Identité légale » (KYB) — étape 2, l'agence.
 *
 * Saisit l'identité légale de l'agence elle-même (pays du siège, forme juridique,
 * raison sociale, nom commercial, numéro de registre, TVA, adresse, NPA, ville,
 * canton). Contrôlée par IdentityShell (value/onChange) : cette étape ne détient
 * aucun état propre et n'écrit rien elle-même — IdentityShell persiste le brouillon
 * via useAgencyIdentity().saveAgency() au changement d'étape (cf. son en-tête).
 * Reprend la forme de StepSignataire (en-tête eyebrow/titre/sous-titre + bento de
 * champs), première étape du wizard livrée à la tâche 3.
 *
 * Deux dépendances d'ordre, ni l'une ni l'autre cosmétique (cf. brief tâche 4) :
 * 1. Le pays du siège filtre la liste des formes juridiques (useLegalForms(country),
 *    déjà filtrée par pays). Changer le pays remet ICI à zéro une forme juridique
 *    devenue incohérente (legalFormIdAfterCountryChange, IdentityShell.tsx) — jamais
 *    laissée en place silencieusement, puisque chaque legal_forms.id n'appartient
 *    qu'à un seul pays.
 * 2. La catégorie de la forme choisie décide de l'affichage de l'étape 3 (tâche 5) :
 *    une raison individuelle n'a pas de bénéficiaire effectif tiers, le signataire
 *    EST l'entité. Cette étape n'implémente pas ce saut elle-même : elle se contente
 *    d'écrire `legalFormId` dans le brouillon via `onChange`. C'est IdentityShell.tsx
 *    qui décide, à partir de CE BROUILLON — jamais de `useAgencyIdentity().legalFormCategory`,
 *    qui ne reflète que l'agence persistée / le dernier `saveAgency()` résolu, jamais
 *    une frappe pas encore sauvegardée (cf. l'en-tête de useAgencyIdentity.ts). Les
 *    deux passent par la même dérivation, `useLegalFormCategory` (useAgencyIdentity.ts,
 *    correctif revue tâche 5) — voir son en-tête et celui d'IdentityShell.tsx.
 *
 * Champs à fournir avant de pouvoir avancer (gate : IdentityShell.isAgencyStepComplete) :
 * 9 des 10 champs ci-dessus, même logique tout-ou-rien que le signataire. Exception
 * décidée le 27.07.2026 : la TVA reste saisissable et, si renseignée, persistée
 * normalement — mais elle ne bloque plus l'avancement (seuil d'assujettissement
 * suisse, cf. le commentaire d'isAgencyStepComplete pour le détail). Seule indication
 * visuelle de ce caractère facultatif : le FieldHint sous le champ, plus bas.
 */
import { useTranslation } from 'react-i18next'
import { SugarV2 } from '../tokens'
import { SgInput } from '@/components/crm-sugar-wizard/primitives'
import { COUNTRIES } from '@/lib/countries'
import { CANTONS } from '@/lib/constants'
import { useLegalForms } from '@/hooks/useLegalForms'
import { legalFormIdAfterCountryChange, type AgencyDraft } from '../IdentityShell'

interface StepAgenceProps {
  value: AgencyDraft
  onChange: (patch: Partial<AgencyDraft>) => void
}

/**
 * Pays de siège pris en charge — les 3 juridictions couvertes par legal_forms
 * (migration 20260728100000 : Suisse/France/Liechtenstein). Sous-ensemble de
 * COUNTRIES (mêmes codes/libellés — même limitation « libellés français seulement »
 * déjà acceptée par le select nationalité de StepSignataire, pas un choix nouveau
 * pris ici) : présenter les 195 pays de COUNTRIES ferait retomber la quasi-totalité
 * des choix dans le repli « pays non reconnu » de useLegalForms (toutes les formes
 * mélangées, suffixées du code pays) — exactement l'ambiguïté que ce hook existe
 * pour éviter.
 */
const AGENCY_COUNTRIES = COUNTRIES.filter((c) => c.code === 'CH' || c.code === 'FR' || c.code === 'LI')

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

/** Légende sous un champ — même langage visuel que le hint des cartes de pouvoir de
 *  signature (StepSignataire), réutilisé ici pour clarifier raison sociale vs nom
 *  commercial sans jargon (cf. en-tête du fichier et brief tâche 4). */
function FieldHint({ text }: { text: string }) {
  return (
    <div style={{ marginTop: 6, fontSize: 12, color: SugarV2.muted, fontWeight: 500, lineHeight: 1.4 }}>
      {text}
    </div>
  )
}

/** Étape 2 du wizard identité : formulaire de l'identité légale de l'agence. */
export function StepAgence({ value, onChange }: StepAgenceProps) {
  const { t } = useTranslation('onboarding')

  // Filtrée par le pays du siège COURANT du brouillon (pas encore persisté tant que
  // l'étape n'est pas complète) — c'est la dépendance d'ordre n°1 du brief.
  const { options: legalFormOptions, isLoading: legalFormsLoading } = useLegalForms(value.country)
  const legalFormDisabled = !value.country || legalFormsLoading

  const onCountryChange = (nextCountry: string) => {
    onChange({
      country: nextCountry,
      legalFormId: legalFormIdAfterCountryChange(value.country, nextCountry, value.legalFormId),
    })
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', animation: 'sgPage .45s cubic-bezier(.2,.8,.2,1) both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: SugarV2.muted,
          letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
        }}>{t('wizard.agence.eyebrow')}</div>
        <h1 style={{
          margin: '0 0 14px', fontSize: 32, fontWeight: 700,
          color: SugarV2.ink, letterSpacing: -0.6, lineHeight: 1.15,
        }}>{t('wizard.agence.title')}</h1>
        <p style={{ margin: 0, fontSize: 15, color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
          {t('wizard.agence.subtitle')}
        </p>
      </div>

      <div style={{
        background: SugarV2.card, borderRadius: 24, padding: 24,
        boxShadow: SugarV2.shadow, display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          <label style={{ display: 'block' }}>
            <div style={FIELD_LABEL_STYLE}>{t('wizard.agence.fields.country')}</div>
            <select
              value={value.country}
              onChange={(e) => onCountryChange(e.target.value)}
              style={SELECT_STYLE}
            >
              <option value="">{t('wizard.agence.fields.countryPlaceholder')}</option>
              {AGENCY_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </label>
          <label style={{ display: 'block' }}>
            <div style={FIELD_LABEL_STYLE}>{t('wizard.agence.fields.legalFormId')}</div>
            <select
              value={value.legalFormId}
              onChange={(e) => onChange({ legalFormId: e.target.value })}
              disabled={legalFormDisabled}
              style={{
                ...SELECT_STYLE,
                opacity: legalFormDisabled ? 0.55 : 1,
                cursor: legalFormDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              <option value="">
                {value.country ? t('wizard.agence.fields.legalFormPlaceholder') : t('wizard.agence.fields.legalFormPlaceholderNoCountry')}
              </option>
              {legalFormOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          <div>
            <SgInput
              label={t('wizard.agence.fields.legalName')}
              value={value.legal}
              onChange={(v) => onChange({ legal: v })}
              autoFocus
            />
            <FieldHint text={t('wizard.agence.fields.legalNameHint')} />
          </div>
          <div>
            <SgInput
              label={t('wizard.agence.fields.tradeName')}
              value={value.tradeName}
              onChange={(v) => onChange({ tradeName: v })}
            />
            <FieldHint text={t('wizard.agence.fields.tradeNameHint')} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          <SgInput
            label={t('wizard.agence.fields.businessRegistrationNumber')}
            value={value.businessRegistrationNumber}
            onChange={(v) => onChange({ businessRegistrationNumber: v })}
          />
          <div>
            <SgInput
              label={t('wizard.agence.fields.tva')}
              value={value.tva}
              onChange={(v) => onChange({ tva: v })}
            />
            {/* Seul champ facultatif de l'étape (décision produit 27.07.2026) : SgInput n'a
                pas de marqueur "requis"/"facultatif" (cf. primitives.tsx), cette mention
                sous le champ est donc la seule indication visuelle du caractère optionnel. */}
            <FieldHint text={t('wizard.agence.fields.tvaHint')} />
          </div>
        </div>

        <SgInput
          label={t('wizard.agence.fields.address')}
          value={value.address}
          onChange={(v) => onChange({ address: v })}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 14 }}>
          <SgInput
            label={t('wizard.agence.fields.postal')}
            value={value.postal}
            onChange={(v) => onChange({ postal: v })}
          />
          <SgInput
            label={t('wizard.agence.fields.city')}
            value={value.city}
            onChange={(v) => onChange({ city: v })}
          />
          <label style={{ display: 'block' }}>
            <div style={FIELD_LABEL_STYLE}>{t('wizard.agence.fields.canton')}</div>
            <select
              value={value.canton}
              onChange={(e) => onChange({ canton: e.target.value })}
              style={SELECT_STYLE}
            >
              <option value="">{t('wizard.agence.fields.cantonPlaceholder')}</option>
              {CANTONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
      </div>
    </div>
  )
}
