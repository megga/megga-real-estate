import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Upload, Download, Eye, X, MessageSquare, ChevronDown,
  ArrowUpRight, Lock, CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────
// MES DOCUMENTS — "The Vault" (archive vault / dossier scellé)
// ─────────────────────────────────────────────────────────────────────────
// Typographic direction: a dark archival vault, in direct contrast with
// the ivory editorial of MesOffres. Legal papers, KYC, the mandate, the
// eventual acte notarié — these deserve a register that *feels* like a
// locked cabinet in a notary's office. Warm charcoal background, cream
// type, brass accents for signed/archived, rust for missing (maîtrisé).
// Instrument Serif for the Renaissance-archive display; Geist + Geist
// Mono pick up the precise classification details (filenames, sizes,
// timestamps). Load fonts via index.html; scope colours via inline <style>
// so the rest of the app stays on DM Sans + light theme.
// ─────────────────────────────────────────────────────────────────────────

const DISPLAY = 'font-["Instrument_Serif"]'
const BODY = 'font-["Geist"]'
const MONO = 'font-["Geist_Mono"] tabular-nums'
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:#C9A44C]/50'

const palette = {
  vault: '#14110D',          // deep warm charcoal
  vaultRaised: '#1C1814',    // card hover
  cream: '#F2E9D8',          // paper-cream primary text
  creamDim: '#C9BFAD',       // secondary
  creamFaint: '#867E72',     // tertiary / hints
  brass: '#C9A44C',          // validated / archived
  brassDark: '#A0812F',
  rust: '#C96B3C',           // missing
  amber: '#D89B4C',           // pending
} as const

// All vault-coloured utilities are declared in a scoped <style> — lets us
// write Tailwind-esque `text-cream` inline while keeping the global
// theme untouched. The `\\` escapes are needed because Tailwind's `/`
// syntax collides with actual CSS escape behaviour here.
const SCOPED_CSS = `
  .vault { background: ${palette.vault}; color: ${palette.cream}; }
  .vault .bg-vault { background: ${palette.vault}; }
  .vault .bg-vault-raised { background: ${palette.vaultRaised}; }
  .vault .text-cream { color: ${palette.cream}; }
  .vault .text-cream-dim { color: ${palette.creamDim}; }
  .vault .text-cream-faint { color: ${palette.creamFaint}; }
  .vault .text-brass { color: ${palette.brass}; }
  .vault .bg-brass { background: ${palette.brass}; }
  .vault .text-rust { color: ${palette.rust}; }
  .vault .text-amber { color: ${palette.amber}; }
  .vault .border-cream { border-color: ${palette.cream}; }
  .vault .border-hairline { border-color: ${palette.cream}1a; }
  .vault .border-hairline-strong { border-color: ${palette.cream}33; }
  .vault .border-brass { border-color: ${palette.brass}; }
  .vault .border-rust { border-color: ${palette.rust}; }

  /* subtle parchment grain */
  .vault-grain {
    background-image:
      radial-gradient(${palette.brass}08 1px, transparent 1px),
      radial-gradient(${palette.brass}05 1px, transparent 1px);
    background-size: 3px 3px, 7px 7px;
    background-position: 0 0, 2px 2px;
    pointer-events: none;
  }

  @keyframes vault-rise {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .vault-rise { animation: vault-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }

  @keyframes brass-sweep {
    0%   { stroke-dashoffset: var(--circ); }
    100% { stroke-dashoffset: var(--offset); }
  }

  /* Upload progress spinner ring */
  @keyframes vault-spin { to { transform: rotate(360deg); } }
  .vault-spin { animation: vault-spin 1s linear infinite; }
`

// ─── Types ───────────────────────────────────────────────────────────────

interface SellerDocument {
  id: string
  name: string
  slug: string
  category: 'mandate' | 'kyc' | 'property' | 'offer' | 'contract' | 'other'
  status: 'validated' | 'pending' | 'missing' | 'expired'
  uploaded_at: string | null
  validated_at: string | null
  expires_at: string | null
  size_kb: number | null
  required: boolean
  required_for: string | null
}

interface DocumentHelp {
  help: string
  cost?: string
}

const DOCUMENT_HELP: Record<string, DocumentHelp> = {
  'diagnostic-amiante': {
    help: "Obligatoire pour les biens construits avant 1991. Faites appel à un diagnostiqueur agréé.",
    cost: 'CHF 300 – 600',
  },
  'certificat-cecb': {
    help: "Certificat de performance énergétique cantonal. Demandez-le sur cecb.ch ou via votre agent.",
    cost: 'CHF 400 – 800',
  },
}

