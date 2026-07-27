/**
 * Wizard « Identité légale » (KYB) — étape 1, le signataire.
 *
 * Saisit l'identité de la personne autorisée à engager l'agence (prénom, nom,
 * date de naissance, nationalité) et son pouvoir de signature. Contrôlée par
 * IdentityShell (value/onChange) : cette étape ne détient aucun état propre et
 * n'écrit rien elle-même — IdentityShell persiste le brouillon via
 * useAgencyIdentity().savePerson() au changement d'étape (cf. son en-tête).
 *
 * Champs à fournir avant de pouvoir avancer (gate : IdentityShell.isSignataireStepComplete) :
 * prénom, nom, date de naissance, nationalité, pouvoir de signature.
 */
import { useTranslation } from 'react-i18next'
import { SugarV2 } from '../tokens'
import { SgInput } from '@/components/crm-sugar-wizard/primitives'
import { COUNTRIES } from '@/lib/countries'
import type { SignataireDraft } from '../IdentityShell'

interface StepSignataireProps {
  value: SignataireDraft
  onChange: (patch: Partial<SignataireDraft>) => void
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

/** Étape 1 du wizard identité : formulaire du signataire autorisé. */
export function StepSignataire({ value, onChange }: StepSignataireProps) {
  const { t } = useTranslation('onboarding')

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', animation: 'sgPage .45s cubic-bezier(.2,.8,.2,1) both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: SugarV2.muted,
          letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
        }}>{t('wizard.signataire.eyebrow')}</div>
        <h1 style={{
          margin: '0 0 14px', fontSize: 32, fontWeight: 700,
          color: SugarV2.ink, letterSpacing: -0.6, lineHeight: 1.15,
        }}>{t('wizard.signataire.title')}</h1>
        <p style={{ margin: 0, fontSize: 15, color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
          {t('wizard.signataire.subtitle')}
        </p>
      </div>

      <div style={{
        background: SugarV2.card, borderRadius: 24, padding: 24,
        boxShadow: SugarV2.shadow, display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          <SgInput
            label={t('wizard.signataire.fields.firstName')}
            value={value.firstName}
            onChange={(v) => onChange({ firstName: v })}
            autoFocus
          />
          <SgInput
            label={t('wizard.signataire.fields.lastName')}
            value={value.lastName}
            onChange={(v) => onChange({ lastName: v })}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          <SgInput
            label={t('wizard.signataire.fields.dateOfBirth')}
            type="date"
            value={value.dateOfBirth ?? ''}
            onChange={(v) => onChange({ dateOfBirth: v || null })}
          />
          <label style={{ display: 'block' }}>
            <div style={FIELD_LABEL_STYLE}>{t('wizard.signataire.fields.nationality')}</div>
            <select
              value={value.nationality ?? ''}
              onChange={(e) => onChange({ nationality: e.target.value || null })}
              style={SELECT_STYLE}
            >
              <option value="">{t('wizard.signataire.fields.nationalityPlaceholder')}</option>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </label>
        </div>

        <div>
          <div style={FIELD_LABEL_STYLE}>{t('wizard.signataire.fields.signaturePower')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <SignaturePowerCard
              selected={value.signaturePower === 'individual'}
              label={t('wizard.signataire.signaturePower.individual')}
              hint={t('wizard.signataire.signaturePower.individualHint')}
              onClick={() => onChange({ signaturePower: 'individual' })}
            />
            <SignaturePowerCard
              selected={value.signaturePower === 'joint'}
              label={t('wizard.signataire.signaturePower.joint')}
              hint={t('wizard.signataire.signaturePower.jointHint')}
              onClick={() => onChange({ signaturePower: 'joint' })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Carte sélectionnable individual/joint — monochrome, pas de couleur décorative (cf. règle steppers/pills). */
function SignaturePowerCard({
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
