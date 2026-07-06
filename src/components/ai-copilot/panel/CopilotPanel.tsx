// MEGGA AI — Panneau latéral docké (refonte Co-Pilot, juin 2026).
// Port fidèle du handoff `crm-copilot-panel.jsx` dans la vraie stack React/TS :
//  • backend réel = useCopilot().sendMessageStream (edge function ai-copilot / DeepSeek)
//  • ouverture / graine / écran courant = useAiPanel (remplace window.meggaAskAI)
//  • ancrage données réelles = contexte CRM live passé à l'edge function (chantier 6)
// Grammaire Sugar Pure : surface opaque (#0B0C0E sombre / blanc clair), coins 22,
// ombre douce, accent noir, identité MEGGA AI bleue (badge « Bêta », glyphe étoile).

import {
  useState, useRef, useEffect, useMemo, useCallback,
  type ReactNode, type KeyboardEvent as ReactKeyboardEvent, type ChangeEvent as ReactChangeEvent,
} from 'react'
import { CRM_TOKENS, crmSugarPalette, crmFmtCHF, CRM_STAGES, type StageId } from '@/components/crm-sugar/tokens'
import { useCopilot, type PendingActionCard } from '@/hooks/useCopilot'
import { useUploadChatPhoto } from '@/hooks/useProperties'
import { useAuth } from '@/hooks/useAuth'
import { usePipelineSugar } from '@/hooks/usePipelineSugar'
import { useAiPanel } from '@/hooks/useAiPanel'
import { useImpersonate } from '@/hooks/useImpersonate'
import { CpIcon, AiGlyph } from './panelIcons'
import EmailReviewModal, { type EmailDraft } from './EmailReviewModal'
import AnnonceReviewModal from './AnnonceReviewModal'
import LetterReviewModal from './LetterReviewModal'
import PublishReviewModal from './PublishReviewModal'
import {
  PANEL_W, deriveAiPalette, packFor, screenLabel, parseSegments, detectEmailDraft, isAnnonceRequest, isLettreRequest, thinkingPhases,
  type AiPalette,
} from './aiPanel'

// ── Mode sombre Sugar (même clé localStorage que les pages) ─────────────────
function readSugarDark(): boolean {
  if (typeof window === 'undefined') return false
  const s = window.localStorage.getItem('megga.sugar.dark')
  if (s === '1') return true
  if (s === '0') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}
// Réactif : `storage` (cross-onglet) + relecture courte tant que le panneau est
// ouvert (capte un toggle same-tab sans toucher au code partagé du rail).
function usePanelDark(active: boolean): boolean {
  const [dark, setDark] = useState(readSugarDark)
  useEffect(() => {
    const sync = () => setDark(readSugarDark())
    window.addEventListener('storage', sync)
    let id: number | undefined
    if (active) id = window.setInterval(sync, 400)
    return () => { window.removeEventListener('storage', sync); if (id) window.clearInterval(id) }
  }, [active])
  return dark
}

// ── Message ─────────────────────────────────────────────────────────────────
interface PanelMsg {
  id: number
  role: 'user' | 'assistant' | 'context'
  content: string
  loading?: boolean
  query?: string
  screen?: string
  /** Libellé RÉEL de l'outil en cours (tool_start SSE) — null = aucun. */
  phase?: string | null
}

// ── Statut « réflexion » ─────────────────────────────────────────────────────
// Si un outil réel tourne (phase fournie par le SSE), on affiche SON libellé —
// c'est de la transparence, pas une animation fabriquée. Sinon, repli sur les
// phases heuristiques dérivées de la question (le temps de la 1re inférence).
function CpThinking({ sp, query, phase }: { sp: AiPalette; query?: string; phase?: string | null }) {
  const phases = useMemo(() => thinkingPhases(query || ''), [query])
  const [i, setI] = useState(0)
  useEffect(() => {
    setI(0)
    const id = window.setInterval(() => setI((n) => Math.min(n + 1, phases.length - 1)), 1100)
    return () => window.clearInterval(id)
  }, [phases])
  const label = phase || phases[i]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
      <span key={label} style={{
        fontSize: 13.5, fontWeight: 600, lineHeight: 1.5,
        color: sp.dark ? 'rgba(255,255,255,0.55)' : '#7A8088',
        background: `linear-gradient(100deg, ${sp.dark ? 'rgba(255,255,255,0.35)' : '#B5BAC2'} 30%, ${sp.dark ? '#FFFFFF' : '#0B0C0E'} 50%, ${sp.dark ? 'rgba(255,255,255,0.35)' : '#B5BAC2'} 70%)`,
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text', backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        animation: 'cpShimmer 1.6s linear infinite, cpFadeIn .3s ease both',
      }}>{label}</span>
    </div>
  )
}

