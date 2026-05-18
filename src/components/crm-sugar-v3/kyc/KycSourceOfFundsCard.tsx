// MEGGA CRM Sugar v3 — Section "Origine des fonds" (LBA art. 6 al. 1 lit. b)
// Sprint 3 — capture structurée de l'origine économique des fonds.
// Red-team Léa #1 + #5 : sans cette UI, crypto / mixed étaient invisibles
// comme red flag. Ici on documente, on associe une pièce, on logge.

import { useState } from 'react'
import { SugarV3 } from '../tokens'
import { KycBlackPill, KycGhostPill } from '../primitives'
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

const SOURCE_LABELS: Record<KycSourceOfFundsType, { label: string; hint: string; isRedFlag: boolean }> = {
  salary:        { label: 'Salaire / revenus d’activité',         hint: 'Fiches de paie ou attestation employeur',                isRedFlag: false },
  sale_property: { label: 'Vente d’un bien immobilier',           hint: 'Contrat de vente notarié',                              isRedFlag: false },
  sale_business: { label: 'Vente d’entreprise / parts sociales',  hint: 'Acte de cession',                                       isRedFlag: false },
  inheritance:   { label: 'Héritage / donation',                       hint: 'Acte notarié',                                          isRedFlag: false },
  investment:    { label: 'Revenus de placement / dividendes',         hint: 'Relevé bancaire ou attestation fiscale',                isRedFlag: false },
  crypto:        { label: 'Crypto-actifs',                             hint: 'Red flag LBA — description détaillée obligatoire',      isRedFlag: true  },
  loan:          { label: 'Prêt bancaire',                             hint: 'Contrat de prêt + attestation banque',                  isRedFlag: false },
  mixed:         { label: 'Origine mixte',                             hint: 'Red flag LBA — détailler chaque source',                isRedFlag: true  },
  other:         { label: 'Autre',                                     hint: 'Description obligatoire',                               isRedFlag: true  },
}