// Rolled-up mock data — identical to what the legacy page used.
const MOCK_DOCUMENTS: SellerDocument[] = [
  { id: 'd1', name: 'Mandat de vente exclusif', slug: 'mandat-vente', category: 'mandate', status: 'validated', uploaded_at: '2026-02-10T10:00:00Z', validated_at: '2026-02-11T14:00:00Z', expires_at: '2026-08-10T10:00:00Z', size_kb: 245, required: true, required_for: null },
  { id: 'd2', name: "Pièce d'identité (passeport)", slug: 'piece-identite', category: 'kyc', status: 'validated', uploaded_at: '2026-02-10T10:15:00Z', validated_at: '2026-02-10T16:00:00Z', expires_at: '2028-05-20T00:00:00Z', size_kb: 1200, required: true, required_for: null },
  { id: 'd3', name: 'Extrait du Registre foncier', slug: 'extrait-registre-foncier', category: 'property', status: 'validated', uploaded_at: '2026-02-12T14:00:00Z', validated_at: '2026-02-13T09:00:00Z', expires_at: null, size_kb: 380, required: true, required_for: null },
  { id: 'd4', name: 'Attestation de propriété', slug: 'attestation-propriete', category: 'property', status: 'validated', uploaded_at: '2026-02-12T14:30:00Z', validated_at: '2026-02-13T09:30:00Z', expires_at: null, size_kb: 150, required: true, required_for: null },
  { id: 'd5', name: "Plans de l'appartement", slug: 'plans-appartement', category: 'property', status: 'validated', uploaded_at: '2026-02-15T09:00:00Z', validated_at: '2026-02-15T14:00:00Z', expires_at: null, size_kb: 4800, required: true, required_for: null },
  { id: 'd6', name: 'Décompte de charges PPE (2025)', slug: 'decompte-charges-ppe', category: 'property', status: 'pending', uploaded_at: '2026-03-10T11:00:00Z', validated_at: null, expires_at: null, size_kb: 520, required: true, required_for: null },
  { id: 'd7', name: 'Diagnostic amiante', slug: 'diagnostic-amiante', category: 'property', status: 'missing', uploaded_at: null, validated_at: null, expires_at: null, size_kb: null, required: true, required_for: 'Signature chez le notaire' },
  { id: 'd8', name: 'Certificat CECB (performance énergétique)', slug: 'certificat-cecb', category: 'property', status: 'missing', uploaded_at: null, validated_at: null, expires_at: null, size_kb: null, required: false, required_for: "Publication de l'annonce" },
  { id: 'd9', name: 'Justificatif de domicile', slug: 'justificatif-domicile', category: 'kyc', status: 'validated', uploaded_at: '2026-02-10T10:20:00Z', validated_at: '2026-02-10T16:30:00Z', expires_at: '2026-05-10T00:00:00Z', size_kb: 890, required: true, required_for: null },
  { id: 'd10', name: 'Photos professionnelles du bien', slug: 'photos-pro', category: 'property', status: 'validated', uploaded_at: '2026-02-13T16:00:00Z', validated_at: '2026-02-14T10:00:00Z', expires_at: null, size_kb: 15000, required: false, required_for: null },
]

const CATEGORY_LABEL: Record<SellerDocument['category'], string> = {
  mandate: 'Mandat',
  kyc: 'Identité',
  property: 'Bien',
  offer: 'Offre',
  contract: 'Contrat',
  other: 'Divers',
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-CH', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatSize(kb: number): string {
  if (kb >= 1000) return `${(kb / 1000).toFixed(1)} Mo`
  return `${kb} Ko`
}