// ── Rendu inline : **gras**, `code` ─────────────────────────────────────────
function cpInline(text: string, sp: AiPalette, kb: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1] != null) {
      out.push(<strong key={kb + 'b' + k++} style={{ fontWeight: 750, color: sp.ink }}>{m[1]}</strong>)
    } else {
      out.push(<code key={kb + 'c' + k++} style={{
        fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '0.86em',
        padding: '1.5px 5px', borderRadius: 6, color: sp.ink,
        background: sp.dark ? 'rgba(255,255,255,0.08)' : 'rgba(11,12,14,0.05)',
      }}>{m[2]}</code>)
    }
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

// ── Rendu structuré (titres, listes, paragraphes) ───────────────────────────
type RichBlock =
  | { type: 'h'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'p'; text: string }

function CpRichText({ content, sp }: { content: string; sp: AiPalette }) {
  const blocks = useMemo<RichBlock[]>(() => {
    const lines = (content || '').split('\n')
    const bl: RichBlock[] = []
    let i = 0
    const special = (s: string) => /^\s*(#{1,4}\s|[-*•]\s|\d+[.)]\s)/.test(s)
    while (i < lines.length) {
      const t = lines[i].trim()
      if (!t) { i++; continue }
      const h = t.match(/^(#{1,4})\s+(.*)$/)
      if (h) { bl.push({ type: 'h', text: h[2] }); i++; continue }
      if (/^[-*•]\s+/.test(t)) {
        const items: string[] = []
        while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*•]\s+/, '')); i++ }
        bl.push({ type: 'ul', items }); continue
      }
      if (/^\d+[.)]\s+/.test(t)) {
        const items: string[] = []
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++ }
        bl.push({ type: 'ol', items }); continue
      }
      const para = [lines[i]]; i++
      while (i < lines.length && lines[i].trim() && !special(lines[i])) { para.push(lines[i]); i++ }
      bl.push({ type: 'p', text: para.join(' ') })
    }
    return bl
  }, [content])

  const txt = { fontSize: 14, lineHeight: 1.62, color: sp.soft, fontWeight: 500 } as const
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {blocks.map((b, i) => {
        if (b.type === 'h') {
          return (
            <div key={i} style={{
              fontSize: 13.5, fontWeight: 800, color: sp.ink, letterSpacing: -0.2,
              lineHeight: 1.35, marginTop: i === 0 ? 0 : 2,
            }}>{cpInline(b.text, sp, 'h' + i)}</div>
          )
        }
        if (b.type === 'ul') {
          return (
            <ul key={i} style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {b.items.map((it, j) => (
                <li key={j} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ width: 5, height: 5, borderRadius: 999, background: sp.sub, flexShrink: 0, marginTop: 8 }} />
                  <span style={txt}>{cpInline(it, sp, 'u' + i + '_' + j)}</span>
                </li>
              ))}
            </ul>
          )
        }
        if (b.type === 'ol') {
          return (
            <ol key={i} style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {b.items.map((it, j) => (
                <li key={j} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{
                    fontSize: 12.5, fontWeight: 800, color: sp.ink, flexShrink: 0, minWidth: 15,
                    fontVariantNumeric: 'tabular-nums', lineHeight: 1.62,
                  }}>{j + 1}.</span>
                  <span style={txt}>{cpInline(it, sp, 'o' + i + '_' + j)}</span>
                </li>
              ))}
            </ol>
          )
        }
        return <div key={i} style={txt}>{cpInline(b.text, sp, 'p' + i)}</div>
      })}
    </div>
  )
}