export function KycSourceOfFundsCard({ dossier, documents, agentId }: Props) {
  const [editing, setEditing] = useState(false)
  const update = useUpdateKycSourceOfFunds()
  const [error, setError] = useState<string | null>(null)

  const currentType = dossier.source_of_funds_type
  const currentDoc = dossier.source_of_funds_doc_id
    ? documents.find((d) => d.id === dossier.source_of_funds_doc_id) ?? null
    : null
  const isRedFlag = currentType ? SOURCE_LABELS[currentType].isRedFlag : false

  const handleSubmit = (
    sourceType: KycSourceOfFundsType,
    description: string | null,
    docId: string | null
  ) => {
    setError(null)
    if (!dossier.agency_id) {
      setError('agency_id manquant.')
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
          setError(err instanceof Error ? err.message : 'Échec de l’enregistrement.'),
      }
    )
  }

  return (
    <>
      <div
        style={{
          background: SugarV3.card,
          borderRadius: 22,
          padding: '24px 28px',
          boxShadow: SugarV3.shadow,
          marginBottom: 24,
          animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
          border: isRedFlag ? `1px solid ${SugarV3.err}33` : undefined,
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
                color: SugarV3.muted,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Origine économique · LBA art. 6 al. 1 lit. b
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: SugarV3.ink,
                letterSpacing: -0.3,
              }}
            >
              Source des fonds
            </h3>
          </div>
          <KycGhostPill
            onClick={() => setEditing(true)}
            icon={<SgIcon name="pencil" size={14} stroke={SugarV3.inkSoft} />}
          >
            {currentType ? 'Modifier' : 'Documenter'}
          </KycGhostPill>
        </div>

        {!currentType ? (
          <div
            style={{
              padding: '14px 16px',
              background: SugarV3.cardSubtle,
              borderRadius: 14,
              fontSize: 13,
              color: SugarV3.muted,
              fontWeight: 500,
              lineHeight: 1.55,
            }}
          >
            Non documentée. Pour les transactions à vigilance renforcée et tout montant
            supérieur à CHF 100&apos;000, l&apos;arrière-plan économique doit être clarifié et conservé.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 6,
              fontSize: 13.5,
              color: SugarV3.ink,
              fontWeight: 500,
              lineHeight: 1.55,
            }}
          >
            <div>
              <strong style={{ fontWeight: 700 }}>{SOURCE_LABELS[currentType].label}</strong>
              {isRedFlag && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    color: SugarV3.errDarker,
                  }}
                >
                  Red flag LBA
                </span>
              )}
            </div>
            {dossier.source_of_funds_description && (
              <div style={{ color: SugarV3.inkSoft, fontSize: 13 }}>
                {dossier.source_of_funds_description}
              </div>
            )}
            <div style={{ color: SugarV3.muted, fontSize: 12 }}>
              {currentDoc ? (
                <>Pièce liée : <strong style={{ color: SugarV3.ink }}>{currentDoc.name}</strong></>
              ) : (
                <em>Aucune pièce associée — à téléverser.</em>
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
              background: SugarV3.errSoft,
              borderRadius: 12,
              fontSize: 12.5,
              fontWeight: 600,
              color: SugarV3.errDarker,
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

function SourceOfFundsOverlay({
  dossier,
  documents,
  isPending,
  onCancel,
  onSubmit,
}: OverlayProps) {
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
          background: SugarV3.card,
          borderRadius: 22,
          padding: '28px 30px',
          boxShadow: SugarV3.shadowLg,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: SugarV3.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          LBA art. 6 al. 1 lit. b · Arrière-plan économique
        </div>
        <h2
          style={{
            margin: '0 0 18px',
            fontSize: 22,
            fontWeight: 700,
            color: SugarV3.ink,
            letterSpacing: -0.4,
          }}
        >
          Documenter l&apos;origine des fonds
        </h2>

        <label
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 600,
            color: SugarV3.inkSoft,
            marginBottom: 6,
          }}
        >
          Type
        </label>
        <select
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value as KycSourceOfFundsType)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 12,
            border: `1px solid ${SugarV3.cardSubtle}`,
            background: SugarV3.cardSubtle,
            fontFamily: 'inherit',
            fontSize: 14,
            color: SugarV3.ink,
            marginBottom: 6,
          }}
        >
          {(Object.keys(SOURCE_LABELS) as KycSourceOfFundsType[]).map((t) => (
            <option key={t} value={t}>
              {SOURCE_LABELS[t].label}
              {SOURCE_LABELS[t].isRedFlag ? ' (red flag)' : ''}
            </option>
          ))}
        </select>
        <div
          style={{
            fontSize: 11.5,
            color: SugarV3.muted,
            fontWeight: 500,
            marginBottom: 18,
          }}
        >
          {SOURCE_LABELS[sourceType].hint}
        </div>

        <label
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 600,
            color: SugarV3.inkSoft,
            marginBottom: 6,
          }}
        >
          Description {requiresDesc ? `(${descTrimLen}/20 caractères min)` : '(optionnelle)'}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder={
            sourceType === 'crypto'
              ? 'Ex : USDT achetés en 2021 sur Kraken, exchange régulé FINMA, conservation cold wallet, attestation jointe.'
              : 'Précisez l’arrière-plan économique : période, instruments, contreparties.'
          }
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 12,
            border: `1px solid ${SugarV3.cardSubtle}`,
            background: SugarV3.cardSubtle,
            fontFamily: 'inherit',
            fontSize: 13,
            color: SugarV3.ink,
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
            color: SugarV3.inkSoft,
            marginBottom: 6,
          }}
        >
          Pièce justificative (catégorie financial ou compliance)
        </label>
        <select
          value={docId}
          onChange={(e) => setDocId(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 12,
            border: `1px solid ${SugarV3.cardSubtle}`,
            background: SugarV3.cardSubtle,
            fontFamily: 'inherit',
            fontSize: 13,
            color: SugarV3.ink,
            marginBottom: 22,
          }}
        >
          <option value="">— Aucune pièce —</option>
          {eligibleDocs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} · {d.document_category}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <KycGhostPill onClick={onCancel}>Annuler</KycGhostPill>
          <KycBlackPill
            size="md"
            onClick={() =>
              canSubmit && onSubmit(sourceType, description || null, docId || null)
            }
            disabled={!canSubmit}
            icon={<SgIcon name="check" size={14} stroke="#fff" />}
          >
            {isPending ? 'Enregistrement…' : 'Enregistrer'}
          </KycBlackPill>
        </div>
      </div>
    </div>
  )
}