function daysUntilExpiry(dateStr: string): number {
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

type FilterTab = 'all' | 'validated' | 'pending' | 'missing'

// ─── Brass completion dial ───────────────────────────────────────────────
// A circular indicator with tick marks, not a SaaS bar. Reads like a
// vault door gauge. SVG arc draws in on mount.

function BrassDial({ percent }: { percent: number }) {
  const size = 160
  const stroke = 6
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* tick marks */}
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="absolute inset-0">
        {Array.from({ length: 48 }).map((_, i) => {
          const angle = (i / 48) * Math.PI * 2 - Math.PI / 2
          const r1 = radius - 12
          const r2 = radius - 6
          const x1 = size / 2 + r1 * Math.cos(angle)
          const y1 = size / 2 + r1 * Math.sin(angle)
          const x2 = size / 2 + r2 * Math.cos(angle)
          const y2 = size / 2 + r2 * Math.sin(angle)
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={palette.cream}
              strokeWidth="1"
              opacity={i % 4 === 0 ? 0.5 : 0.18}
            />
          )
        })}
      </svg>
      {/* ring */}
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={palette.cream}
          strokeOpacity="0.12"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={palette.brass}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
            filter: `drop-shadow(0 0 12px ${palette.brass}55)`,
          }}
        />
      </svg>
      {/* centre */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(DISPLAY, 'text-[56px] leading-none text-cream')}
          style={{ fontVariationSettings: '"opsz" 144' }}
        >
          {percent}
          <span className="text-[22px] text-brass ml-0.5">%</span>
        </span>
        <span className={cn(BODY, 'text-[9px] uppercase tracking-[0.22em] text-cream-faint mt-2')}>
          Complétude
        </span>
      </div>
    </div>
  )
}

// ─── Classification stamp ────────────────────────────────────────────────
// A tiny framed label that sits next to each document title — evokes the
// rubber stamp on the corner of an archival folder. Colour varies by
// status: brass (validated), amber (pending), rust (missing).

