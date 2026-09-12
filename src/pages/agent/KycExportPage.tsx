// MEGGA — Page d'export PDF dossier KYC
// Route : /dashboard/kyc/:dossierId/export
// Print-friendly, déclenche window.print() automatiquement.
//
// Stratégie : on rend les 3 feuilles A4 côté React (`KycReportDocument`), puis
// l'agent fait Cmd+P (ou auto-trigger). Le navigateur génère un PDF natif — pas
// de dépendance Puppeteer / jsPDF. Le MÊME composant sert le rendu headless de
// `/kyc-report/:token` (envoi WhatsApp) : ce que l'agent voit ici est ce qui part.

import { crmPalette, crmVoileEncre } from '@/components/crm/tokens'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useKycCase, useKycDocuments, useKycAuditEvents, useLatestKycScreeningDecision } from '@/hooks/useKyc'
import { useTransaction } from '@/hooks/useTransactions'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { buildPdfReportData, type ReportScreeningDecision } from '@/components/kyc-report/buildReportData'
import { computeKycIntegrityHash, kycIntegrityCanonical } from '@/components/kyc-report/integrity'
import { KycReportDocument } from '@/components/kyc-report/KycReportDocument'
import { PDF } from '@/components/kyc-report/tokens'

const EMPTY: never[] = []

export default function KycExportPage() {
  const { t } = useTranslation('kyc')
  const { dossierId } = useParams<{ dossierId: string }>()
  const { profile } = useAuth()

  const { data: dossier, isLoading: dossierLoading, error: dossierError } = useKycCase(dossierId)
  // ⚠ Pas de `= []` en défaut : un tableau neuf à chaque rendu relancerait l'effet
  // de hachage sans fin. Une constante stable, ou la donnée.
  const { data: documents = EMPTY } = useKycDocuments(dossierId)
  const { data: auditEvents = EMPTY } = useKycAuditEvents(dossierId)
  const { data: transaction } = useTransaction(dossier?.transaction_id)
  const { data: pepDecision } = useLatestKycScreeningDecision(dossierId, 'pep')
  const { data: sanctionsDecision } = useLatestKycScreeningDecision(dossierId, 'sanctions')

  // Nom de l'agence depuis profile.agency_id
  const { data: agency } = useQuery({
    queryKey: ['agency-for-export', profile?.agency_id],
    queryFn: async () => {
      if (!profile?.agency_id) return null
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name')
        .eq('id', profile.agency_id)
        .single()
      if (error) throw error
      return data as { id: string; name: string } | null
    },
    enabled: !!profile?.agency_id,
  })

  // Les personnes que le rapport NOMME : qui a validé, qui a tranché un match. Le
  // rapport ne montre jamais un UUID — un nom absent tombe sur le nom de l'agent.
  const nameIds = useMemo(() => {
    const ids = [dossier?.validated_by, pepDecision?.decided_by, sanctionsDecision?.decided_by]
    return [...new Set(ids.filter((id): id is string => Boolean(id)))].sort()
  }, [dossier?.validated_by, pepDecision?.decided_by, sanctionsDecision?.decided_by])
  const { data: names } = useQuery({
    queryKey: ['kyc-report-names', nameIds],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name').in('id', nameIds)
      if (error) throw error
      const out: Record<string, string> = {}
      for (const p of (data ?? []) as { id: string; full_name: string | null }[]) {
        if (p.full_name) out[p.id] = p.full_name
      }
      return out
    },
    enabled: nameIds.length > 0,
  })

  // Empreinte SHA-256 du dossier (asynchrone : crypto.subtle) — le rapport attend
  // de l'avoir avant de se rendre, un PDF ne s'imprime pas avec une empreinte « … ».
  // La clé porte la forme canonique elle-même : toute pièce ou contrôle qui bouge
  // rend une empreinte neuve, sans effet ni état à resynchroniser.
  const canonical = dossier ? kycIntegrityCanonical(dossier, documents) : null
  const { data: integrityHash } = useQuery({
    queryKey: ['kyc-integrity', canonical],
    queryFn: () => computeKycIntegrityHash(dossier!, documents),
    enabled: !!dossier,
    staleTime: Infinity,
  })

  const screeningDecisions = useMemo<ReportScreeningDecision[]>(() => {
    const out: ReportScreeningDecision[] = []
    if (pepDecision) {
      out.push({
        target: 'pep', decision: pepDecision.decision, justification: pepDecision.justification,
        decided_at: pepDecision.decided_at, decided_by_name: names?.[pepDecision.decided_by] ?? null,
      })
    }
    if (sanctionsDecision) {
      out.push({
        target: 'sanctions', decision: sanctionsDecision.decision, justification: sanctionsDecision.justification,
        decided_at: sanctionsDecision.decided_at, decided_by_name: names?.[sanctionsDecision.decided_by] ?? null,
      })
    }
    return out
  }, [pepDecision, sanctionsDecision, names])

  const reportData = useMemo(() => {
    if (!dossier || !integrityHash) return null
    // `property` est joint par la query (cf. useTransaction) mais absent
    // du type TS — on accède via cast pour récupérer titre + ville si dispo.
    const property = (
      transaction as unknown as { property?: { title?: string; city?: string } } | undefined
    )?.property
    const propertyTitle = property?.title ?? null
    const propertyCity = property?.city ?? null
    const propertyLabel = propertyTitle
      ? propertyCity
        ? `${propertyTitle} · ${propertyCity}`
        : propertyTitle
      : null

    return buildPdfReportData({
      dossier,
      documents,
      auditEvents,
      agentName: profile?.full_name ?? t('report.export.agentFallback'),
      agencyName: agency?.name ?? 'MEGGA',
      transactionAmount: transaction?.price_final ?? transaction?.price_offered ?? null,
      transactionRef: null,
      propertyLabel,
      validatedByName: dossier.validated_by ? (names?.[dossier.validated_by] ?? null) : null,
      screeningDecisions,
      integrityHash,
    })
  }, [dossier, documents, auditEvents, profile, agency, transaction, names, screeningDecisions, integrityHash, t])

  // Auto-trigger Cmd+P une fois le rapport rendu ET les polices chargées (Manrope,
  // Caveat) — imprimer avant, c'est imprimer la police de repli.
  const [printed, setPrinted] = useState(false)
  useEffect(() => {
    if (!reportData || printed) return
    let cancelled = false
    let timer: number | undefined
    const fontsReady = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready
      ?? Promise.resolve()
    Promise.resolve(fontsReady).then(() => {
      if (cancelled) return
      timer = window.setTimeout(() => {
        window.print()
        setPrinted(true)
      }, 300)
    })
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [reportData, printed])

  if (dossierLoading) {
    return <ExportPlaceholder>{t('report.export.loading')}</ExportPlaceholder>
  }
  if (dossierError || !dossier) {
    return <ExportPlaceholder>{t('report.export.notFound')}</ExportPlaceholder>
  }
  if (!reportData) {
    return <ExportPlaceholder>{t('report.export.preparing')}</ExportPlaceholder>
  }

  return (
    <>
      {/* Le bureau n'existe qu'à l'écran ; la barre d'outils disparaît à l'impression */}
      <style>{`
        @media print { .pdf-export-toolbar { display: none !important; } }
        body { background: ${PDF.desk}; }
      `}</style>

      <ExportToolbar onPrint={() => window.print()} reference={reportData.reference} />

      {/* Stack vertical des 3 feuilles */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 32,
          padding: '48px 24px',
          background: PDF.desk,
          minHeight: '100vh',
        }}
      >
        <KycReportDocument data={reportData} />
      </div>
    </>
  )
}

