// MEGGA CRM Sugar v3 — Overlay "Origine des fonds" (LBA art. 6 al. 1 lit. b)
// Sprint 3 — capture structurée de l'origine économique des fonds.
// Red-team Léa #1 + #5 : sans cette UI, crypto / mixed étaient invisibles
// comme red flag. Ici on documente, on associe une pièce, on logge.

import { useState, useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { KycBlackPill, KycGhostPill } from './kycPrimitives'
import { useKycPalette } from './kycPalette'
import { SgIcon } from '../icons'
import type {
  KycCase,
  KycDocument,
  KycSourceOfFundsType,
} from '@/types/kyc'
import { useFocusTrap } from '@/hooks/useFocusTrap'

/** Libellés des types d'origine des fonds. `isRedFlag` est une donnée métier
 * (LBA), pas du texte — seuls `label`/`hint` sont traduits via `t`. */
function buildSourceLabels(
  t: TFunction
): Record<KycSourceOfFundsType, { label: string; hint: string; isRedFlag: boolean }> {
  return {
    salary:        { label: t('dossier.funds.types.salary.label'),        hint: t('dossier.funds.types.salary.hint'),        isRedFlag: false },
    sale_property: { label: t('dossier.funds.types.sale_property.label'),  hint: t('dossier.funds.types.sale_property.hint'),  isRedFlag: false },
    sale_business: { label: t('dossier.funds.types.sale_business.label'),  hint: t('dossier.funds.types.sale_business.hint'),  isRedFlag: false },
    inheritance:   { label: t('dossier.funds.types.inheritance.label'),    hint: t('dossier.funds.types.inheritance.hint'),    isRedFlag: false },
    investment:    { label: t('dossier.funds.types.investment.label'),     hint: t('dossier.funds.types.investment.hint'),     isRedFlag: false },
    crypto:        { label: t('dossier.funds.types.crypto.label'),         hint: t('dossier.funds.types.crypto.hint'),         isRedFlag: true  },
    loan:          { label: t('dossier.funds.types.loan.label'),           hint: t('dossier.funds.types.loan.hint'),           isRedFlag: false },
    mixed:         { label: t('dossier.funds.types.mixed.label'),          hint: t('dossier.funds.types.mixed.hint'),          isRedFlag: true  },
    other:         { label: t('dossier.funds.types.other.label'),          hint: t('dossier.funds.types.other.hint'),          isRedFlag: true  },
  }
}


interface OverlayProps {
  dossier: KycCase
  documents: KycDocument[]
  isPending: boolean
  onCancel: () => void
  onSubmit: (
    sourceType: KycSourceOfFundsType,
    description: string | null,
    docId: string | null
  ) => void
}

export function SourceOfFundsOverlay({
  dossier,
  documents,
  isPending,
  onCancel,
  onSubmit,
}: OverlayProps) {
  const sp = useKycPalette()
  const refPiegeFocus = useFocusTrap(true, onCancel)
  // Le dialogue est nommé par son titre visible plutôt que par une chaîne
  // recopiée : les deux ne peuvent pas diverger.
  const titreId = useId()
  const { t } = useTranslation('kyc')
  const sourceLabels = buildSourceLabels(t)
  const [sourceType, setSourceType] = useState<KycSourceOfFundsType>(
    dossier.source_of_funds_type ?? 'salary'
  )
  const [description, setDescription] = useState(dossier.source_of_funds_description ?? '')
  const [docId, setDocId] = useState<string>(dossier.source_of_funds_doc_id ?? '')

  const requiresDesc =
    sourceType === 'crypto' || sourceType === 'mixed' || sourceType === 'other'
  const descTrimLen = description.trim().length
  const descOk = !requiresDesc || descTrimLen >= 20
  const canSubmit = descOk && !isPending

  const eligibleDocs = documents.filter(
    (d) => d.document_category === 'financial' || d.document_category === 'compliance'
  )

  return (
    <div
      ref={refPiegeFocus}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titreId}
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9100,
        background: 'rgba(11,12,14,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--crm-space-7xl)',
        animation: 'sgFadeUp .25s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 600,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: sp.card,
          borderRadius: 'var(--crm-radius-5xl)',
          padding: '28px 30px',
          border: `1px solid ${sp.cardBorder}`,
          boxShadow: sp.shadowLg,
        }}
      >
        <div
          style={{
            fontSize: 'var(--crm-text-sm)',
            fontWeight: 600,
            color: sp.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          {t('dossier.funds.overlayEyebrow')}
        </div>
        <h2
          id={titreId}
          style={{
            margin: '0 0 18px',
            fontSize: 'var(--crm-text-4xl)',
            fontWeight: 700,
            color: sp.ink,
            letterSpacing: -0.4,
          }}
        >
          {t('dossier.funds.overlayTitle')}
        </h2>

        <label
          style={{
            display: 'block',
            fontSize: 'var(--crm-text-md)',
            fontWeight: 600,
            color: sp.inkSoft,
            marginBottom: 6,
          }}
        >
          {t('dossier.funds.typeLabel')}
        </label>
        <select
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value as KycSourceOfFundsType)}
          style={{
            width: '100%',
            padding: 'var(--crm-space-lg) var(--crm-space-xl)',
            borderRadius: 'var(--crm-radius-lg)',
            border: `1px solid ${sp.cardSubtle}`,
            background: sp.cardSubtle,
            fontFamily: 'inherit',
            fontSize: 'var(--crm-text-xl)',
            color: sp.ink,
            marginBottom: 6,
          }}
        >
          {(Object.keys(sourceLabels) as KycSourceOfFundsType[]).map((type) => (
            <option key={type} value={type}>
              {sourceLabels[type].label}
              {sourceLabels[type].isRedFlag ? ` ${t('dossier.funds.redFlagSuffix')}` : ''}
            </option>
          ))}
        </select>
        <div
          style={{
            fontSize: 'var(--crm-text-sm)',
            color: sp.muted,
            fontWeight: 500,
            marginBottom: 18,
          }}
        >
          {sourceLabels[sourceType].hint}
        </div>

        <label
          style={{
            display: 'block',
            fontSize: 'var(--crm-text-md)',
            fontWeight: 600,
            color: sp.inkSoft,
            marginBottom: 6,
          }}
        >
          {requiresDesc
            ? t('dossier.funds.descriptionLabelRequired', { count: descTrimLen })
            : t('dossier.funds.descriptionLabelOptional')}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder={
            sourceType === 'crypto'
              ? t('dossier.funds.descriptionPlaceholderCrypto')
              : t('dossier.funds.descriptionPlaceholder')
          }
          style={{
            width: '100%',
            padding: 'var(--crm-space-xl) var(--crm-space-2xl)',
            borderRadius: 'var(--crm-radius-lg)',
            border: `1px solid ${sp.cardSubtle}`,
            background: sp.cardSubtle,
            fontFamily: 'inherit',
            fontSize: 'var(--crm-text-lg)',
            color: sp.ink,
            marginBottom: 18,
            resize: 'vertical',
            minHeight: 90,
          }}
        />

        <label
          style={{
            display: 'block',
            fontSize: 'var(--crm-text-md)',
            fontWeight: 600,
            color: sp.inkSoft,
            marginBottom: 6,
          }}
        >
          {t('dossier.funds.docLabel')}
        </label>
        <select
          value={docId}
          onChange={(e) => setDocId(e.target.value)}
          style={{
            width: '100%',
            padding: 'var(--crm-space-lg) var(--crm-space-xl)',
            borderRadius: 'var(--crm-radius-lg)',
            border: `1px solid ${sp.cardSubtle}`,
            background: sp.cardSubtle,
            fontFamily: 'inherit',
            fontSize: 'var(--crm-text-lg)',
            color: sp.ink,
            marginBottom: 22,
          }}
        >
          <option value="">{t('dossier.funds.docNone')}</option>
          {eligibleDocs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} · {d.document_category}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--crm-space-lg)' }}>
          <KycGhostPill onClick={onCancel}>{t('dossier.funds.cancel')}</KycGhostPill>
          <KycBlackPill
            size="md"
            onClick={() =>
              canSubmit && onSubmit(sourceType, description || null, docId || null)
            }
            disabled={!canSubmit}
            icon={<SgIcon name="check" size={14} stroke={sp.onAccent} />}
          >
            {isPending ? t('dossier.funds.saving') : t('dossier.funds.save')}
          </KycBlackPill>
        </div>
      </div>
    </div>
  )
}