// ── Carte d'action : brouillon rédigé (chantier 4 — boucle fermée) ──────────
function CpDraftCard({ lang, body, open, sp, onInsertEmail, onUseAnnonce, onGenerateLetter }: { lang: string; body: string; open: boolean; sp: AiPalette; onInsertEmail?: (draft: EmailDraft) => void; onUseAnnonce?: (annonce: string) => void; onGenerateLetter?: (letter: string) => void }) {
  const [copied, setCopied] = useState(false)
  const isEmail = /^(courriel|email|e-mail|mail)$/i.test(lang)
  const isAnnonce = /annonce/i.test(lang)
  const isLettre = /lettre/i.test(lang)
  // Un brouillon a une action « boucle fermée » RÉELLE seulement pour email
  // (modal d'envoi Resend), annonce (enregistrement sur le bien) et lettre (PDF).
  // Un message/SMS n'a pas de canal d'envoi web → on ne montre PAS de fausse
  // action « Programmer l'envoi » : l'agent copie et envoie par son canal.
  const hasAction = isEmail || isAnnonce || isLettre
  const kind = isEmail ? "Brouillon d'email"
    : /sms/i.test(lang) ? 'Brouillon de SMS'
    : isLettre ? 'Brouillon de courrier'
    : isAnnonce ? "Brouillon d'annonce"
    : 'Brouillon de message'
  let subject: string | null = null
  let text = body
  const firstNl = body.indexOf('\n')
  const head = firstNl === -1 ? body : body.slice(0, firstNl)
  const m = head.match(/^\s*objet\s*:\s*(.+)$/i)
  if (m) { subject = m[1].trim(); text = firstNl === -1 ? '' : body.slice(firstNl + 1).replace(/^\n+/, '') }
  const copy = () => {
    if (!navigator.clipboard) return
    navigator.clipboard
      .writeText((subject ? 'Objet : ' + subject + '\n\n' : '') + text)
      .then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600) })
      .catch(() => {})
  }
  return (
    <div style={{
      background: sp.cardBg2, borderRadius: 14, padding: '13px 14px 12px',
      boxShadow: sp.cardShadow, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <CpIcon name="draft" size={14} color={sp.sub} sw={1.9} />
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: sp.sub }}>{kind}</span>
      </div>
      {subject != null && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: sp.sub, flexShrink: 0 }}>Objet</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: sp.ink, letterSpacing: -0.2, lineHeight: 1.4 }}>{subject}</span>
        </div>
      )}
      <div style={{ fontSize: 13.5, lineHeight: 1.6, color: sp.soft, fontWeight: 500, whiteSpace: 'pre-wrap' }}>
        {text}{open && <span style={{ opacity: 0.4 }}>▍</span>}
      </div>
      {!open && (
        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          {hasAction && (
            <button
              onClick={() => {
                // Boucle fermée réelle (human-in-the-loop) : email → modal d'envoi,
                // annonce → enregistrement sur le bien, lettre → génération PDF.
                if (isEmail && onInsertEmail) onInsertEmail({ subject: subject ?? '', body: text })
                else if (isAnnonce && onUseAnnonce) onUseAnnonce(text)
                else if (isLettre && onGenerateLetter) onGenerateLetter(text)
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, border: 0, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, letterSpacing: -0.1, height: 34, padding: '0 15px',
                borderRadius: 999, background: sp.accent, color: sp.onAccent, transition: 'background .15s, transform .15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}>
              {isEmail ? 'Insérer dans un email' : isAnnonce ? 'Utiliser sur le bien' : 'Générer le PDF'}
            </button>
          )}
          <button onClick={copy} style={{
            display: 'flex', alignItems: 'center', gap: 6, border: 0, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, letterSpacing: -0.1, height: 34, padding: '0 13px',
            borderRadius: 999, color: copied ? sp.ink : sp.soft, background: sp.dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
            boxShadow: sp.dark ? 'none' : '0 1px 4px rgba(15,23,42,0.06)', transition: 'background .14s',
          }}>
            <CpIcon name={copied ? 'check' : 'copy'} size={13} color={copied ? sp.ink : sp.soft} sw={2} />
            {copied ? 'Copié' : 'Copier'}
          </button>
        </div>
      )}
    </div>
  )
}

function CpAnswerBody({ content, sp, query, onInsertEmail, onUseAnnonce, onGenerateLetter }: { content: string; sp: AiPalette; query?: string; onInsertEmail?: (draft: EmailDraft) => void; onUseAnnonce?: (annonce: string) => void; onGenerateLetter?: (letter: string) => void }) {
  const segs = useMemo(() => parseSegments(content), [content])
  const hasFence = segs.some((s) => s.type === 'draft')
  // L'edge function ne fence pas → si pas de bloc explicite, on détecte un email
  // rédigé en clair (« Objet : … ») pour le présenter en carte d'action.
  const emailDraft = useMemo(() => (hasFence ? null : detectEmailDraft(content)), [hasFence, content])
  if (!segs.length) return null
  // Intentions EXPLICITES (lettre/annonce) prioritaires sur la détection email de
  // contenu (un courrier formel a aussi greeting + formule de politesse).
  if (!hasFence && isLettreRequest(query)) {
    return <CpDraftCard lang="lettre" body={content} open={false} sp={sp} onGenerateLetter={onGenerateLetter} />
  }
  if (!hasFence && isAnnonceRequest(query)) {
    return <CpDraftCard lang="annonce" body={content} open={false} sp={sp} onUseAnnonce={onUseAnnonce} />
  }
  if (emailDraft) {
    // CpDraftCard re-parse la ligne « Objet: … » → on la reconstruit.
    const reconstructed = (emailDraft.subject ? `Objet: ${emailDraft.subject}\n` : '') + emailDraft.body
    return <CpDraftCard lang="courriel" body={reconstructed} open={false} sp={sp} onInsertEmail={onInsertEmail} />
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {segs.map((s, i) => s.type === 'draft'
        ? <CpDraftCard key={i} lang={s.lang} body={s.body} open={s.open} sp={sp} onInsertEmail={onInsertEmail} onUseAnnonce={onUseAnnonce} onGenerateLetter={onGenerateLetter} />
        : <CpRichText key={i} content={s.text} sp={sp} />)}
    </div>
  )
}

