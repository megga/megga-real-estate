// MEGGA CRM Sugar v3 — Vue détail dossier (orchestrateur, onglets)
// Port du handoff Claude Design juin 2026 (crm-screen-kyc-sugar.jsx §KycDossierDetail).
//
// Structure à onglets (handoff §5) : header compact + navbar segmentée sticky
//   Synthèse · Contrôles · Documents · Audit
// Tout le câblage backend (screening Dilisense, garde LBA art. 9, décisions
// compliance, source des fonds, upload, audit réel) est PRÉSERVÉ.
//
// Politique non-bloquante (CLAUDE.md) : aucun libellé n'implique un blocage du
// pipeline. La SEULE garde restante est l'intégrité LBA art. 9 — on ne peut pas
// auto-attester « vérifié » tant qu'un match sanctions/PEP n'est pas examiné
// (chemin humain : Examiner → faux positif → débloque). Ce n'est pas du gating
// pipeline : le deal avance indépendamment.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { SgIcon } from '../icons'
import { useKycPalette } from './kycPalette'
import { KycBlackPill, KycGhostPill } from './kycPrimitives'
import { KycDetailHeader } from './KycDetailHeader'
import { KycSegTabs, type KycSegTab } from './KycSegTabs'
import { KycSynthese } from './KycSynthese'
import { KycCheckCard } from './KycCheckCard'
import { KycDocsSection } from './KycDocsSection'
import { KycAuditTrail } from './KycAuditTrail'
import { KycSourceOfFundsCard } from './KycSourceOfFundsCard'
import {
  useKycCase,
  useKycDocuments,
  useKycAuditEvents,
  useScreenKycCase,
  useUploadKycDocument,
  useLatestKycScreeningDecision,
  useCreateKycScreeningDecision,
  useLogKycRead,
} from '@/hooks/useKyc'
import {
  useMarkKycCheck,
  useMarkAllChecksCompleted,
} from '@/hooks/useKycDossier'
import { supabase } from '@/lib/supabase'
import type {
  KycCheckCategory,
  KycChecklistItem,
  KycCaseWithChecklist,
  ScreeningDecisionTarget,
  ScreeningDecisionVerdict,
} from '@/types/kyc'

type ScreeningGuard =
  | { status: 'ok' }
  | { status: 'match'; kind: 'sanctions' | 'pep' }
  | { status: 'pending' }
  | { status: 'missing' }

interface DilisenseRecordView {
  name?: string
  source_id?: string
  source_type?: string
  [key: string]: unknown
}

interface ScreeningDetails {
  total?: number
  records?: DilisenseRecordView[]
}

/** Libellés des verdicts d'examen compliance. `tone` est une donnée (couleur),
 * seuls `label`/`hint` sont traduits via `t`. */
function buildVerdictLabels(
  t: TFunction
): Record<ScreeningDecisionVerdict, { label: string; hint: string; tone: 'ok' | 'err' | 'warn' | 'neutral' }> {
  return {
    false_positive: {
      label: t('dossier.verdict.false_positive.label'),
      hint: t('dossier.verdict.false_positive.hint'),
      tone: 'ok',
    },
    true_match: {
      label: t('dossier.verdict.true_match.label'),
      hint: t('dossier.verdict.true_match.hint'),
      tone: 'err',
    },
    escalated: {
      label: t('dossier.verdict.escalated.label'),
      hint: t('dossier.verdict.escalated.hint'),
      tone: 'warn',
    },
    awaiting_evidence: {
      label: t('dossier.verdict.awaiting_evidence.label'),
      hint: t('dossier.verdict.awaiting_evidence.hint'),
      tone: 'neutral',
    },
  }
}

interface Props {
  dossierId: string
  agentId: string
  onBack: () => void
  /** Fond de page (sp.pageBg) — sert au fond de la navbar sticky. */
  pageBg: string
}

const CHECK_KEYS: KycCheckCategory[] = ['id', 'address', 'pep', 'sanctions', 'funds']