function StatusStamp({ status }: { status: SellerDocument['status'] }) {
  const cfg = {
    validated: { label: 'Archivé', border: palette.brass, text: palette.brass },
    pending: { label: 'Vérification', border: palette.amber, text: palette.amber },
    missing: { label: 'À fournir', border: palette.rust, text: palette.rust },
    expired: { label: 'Expiré', border: palette.creamFaint, text: palette.creamFaint },
  }[status]

  return (
    <span
      className={cn(
        BODY,
        'inline-flex items-center h-5 px-2 text-[9px] uppercase tracking-[0.18em] font-medium border rounded-[1px]',
      )}
      style={{
        color: cfg.text,
        borderColor: `${cfg.border}80`,
      }}
    >
      {cfg.label}
    </span>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────

export default function MesDocumentsPage() {
  const [filter, setFilter] = useState<FilterTab>('all')
  const [dragTarget, setDragTarget] = useState<string | null>(null)
  const [dragOverGeneral, setDragOverGeneral] = useState(false)
  const [helpDocId, setHelpDocId] = useState<string | null>(null)
  const [validatedCollapsed, setValidatedCollapsed] = useState(true)
  const [animatedPct, setAnimatedPct] = useState(0)
  const [uploadedIds, setUploadedIds] = useState<Set<string>>(new Set())
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const generalFileRef = useRef<HTMLInputElement | null>(null)

  const docs = MOCK_DOCUMENTS.map((d) =>
    uploadedIds.has(d.id)
      ? { ...d, status: 'pending' as const, uploaded_at: new Date().toISOString(), size_kb: 850 }
      : d,
  )
  const validated = docs.filter((d) => d.status === 'validated').length
  const pending = docs.filter((d) => d.status === 'pending').length
  const missing = docs.filter((d) => d.status === 'missing').length
  const required = docs.filter((d) => d.required).length
  const requiredDone = docs.filter((d) => d.required && d.status === 'validated').length
  const completionPct = Math.round((requiredDone / required) * 100)

  useEffect(() => {
    const t = setTimeout(() => setAnimatedPct(completionPct), 200)
    return () => clearTimeout(t)
  }, [completionPct])

  const expiringDocs = docs.filter(
    (d) => d.expires_at && daysUntilExpiry(d.expires_at) <= 60 && daysUntilExpiry(d.expires_at) > 0 && d.status === 'validated',
  )

  const missingDocs = docs.filter((d) => d.status === 'missing')
  const pendingDocs = docs.filter((d) => d.status === 'pending')
  const validatedDocs = docs.filter((d) => d.status === 'validated' || d.status === 'expired')

  const filteredDocs = (() => {
    switch (filter) {
      case 'validated': return validatedDocs
      case 'pending': return pendingDocs
      case 'missing': return missingDocs
      default: return null
    }
  })()

  const simulateUpload = useCallback((docId: string, docName: string) => {
    setUploadingId(docId)
    setTimeout(() => {
      setUploadingId(null)
      setUploadedIds((prev) => new Set(prev).add(docId))
      setToast(`${docName} déposé — en attente de vérification`)
      setTimeout(() => setToast(null), 3500)
    }, 1500)
  }, [])

  const handleGeneralDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOverGeneral(false)
    setToast('Document déposé — en attente de vérification')
    setTimeout(() => setToast(null), 3500)
  }, [])

  const handleDropOnDocument = useCallback((e: React.DragEvent, docId: string) => {
    e.preventDefault()
    setDragTarget(null)
    const doc = MOCK_DOCUMENTS.find((d) => d.id === docId)
    if (doc) simulateUpload(docId, doc.name)
  }, [simulateUpload])

  const helpDoc = helpDocId ? docs.find((d) => d.id === helpDocId) : null
  const helpInfo = helpDoc ? DOCUMENT_HELP[helpDoc.slug] : null

  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'Tout', count: docs.length },
    { key: 'missing', label: 'À fournir', count: missing },
    { key: 'pending', label: 'Vérification', count: pending },
    { key: 'validated', label: 'Archivés', count: validated },
  ]

  // ─── Render a single document line ────────────────────────────────────

  function renderDocLine(doc: SellerDocument, index: number, compact = false) {
    const catLabel = CATEGORY_LABEL[doc.category]
    const docHelp = DOCUMENT_HELP[doc.slug]
    const isExpiring = doc.expires_at && daysUntilExpiry(doc.expires_at) <= 60 && daysUntilExpiry(doc.expires_at) > 0
    const isExpired = doc.expires_at && daysUntilExpiry(doc.expires_at) <= 0
    const isMissing = doc.status === 'missing'
    const isDropTarget = dragTarget === doc.id

    return (
      <article
        key={doc.id}
        onDragOver={isMissing ? (e) => { e.preventDefault(); setDragTarget(doc.id) } : undefined}
        onDragLeave={isMissing ? () => setDragTarget(null) : undefined}
        onDrop={isMissing ? (e) => handleDropOnDocument(e, doc.id) : undefined}
        className={cn(
          'vault-rise group relative border-b border-hairline transition-colors',
          isDropTarget && 'bg-vault-raised',
          compact ? 'py-3' : 'py-5 md:py-6',
        )}
        style={{ animationDelay: `${index * 60}ms` }}
      >
        <div className="grid grid-cols-12 gap-4 items-start">
          {/* Classification number + category */}
          <div className="col-span-2 md:col-span-1">
            <div className={cn(MONO, 'text-[11px] text-cream-faint')}>
              {String(index + 1).padStart(3, '0')}
            </div>
          </div>

          {/* Name + metadata */}
          <div className="col-span-10 md:col-span-7 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className={cn(DISPLAY, compact ? 'text-[18px]' : 'text-[22px] md:text-[24px]', 'leading-tight text-cream')}>
                {doc.name}
              </h3>
              <StatusStamp status={doc.status} />
              {doc.required && (
                <span className={cn(BODY, 'text-[9px] uppercase tracking-[0.18em] text-cream-faint')}>
                  Obligatoire
                </span>
              )}
            </div>

            <div className={cn(MONO, 'mt-2 flex items-center gap-3 flex-wrap text-[11px] text-cream-faint')}>
              <span>{catLabel.toUpperCase()}</span>
              {doc.uploaded_at && (
                <>
                  <span className="opacity-40">/</span>
                  <span>Dépôt {formatDate(doc.uploaded_at)}</span>
                </>
              )}
              {doc.validated_at && (
                <>
                  <span className="opacity-40">/</span>
                  <span className="text-brass">Validé {formatDate(doc.validated_at)}</span>
                </>
              )}
              {doc.size_kb && (
                <>
                  <span className="opacity-40">/</span>
                  <span>{formatSize(doc.size_kb)}</span>
                </>
              )}
              {isExpiring && !isExpired && (
                <>
                  <span className="opacity-40">/</span>
                  <span className="text-amber">Expire J{daysUntilExpiry(doc.expires_at!)}</span>
                </>
              )}
              {isExpired && (
                <>
                  <span className="opacity-40">/</span>
                  <span className="text-rust">Expiré</span>
                </>
              )}
            </div>

            {/* Missing helper */}
            {isMissing && docHelp && (
              <div className="mt-3 flex items-start gap-3">
                <span className={cn(DISPLAY, 'text-rust text-[24px] italic leading-none shrink-0 mt-[-2px]')}>
                  ¶
                </span>
                <div className={cn(BODY, 'text-[13px] text-cream-dim leading-[1.6]')}>
                  {docHelp.help}
                  {docHelp.cost && (
                    <span className={cn(MONO, 'ml-2 text-cream-faint')}>· {docHelp.cost}</span>
                  )}
                </div>
              </div>
            )}
            {isMissing && doc.required_for && (
              <p className={cn(BODY, 'mt-2 text-[12px] text-cream-faint italic')}>
                <span className="text-rust">Nécessaire avant :</span>{' '}
                <span className="text-cream-dim">{doc.required_for}</span>
              </p>
            )}
            {doc.status === 'pending' && doc.uploaded_at && !compact && (
              <p className={cn(BODY, 'mt-2 text-[12px] text-amber italic')}>
                Déposé le {formatDate(doc.uploaded_at)} — en cours de vérification par l'agent.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="col-span-12 md:col-span-4 flex items-start md:justify-end gap-1.5">
            {uploadingId === doc.id ? (
              <div className={cn(BODY, 'inline-flex items-center gap-2 text-[12px] text-cream-dim')}>
                <span
                  className="vault-spin inline-block w-3.5 h-3.5 border rounded-full"
                  style={{ borderColor: `${palette.cream}33`, borderTopColor: palette.brass }}
                />
                Envoi en cours
              </div>
            ) : isMissing ? (
              <>
                <input
                  ref={(el) => { fileInputRefs.current[doc.id] = el }}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={() => simulateUpload(doc.id, doc.name)}
                />
                <button
                  onClick={() => fileInputRefs.current[doc.id]?.click()}
                  className={cn(
                    BODY, FOCUS_RING,
                    'inline-flex items-center gap-1.5 h-9 px-4 text-[12px] font-medium border transition-all',
                    'text-vault rounded-[1px] hover:gap-2',
                  )}
                  style={{
                    background: palette.brass,
                    borderColor: palette.brass,
                  }}
                >
                  <Upload className="w-3 h-3" strokeWidth={2} />
                  Déposer
                </button>
                <button
                  onClick={() => setHelpDocId(doc.id)}
                  className={cn(
                    BODY, FOCUS_RING,
                    'inline-flex items-center h-9 px-3 text-[12px] font-medium text-cream-dim hover:text-brass transition-colors',
                  )}
                >
                  Aide ?
                </button>
              </>
            ) : (
              <div className="inline-flex items-center gap-0.5 md:opacity-40 md:group-hover:opacity-100 transition-opacity">
                <button
                  className={cn(BODY, FOCUS_RING, 'p-2 text-cream-dim hover:text-brass transition-colors')}
                  aria-label="Consulter"
                >
                  <Eye className="w-4 h-4" strokeWidth={1.5} />
                </button>
                <button
                  className={cn(BODY, FOCUS_RING, 'p-2 text-cream-dim hover:text-brass transition-colors')}
                  aria-label="Télécharger"
                >
                  <Download className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Drop-target visual when dragging over a missing entry */}
        {isDropTarget && (
          <div
            className="absolute inset-0 border-2 border-dashed pointer-events-none"
            style={{ borderColor: palette.brass }}
          />
        )}
      </article>
    )
  }

  return (
    <div
      className={cn(
        'vault relative', BODY,
        '-mx-4 md:-mx-6 -mt-6 px-4 md:px-10 pt-8 md:pt-12 pb-24 min-h-[calc(100vh-4rem)]',
      )}
    >
      <style>{SCOPED_CSS}</style>
      {/* Parchment grain overlay */}
      <div className="vault-grain absolute inset-0 opacity-60" aria-hidden />

      <div className="relative max-w-5xl mx-auto">
        {/* ── Masthead ─────────────────────────────────────────────── */}
        <header className="vault-rise flex items-start justify-between gap-8 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <div className={cn(BODY, 'flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-cream-faint')}>
              <Lock className="w-3 h-3" strokeWidth={1.5} />
              Coffre-fort de votre dossier
              <span className="opacity-40">·</span>
              <span className={MONO}>
                {new Date().toLocaleDateString('fr-CH', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>

            <h1
              className={cn(
                DISPLAY,
                'mt-6 md:mt-8 text-[clamp(56px,10vw,128px)] leading-[0.88] tracking-[-0.02em]',
              )}
              style={{ fontVariationSettings: '"opsz" 144' }}
            >
              Archives
              <br />
              <em className="italic text-brass">&amp; documents</em>
              <span className="text-cream-faint">.</span>
            </h1>

            <p className={cn(BODY, 'mt-6 md:mt-8 text-[15px] leading-[1.65] text-cream-dim max-w-lg')}>
              Chaque pièce de votre dossier est consignée ici, chiffrée et accessible aux seules
              parties habilitées. Les documents manquants bloquent parfois une étape —
              glissez-les dans leur case pour les transmettre à votre agent.
            </p>
          </div>

          {/* Brass dial */}
          <div className="shrink-0 flex flex-col items-center gap-4 pt-2">
            <BrassDial percent={animatedPct} />
            <div className={cn(MONO, 'text-[11px] text-cream-faint text-center')}>
              <span className="text-cream">{requiredDone}</span>
              <span className="text-cream-faint"> / {required}</span>
              <span className="ml-2 text-cream-faint uppercase tracking-[0.14em] text-[9px]">
                obligatoires
              </span>
            </div>
          </div>
        </header>

        {/* ── Alert rows (missing / expiring) ───────────────────── */}
        {(missing > 0 || expiringDocs.length > 0) && (
          <div
            className="vault-rise mt-12 border-y border-hairline-strong py-4 flex items-center gap-8 flex-wrap"
            style={{ animationDelay: '150ms' }}
          >
            {missing > 0 && (
              <button
                onClick={() => setFilter('missing')}
                className={cn(
                  BODY, FOCUS_RING,
                  'group inline-flex items-center gap-3 text-[13px] hover:gap-4 transition-all',
                )}
              >
                <span className="w-2 h-2 rounded-full bg-rust shrink-0" style={{ boxShadow: `0 0 10px ${palette.rust}` }} />
                <span className="text-cream-dim">
                  <span className={cn(DISPLAY, 'text-rust italic text-[20px] mr-1.5')}>{missing}</span>
                  document{missing > 1 ? 's' : ''} à fournir
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-cream-faint group-hover:text-rust transition-colors" strokeWidth={1.5} />
              </button>
            )}
            {expiringDocs.length > 0 && (
              <div className={cn(BODY, 'inline-flex items-center gap-3 text-[13px]')}>
                <span className="w-2 h-2 rounded-full bg-amber shrink-0" style={{ boxShadow: `0 0 10px ${palette.amber}` }} />
                <span className="text-cream-dim">
                  <span className={cn(DISPLAY, 'text-amber italic text-[20px] mr-1.5')}>{expiringDocs.length}</span>
                  expire{expiringDocs.length > 1 ? 'nt' : ''} dans moins de 60 jours
                </span>
              </div>
            )}
            {missing === 0 && expiringDocs.length === 0 && (
              <div className={cn(BODY, 'inline-flex items-center gap-2 text-[13px] text-brass')}>
                <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
                Dossier complet — rien ne manque.
              </div>
            )}
          </div>
        )}

        {/* ── Drop zone ─────────────────────────────────────────── */}
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); generalFileRef.current?.click() } }}
          onDragOver={(e) => { e.preventDefault(); setDragOverGeneral(true) }}
          onDragLeave={() => setDragOverGeneral(false)}
          onDrop={handleGeneralDrop}
          onClick={() => generalFileRef.current?.click()}
          className={cn(
            'vault-rise mt-10 md:mt-14 relative cursor-pointer transition-all',
            FOCUS_RING,
          )}
          style={{ animationDelay: '220ms' }}
        >
          <input ref={generalFileRef} type="file" multiple className="hidden" accept=".pdf,.jpg,.jpeg,.png" />
          <div
            className="border border-dashed p-6 md:p-7 flex items-center gap-5 transition-all"
            style={{
              borderColor: dragOverGeneral ? palette.brass : `${palette.cream}33`,
              background: dragOverGeneral ? `${palette.brass}10` : 'transparent',
            }}
          >
            <div
              className="shrink-0 w-11 h-11 rounded-full border flex items-center justify-center transition-all"
              style={{
                borderColor: dragOverGeneral ? palette.brass : `${palette.cream}33`,
                background: dragOverGeneral ? `${palette.brass}20` : 'transparent',
              }}
            >
              <Upload
                className={cn('w-4 h-4 transition-all', dragOverGeneral && 'scale-110 -translate-y-0.5')}
                strokeWidth={1.5}
                style={{ color: dragOverGeneral ? palette.brass : palette.cream }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(DISPLAY, 'text-[22px] text-cream leading-none')}>
                Déposer une nouvelle pièce
              </p>
              <p className={cn(MONO, 'mt-1.5 text-[11px] text-cream-faint')}>
                PDF · JPG · PNG
                <span className="opacity-40"> / </span>
                10 Mo max
                <span className="opacity-40"> / </span>
                chiffrement de bout en bout
              </p>
            </div>
            <div className={cn(BODY, 'hidden md:flex items-center gap-1 text-[11px] uppercase tracking-[0.18em] text-cream-faint')}>
              Parcourir
              <ArrowUpRight className="w-3 h-3" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        {/* ── Filter tabs ───────────────────────────────────────── */}
        <div className="vault-rise mt-12 flex items-center gap-1 flex-wrap" style={{ animationDelay: '280ms' }}>
          {TABS.map((tab) => {
            const active = filter === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={cn(
                  BODY, FOCUS_RING,
                  'relative px-4 py-2 text-[12px] uppercase tracking-[0.16em] transition-colors',
                  active ? 'text-brass' : 'text-cream-faint hover:text-cream',
                )}
              >
                {tab.label}
                <span className={cn(MONO, 'ml-2 text-[10px]', active ? 'text-brass' : 'text-cream-faint opacity-60')}>
                  {String(tab.count).padStart(2, '0')}
                </span>
                {active && (
                  <span className="absolute -bottom-px left-0 right-0 h-px bg-brass" />
                )}
              </button>
            )
          })}
        </div>

        {/* ── Document list ─────────────────────────────────────── */}
        <section className="mt-4 border-t border-hairline-strong">
          {filter === 'all' ? (
            <>
              {missingDocs.length > 0 && (
                <>
                  <SectionHeader numeral="I" label="À fournir" count={missingDocs.length} />
                  {missingDocs.map((doc, i) => renderDocLine(doc, i))}
                </>
              )}
              {pendingDocs.length > 0 && (
                <>
                  <SectionHeader numeral="II" label="En vérification" count={pendingDocs.length} />
                  {pendingDocs.map((doc, i) => renderDocLine(doc, i))}
                </>
              )}
              {validatedDocs.length > 0 && (
                <>
                  <div className="flex items-baseline justify-between pt-10 pb-4 border-b border-hairline">
                    <div className="flex items-baseline gap-4">
                      <span className={cn(DISPLAY, 'text-[28px] italic text-brass')}>III</span>
                      <h2 className={cn(DISPLAY, 'text-[24px] text-cream')}>Archivés</h2>
                      <span className={cn(MONO, 'text-[11px] text-cream-faint')}>
                        {String(validatedDocs.length).padStart(2, '0')} pièce{validatedDocs.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <button
                      onClick={() => setValidatedCollapsed(!validatedCollapsed)}
                      className={cn(
                        BODY, FOCUS_RING,
                        'inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-cream-faint hover:text-brass transition-colors',
                      )}
                    >
                      {validatedCollapsed ? 'Déplier' : 'Replier'}
                      <ChevronDown className={cn('w-3 h-3 transition-transform', validatedCollapsed && '-rotate-90')} strokeWidth={1.5} />
                    </button>
                  </div>
                  {!validatedCollapsed && validatedDocs.map((doc, i) => renderDocLine(doc, i, true))}
                </>
              )}
            </>
          ) : filteredDocs && filteredDocs.length === 0 ? (
            <div className="py-20 text-center">
              <span className={cn(DISPLAY, 'text-[64px] italic text-cream-faint opacity-40')}>—</span>
              <p className={cn(BODY, 'mt-4 text-[14px] text-cream-dim')}>
                {filter === 'missing' && 'Toutes les pièces obligatoires sont consignées.'}
                {filter === 'pending' && 'Aucune pièce en vérification.'}
                {filter === 'validated' && 'Aucune pièce archivée pour l\'instant.'}
              </p>
            </div>
          ) : (
            filteredDocs?.map((doc, i) => renderDocLine(doc, i, filter === 'validated'))
          )}
        </section>

        {/* ── Footer plate ─────────────────────────────────────── */}
        <footer className="mt-16 pt-6 border-t border-hairline-strong flex items-start justify-between gap-6 flex-wrap">
          <div className={cn(BODY, 'text-[10px] uppercase tracking-[0.18em] text-cream-faint')}>
            MEGGA Real Estate
            <span className="mx-2 opacity-40">·</span>
            Coffre-fort numérique
            <span className="mx-2 opacity-40">·</span>
            Chiffrement AES-256
          </div>
          <div className={cn(MONO, 'text-[10px] text-cream-faint uppercase tracking-[0.1em]')}>
            {docs.length} entrée{docs.length > 1 ? 's' : ''} consignée{docs.length > 1 ? 's' : ''}
          </div>
        </footer>
      </div>

      {/* ── Toast ────────────────────────────────────────────── */}
      {toast && createPortal(
        <div className="vault fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] animate-in fade-in-0 slide-in-from-bottom-4 duration-200">
          <style>{SCOPED_CSS}</style>
          <div
            className={cn(BODY, 'flex items-center gap-3 text-[13px] text-cream px-5 py-3 border border-brass/40')}
            style={{ background: palette.vaultRaised, boxShadow: `0 12px 30px -10px ${palette.brass}55` }}
          >
            <CheckCircle2 className="w-4 h-4 text-brass" strokeWidth={1.5} />
            {toast}
          </div>
        </div>,
        document.body,
      )}

      {/* ── Help modal ───────────────────────────────────────── */}
      {helpDocId && helpDoc && createPortal(
        <div
          className={cn(BODY, 'vault fixed inset-0 z-[100] flex items-center justify-center px-4')}
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-modal-title"
          onClick={() => setHelpDocId(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setHelpDocId(null) }}
          style={{ background: `${palette.vault}c0`, backdropFilter: 'blur(10px)' }}
        >
          <style>{SCOPED_CSS}</style>
          <div
            className="relative w-full max-w-lg p-8 vault-rise border border-hairline-strong"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: palette.vaultRaised,
              boxShadow: `0 40px 80px -20px ${palette.vault}, 0 0 0 1px ${palette.brass}20`,
            }}
          >
            <div className="flex items-start justify-between pb-3 border-b border-hairline">
              <span className={cn(BODY, 'text-[10px] uppercase tracking-[0.22em] text-cream-faint')}>
                Notice d'archivage
              </span>
              <button
                autoFocus
                onClick={() => setHelpDocId(null)}
                aria-label="Fermer"
                className={cn(FOCUS_RING, 'text-cream-faint hover:text-cream transition-colors')}
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
            <h3 id="help-modal-title" className={cn(DISPLAY, 'mt-5 text-[32px] leading-[0.95] text-cream')}>
              {helpDoc.name}
            </h3>

            <div className="mt-6 space-y-4">
              {helpInfo ? (
                <>
                  <p className={cn(BODY, 'text-[14px] leading-[1.7] text-cream-dim')}>{helpInfo.help}</p>
                  {helpInfo.cost && (
                    <p className={cn(MONO, 'text-[12px] text-cream-faint')}>
                      Coût estimé : <span className="text-brass">{helpInfo.cost}</span>
                    </p>
                  )}
                </>
              ) : (
                <p className={cn(BODY, 'text-[14px] leading-[1.7] text-cream-dim')}>
                  Cette pièce est nécessaire à votre dossier. Votre agent peut vous orienter
                  vers la meilleure voie pour l'obtenir.
                </p>
              )}
              {helpDoc.required_for && (
                <p className={cn(BODY, 'text-[12px] text-cream-faint italic')}>
                  <span className="text-rust">Nécessaire avant :</span>{' '}
                  <span className="text-cream-dim">{helpDoc.required_for}</span>
                </p>
              )}
            </div>

            <div className="mt-8 pt-4 border-t border-hairline flex items-center justify-between">
              <button
                onClick={() => setHelpDocId(null)}
                className={cn(
                  BODY, FOCUS_RING,
                  'inline-flex items-center gap-2 text-[13px] text-cream-dim hover:text-brass transition-colors',
                )}
              >
                <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.5} />
                Contacter mon agent
                <ArrowUpRight className="w-3 h-3" strokeWidth={1.5} />
              </button>
              <span className={cn(MONO, 'text-[10px] text-cream-faint uppercase tracking-[0.14em]')}>
                Réf. {helpDoc.id.toUpperCase()}
              </span>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

// ─── Section header ──────────────────────────────────────────────────────

function SectionHeader({ numeral, label, count }: { numeral: string; label: string; count: number }) {
  return (
    <div className="flex items-baseline gap-4 pt-10 pb-4 border-b border-hairline">
      <span className={cn(DISPLAY, 'text-[28px] italic text-brass')}>{numeral}</span>
      <h2 className={cn(DISPLAY, 'text-[24px] text-cream')}>{label}</h2>
      <span className={cn(MONO, 'text-[11px] text-cream-faint')}>
        {String(count).padStart(2, '0')} pièce{count > 1 ? 's' : ''}
      </span>
    </div>
  )
}