// ── Bulle de message ────────────────────────────────────────────────────────
function Bubble({ msg, sp, onSend, onInsertEmail, onUseAnnonce, onGenerateLetter }: { msg: PanelMsg; sp: AiPalette; onSend: (p: string) => void; onInsertEmail?: (draft: EmailDraft) => void; onUseAnnonce?: (annonce: string) => void; onGenerateLetter?: (letter: string) => void }) {
  if (msg.role === 'context') {
    const pack = packFor(msg.screen || '')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, margin: '4px 0 18px', animation: 'cpCtxIn .4s cubic-bezier(.2,.8,.2,1) both' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999,
          background: sp.dark ? 'rgba(255,255,255,0.06)' : 'rgba(11,12,14,0.05)',
        }}>
          <CpIcon name="eye" size={13} color={sp.sub} sw={1.9} />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: sp.sub, letterSpacing: 0.1 }}>
            Vous êtes maintenant sur {screenLabel(msg.screen || '')}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {pack.actions.slice(0, 2).map((a, i) => (
            <button key={i} onClick={() => onSend(a.p)} style={{
              border: 0, cursor: 'pointer', fontFamily: 'inherit', padding: '7px 13px', borderRadius: 999,
              fontSize: 12, fontWeight: 700, letterSpacing: -0.1, color: sp.soft,
              background: sp.cardBg2, boxShadow: sp.cardShadow, transition: 'background .14s',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = sp.rowHov }}
              onMouseLeave={(e) => { e.currentTarget.style.background = sp.cardBg2 }}>
              {a.t}
            </button>
          ))}
        </div>
      </div>
    )
  }
  if (msg.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <div style={{
          maxWidth: '82%', background: sp.ink, color: sp.cardInk || '#fff',
          padding: '11px 15px', borderRadius: '16px 16px 4px 16px',
          fontSize: 14, lineHeight: 1.5, fontWeight: 500,
        }}>{msg.content}</div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'flex-start' }}>
      <AiGlyph size={22} bg="transparent" on={sp.dark ? '#7FB0FF' : '#1E5BC6'} />
      <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
        {msg.loading
          ? <CpThinking sp={sp} query={msg.query} phase={msg.phase} />
          : <CpAnswerBody content={msg.content} sp={sp} query={msg.query} onInsertEmail={onInsertEmail} onUseAnnonce={onUseAnnonce} onGenerateLetter={onGenerateLetter} />}
      </div>
    </div>
  )
}

// ── Barre de saisie ancrée ──────────────────────────────────────────────────
interface ComposerPhoto { id: string; url: string | null; error: boolean }

