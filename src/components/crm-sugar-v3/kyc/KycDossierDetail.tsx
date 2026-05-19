// MEGGA CRM Sugar v3 — Vue détail dossier (orchestrateur)
// Port 1:1 de crm-screen-kyc-sugar.jsx lignes 587-646 (KycDossierDetail).
//
// Structure : Hero + 5 KycCheckCard (grid 2x) + 2 cards (Docs + AuditTrail) + bottom actions

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { SugarV3 } from '../tokens'
import { KycBlackPill, KycGhostPill } from '../primitives'
import { SgIcon } from '../icons'
import { KycDossierHero } from './KycDossierHero'
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

const VERDICT_LABELS: Record<ScreeningDecisionVerdict, { label: string; hint: string; tone: 'ok' | 'err' | 'warn' | 'neutral' }> = {
  false_positive: {
    label: 'Faux positif',
    hint: 'Examen humain : le match Dilisense ne correspond pas au client. Débloque la validation.',
    tone: 'ok',
  },
  true_match: {
    label: 'Vrai match',
    hint: 'Le client est bien la personne sanctionnée/PEP. Déclaration MROS (art. 9 LBA) obligatoire.',
    tone: 'err',
  },
  escalated: {
    label: 'Escaladé direction',
    hint: 'Renvoyé au MLRO / direction compliance pour décision.',
    tone: 'warn',
  },
  awaiting_evidence: {
    label: 'En attente d’éléments',
    hint: 'Examen en pause — éléments complémentaires demandés au client.',
    tone: 'neutral',
  },
}

interface Props {
  dossierId: string
  agentId: string
  onBack: () => void
}

const CHECK_KEYS: KycCheckCategory[] = ['id', 'address', 'pep', 'sanctions', 'funds']

