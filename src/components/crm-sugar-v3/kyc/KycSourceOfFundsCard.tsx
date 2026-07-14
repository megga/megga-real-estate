// MEGGA CRM Sugar v3 — Section "Origine des fonds" (LBA art. 6 al. 1 lit. b)
// Sprint 3 — capture structurée de l'origine économique des fonds.
// Red-team Léa #1 + #5 : sans cette UI, crypto / mixed étaient invisibles
// comme red flag. Ici on documente, on associe une pièce, on logge.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { KycBlackPill, KycGhostPill } from './kycPrimitives'
import { useKycPalette } from './kycPalette'
import { SgIcon } from '../icons'
import { useUpdateKycSourceOfFunds } from '@/hooks/useKyc'
import type {
  KycCase,
  KycDocument,
  KycSourceOfFundsType,
} from '@/types/kyc'

interface Props {
  dossier: KycCase
  documents: KycDocument[]
  agentId: string
}

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

export function KycSourceOfFundsCard({ dossier, documents, agentId }: Props) {
  const sp = useKycPalette()
  const { t } = useTranslation('kyc')
  const sourceLabels = buildSourceLabels(t)
  const [editing, setEditing] = useState(false)
  const update = useUpdateKycSourceOfFunds()
  const [error, setError] = useState<string | null>(null)

  const currentType = dossier.source_of_funds_type
  const currentDoc = dossier.source_of_funds_doc_id
    ? documents.find((d) => d.id === dossier.source_of_funds_doc_id) ?? null
    : null
  const isRedFlag = currentType ? sourceLabels[currentType].isRedFlag : false

  const handleSubmit = (
    sourceType: KycSourceOfFundsType,
    description: string | null,
    docId: string | null
  ) => {
    setError(null)
    if (!dossier.agency_id) {
      setError(t('dossier.funds.errorAgencyMissing'))
      return
    }
    update.mutate(
      {
        kycCaseId: dossier.id,
        agencyId: dossier.agency_id,
        actorId: agentId,
        sourceType,
        description,
        docId,
      },
      {
        onSuccess: () => setEditing(false),
        onError: (err) =>
          setError(err instanceof Error ? err.message : t('dossier.funds.errorSave')),
      }
    )
  }

  return (
    <>
      <div
        style={{
          background: sp.card,
          borderRadius: 22,
          padding: '24px 28px',
          boxShadow: sp.shadow,
          marginBottom: 24,
          animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
          border: isRedFlag ? `1px solid ${sp.err}33` : `1px solid ${sp.cardBorder}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: sp.muted,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              {t('dossier.funds.eyebrow')}
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: sp.ink,
                letterSpacing: -0.3,
              }}
            >
              {t('dossier.funds.title')}
            </h3>
          </div>
          <KycGhostPill
            onClick={() => setEditing(true)}
            icon={<SgIcon name="pencil" size={14} stroke={sp.inkSoft} />}
          >
            {currentType ? t('dossier.funds.edit') : t('dossier.funds.document')}
          </KycGhostPill>
        </div>

        {!currentType ? (
          <div
            style={{
              padding: '14px 16px',
              background: sp.cardSubtle,
              borderRadius: 14,
              fontSize: 13,
              color: sp.muted,
              fontWeight: 500,
              lineHeight: 1.55,
            }}
          >
            {t('dossier.funds.notDocumented')}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 6,
              fontSize: 13.5,
              color: sp.ink,
              fontWeight: 500,
              lineHeight: 1.55,
            }}
          >
            <div>
              <strong style={{ fontWeight: 700 }}>{sourceLabels[currentType].label}</strong>
              {isRedFlag && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    color: sp.errDarker,
                  }}
                >
                  {t('dossier.funds.redFlag')}
                </span>
              )}
            </div>
            {dossier.source_of_funds_description && (
              <div style={{ color: sp.inkSoft, fontSize: 13 }}>
                {dossier.source_of_funds_description}
              </div>
            )}
            <div style={{ color: sp.muted, fontSize: 12 }}>
              {currentDoc ? (
                <>{t('dossier.funds.linkedDoc')} <strong style={{ color: sp.ink }}>{currentDoc.name}</strong></>
              ) : (
                <em>{t('dossier.funds.noLinkedDoc')}</em>
              )}
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              marginTop: 12,
              padding: '10px 14px',
              background: sp.errSoft,
              borderRadius: 12,
              fontSize: 12.5,
              fontWeight: 600,
              color: sp.errDarker,
            }}
          >
            {error}
          </div>
        )}
      </div>

      {editing && (
        <SourceOfFundsOverlay
          dossier={dossier}
          documents={documents}
          isPending={update.isPending}
          onCancel={() => setEditing(false)}
          onSubmit={handleSubmit}
        />
      )}
    </>
  )
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
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9100,
        background: 'rgba(11,12,14,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
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
          borderRadius: 22,
          padding: '28px 30px',
          border: `1px solid ${sp.cardBorder}`,
          boxShadow: sp.shadowLg,
        }}
      >
        <div
          style={{
            fontSize: 11,
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
          style={{
            margin: '0 0 18px',
            fontSize: 22,
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
            fontSize: 12,
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
            padding: '10px 12px',
            borderRadius: 12,
            border: `1px solid ${sp.cardSubtle}`,
            background: sp.cardSubtle,
            fontFamily: 'inherit',
            fontSize: 14,
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
            fontSize: 11.5,
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
            fontSize: 12,
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
            padding: '12px 14px',
            borderRadius: 12,
            border: `1px solid ${sp.cardSubtle}`,
            background: sp.cardSubtle,
            fontFamily: 'inherit',
            fontSize: 13,
            color: sp.ink,
            marginBottom: 18,
            resize: 'vertical',
            minHeight: 90,
          }}
        />

        <label
          style={{
            display: 'block',
            fontSize: 12,
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
            padding: '10px 12px',
            borderRadius: 12,
            border: `1px solid ${sp.cardSubtle}`,
            background: sp.cardSubtle,
            fontFamily: 'inherit',
            fontSize: 13,
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
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