function Composer({ onSend, loading, sp }: { onSend: (t: string, photos?: string[]) => void; loading: boolean; sp: AiPalette }) {
  const [val, setVal] = useState('')
  const [photos, setPhotos] = useState<ComposerPhoto[]>([])
  const [dragOver, setDragOver] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const upload = useUploadChatPhoto()

  const uploading = photos.some((p) => p.url === null && !p.error)
  const readyUrls = photos.filter((p) => p.url).map((p) => p.url as string)

  // Chaque photo est stagée en parallèle (bucket property-photos) ; l'URL revient dans la
  // vignette. À l'envoi, seules les URLs prêtes partent dans context.attached_photos.
  const addFiles = (files: FileList | File[]) => {
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, 8)
    for (const file of imgs) {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      setPhotos((ps) => [...ps, { id, url: null, error: false }])
      upload.mutateAsync(file)
        .then((url) => setPhotos((ps) => ps.map((p) => (p.id === id ? { ...p, url } : p))))
        .catch(() => setPhotos((ps) => ps.map((p) => (p.id === id ? { ...p, error: true } : p))))
    }
  }
  const removePhoto = (id: string) => setPhotos((ps) => ps.filter((p) => p.id !== id))

  const submit = () => {
    const v = val.trim()
    if ((!v && readyUrls.length === 0) || loading || uploading) return
    onSend(v, readyUrls.length ? readyUrls : undefined)
    setVal(''); setPhotos([])
    if (ref.current) ref.current.style.height = 'auto'
  }
  const onKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }
  const grow = (e: ReactChangeEvent<HTMLTextAreaElement>) => {
    setVal(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }
  const canSend = (!!val.trim() || readyUrls.length > 0) && !loading && !uploading

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!dragOver) setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files) }}
      style={{
        background: sp.dark ? '#0B0C0E' : sp.composerBg, borderRadius: 22, padding: '10px 10px 10px 16px',
        boxShadow: dragOver ? `inset 0 0 0 2px ${sp.accent}` : (sp.dark ? 'inset 0 0 0 1px rgba(255,255,255,0.08)' : sp.composerShadow),
        display: 'flex', flexDirection: 'column', gap: 8, transition: 'box-shadow .14s',
      }}
    >
      {photos.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
          {photos.map((p) => (
            <div key={p.id} style={{
              position: 'relative', width: 46, height: 46, borderRadius: 9, overflow: 'hidden',
              background: sp.dark ? 'rgba(255,255,255,0.08)' : '#E9ECF1', display: 'grid', placeItems: 'center',
            }}>
              {p.url
                ? <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 11, fontWeight: 700, color: p.error ? '#E5484D' : sp.sub }}>{p.error ? '!' : '…'}</span>}
              <button onClick={() => removePhoto(p.id)} title="Retirer" aria-label="Retirer la photo" style={{
                position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: 999, border: 0, cursor: 'pointer',
                background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, lineHeight: '16px', padding: 0,
              }}>×</button>
            </div>
          ))}
        </div>
      )}
      <textarea ref={ref} value={val} onChange={grow} onKeyDown={onKey} rows={1}
        className={sp.dark ? 'cp-composer-input' : undefined}
        placeholder="Demander à MEGGA AI"
        style={{
          width: '100%', border: 0, outline: 'none', background: 'transparent',
          resize: 'none', fontFamily: 'inherit', fontSize: 14.5, lineHeight: 1.5,
          color: sp.dark ? '#FFFFFF' : sp.ink, padding: '4px 0', maxHeight: 120,
        }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => fileRef.current?.click()} title="Joindre des photos" aria-label="Joindre des photos"
          style={{
            width: 34, height: 34, borderRadius: 999, border: 0, cursor: 'pointer',
            background: sp.dark ? 'rgba(255,255,255,0.06)' : 'rgba(11,12,14,0.05)',
            display: 'grid', placeItems: 'center',
          }}>
          <CpIcon name="image" size={18} color={sp.sub} sw={1.9} />
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = '' }} />
        <button onClick={submit} disabled={!canSend} title="Envoyer" aria-label="Envoyer"
          style={{
            width: 36, height: 36, borderRadius: 999, border: 0, cursor: canSend ? 'pointer' : 'default',
            background: canSend ? (sp.dark ? '#FFFFFF' : sp.ink) : (sp.dark ? 'rgba(255,255,255,0.12)' : '#E6E9EE'),
            display: 'grid', placeItems: 'center', transition: 'background .16s',
          }}>
          <CpIcon name="send" size={18} color={canSend ? (sp.dark ? '#0B0C0E' : '#fff') : (sp.dark ? 'rgba(255,255,255,0.4)' : sp.sub)} sw={2} />
        </button>
      </div>
    </div>
  )
}

// ── En-tête du panneau (identité bleue — chantier 1) ────────────────────────
function PanelHeader({ sp, onClose, onReset, hasMsgs }: { sp: AiPalette; onClose: () => void; onReset: () => void; hasMsgs: boolean }) {
  const headBtn = {
    width: 34, height: 34, borderRadius: 999, border: 0, background: 'transparent',
    cursor: 'pointer', display: 'grid', placeItems: 'center',
  } as const
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px', flexShrink: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: sp.ink, letterSpacing: -0.3 }}>MEGGA AI</span>
          <span style={{
            marginLeft: 8, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.2,
            color: '#FFFFFF', padding: '2px 7px', borderRadius: 999, background: '#1E5BC6',
          }}>Bêta</span>
        </div>
      </div>
      {hasMsgs && (
        <button onClick={onReset} title="Nouvelle conversation" aria-label="Nouvelle conversation" style={headBtn}>
          <CpIcon name="plus" size={18} color={sp.sub} />
        </button>
      )}
      <button onClick={onClose} title="Fermer" aria-label="Fermer" style={headBtn}>
        <CpIcon name="close" size={18} color={sp.sub} />
      </button>
    </div>
  )
}