export function KycDossierDetail({ dossierId, agentId, onBack }: Props) {
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

  // nLPD art. 12 — log de l'accès consultation au dossier KYC (Roger #1).
  // Une seule fois par mount + dossier, pas à chaque re-render.
  // NB : logRead.mutate exclu des deps — l'objet mutation change à chaque render
  // et causerait une boucle infinie (fix Sprint 3.1).
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

  // screeningGuard remonté ICI (avant tout early-return) pour respecter
  // rules-of-hooks. Tolère un dossier null/undefined pendant le chargement.
  const screeningGuard = useMemo<ScreeningGuard>(() => {
    if (!dossier) return { status: 'missing' }
    const sanctions = dossier.sanctions_status
    const pep = dossier.pep_status
    // Un match est BLOQUANT sauf si une décision false_positive l'a écarté
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
  }, [
    dossier,
    sanctionsDecision?.decision,
    pepDecision?.decision,
  ])

  if (isError && !isLoading) {
    return (
      <div
        role="alert"
        style={{
          maxWidth: 1080,
          margin: '60px auto',
          padding: '32px',
          textAlign: 'center',
          background: SugarV3.card,
          borderRadius: 22,
          boxShadow: SugarV3.shadow,
          color: SugarV3.err,
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        <div style={{ marginBottom: 8 }}>
          Impossible de charger ce dossier KYC.
        </div>
        <div style={{ fontSize: 12, fontWeight: 500, color: SugarV3.muted, marginBottom: 18 }}>
          {(error as Error)?.message || 'Erreur réseau ou base de données.'}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <KycGhostPill onClick={onBack}>Retour à la liste</KycGhostPill>
          <KycBlackPill onClick={() => refetch()}>Réessayer</KycBlackPill>
        </div>
      </div>
    )
  }

  if (isLoading || !dossier) {
    return (
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '60px 0', textAlign: 'center', color: SugarV3.muted, fontSize: 14, fontWeight: 500 }}>
        Chargement du dossier…
      </div>
    )
  }

  // Progression LBA : ratio des contrôles REQUIS effectivement complétés.
  // Les items is_required=false ne comptent ni au numérateur ni au dénominateur
  // (sinon on gonfle artificiellement la progression — finding red-team V3-6).
  const requiredChecks = Object.values(checksByCategory).filter(
    (c): c is KycChecklistItem => c?.is_required === true
  )
  const completedRequiredCount = requiredChecks.filter((c) => c.is_completed).length
  const pct =
    requiredChecks.length > 0
      ? (completedRequiredCount / requiredChecks.length) * 100
      : 0

  const handleMarkVerified = (category: KycCheckCategory) => {
    const item = checksByCategory[category]
    if (!item) return
    markCheck.mutate({ checkId: item.id, is_completed: true, actorId: agentId })
  }

  const isVerified = dossier.dossier_status === 'verified'

  const canMarkAll = !isVerified && screeningGuard.status === 'ok'

  const blockedLabel = (() => {
    if (screeningGuard.status === 'match') {
      return screeningGuard.kind === 'sanctions'
        ? 'Validation bloquée — match sanctions'
        : 'Validation bloquée — match PEP'
    }
    if (screeningGuard.status === 'pending') return 'Screening en cours…'
    if (screeningGuard.status === 'missing') return 'Screening requis avant validation'
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
      setActionMessage({ kind: 'err', text: 'Contact introuvable pour ce dossier.' })
      return
    }
    const name = `${dossier.contact.first_name} ${dossier.contact.last_name}`.trim()
    if (!name) {
      setActionMessage({ kind: 'err', text: 'Nom du contact manquant.' })
      return
    }
    if (!dossier.contact_nationality) {
      setActionMessage({
        kind: 'err',
        text: 'Nationalité requise pour le screening Dilisense. Mettez à jour le contact.',
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
          setActionMessage({ kind: 'ok', text: 'Screening Dilisense relancé.' }),
        onError: (err) =>
          setActionMessage({
            kind: 'err',
            text: err instanceof Error ? err.message : 'Échec du screening.',
          }),
      }
    )
  }

  const handleSubmitDecision = (
    target: ScreeningDecisionTarget,
    decision: ScreeningDecisionVerdict,
    justification: string
  ) => {
    if (!dossier.agency_id) {
      setActionMessage({ kind: 'err', text: 'agency_id manquant — connexion requise.' })
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
            text: `Décision « ${VERDICT_LABELS[decision].label} » enregistrée.`,
          })
        },
        onError: (err) =>
          setActionMessage({
            kind: 'err',
            text: err instanceof Error ? err.message : 'Échec de l’enregistrement.',
          }),
      }
    )
  }

  const handleUploadFile = (file: File, category: 'identity' | 'domicile' | 'financial' | 'compliance' | 'other') => {
    setActionMessage(null)
    if (!dossier.agency_id) {
      setActionMessage({ kind: 'err', text: 'agency_id manquant — connexion requise.' })
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
          setActionMessage({ kind: 'ok', text: `« ${file.name} » téléversé.` })
        },
        onError: (err) =>
          setActionMessage({
            kind: 'err',
            text: err instanceof Error ? err.message : 'Échec du téléversement.',
          }),
      }
    )
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <KycDossierHero
        dossier={dossier}
        contact={
          dossier.contact
            ? { first_name: dossier.contact.first_name, last_name: dossier.contact.last_name }
            : null
        }
        pct={Math.round(pct)}
        onBack={onBack}
      />

      {screeningGuard.status === 'match' && (() => {
        const target = screeningGuard.kind
        const decision = target === 'sanctions' ? sanctionsDecision : pepDecision
        const verdictInfo = decision ? VERDICT_LABELS[decision.decision] : null
        return (
          <div
            role="alert"
            style={{
              marginBottom: 16,
              padding: '14px 20px',
              background: SugarV3.errSoft,
              borderRadius: 14,
              border: `1px solid ${SugarV3.err}33`,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <SgIcon name="shield" size={16} stroke={SugarV3.errDarker} />
            <div
              style={{
                flex: 1,
                minWidth: 240,
                fontSize: 13,
                fontWeight: 600,
                color: SugarV3.errDarker,
                lineHeight: 1.5,
              }}
            >
              Match {target === 'sanctions' ? 'sanctions' : 'PEP'} détecté ·
              Validation bloquée (LBA art. 9).
              {verdictInfo && (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    fontWeight: 500,
                    color: SugarV3.errDark,
                  }}
                >
                  Dernière décision : <strong>{verdictInfo.label}</strong> ·{' '}
                  {new Date(decision!.decided_at).toLocaleDateString('fr-CH')}
                </div>
              )}
            </div>
            <KycBlackPill
              size="md"
              onClick={() => setExamineTarget(target)}
              icon={<SgIcon name="eye" size={14} stroke="#fff" />}
            >
              {decision ? 'Réexaminer' : 'Examiner ce match'}
            </KycBlackPill>
          </div>
        )
      })()}

      {screeningGuard.status === 'ok' && (sanctionsDecision?.decision === 'false_positive' || pepDecision?.decision === 'false_positive') && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 18px',
            background: SugarV3.okSoft,
            borderRadius: 14,
            fontSize: 12.5,
            fontWeight: 600,
            color: SugarV3.okDark,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <SgIcon name="check" size={14} stroke={SugarV3.okDark} />
          Match Dilisense écarté par décision compliance (faux positif) · LBA art. 7 documenté.
        </div>
      )}

      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: SugarV3.muted,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          marginBottom: 14,
        }}
      >
        5 contrôles obligatoires (LBA art. 3-7)
      </div>

      <div
        className="sg-grid-2"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          marginBottom: 24,
        }}
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

      <div className="sg-grid-detail-bottom" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <KycDocsSection docs={docs} onUpload={() => setUploadOpen(true)} />
        <KycAuditTrail events={auditEvents ?? []} />
      </div>

      {actionMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginTop: 16,
            padding: '12px 18px',
            borderRadius: 14,
            fontSize: 13,
            fontWeight: 600,
            background:
              actionMessage.kind === 'ok' ? SugarV3.okSoft : SugarV3.errSoft,
            color:
              actionMessage.kind === 'ok' ? SugarV3.okDark : SugarV3.errDarker,
          }}
        >
          {actionMessage.text}
        </div>
      )}

      {/* Actions principales bas de page */}
      <div
        style={{
          marginTop: 32,
          padding: '24px 32px',
          background: SugarV3.card,
          borderRadius: 22,
          boxShadow: SugarV3.shadow,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: SugarV3.ink }}>
            {isVerified
              ? 'Dossier vérifié — transaction autorisée'
              : 'Compléter pour débloquer les étapes du pipeline'}
          </div>
          <div
            style={{
              fontSize: 12,
              color: SugarV3.muted,
              fontWeight: 500,
              marginTop: 2,
            }}
          >
            {isVerified
              ? 'Un re-screening est conseillé dans les 12 mois.'
              : "Le contact ne pourra pas passer en « Intérêt confirmé » tant que ce dossier n'est pas validé."}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <KycGhostPill
            onClick={handleRescreen}
            disabled={screen.isPending}
            icon={<SgIcon name="refresh" size={14} stroke={SugarV3.inkSoft} />}
          >
            {screen.isPending ? 'Screening…' : 'Re-screener'}
          </KycGhostPill>
          {!isVerified ? (
            <KycBlackPill
              size="md"
              onClick={requestMarkAll}
              disabled={markAll.isPending || !canMarkAll}
              title={blockedLabel ?? undefined}
              icon={<SgIcon name="checkAll" size={14} stroke="#fff" />}
            >
              {markAll.isPending
                ? 'Validation…'
                : blockedLabel ?? 'Tout marquer vérifié'}
            </KycBlackPill>
          ) : (
            <KycBlackPill
              size="md"
              onClick={() => {
                // Sprint 4.4 — Ouvre la route print-friendly dans un nouvel onglet.
                // L'agent peut Cmd+P (ou bouton "Imprimer" de la toolbar) pour
                // générer le PDF natif via le navigateur.
                window.open(
                  `/dashboard/kyc/${dossierId}/export`,
                  '_blank',
                  'noopener,noreferrer'
                )
              }}
              icon={<SgIcon name="download" size={14} stroke="#fff" />}
            >
              Exporter dossier complet
            </KycBlackPill>
          )}
        </div>
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
          Validation conformité · LBA art. 7
        </div>
        <h2
          style={{
            margin: '0 0 12px',
            fontSize: 22,
            fontWeight: 700,
            color: SugarV3.ink,
            letterSpacing: -0.4,
            lineHeight: 1.25,
          }}
        >
          Marquer le dossier comme vérifié&nbsp;?
        </h2>
        <p
          style={{
            margin: '0 0 18px',
            fontSize: 14,
            color: SugarV3.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          Cette action coche les 5 contrôles obligatoires et passe le dossier en statut
          « vérifié ». Elle autorise la suite du pipeline (offre, signature, encaissement)
          et est tracée dans le journal d&apos;audit nLPD pendant 10 ans.
        </p>
        <div
          style={{
            background: SugarV3.cardSubtle,
            borderRadius: 14,
            padding: '14px 18px',
            marginBottom: 22,
            fontSize: 13,
            color: SugarV3.inkSoft,
            fontWeight: 500,
            lineHeight: 1.6,
          }}
        >
          <div>
            <strong style={{ color: SugarV3.ink }}>Sanctions :</strong>{' '}
            {dossier.sanctions_status === 'clear' ? '✓ Clear' : dossier.sanctions_status}
          </div>
          <div>
            <strong style={{ color: SugarV3.ink }}>PEP :</strong>{' '}
            {dossier.pep_status === 'clear' ? '✓ Clear' : dossier.pep_status}
          </div>
          <div>
            <strong style={{ color: SugarV3.ink }}>Vigilance :</strong>{' '}
            {dossier.vigilance === 'renforced' ? 'Renforcée (LBA art. 6)' : 'Standard (LBA art. 3-4)'}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <KycGhostPill onClick={onCancel}>Annuler</KycGhostPill>
          <KycBlackPill
            size="md"
            onClick={onConfirm}
            icon={<SgIcon name="checkAll" size={14} stroke="#fff" />}
          >
            Confirmer la validation
          </KycBlackPill>
        </div>
      </div>
    </div>
  )
}