export function KycDossierDetail({ dossierId, agentId, onBack, pageBg }: Props) {
  const sp = useKycPalette()
  const { t } = useTranslation('kyc')
  const verdictLabels = buildVerdictLabels(t)
  const { data: dossier, isLoading, isError, error, refetch } = useKycCase(dossierId)
  const { data: docs = [] } = useKycDocuments(dossierId)
  const { data: auditEvents = [] } = useKycAuditEvents(dossierId)
  const markCheck = useMarkKycCheck()
  const markAll = useMarkAllChecksCompleted()
  const screen = useScreenKycCase()
  const uploadDoc = useUploadKycDocument()
  const createDecision = useCreateKycScreeningDecision()
  const logRead = useLogKycRead()
  const { data: sanctionsDecision } = useLatestKycScreeningDecision(dossierId, 'sanctions')
  const { data: pepDecision } = useLatestKycScreeningDecision(dossierId, 'pep')

  const [tab, setTab] = useState<'synthese' | 'controles' | 'documents' | 'audit'>('synthese')

  // nLPD art. 12 — log de l'accès consultation au dossier KYC (Roger #1).
  const readLoggedRef = useRef<string | null>(null)
  const logReadMutate = logRead.mutate
  useEffect(() => {
    if (!dossier?.agency_id || readLoggedRef.current === dossierId) return
    readLoggedRef.current = dossierId
    logReadMutate({
      kycCaseId: dossierId,
      agencyId: dossier.agency_id,
      actorId: agentId,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossier?.agency_id, dossierId, agentId])

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [examineTarget, setExamineTarget] = useState<ScreeningDecisionTarget | null>(null)
  const [actionMessage, setActionMessage] = useState<
    { kind: 'ok' | 'err'; text: string } | null
  >(null)

  // Index des checklist items par catégorie LBA
  const checksByCategory = useMemo<Record<KycCheckCategory, KycChecklistItem | null>>(() => {
    const map: Record<KycCheckCategory, KycChecklistItem | null> = {
      id: null,
      address: null,
      pep: null,
      sanctions: null,
      funds: null,
    }
    const items = (dossier as KycCaseWithChecklist | undefined)?.checklist ?? []
    items.forEach((c) => {
      if ((CHECK_KEYS as string[]).includes(c.category)) {
        map[c.category as KycCheckCategory] = c
      }
    })
    return map
  }, [dossier])

  // Garde compliance remontée ICI (avant tout early-return) — rules-of-hooks.
  const screeningGuard = useMemo<ScreeningGuard>(() => {
    if (!dossier) return { status: 'missing' }
    const sanctions = dossier.sanctions_status
    const pep = dossier.pep_status
    if (sanctions === 'match' && sanctionsDecision?.decision !== 'false_positive') {
      return { status: 'match', kind: 'sanctions' }
    }
    if (pep === 'match' && pepDecision?.decision !== 'false_positive') {
      return { status: 'match', kind: 'pep' }
    }
    if (sanctions === 'pending' || pep === 'pending') return { status: 'pending' }
    if (!sanctions || !pep || sanctions === 'not_checked' || pep === 'not_checked') {
      return { status: 'missing' }
    }
    return { status: 'ok' }
  }, [dossier, sanctionsDecision?.decision, pepDecision?.decision])

  if (isError && !isLoading) {
    return (
      <div
        role="alert"
        style={{
          maxWidth: 1000,
          margin: '60px auto',
          padding: '32px',
          textAlign: 'center',
          background: sp.card,
          borderRadius: 22,
          border: `1px solid ${sp.cardBorder}`,
          boxShadow: sp.shadow,
          color: sp.err,
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        <div style={{ marginBottom: 8 }}>{t('dossier.detail.loadError')}</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: sp.muted, marginBottom: 18 }}>
          {(error as Error)?.message || t('dossier.detail.loadErrorHint')}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <KycGhostPill onClick={onBack}>{t('dossier.detail.backToList')}</KycGhostPill>
          <KycBlackPill onClick={() => refetch()}>{t('dossier.detail.retry')}</KycBlackPill>
        </div>
      </div>
    )
  }

  if (isLoading || !dossier) {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '60px 0', textAlign: 'center', color: sp.muted, fontSize: 14, fontWeight: 500 }}>
        {t('dossier.detail.loading')}
      </div>
    )
  }

  // Avancement des 5 contrôles LBA (fixes). Un check non requis compte comme fait.
  const done = CHECK_KEYS.filter((k) => {
    const it = checksByCategory[k]
    return !!(it && (it.is_completed || it.is_required === false))
  }).length
  const total = CHECK_KEYS.length

  // Dernier screening = date d'action la plus récente connue.
  let lastScreeningAt: string | null = dossier.last_screening_at ?? null
  Object.values(checksByCategory).forEach((c) => {
    if (c?.completed_at && (!lastScreeningAt || new Date(c.completed_at) > new Date(lastScreeningAt))) {
      lastScreeningAt = c.completed_at
    }
  })

  const handleMarkVerified = (category: KycCheckCategory) => {
    const item = checksByCategory[category]
    if (!item) return
    markCheck.mutate({ checkId: item.id, is_completed: true, actorId: agentId })
  }

  const isVerified = dossier.dossier_status === 'verified'
  const canMarkAll = !isVerified && screeningGuard.status === 'ok'

  // Libellé du POURQUOI le « tout marquer vérifié » est indisponible.
  // Volontairement orienté ACTION et SANS langage de blocage pipeline :
  // c'est l'intégrité de l'attestation KYC (LBA art. 9), pas un verrou de deal.
  const markAllBlockedLabel = (() => {
    if (screeningGuard.status === 'match') {
      return screeningGuard.kind === 'sanctions'
        ? t('dossier.detail.reviewSanctionsFirst')
        : t('dossier.detail.reviewPepFirst')
    }
    if (screeningGuard.status === 'pending') return t('dossier.detail.screeningRunning')
    if (screeningGuard.status === 'missing') return t('dossier.detail.runScreeningFirst')
    return null
  })()

  const requestMarkAll = () => {
    if (!canMarkAll) return
    setConfirmOpen(true)
  }

  const confirmMarkAll = () => {
    setConfirmOpen(false)
    markAll.mutate({ kycCaseId: dossierId, actorId: agentId })
  }

  const handleRescreen = () => {
    setActionMessage(null)
    if (!dossier.contact) {
      setActionMessage({ kind: 'err', text: t('dossier.detail.contactNotFound') })
      return
    }
    const name = `${dossier.contact.first_name} ${dossier.contact.last_name}`.trim()
    if (!name) {
      setActionMessage({ kind: 'err', text: t('dossier.detail.contactNameMissing') })
      return
    }
    if (!dossier.contact_nationality) {
      setActionMessage({
        kind: 'err',
        text: t('dossier.detail.nationalityRequired'),
      })
      return
    }
    const entityType: 'individual' | 'entity' = dossier.type.endsWith('_pm')
      ? 'entity'
      : 'individual'
    screen.mutate(
      {
        kycCaseId: dossierId,
        contactName: name,
        contactNationality: dossier.contact_nationality,
        entityType,
      },
      {
        onSuccess: () =>
          setActionMessage({ kind: 'ok', text: t('dossier.detail.screeningRestarted') }),
        onError: (err) =>
          setActionMessage({
            kind: 'err',
            text: err instanceof Error ? err.message : t('dossier.detail.screeningFailed'),
          }),
      }
    )
  }

  const handleExport = () => {
    // Sprint 4.4 — route print-friendly dans un nouvel onglet (Cmd+P → PDF).
    window.open(`/dashboard/kyc/${dossierId}/export`, '_blank', 'noopener,noreferrer')
  }

  const handleSubmitDecision = (
    target: ScreeningDecisionTarget,
    decision: ScreeningDecisionVerdict,
    justification: string
  ) => {
    if (!dossier.agency_id) {
      setActionMessage({ kind: 'err', text: t('dossier.detail.agencyMissing') })
      return
    }
    const snapshot = {
      sanctions_status: dossier.sanctions_status,
      pep_status: dossier.pep_status,
      sanctions_details: dossier.sanctions_details,
      pep_details: dossier.pep_details,
      risk_score: dossier.risk_score,
      risk_factors: dossier.risk_factors,
      last_screening_at: dossier.last_screening_at,
      taken_at: new Date().toISOString(),
    }
    const previous = target === 'sanctions' ? sanctionsDecision : pepDecision
    createDecision.mutate(
      {
        kycCaseId: dossierId,
        agencyId: dossier.agency_id,
        decidedBy: agentId,
        target,
        decision,
        justification,
        screeningSnapshot: snapshot,
        supersedesId: previous?.id ?? null,
      },
      {
        onSuccess: () => {
          setExamineTarget(null)
          setActionMessage({
            kind: 'ok',
            text: t('dossier.detail.decisionSaved', {
              verdict: verdictLabels[decision].label,
            }),
          })
        },
        onError: (err) =>
          setActionMessage({
            kind: 'err',
            text: err instanceof Error ? err.message : t('dossier.detail.saveFailed'),
          }),
      }
    )
  }

  const handleUploadFile = (file: File, category: 'identity' | 'domicile' | 'financial' | 'compliance' | 'other') => {
    setActionMessage(null)
    if (!dossier.agency_id) {
      setActionMessage({ kind: 'err', text: t('dossier.detail.agencyMissing') })
      return
    }
    uploadDoc.mutate(
      {
        kycCaseId: dossierId,
        agencyId: dossier.agency_id,
        file,
        documentCategory: category,
        uploadedBy: agentId,
      },
      {
        onSuccess: () => {
          setUploadOpen(false)
          setActionMessage({ kind: 'ok', text: t('dossier.detail.fileUploaded', { name: file.name }) })
        },
        onError: (err) =>
          setActionMessage({
            kind: 'err',
            text: err instanceof Error ? err.message : t('dossier.detail.uploadFailed'),
          }),
      }
    )
  }

  // ─── Encart compliance (match sanctions/PEP, faux positif écarté) ──────
  // Rendu dans l'onglet Synthèse via le slot `alert`. Conservation de la
  // logique LBA art. 9 — purement informatif sur l'état du screening.
  let complianceAlert: React.ReactNode = null
  if (screeningGuard.status === 'match') {
    const target = screeningGuard.kind
    const decision = target === 'sanctions' ? sanctionsDecision : pepDecision
    const verdictInfo = decision ? verdictLabels[decision.decision] : null
    complianceAlert = (
      <div
        role="alert"
        style={{
          padding: '14px 20px',
          background: sp.errSoft,
          borderRadius: 14,
          border: `1px solid ${sp.err}33`,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <SgIcon name="shield" size={16} stroke={sp.errDarker} />
        <div style={{ flex: 1, minWidth: 240, fontSize: 13, fontWeight: 600, color: sp.errDarker, lineHeight: 1.5 }}>
          {target === 'sanctions'
            ? t('dossier.alert.matchSanctions')
            : t('dossier.alert.matchPep')}
          {verdictInfo && (
            <div style={{ marginTop: 4, fontSize: 12, fontWeight: 500, color: sp.errDark }}>
              {t('dossier.alert.lastDecision')} <strong>{verdictInfo.label}</strong> ·{' '}
              {new Date(decision!.decided_at).toLocaleDateString('fr-CH')}
            </div>
          )}
        </div>
        <KycBlackPill
          size="md"
          onClick={() => setExamineTarget(target)}
          icon={<SgIcon name="eye" size={14} stroke={sp.onAccent} />}
        >
          {decision ? t('dossier.alert.reExamine') : t('dossier.alert.examineMatch')}
        </KycBlackPill>
      </div>
    )
  } else if (
    screeningGuard.status === 'ok' &&
    (sanctionsDecision?.decision === 'false_positive' || pepDecision?.decision === 'false_positive')
  ) {
    complianceAlert = (
      <div
        style={{
          padding: '12px 18px',
          background: sp.okSoft,
          borderRadius: 14,
          fontSize: 12.5,
          fontWeight: 600,
          color: sp.okDark,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <SgIcon name="check" size={14} stroke={sp.okDark} />
        {t('dossier.alert.clearedFalsePositive')}
      </div>
    )
  }

  const tabs: KycSegTab[] = [
    { id: 'synthese', label: t('dossier.tabs.synthese') },
    { id: 'controles', label: t('dossier.tabs.controles'), count: total },
    { id: 'documents', label: t('dossier.tabs.documents'), count: docs.length },
    { id: 'audit', label: t('dossier.tabs.audit') },
  ]

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <KycDetailHeader
        dossier={dossier}
        contact={
          dossier.contact
            ? { first_name: dossier.contact.first_name, last_name: dossier.contact.last_name }
            : null
        }
        done={done}
        total={total}
        onBack={onBack}
      />

      {/* Feedback d'action (rescreen / upload / décision) — visible tout onglet */}
      {actionMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginTop: 12,
            padding: '12px 18px',
            borderRadius: 14,
            fontSize: 13,
            fontWeight: 600,
            background: actionMessage.kind === 'ok' ? sp.okSoft : sp.errSoft,
            color: actionMessage.kind === 'ok' ? sp.okDark : sp.errDarker,
          }}
        >
          {actionMessage.text}
        </div>
      )}

      {/* Navbar sticky — toujours accessible quel que soit le scroll */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 4,
          background: pageBg,
          padding: '16px 0 14px',
          marginTop: 6,
        }}
      >
        <KycSegTabs tabs={tabs} active={tab} onChange={(id) => setTab(id as typeof tab)} />
      </div>

      {/* Panneau actif — ré-anime à chaque changement d'onglet */}
      <div key={tab} style={{ animation: 'sgFadeUp .4s cubic-bezier(.2,.8,.2,1) both' }}>
        {tab === 'synthese' && (
          <KycSynthese
            dossier={dossier as KycCaseWithChecklist}
            checksByCategory={checksByCategory}
            done={done}
            total={total}
            lastScreeningAt={lastScreeningAt}
            isVerified={isVerified}
            onRescreen={handleRescreen}
            rescreening={screen.isPending}
            onMarkAll={requestMarkAll}
            markAllPending={markAll.isPending}
            canMarkAll={canMarkAll}
            markAllBlockedLabel={markAllBlockedLabel}
            onExport={handleExport}
            goControles={() => setTab('controles')}
            alert={complianceAlert}
          />
        )}

        {tab === 'controles' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: sp.muted,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
              }}
            >
              {t('dossier.detail.fiveChecks')}
            </div>
            <div
              className="sg-grid-2"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
            >
              {CHECK_KEYS.map((k) => (
                <KycCheckCard
                  key={k}
                  category={k}
                  check={checksByCategory[k]}
                  onMarkVerified={() => handleMarkVerified(k)}
                />
              ))}
            </div>
            <KycSourceOfFundsCard dossier={dossier} documents={docs} agentId={agentId} />
          </div>
        )}

        {tab === 'documents' && (
          <KycDocsSection
            docs={docs}
            onUpload={() => setUploadOpen(true)}
            onPreview={async (doc) => {
              const { data, error: signErr } = await supabase.storage
                .from('kyc-documents')
                .createSignedUrl(doc.storage_path, 60)
              if (signErr) {
                window.alert(t('dossier.detail.previewError', { message: signErr.message }))
                return
              }
              window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
            }}
            onDownload={async (doc) => {
              const { data, error: signErr } = await supabase.storage
                .from('kyc-documents')
                .createSignedUrl(doc.storage_path, 60, { download: doc.name ?? true })
              if (signErr) {
                window.alert(t('dossier.detail.downloadError', { message: signErr.message }))
                return
              }
              window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
            }}
          />
        )}

        {tab === 'audit' && (
          <KycAuditTrail
            events={auditEvents ?? []}
            onExportPdf={() => {
              window.open(`/dashboard/kyc/${dossierId}/export`, '_blank', 'noopener,noreferrer')
            }}
          />
        )}
      </div>

      {confirmOpen && (
        <ConfirmMarkAllOverlay
          dossier={dossier}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={confirmMarkAll}
        />
      )}

      {uploadOpen && (
        <UploadDocOverlay
          isPending={uploadDoc.isPending}
          onCancel={() => setUploadOpen(false)}
          onSubmit={handleUploadFile}
        />
      )}

      {examineTarget && (
        <ExamineHitOverlay
          target={examineTarget}
          details={
            (examineTarget === 'sanctions'
              ? dossier.sanctions_details
              : dossier.pep_details) as ScreeningDetails | null
          }
          previousDecision={examineTarget === 'sanctions' ? sanctionsDecision : pepDecision}
          isPending={createDecision.isPending}
          onCancel={() => setExamineTarget(null)}
          onSubmit={(decision, justification) =>
            handleSubmitDecision(examineTarget, decision, justification)
          }
        />
      )}
    </div>
  )
}