// ─── Toolbar ───────────────────────────────────────────────────────────

interface ExportToolbarProps {
  onPrint: () => void
  reference: string
}

function ExportToolbar({ onPrint, reference }: ExportToolbarProps) {
  const { t } = useTranslation('kyc')
  // La barre est un ÉCRAN du CRM (pas du papier) : son affordance primaire porte
  // l'accent, comme partout au bureau — le thème clair, puisque le bureau derrière
  // les feuilles l'est toujours.
  const sp = crmPalette(false)
  return (
    <div
      className="pdf-export-toolbar"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: PDF.paper,
        borderBottom: `1px solid ${PDF.hair}`,
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: '"Inter Tight", system-ui, sans-serif',
        boxShadow: `0 2px 8px ${crmVoileEncre(false, 0.04)}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={() => window.close()}
          style={{
            height: 36,
            padding: '0 14px',
            borderRadius: 999,
            border: `1px solid ${PDF.hair}`,
            background: PDF.paper,
            color: PDF.inkSoft,
            fontFamily: 'inherit',
            fontSize: 'var(--crm-text-sm)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {`← ${t('report.export.close')}`}
        </button>
        <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: PDF.muted }}>
          {t('report.export.reportRef', { reference })}
        </div>
      </div>
      <button
        onClick={onPrint}
        style={{
          height: 40,
          padding: '0 20px',
          borderRadius: 999,
          border: 0,
          background: sp.accent,
          color: sp.accentInk,
          fontFamily: 'inherit',
          fontSize: 'var(--crm-text-md)',
          fontWeight: 600,
          letterSpacing: 0.1,
          cursor: 'pointer',
          boxShadow: `0 6px 16px ${crmVoileEncre(false, 0.18)}`,
        }}
      >
        {t('report.export.print')}
      </button>
    </div>
  )
}

// ─── Placeholder de chargement ────────────────────────────────────────

function ExportPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: PDF.desk,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Inter Tight", system-ui, sans-serif',
        color: PDF.muted,
        fontSize: 'var(--crm-text-lg)',
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  )
}
