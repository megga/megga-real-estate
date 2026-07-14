// MEGGA CRM Sugar v3 — Wizard Step 2bis : Import d'un rapport externe
// Port du KwStepImport (crm-kyc-wizard.jsx) mais avec une VRAIE extraction :
// dépôt PDF → EF `kyc-report-import` (Gemini via _shared/vision + kyc-extract)
// → contrôles id / PEP / sanctions pré-remplis, LAISSÉS À VALIDER par l'agent
// (garde-fou MLRO). Le domicile et la source des fonds restent à compléter.

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useKycPalette } from '../kyc/kycPalette'
import { SgIcon } from '../icons'
import { KycBlackPill } from '../kyc/kycPrimitives'
import type { KycImportParsed, WizardData } from './types'

interface Props {
  data: WizardData
  set: (patch: Partial<WizardData>) => void
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const res = reader.result as string
      resolve(res.includes(',') ? res.split(',')[1] : res)
    }
    reader.onerror = () => reject(new Error('read_failed'))
    reader.readAsDataURL(file)
  })
}

export function KwStepImport({ data, set }: Props) {
  const sp = useKycPalette()
  const [error, setError] = useState<string | null>(null)
  const reading = !!data.importFile && !data.importParsed && !error
  const inputRef = useRef<HTMLInputElement | null>(null)
  const runRef = useRef<string | null>(null)

  useEffect(() => {
    const file = data.importFile
    if (!file || data.importParsed) return
    // Une seule extraction par fichier (nom+taille comme clé).
    const key = `${file.name}:${file.size}`
    if (runRef.current === key) return
    runRef.current = key
    setError(null)
    let alive = true
    ;(async () => {
      try {
        const pdfBase64 = await toBase64(file)
        const { data: res, error: efError } = await supabase.functions.invoke('kyc-report-import', {
          body: { pdf_base64: pdfBase64, filename: file.name },
        })
        if (!alive) return
        if (efError) throw efError
        set({ importParsed: res as KycImportParsed })
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Lecture du rapport impossible.')
        runRef.current = null
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.importFile])

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both' }}>
      <style>{`@keyframes kwSpin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 38, fontWeight: 700, color: sp.ink, letterSpacing: -0.8, lineHeight: 1.1 }}>
          Déposez le rapport externe
        </h1>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) set({ importFile: f, importParsed: null })
        }}
      />

      <div style={{ background: sp.card, borderRadius: 22, boxShadow: sp.shadow, padding: '34px 36px', maxWidth: 560, margin: '0 auto', border: `1px solid ${sp.cardBorder}` }}>
        {!data.importFile && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, textAlign: 'center' }}>
            <span style={{ width: 64, height: 64, borderRadius: 999, background: sp.cardSubtle, display: 'grid', placeItems: 'center' }}>
              <SgIcon name="upload" size={26} stroke={sp.ink} />
            </span>
            <KycBlackPill onClick={() => inputRef.current?.click()}>Choisir le fichier</KycBlackPill>
            <div style={{ fontSize: 12, color: sp.muted, fontWeight: 500 }}>PDF Persona ou partenaire · 10 Mo max</div>
          </div>
        )}

        {reading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center', padding: '14px 0' }}>
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: 999,
                border: `3px solid ${sp.cardSubtle}`,
                borderTopColor: sp.ink,
                animation: 'kwSpin .7s linear infinite',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ fontSize: 14.5, fontWeight: 700, color: sp.ink }}>MEGGA lit les contrôles…</div>
            <div style={{ fontSize: 12.5, color: sp.muted, fontWeight: 500 }}>{data.importFile?.name}</div>
          </div>
        )}

        {error && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: sp.errDarker }}>{error}</div>
            <KycBlackPill onClick={() => { set({ importFile: null, importParsed: null }); setError(null); runRef.current = null }}>
              Réessayer
            </KycBlackPill>
          </div>
        )}

        {data.importParsed && !error && (
          <div style={{ animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 14, minWidth: 0 }}>
              <SgIcon name="doc" size={14} stroke={sp.inkSoft} />
              <span style={{ fontSize: 13, fontWeight: 700, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {data.importFile?.name}
              </span>
            </div>
            {data.importParsed.checks.map((c) => (
              <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: `1px solid ${sp.cardSubtle}` }}>
                <span style={{ width: 24, height: 24, borderRadius: 999, background: sp.black, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <SgIcon name="check" size={12} stroke={sp.onAccent} sw={2.4} />
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: sp.ink, whiteSpace: 'nowrap' }}>{c.key}</span>
                <span style={{ fontSize: 12.5, color: sp.muted, fontWeight: 500, marginLeft: 'auto', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {c.result}
                </span>
              </div>
            ))}
            <div style={{ marginTop: 16, fontSize: 12.5, color: sp.muted, fontWeight: 600 }}>
              Pré-remplis depuis le rapport — à valider. Restent le domicile et la source des fonds.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