type DocCategory = 'identity' | 'domicile' | 'financial' | 'compliance' | 'other'

const DOC_CATEGORIES: { value: DocCategory; label: string; mimes: string[] }[] = [
  { value: 'identity',   label: 'Pièce d’identité',                 mimes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] },
  { value: 'domicile',   label: 'Justificatif de domicile',         mimes: ['application/pdf', 'image/jpeg', 'image/png'] },
  { value: 'financial',  label: 'Document financier',               mimes: ['application/pdf'] },
  { value: 'compliance', label: 'Pièce compliance (Form A, UBO…)',  mimes: ['application/pdf'] },
  { value: 'other',      label: 'Autre',                            mimes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] },
]

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // 20 MB

function validateFileForCategory(
  file: File,
  category: DocCategory
): { ok: true } | { ok: false; reason: string } {
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: 'Fichier trop volumineux (max 20 Mo).' }
  }
  if (file.size === 0) {
    return { ok: false, reason: 'Fichier vide.' }
  }
  // Path traversal défensif : pas de / ni ..
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return { ok: false, reason: 'Nom de fichier invalide.' }
  }
  const meta = DOC_CATEGORIES.find((c) => c.value === category)
  if (!meta) return { ok: false, reason: 'Catégorie inconnue.' }
  // file.type peut être vide sur certains navigateurs — fallback sur l'extension.
  const mime = file.type || ''
  if (mime && !meta.mimes.includes(mime)) {
    return {
      ok: false,
      reason: `Type de fichier non autorisé pour cette catégorie (reçu : ${mime}).`,
    }
  }
  // Fallback extension whitelist
  const allowedExt = ['pdf', 'jpg', 'jpeg', 'png', 'webp']
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  if (!allowedExt.includes(ext)) {
    return {
      ok: false,
      reason: `Extension non autorisée (.${ext}). Utilisez PDF, JPG, PNG ou WEBP.`,
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
  const [category, setCategory] = useState<DocCategory>('identity')
  const [file, setFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const handlePick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const v = validateFileForCategory(f, category)
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
    const v = validateFileForCategory(file, category)
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
          Téléversement de pièce
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
          Ajouter un document
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
          Catégorie LBA
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as DocCategory)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 12,
            border: `1px solid ${SugarV3.cardSubtle}`,
            background: SugarV3.cardSubtle,
            fontFamily: 'inherit',
            fontSize: 14,
            color: SugarV3.ink,
            marginBottom: 18,
          }}
        >
          {DOC_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <label
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 600,
            color: SugarV3.inkSoft,
            marginBottom: 6,
          }}
        >
          Fichier (PDF, JPG, PNG, WEBP)
        </label>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          onChange={handlePick}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 12,
            border: `1px solid ${SugarV3.cardSubtle}`,
            background: SugarV3.cardSubtle,
            fontFamily: 'inherit',
            fontSize: 13,
            marginBottom: validationError ? 8 : 22,
          }}
        />
        {validationError && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              background: SugarV3.errSoft,
              borderRadius: 12,
              fontSize: 12.5,
              fontWeight: 600,
              color: SugarV3.errDarker,
              marginBottom: 18,
            }}
          >
            {validationError}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <KycGhostPill onClick={onCancel}>Annuler</KycGhostPill>
          <KycBlackPill
            size="md"
            onClick={handleSubmit}
            disabled={!file || isPending || !!validationError}
            icon={<SgIcon name="upload" size={14} stroke="#fff" />}
          >
            {isPending ? 'Téléversement…' : 'Téléverser'}
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
          Examen compliance · {target === 'sanctions' ? 'Sanctions' : 'PEP'} · LBA art. 7
        </div>
        <h2
          style={{
            margin: '0 0 6px',
            fontSize: 22,
            fontWeight: 700,
            color: SugarV3.ink,
            letterSpacing: -0.4,
          }}
        >
          {total} correspondance{total > 1 ? 's' : ''} Dilisense
        </h2>
        <p
          style={{
            margin: '0 0 18px',
            fontSize: 13,
            color: SugarV3.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          Examinez les éléments retournés par Dilisense, choisissez un verdict et justifiez-le
          (minimum 30 caractères, conservé 10 ans).
        </p>

        {records.length === 0 ? (
          <div
            style={{
              padding: '20px',
              background: SugarV3.cardSubtle,
              borderRadius: 14,
              fontSize: 13,
              color: SugarV3.muted,
              marginBottom: 22,
            }}
          >
            Aucun détail de match n’a été stocké pour ce dossier. Relancez un screening si nécessaire.
          </div>
        ) : (
          <div
            style={{
              marginBottom: 22,
              maxHeight: 220,
              overflowY: 'auto',
              border: `1px solid ${SugarV3.cardSubtle}`,
              borderRadius: 14,
            }}
          >
            {records.map((r, i) => (
              <div
                key={i}
                style={{
                  padding: '12px 16px',
                  borderTop: i === 0 ? 'none' : `1px solid ${SugarV3.cardSubtle}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 700, color: SugarV3.ink }}>
                  {r.name ?? '—'}
                </div>
                <div style={{ fontSize: 11.5, color: SugarV3.muted, fontWeight: 500 }}>
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
              background: SugarV3.cardSubtle,
              borderRadius: 12,
              fontSize: 12,
              color: SugarV3.inkSoft,
              lineHeight: 1.55,
            }}
          >
            <strong style={{ color: SugarV3.ink }}>Décision précédente :</strong>{' '}
            {VERDICT_LABELS[previousDecision.decision].label} · {new Date(previousDecision.decided_at).toLocaleDateString('fr-CH')}
            <br />
            <em style={{ color: SugarV3.muted, fontStyle: 'normal' }}>{previousDecision.justification}</em>
            <br />
            <span style={{ color: SugarV3.muted, fontSize: 11 }}>
              Une nouvelle décision écrasera celle-ci (chaînage supersedes).
            </span>
          </div>
        )}

        <label
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 600,
            color: SugarV3.inkSoft,
            marginBottom: 8,
          }}
        >
          Verdict
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
          {(Object.keys(VERDICT_LABELS) as ScreeningDecisionVerdict[]).map((v) => {
            const info = VERDICT_LABELS[v]
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
                  background: selected ? SugarV3.black : SugarV3.cardSubtle,
                  color: selected ? '#fff' : SugarV3.ink,
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
                    color: selected ? 'rgba(255,255,255,0.75)' : SugarV3.muted,
                    lineHeight: 1.45,
                  }}
                >
                  {info.hint}
                </span>
              </button>
            )
          })}
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
          Justification ({justification.trim().length}/30 caractères min)
        </label>
        <textarea
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          rows={4}
          placeholder="Ex : Date de naissance différente (1985 vs 1972), pays différent (CH vs RU), homonymie confirmée par pièce d’identité."
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 12,
            border: `1px solid ${SugarV3.cardSubtle}`,
            background: SugarV3.cardSubtle,
            fontFamily: 'inherit',
            fontSize: 13,
            color: SugarV3.ink,
            marginBottom: 22,
            resize: 'vertical',
            minHeight: 90,
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <KycGhostPill onClick={onCancel}>Annuler</KycGhostPill>
          <KycBlackPill
            size="md"
            onClick={() => canSubmit && onSubmit(verdict, justification)}
            disabled={!canSubmit}
            icon={<SgIcon name="check" size={14} stroke="#fff" />}
          >
            {isPending ? 'Enregistrement…' : 'Enregistrer la décision'}
          </KycBlackPill>
        </div>
      </div>
    </div>
  )
}
