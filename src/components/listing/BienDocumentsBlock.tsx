// MEGGA — Bien documents block (port 1:1 du proto megga-bien-features.jsx
// DocumentsBlock).
// Liste de PDFs téléchargeables : icône bleue type 36×44, nom + size, hover
// border bleue + background F6F8FC, footer note "documents indicatifs".

const M = {
  ink: '#0E1410',
  muted: '#7A8079',
  border: '#E6E8EC',
  green: '#0041D9',
  pillBg: '#E8EFFE',
  hover: '#F6F8FC',
}
const FONT = '"Manrope", system-ui, -apple-system, sans-serif'

export interface BienDocument {
  name: string
  size: string
  type: string
  url?: string | null
}

interface BienDocumentsBlockProps {
  documents?: BienDocument[]
  /** Affiché en footer quand l'utilisateur n'est pas connecté */
  requireAccount?: boolean
}

const DEFAULT_DOCS: BienDocument[] = [
  { name: "Plan d'étage", size: '1.2 MB', type: 'PDF' },
  { name: 'Fiche technique', size: '640 KB', type: 'PDF' },
  { name: 'Diagnostic énergétique (CECB)', size: '880 KB', type: 'PDF' },
  { name: 'Règlement de copropriété', size: '2.1 MB', type: 'PDF' },
]

export default function BienDocumentsBlock({
  documents,
  requireAccount = true,
}: BienDocumentsBlockProps) {
  const docs = documents && documents.length > 0 ? documents : DEFAULT_DOCS

  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${M.border}`,
        borderRadius: 14,
        padding: 22,
        fontFamily: FONT,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: M.green,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          Documents
        </div>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: M.ink,
            margin: 0,
            letterSpacing: -0.5,
          }}
        >
          Téléchargeables
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {docs.map((d, i) => (
          <a
            key={i}
            href={d.url || '#'}
            onClick={(e) => {
              if (!d.url) e.preventDefault()
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '12px 14px',
              border: `1px solid ${M.border}`,
              borderRadius: 10,
              textDecoration: 'none',
              color: M.ink,
              transition: 'border-color 0.15s, background 0.15s',
              background: '#fff',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = M.green
              e.currentTarget.style.background = M.hover
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = M.border
              e.currentTarget.style.background = '#fff'
            }}
          >
            <div
              style={{
                width: 36,
                height: 44,
                borderRadius: 5,
                background: M.pillBg,
                color: M.green,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 0.5,
                flexShrink: 0,
              }}
            >
              {d.type}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {d.name}
              </div>
              <div style={{ fontSize: 11, color: M.muted, marginTop: 2 }}>
                {d.size}
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 2v8 M3 6l4 4 4-4 M2 12h10"
                stroke={M.ink}
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        ))}
      </div>

      <div
        style={{
          marginTop: 12,
          fontSize: 11,
          color: M.muted,
        }}
      >
        Documents fournis à titre indicatif.
        {requireAccount && ' Téléchargement disponible après création de compte.'}
      </div>
    </div>
  )
}
