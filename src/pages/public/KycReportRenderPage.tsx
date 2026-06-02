// MEGGA — Rendu public tokenisé du rapport KYC (pour Cloudflare Browser Rendering).
// Aucune session : les données viennent de l'edge kyc-report-data (token HMAC).
// Pose #pdf-ready quand données + fontes sont prêtes → le headless capture alors.
// Réutilise le MÊME template que le CRM (buildPdfReportData + PdfPage1/2/3) → DRY.

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { buildPdfReportData, type BuildReportInput } from '@/components/kyc-report/buildReportData'
import { PdfPage1 } from '@/components/kyc-report/PdfPage1'
import { PdfPage2 } from '@/components/kyc-report/PdfPage2'
import { PdfPage3 } from '@/components/kyc-report/PdfPage3'
import { PDF } from '@/components/kyc-report/tokens'

export default function KycReportRenderPage() {
  const { token } = useParams<{ token: string }>()
  const [input, setInput] = useState<BuildReportInput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!token) { setError('missing token'); return }
      const { data, error: invErr } = await supabase.functions.invoke('kyc-report-data', { body: { token } })
      if (cancelled) return
      if (invErr || !data?.ok) { setError(invErr?.message ?? data?.error ?? 'load failed'); return }
      setInput(data.report as BuildReportInput)
    })()
    return () => { cancelled = true }
  }, [token])

  const reportData = useMemo(() => (input ? buildPdfReportData(input) : null), [input])

  // Sentinelle : attendre le rendu + les fontes (Manrope) avant de signaler "prêt".
  useEffect(() => {
    if (!reportData) return
    let cancelled = false
    const fontsReady = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready
      ?? Promise.resolve()
    Promise.resolve(fontsReady).then(() => {
      if (!cancelled) requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)))
    })
    return () => { cancelled = true }
  }, [reportData])

  if (error) {
    // Sentinelle d'erreur distincte → le headless échoue proprement (pas de PDF blanc).
    return <div id="pdf-error" style={{ fontFamily: 'system-ui', padding: 24 }}>Rapport indisponible.</div>
  }
  if (!reportData) {
    return <div style={{ fontFamily: 'system-ui', padding: 24, color: PDF.muted }}>Préparation du rapport…</div>
  }

  return (
    <>
      <link
        rel="stylesheet"
        referrerPolicy="no-referrer"
        href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap"
      />
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: #FFFFFF !important;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .pdf-page { box-shadow: none !important; break-after: page; page-break-after: always; }
          .pdf-page:last-child { break-after: auto; page-break-after: auto; }
        }
        body { background: #FFFFFF; }
      `}</style>

      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: '#FFFFFF', fontFamily: 'Manrope, system-ui, sans-serif',
        }}
      >
        <PdfPage1 data={reportData} />
        <PdfPage2 data={reportData} />
        <PdfPage3 data={reportData} />
      </div>

      {/* Signal pour Cloudflare Browser Rendering (waitForSelector: '#pdf-ready') */}
      {ready && <div id="pdf-ready" aria-hidden style={{ position: 'fixed', width: 1, height: 1, opacity: 0 }} />}
    </>
  )
}