// ── Empty-state DOCK : suggestions liées à l'écran (chantier 5) ─────────────
function EmptyDock({ sp, onSend, screen }: { sp: AiPalette; onSend: (p: string) => void; screen: string }) {
  const pack = packFor(screen)
  const chipRow = {
    display: 'flex', alignItems: 'center', gap: 11, width: '100%',
    padding: '12px 14px', borderRadius: 14, border: 0, cursor: 'pointer',
    background: 'transparent', transition: 'background .14s', fontFamily: 'inherit',
  } as const
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 28px', textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 23, fontWeight: 800, color: sp.ink, letterSpacing: -0.6, lineHeight: 1.15 }}>
          Comment puis-je<br />vous aider ?
        </h2>
      </div>
      {/* key={screen} → les suggestions se renouvellent en douceur à chaque page */}
      <div key={screen} style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '0 16px 4px', animation: 'cpCtxIn .4s cubic-bezier(.2,.8,.2,1) both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 4px 4px' }}>
          <CpIcon name="sparkle" size={12} color={sp.dark ? '#7FB0FF' : '#1E5BC6'} sw={1.9} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: sp.sub }}>
            Suggestions · {pack.label}
          </span>
        </div>
        {pack.actions.slice(0, 3).map((c, i) => (
          <button key={i} onClick={() => onSend(c.p)} style={chipRow}
            onMouseEnter={(e) => { e.currentTarget.style.background = sp.rowHov }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
            <CpIcon name={c.icon} size={16} color={sp.sub} />
            <span style={{ flex: 1, textAlign: 'left', fontSize: 13.5, fontWeight: 600, color: sp.soft }}>{c.t}</span>
            <CpIcon name="arrowR" size={15} color={sp.sub} />
          </button>
        ))}
      </div>
    </div>
  )
}

const CP_KEYFRAMES = `
  @keyframes cpFade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes cpFadeIn { from{opacity:0} to{opacity:1} }
  @keyframes cpShimmer { from{background-position:200% 0} to{background-position:-200% 0} }
  @keyframes cpCtxIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
  .cp-composer-input::placeholder{ color:rgba(255,255,255,0.45); }
`

