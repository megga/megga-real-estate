// MEGGA — Page d'export PDF dossier KYC (Sprint 4.4)
// Route : /dashboard/kyc/:dossierId/export
// Print-friendly, déclenche window.print() automatiquement.
//
// Stratégie : on rend les 3 pages PDF côté React (composants PdfPage1/2/3),
// puis l'agent fait Cmd+P (ou auto-trigger). Le navigateur génère un PDF natif
// — pas de dépendance Puppeteer / jsPDF. Plus simple, plus léger.

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useKycCase, useKycDocuments, useKycAuditEvents } from '@/hooks/useKyc'
import { useTransaction } from '@/hooks/useTransactions'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { buildPdfReportData } from '@/components/kyc-report/buildReportData'
import { PdfPage1 } from '@/components/kyc-report/PdfPage1'
import { PdfPage2 } from '@/components/kyc-report/PdfPage2'
import { PdfPage3 } from '@/components/kyc-report/PdfPage3'
import { PDF } from '@/components/kyc-report/tokens'

export default function KycExportPage() {
  const { t } = useTranslation('kyc')
  const { dossierId } = useParams<{ dossierId: string }>()
  const { profile } = useAuth()

  const { data: dossier, isLoading: dossierLoading, error: dossierError } =
    useKycCase(dossierId)
  const { data: documents = [] } = useKycDocuments(dossierId)
  const { data: auditEvents = [] } = useKycAuditEvents(dossierId)
  const { data: transaction } = useTransaction(dossier?.transaction_id)

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

  // Auto-trigger Cmd+P après render — donne 800ms pour le 1er paint des fontes
  const [printed, setPrinted] = useState(false)
  useEffect(() => {
    if (!dossier || printed) return
    const timer = window.setTimeout(() => {
      window.print()
      setPrinted(true)
    }, 800)
    return () => window.clearTimeout(timer)
  }, [dossier, printed])

  const reportData = useMemo(() => {
    if (!dossier) return null
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
      transactionAmount:
        transaction?.price_final ?? transaction?.price_offered ?? null,
      transactionRef: null,
      propertyLabel,
    })
  }, [dossier, documents, auditEvents, profile, agency, transaction])

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
      {/* Print styles globales pour l'export PDF */}
      <style>{`
        @page {
          size: A4;
          margin: 0;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #FFFFFF !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .pdf-page {
            box-shadow: none !important;
            break-after: page;
            page-break-after: always;
          }
          .pdf-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }
          .pdf-export-toolbar {
            display: none !important;
          }
        }
        body {
          background: ${PDF.bg};
        }
      `}</style>

      {/* Toolbar (masquée à l'impression) */}
      <ExportToolbar
        onPrint={() => window.print()}
        reference={reportData.reference}
      />

      {/* Stack vertical des 3 pages */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 32,
          padding: '48px 24px',
          background: PDF.bg,
          minHeight: '100vh',
          fontFamily: '"Inter Tight", system-ui, sans-serif',
        }}
      >
        <PdfPage1 data={reportData} />
        <PdfPage2 data={reportData} />
        <PdfPage3 data={reportData} />
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
  return (
    <div
      className="pdf-export-toolbar"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: '#FFFFFF',
        borderBottom: `1px solid ${PDF.hairStrong}`,
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: '"Inter Tight", system-ui, sans-serif',
        boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={() => window.close()}
          style={{
            height: 36,
            padding: '0 14px',
            borderRadius: 999,
            border: `1px solid ${PDF.hairStrong}`,
            background: '#FFFFFF',
            color: PDF.inkSoft,
            fontFamily: 'inherit',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {`← ${t('report.export.close')}`}
        </button>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: PDF.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
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
          background: PDF.black,
          color: '#FFFFFF',
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 0.1,
          cursor: 'pointer',
          boxShadow: '0 6px 16px rgba(11,12,14,0.18)',
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
        background: PDF.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Inter Tight", system-ui, sans-serif',
        color: PDF.muted,
        fontSize: 14,
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  )
}