interface ConfirmOverlayProps {
  dossier: KycCaseWithChecklist
  onCancel: () => void
  onConfirm: () => void
}

function ConfirmMarkAllOverlay({ dossier, onCancel, onConfirm }: ConfirmOverlayProps) {
  const sp = useKycPalette()
  const { t } = useTranslation('kyc')
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9100,
        background: 'rgba(11,12,14,0.45)',
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
          maxWidth: 520,
          width: '100%',
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
          {t('dossier.confirm.eyebrow')}
        </div>
        <h2
          style={{
            margin: '0 0 12px',
            fontSize: 22,
            fontWeight: 700,
            color: sp.ink,
            letterSpacing: -0.4,
            lineHeight: 1.25,
          }}
        >
          {t('dossier.confirm.title')}
        </h2>
        <p
          style={{
            margin: '0 0 18px',
            fontSize: 14,
            color: sp.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          {t('dossier.confirm.body')}
        </p>
        <div
          style={{
            background: sp.cardSubtle,
            borderRadius: 14,
            padding: '14px 18px',
            marginBottom: 22,
            fontSize: 13,
            color: sp.inkSoft,
            fontWeight: 500,
            lineHeight: 1.6,
          }}
        >
          <div>
            <strong style={{ color: sp.ink }}>{t('dossier.confirm.sanctions')}</strong>{' '}
            {dossier.sanctions_status === 'clear' ? t('dossier.confirm.clear') : t('dossier.confirm.status.' + dossier.sanctions_status)}
          </div>
          <div>
            <strong style={{ color: sp.ink }}>{t('dossier.confirm.pep')}</strong>{' '}
            {dossier.pep_status === 'clear' ? t('dossier.confirm.clear') : t('dossier.confirm.status.' + dossier.pep_status)}
          </div>
          <div>
            <strong style={{ color: sp.ink }}>{t('dossier.confirm.vigilance')}</strong>{' '}
            {dossier.vigilance === 'renforced'
              ? t('dossier.confirm.vigilanceEnhanced')
              : t('dossier.confirm.vigilanceStandard')}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <KycGhostPill onClick={onCancel}>{t('dossier.confirm.cancel')}</KycGhostPill>
          <KycBlackPill
            size="md"
            onClick={onConfirm}
            icon={<SgIcon name="checkAll" size={14} stroke={sp.onAccent} />}
          >
            {t('dossier.confirm.submit')}
          </KycBlackPill>
        </div>
      </div>
    </div>
  )
}

type DocCategory = 'identity' | 'domicile' | 'financial' | 'compliance' | 'other'

/** Catégories de pièces. `value`/`mimes` sont des données ; seul `label` est traduit. */
function buildDocCategories(
  t: TFunction
): { value: DocCategory; label: string; mimes: string[] }[] {
  return [
    { value: 'identity',   label: t('dossier.upload.cat.identity'),   mimes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] },
    { value: 'domicile',   label: t('dossier.upload.cat.domicile'),   mimes: ['application/pdf', 'image/jpeg', 'image/png'] },
    { value: 'financial',  label: t('dossier.upload.cat.financial'),  mimes: ['application/pdf'] },
    { value: 'compliance', label: t('dossier.upload.cat.compliance'), mimes: ['application/pdf'] },
    { value: 'other',      label: t('dossier.upload.cat.other'),      mimes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] },
  ]
}

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // 20 MB