// ── Contenu (monté à la 1re ouverture — évite les requêtes tant que fermé) ──
function PanelContent({ sp, isOpen, screen, seed, consumeSeed, onClose }: {
  sp: AiPalette
  isOpen: boolean
  screen: string
  seed: string | null
  consumeSeed: () => void
  onClose: () => void
}) {
  const { sendMessageStream, executePending, isLoading, clearHistory } = useCopilot()
  const { profile } = useAuth()
  const { deals } = usePipelineSugar()
  const { entity } = useAiPanel()
  const [messages, setMessages] = useState<PanelMsg[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(0) // ids de messages monotones (pas de collision Date.now())

  // Modal de revue-et-envoi d'email (chantier 4 · Partie 2). Ouvert par la carte
  // brouillon ; destinataire pré-rempli depuis la fiche contact ouverte (route).
  const [emailModal, setEmailModal] = useState<{ open: boolean; draft: EmailDraft }>({ open: false, draft: { subject: '', body: '' } })
  const openEmailModal = useCallback((draft: EmailDraft) => setEmailModal({ open: true, draft }), [])
  // Modal annonce → enregistre le texte comme description du bien ouvert (route → entity).
  const [annonceModal, setAnnonceModal] = useState<{ open: boolean; annonce: string }>({ open: false, annonce: '' })
  const openAnnonceModal = useCallback((annonce: string) => setAnnonceModal({ open: true, annonce }), [])
  // Modal lettre → génère un PDF A4 (impression navigateur, pattern KycExportPage).
  const [letterModal, setLetterModal] = useState<{ open: boolean; letter: string }>({ open: false, letter: '' })
  const openLetterModal = useCallback((letter: string) => setLetterModal({ open: true, letter }), [])
  // Carte de publication (Phase C) : ouverte par l'event serveur onPendingAction quand
  // le copilote a PRÉPARÉ une publication/retrait. Rien ne part sans le clic de l'agent.
  const [publishModal, setPublishModal] = useState<{ open: boolean; pending: PendingActionCard | null }>({ open: false, pending: null })

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || ''

  // Contexte CRM live injecté au prompt (chantier 6 — données réelles, 0 fabrication).
  const buildContext = useCallback((scr: string): Record<string, unknown> => {
    const active = deals.filter((d) => d.stage !== 'lost')
    const ctx: Record<string, unknown> = { ecran: screenLabel(scr) }
    if (firstName) ctx.agent = firstName
    if (active.length) {
      const total = active.reduce((s, d) => s + (d.value || 0), 0)
      const atRisk = active.filter((d) => d.risk !== 'healthy').length
      const byStage: Record<string, number> = {}
      active.forEach((d) => { byStage[d.stage] = (byStage[d.stage] || 0) + 1 })
      ctx.pipeline_deals_actifs = active.length
      ctx.pipeline_valeur_totale = crmFmtCHF(total)
      if (atRisk) ctx.pipeline_deals_a_risque = atRisk
      const stages = Object.entries(byStage)
        .map(([k, n]) => `${CRM_STAGES[k as StageId]?.label || k}: ${n}`)
        .join(', ')
      if (stages) ctx.pipeline_par_etape = stages
    }
    // Résidence PII : on n'injecte PAS de nom de contact client (DeepSeek = hors-UE).
    // Contexte limité à l'écran + agrégats pipeline + agency_id.
    const agencyId = (profile as { agency_id?: string } | null)?.agency_id
    if (agencyId) ctx.agency_id = agencyId
    return ctx
  }, [deals, firstName, profile])

  const send = useCallback((text: string, photoUrls?: string[]) => {
    const t = text.trim()
    const hasPhotos = !!photoUrls?.length
    if ((!t && !hasPhotos) || isLoading) return
    const uid = (idRef.current += 1)
    const lid = (idRef.current += 1)
    // Message envoyé au copilote : non vide même sans texte (sinon l'edge le rejette).
    const msg = t || 'Voici des photos pour un bien.'
    // Bulle utilisateur : texte + indicateur photo si des photos sont jointes.
    const shown = hasPhotos
      ? `${t ? t + '\n\n' : ''}📷 ${photoUrls!.length} photo${photoUrls!.length > 1 ? 's' : ''}`
      : t
    setMessages((m) => [
      ...m,
      { id: uid, role: 'user', content: shown },
      { id: lid, role: 'assistant', content: '', loading: true, query: msg, phase: null },
    ])
    const ctx = buildContext(screen)
    if (hasPhotos) ctx.attached_photos = photoUrls
    void sendMessageStream(msg, ctx, {
      // Token streamé → on sort du mode « réflexion » et on APPEND le fragment.
      onDelta: (chunk) => setMessages((m) => m.map((x) => x.id === lid ? { ...x, loading: false, phase: null, content: (x.content || '') + chunk } : x)),
      // Un appel d'outil est survenu après du texte → on efface l'ébauche.
      onReset: () => setMessages((m) => m.map((x) => x.id === lid ? { ...x, content: '' } : x)),
      // Phase d'outil RÉELLE (« Analyse du marché… ») affichée pendant la consultation.
      onPhase: (label) => setMessages((m) => m.map((x) => x.id === lid ? { ...x, phase: label } : x)),
      // Texte final normalisé (meggaProse serveur) → remplace l'accumulation brute.
      onFinal: (finalText) => setMessages((m) => m.map((x) => x.id === lid ? { ...x, loading: false, phase: null, content: finalText } : x)),
      // Publication préparée → ouvre la carte de validation (aucune exécution avant le clic).
      onPendingAction: (pending) => setPublishModal({ open: true, pending }),
    })
  }, [isLoading, sendMessageStream, buildContext, screen])

  // Garde la version courante de `send` accessible aux effets sans churn de deps.
  const sendRef = useRef(send)
  useEffect(() => { sendRef.current = send }, [send])

  const reset = useCallback(() => { setMessages([]); clearHistory() }, [clearHistory])

  // Amorce externe (chantier 3) : une puce proactive ouvre le panneau avec une
  // question pré-remplie → envoyée une fois, puis purgée.
  const lastSeedRef = useRef<string | null>(null)
  useEffect(() => { if (!isOpen) lastSeedRef.current = null }, [isOpen])
  useEffect(() => {
    if (isOpen && seed && lastSeedRef.current !== seed) {
      lastSeedRef.current = seed
      sendRef.current(seed)
      consumeSeed()
    }
  }, [isOpen, seed, consumeSeed])

  // Suivi de contexte (chantier 5) : changement d'écran panneau ouvert → marqueur.
  const lastCtxScreenRef = useRef(screen)
  useEffect(() => {
    if (!isOpen) return
    if (lastCtxScreenRef.current === screen) return
    lastCtxScreenRef.current = screen
    setMessages((m) => {
      if (!m.length) return m
      const last = m[m.length - 1]
      if (last.role === 'context') {
        if (last.screen === screen) return m
        return [...m.slice(0, -1), { ...last, id: (idRef.current += 1), screen }]
      }
      return [...m, { id: (idRef.current += 1), role: 'context', content: '', screen }]
    })
  }, [screen, isOpen])

  // Esc ferme
  useEffect(() => {
    if (!isOpen) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [isOpen, onClose])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const hasMsgs = messages.length > 0

  return (
    <>
      <PanelHeader sp={sp} onClose={onClose} onReset={reset} hasMsgs={hasMsgs} />
      {!hasMsgs && <EmptyDock sp={sp} onSend={send} screen={screen} />}
      {hasMsgs && (
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 18px 8px' }}>
          {messages.map((m) => <Bubble key={m.id} msg={m} sp={sp} onSend={send} onInsertEmail={openEmailModal} onUseAnnonce={openAnnonceModal} onGenerateLetter={openLetterModal} />)}
        </div>
      )}
      <div style={{ padding: '8px 14px 12px', flexShrink: 0 }}>
        <Composer onSend={send} loading={isLoading} sp={sp} />
      </div>
      <EmailReviewModal
        open={emailModal.open}
        sp={sp}
        dark={sp.dark}
        draft={emailModal.draft}
        contactId={entity?.kind === 'contact' ? entity.id : null}
        onClose={() => setEmailModal((m) => ({ ...m, open: false }))}
        onSent={() => {}}
      />
      <AnnonceReviewModal
        open={annonceModal.open}
        sp={sp}
        dark={sp.dark}
        annonce={annonceModal.annonce}
        listingId={entity?.kind === 'listing' ? entity.id : null}
        onClose={() => setAnnonceModal((m) => ({ ...m, open: false }))}
        onSaved={() => {}}
      />
      <LetterReviewModal
        open={letterModal.open}
        sp={sp}
        dark={sp.dark}
        letter={letterModal.letter}
        onClose={() => setLetterModal((m) => ({ ...m, open: false }))}
      />
      <PublishReviewModal
        open={publishModal.open}
        sp={sp}
        dark={sp.dark}
        pending={publishModal.pending}
        executePending={executePending}
        onExecuted={(resultText) => {
          const id = (idRef.current += 1)
          setMessages((m) => [...m, { id, role: 'assistant', content: resultText }])
        }}
        onClose={() => setPublishModal((m) => ({ ...m, open: false }))}
      />
    </>
  )
}

// ── Panneau (shell fixe + animation d'ouverture) ────────────────────────────
export default function CopilotPanel() {
  const { isOpen, screen, seed, close, consumeSeed } = useAiPanel()
  const { impersonating } = useImpersonate()
  const dark = usePanelDark(isOpen)
  const sp = useMemo<AiPalette>(() => {
    const base = crmSugarPalette(dark ? CRM_TOKENS.dark : CRM_TOKENS.light, dark, 'meggaAi')
    return deriveAiPalette(base, dark)
  }, [dark])

  // Monté à la 1re ouverture : aucune requête (usePipelineSugar) tant que MEGGA
  // AI n'a pas été ouvert ; ensuite le contenu reste monté (conversation préservée).
  const [mounted, setMounted] = useState(false)
  useEffect(() => { if (isOpen) setMounted(true) }, [isOpen])

  const margin = 16
  const navH = 82
  const cardShadow = dark
    ? '0 24px 70px -16px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)'
    : sp.panelShadow

  return (
    <>
      <style>{CP_KEYFRAMES}</style>
      <aside
        role="complementary"
        aria-label="MEGGA AI"
        inert={!isOpen}
        style={{
          position: 'fixed', zIndex: 70, top: navH + 8 + (impersonating ? 40 : 0), bottom: margin, right: margin,
          width: PANEL_W, maxWidth: 'calc(100vw - 24px)',
          background: sp.panelBg, borderRadius: 22, border: 'none', boxShadow: cardShadow,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          transform: isOpen ? 'translateX(0)' : `translateX(${PANEL_W + margin + 8}px)`,
          opacity: isOpen ? 1 : 0,
          transition: 'transform .42s cubic-bezier(.2,.8,.2,1), opacity .3s ease',
          pointerEvents: isOpen ? 'auto' : 'none',
          fontFamily: "'Inter Tight', system-ui, sans-serif",
        }}
      >
        {mounted && (
          <PanelContent
            sp={sp}
            isOpen={isOpen}
            screen={screen}
            seed={seed}
            consumeSeed={consumeSeed}
            onClose={close}
          />
        )}
      </aside>
    </>
  )
}
