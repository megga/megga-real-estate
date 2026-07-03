// Modal de revue + génération PDF d'une lettre rédigée par MEGGA AI (P2).
// Human-in-the-loop : l'agent relit/édite, puis « Générer le PDF » ouvre une page
// A4 en-tête MEGGA et déclenche l'impression navigateur → « Enregistrer en PDF ».
// Suit le pattern PDF du codebase (KycExportPage : window.print(), pas de lib).

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '@/components/ui/Toast'
import { CpIcon } from './panelIcons'
import type { AiPalette } from './aiPanel'

interface LetterReviewModalProps {
  open: boolean
  sp: AiPalette
  dark: boolean
  letter: string
  onClose: () => void
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildLetterHtml(body: string, dateStr: string): string {
  const paragraphs = body
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Lettre MEGGA</title>
<style>
  @page { size: A4; margin: 26mm 22mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; font-size: 12pt; line-height: 1.65; margin: 0; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 44px; }
  .logo { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 22pt; font-weight: 800; letter-spacing: 3px; }
  .date { font-size: 11pt; color: #444; }
  .body p { margin: 0 0 14px; }
</style></head>
<body>
  <div class="head"><div class="logo">MEGGA</div><div class="date">Genève, le ${dateStr}</div></div>
  <div class="body">${paragraphs}</div>
</body></html>`
}

export default function LetterReviewModal({ open, sp, dark, letter, onClose }: LetterReviewModalProps) {
  const toast = useToast()
  const [body, setBody] = useState(letter)

  useEffect(() => {
    if (open) setBody(letter)
  }, [open, letter])

  if (!open) return null

  const canGenerate = body.trim().length > 0

  const generate = () => {
    if (!canGenerate) return
    const dateStr = new Date().toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })
    const w = window.open('', '_blank', 'width=820,height=1040')
    if (!w) {
      toast.error('Autorisez les fenêtres pop-up pour générer le PDF')
      return
    }
    w.document.write(buildLetterHtml(body, dateStr))
    w.document.close()
    w.focus()
    // Laisse le rendu se faire avant d'ouvrir la boîte d'impression.
    window.setTimeout(() => { w.print() }, 350)
    onClose()
  }

  const surface = dark ? '#17181C' : '#FFFFFF'
  const fieldBg = dark ? 'rgba(255,255,255,0.05)' : '#F4F6F9'
  const fieldBorder = dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.08)'

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center',
        background: dark ? 'rgba(0,0,2,0.55)' : 'rgba(15,23,42,0.28)',
        backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
        animation: 'ltrFade .2s ease both', padding: 20,
        fontFamily: "'Inter Tight', system-ui, sans-serif",
      }}
    >
      <style>{`@keyframes ltrFade{from{opacity:0}to{opacity:1}}@keyframes ltrUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Générer le PDF de la lettre"
        style={{
          width: 'min(540px, 100%)', maxHeight: '86vh', overflowY: 'auto',
          background: surface, borderRadius: 22, padding: '20px 22px 18px',
          boxShadow: dark ? '0 30px 80px -12px rgba(0,0,0,.7)' : '0 30px 80px -16px rgba(15,23,42,.28)',
          display: 'flex', flexDirection: 'column', gap: 14,
          animation: 'ltrUp .28s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: sp.ink, letterSpacing: -0.3, flex: 1 }}>Générer le PDF</span>
          <button onClick={onClose} title="Fermer" aria-label="Fermer" style={{
            width: 32, height: 32, borderRadius: 999, border: 0, cursor: 'pointer',
            background: 'transparent', display: 'grid', placeItems: 'center',
          }}>
            <CpIcon name="close" size={18} color={sp.sub} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: sp.sub }}>Lettre (en-tête MEGGA · A4)</span>
          <textarea
            value={body} onChange={(e) => setBody(e.target.value)} rows={12}
            style={{
              width: '100%', border: fieldBorder, outline: 'none', background: fieldBg,
              borderRadius: 12, padding: '11px 13px', fontFamily: 'inherit', fontSize: 14,
              color: sp.ink, boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6, minHeight: 220,
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
          <span style={{ fontSize: 12, color: sp.sub, flex: 1 }}>
            Ouvre l'aperçu imprimable — choisissez « Enregistrer en PDF ».
          </span>
          <button onClick={onClose} style={{
            height: 40, padding: '0 18px', borderRadius: 999, border: 0, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: sp.soft,
            background: dark ? 'rgba(255,255,255,0.06)' : '#F1F4F8',
          }}>Annuler</button>
          <button onClick={generate} disabled={!canGenerate} style={{
            height: 40, padding: '0 20px', borderRadius: 999, border: 0,
            cursor: canGenerate ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
            background: canGenerate ? sp.accent : (dark ? 'rgba(255,255,255,0.12)' : '#E6E9EE'),
            color: canGenerate ? sp.onAccent : sp.sub, display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <CpIcon name="draft" size={15} color={canGenerate ? sp.onAccent : sp.sub} sw={2} />
            Générer le PDF
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