function validateFileForCategory(
  file: File,
  category: DocCategory,
  t: TFunction
): { ok: true } | { ok: false; reason: string } {
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: t('dossier.upload.errTooLarge') }
  }
  if (file.size === 0) {
    return { ok: false, reason: t('dossier.upload.errEmpty') }
  }
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return { ok: false, reason: t('dossier.upload.errInvalidName') }
  }
  const meta = buildDocCategories(t).find((c) => c.value === category)
  if (!meta) return { ok: false, reason: t('dossier.upload.errUnknownCategory') }
  const mime = file.type || ''
  if (mime && !meta.mimes.includes(mime)) {
    return {
      ok: false,
      reason: t('dossier.upload.errMimeNotAllowed', { mime }),
    }
  }
  const allowedExt = ['pdf', 'jpg', 'jpeg', 'png', 'webp']
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  if (!allowedExt.includes(ext)) {
    return {
      ok: false,
      reason: t('dossier.upload.errExtNotAllowed', { ext }),
    }
  }
  return { ok: true }
}

interface UploadOverlayProps {
  isPending: boolean
  onCancel: () => void
  onSubmit: (file: File, category: DocCategory) => void
}

function UploadDocOverlay({ isPending, onCancel, onSubmit }: UploadOverlayProps) {
  const sp = useKycPalette()
  const { t } = useTranslation('kyc')
  const docCategories = buildDocCategories(t)
  const [category, setCategory] = useState<DocCategory>('identity')
  const [file, setFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const handlePick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const v = validateFileForCategory(f, category, t)
    if (!v.ok) {
      setValidationError(v.reason)
      setFile(null)
      e.target.value = ''
      return
    }
    setValidationError(null)
    setFile(f)
  }

  const handleSubmit = () => {
    if (!file) return
    const v = validateFileForCategory(file, category, t)
    if (!v.ok) {
      setValidationError(v.reason)
      return
    }
    onSubmit(file, category)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9100,
        background: 'rgba(11,12,14,0.45)',
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
          maxWidth: 520,
          width: '100%',
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
          {t('dossier.upload.eyebrow')}
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
          {t('dossier.upload.title')}
        </h2>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: sp.inkSoft, marginBottom: 6 }}>
          {t('dossier.upload.categoryLabel')}
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as DocCategory)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 12,
            border: `1px solid ${sp.cardSubtle}`,
            background: sp.cardSubtle,
            fontFamily: 'inherit',
            fontSize: 14,
            color: sp.ink,
            marginBottom: 18,
          }}
        >
          {docCategories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: sp.inkSoft, marginBottom: 6 }}>
          {t('dossier.upload.fileLabel')}
        </label>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          onChange={handlePick}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 12,
            border: `1px solid ${sp.cardSubtle}`,
            background: sp.cardSubtle,
            fontFamily: 'inherit',
            fontSize: 13,
            color: sp.ink,
            marginBottom: validationError ? 8 : 22,
          }}
        />
        {validationError && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              background: sp.errSoft,
              borderRadius: 12,
              fontSize: 12.5,
              fontWeight: 600,
              color: sp.errDarker,
              marginBottom: 18,
            }}
          >
            {validationError}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <KycGhostPill onClick={onCancel}>{t('dossier.upload.cancel')}</KycGhostPill>
          <KycBlackPill
            size="md"
            onClick={handleSubmit}
            disabled={!file || isPending || !!validationError}
            icon={<SgIcon name="upload" size={14} stroke={sp.onAccent} />}
          >
            {isPending ? t('dossier.upload.uploading') : t('dossier.upload.submit')}
          </KycBlackPill>
        </div>
      </div>
    </div>
  )
}

