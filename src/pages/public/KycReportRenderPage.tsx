// MEGGA — Rendu public tokenisé du rapport KYC (pour Cloudflare Browser Rendering).
// Aucune session : les données viennent de l'edge kyc-report-data (token HMAC).
// Pose #pdf-ready quand données + empreinte + fontes sont prêtes → le headless
// capture alors. Réutilise le MÊME composant que le CRM (`KycReportDocument`).

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { buildPdfReportData, type BuildReportInput, type PdfReportData } from '@/components/kyc-report/buildReportData'
import { computeKycIntegrityHash } from '@/components/kyc-report/integrity'
import { KycReportDocument } from '@/components/kyc-report/KycReportDocument'
import { PDF } from '@/components/kyc-report/tokens'

/** Ce que rend `kyc-report-data` : tout le view-model d'entrée, sauf l'empreinte, calculée ici. */
type ServerReport = Omit<BuildReportInput, 'integrityHash'>

export default function KycReportRenderPage() {
  const { t } = useTranslation('kyc')
  const { token } = useParams<{ token: string }>()
  const [reportData, setReportData] = useState<PdfReportData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!token) { setError('missing token'); return }
      const { data, error: invErr } = await supabase.functions.invoke('kyc-report-data', { body: { token } })
      if (cancelled) return
      if (invErr || !data?.ok) { setError(invErr?.message ?? data?.error ?? 'load failed'); return }
      const report = data.report as ServerReport
      // L'empreinte est calculée par le navigateur qui rend, jamais reçue : le
      // serveur ne fait que fournir la matière, comme pour l'aperçu de l'agent.
      const integrityHash = await computeKycIntegrityHash(report.dossier, report.documents)
      if (cancelled) return
      setReportData(buildPdfReportData({ ...report, integrityHash }))
    })()
    return () => { cancelled = true }
  }, [token])

  // Sentinelle : attendre le rendu + les fontes (Manrope, Caveat) avant de signaler "prêt".
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
    return <div id="pdf-error" style={{ fontFamily: 'system-ui', padding: 24 }}>{t('report.render.unavailable')}</div>
  }
  if (!reportData) {
    return <div style={{ fontFamily: 'system-ui', padding: 24, color: PDF.muted }}>{t('report.render.preparing')}</div>
  }

  return (
    <>
      <style>{`body { background: ${PDF.paper}; }`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: PDF.paper }}>
        <KycReportDocument data={reportData} />
      </div>

      {/* Signal pour Cloudflare Browser Rendering (waitForSelector: '#pdf-ready') */}
      {ready && <div id="pdf-ready" aria-hidden style={{ position: 'fixed', width: 1, height: 1, opacity: 0 }} />}
    </>
  )
}