interface ExamineOverlayProps {
  target: ScreeningDecisionTarget
  details: ScreeningDetails | null
  previousDecision: { id: string; decision: ScreeningDecisionVerdict; justification: string; decided_at: string } | null | undefined
  isPending: boolean
  onCancel: () => void
  onSubmit: (decision: ScreeningDecisionVerdict, justification: string) => void
}

function ExamineHitOverlay({
  target,
  details,
  previousDecision,
  isPending,
  onCancel,
  onSubmit,
}: ExamineOverlayProps) {
  const sp = useKycPalette()
  const { t } = useTranslation('kyc')
  const verdictLabels = buildVerdictLabels(t)
  const [verdict, setVerdict] = useState<ScreeningDecisionVerdict>('false_positive')
  const [justification, setJustification] = useState('')

  const records = details?.records ?? []
  const total = details?.total ?? records.length
  const canSubmit = justification.trim().length >= 30 && !isPending

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
          maxWidth: 720,
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
          {target === 'sanctions'
            ? t('dossier.examine.eyebrowSanctions')
            : t('dossier.examine.eyebrowPep')}
        </div>
        <h2
          style={{
            margin: '0 0 6px',
            fontSize: 22,
            fontWeight: 700,
            color: sp.ink,
            letterSpacing: -0.4,
          }}
        >
          {t('dossier.examine.matchCount', { count: total })}
        </h2>
        <p
          style={{
            margin: '0 0 18px',
            fontSize: 13,
            color: sp.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          {t('dossier.examine.intro')}
        </p>

        {records.length === 0 ? (
          <div
            style={{
              padding: '20px',
              background: sp.cardSubtle,
              borderRadius: 14,
              fontSize: 13,
              color: sp.muted,
              marginBottom: 22,
            }}
          >
            {t('dossier.examine.noRecords')}
          </div>
        ) : (
          <div
            style={{
              marginBottom: 22,
              maxHeight: 220,
              overflowY: 'auto',
              border: `1px solid ${sp.cardSubtle}`,
              borderRadius: 14,
            }}
          >
            {records.map((r, i) => (
              <div
                key={i}
                style={{
                  padding: '12px 16px',
                  borderTop: i === 0 ? 'none' : `1px solid ${sp.cardSubtle}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 700, color: sp.ink }}>
                  {r.name ?? '—'}
                </div>
                <div style={{ fontSize: 11.5, color: sp.muted, fontWeight: 500 }}>
                  {r.source_type ?? '—'} · ID {r.source_id ?? '—'}
                </div>
              </div>
            ))}
          </div>
        )}

        {previousDecision && (
          <div
            style={{
              marginBottom: 18,
              padding: '12px 14px',
              background: sp.cardSubtle,
              borderRadius: 12,
              fontSize: 12,
              color: sp.inkSoft,
              lineHeight: 1.55,
            }}
          >
            <strong style={{ color: sp.ink }}>{t('dossier.examine.previousDecision')}</strong>{' '}
            {verdictLabels[previousDecision.decision].label} · {new Date(previousDecision.decided_at).toLocaleDateString('fr-CH')}
            <br />
            <em style={{ color: sp.muted, fontStyle: 'normal' }}>{previousDecision.justification}</em>
            <br />
            <span style={{ color: sp.muted, fontSize: 11 }}>
              {t('dossier.examine.willSupersede')}
            </span>
          </div>
        )}

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: sp.inkSoft, marginBottom: 8 }}>
          {t('dossier.examine.verdictLabel')}
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
          {(Object.keys(verdictLabels) as ScreeningDecisionVerdict[]).map((v) => {
            const info = verdictLabels[v]
            const selected = verdict === v
            return (
              <button
                key={v}
                type="button"
                onClick={() => setVerdict(v)}
                style={{
                  border: 0,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: '12px 16px',
                  borderRadius: 14,
                  background: selected ? sp.black : sp.cardSubtle,
                  color: selected ? sp.onAccent : sp.ink,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  transition: 'all .2s ease',
                }}
              >
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{info.label}</span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: selected ? sp.onAccent : sp.muted,
                    opacity: selected ? 0.75 : 1,
                    lineHeight: 1.45,
                  }}
                >
                  {info.hint}
                </span>
              </button>
            )
          })}
        </div>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: sp.inkSoft, marginBottom: 6 }}>
          {t('dossier.examine.justificationLabel', { count: justification.trim().length })}
        </label>
        <textarea
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          rows={4}
          placeholder={t('dossier.examine.justificationPlaceholder')}
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 12,
            border: `1px solid ${sp.cardSubtle}`,
            background: sp.cardSubtle,
            fontFamily: 'inherit',
            fontSize: 13,
            color: sp.ink,
            marginBottom: 22,
            resize: 'vertical',
            minHeight: 90,
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <KycGhostPill onClick={onCancel}>{t('dossier.examine.cancel')}</KycGhostPill>
          <KycBlackPill
            size="md"
            onClick={() => canSubmit && onSubmit(verdict, justification)}
            disabled={!canSubmit}
            icon={<SgIcon name="check" size={14} stroke={sp.onAccent} />}
          >
            {isPending ? t('dossier.examine.saving') : t('dossier.examine.submit')}
          </KycBlackPill>
        </div>
      </div>
    </div>
  )
}
