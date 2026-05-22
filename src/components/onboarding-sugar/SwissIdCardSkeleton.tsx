// MEGGA · Carte d'identité suisse 2023 — Skeleton (composant autonome)
// =====================================================================
// Source : handoff-carte-identite/demo/swiss-id-card.jsx
// Réplique fidèle du modèle officiel fedpol 2023+ : bandeau pays en 5 langues,
// photo pleine hauteur à gauche + signature dessous, titre quadrilingue + drapeau
// CH + numéro de document, libellés de champs en 5 langues, picto montagnes
// stylisées, ghost portrait fac-similé, fond avec courbes topographiques Alpes
// organiques. Skeleton = pas de vraies PII (valeurs en barres opaques).
//
// Props :
//   dark   : boolean  — mode sombre (palette inversée). Défaut : false.
//   shadow : string   — box-shadow CSS, escape hatch. Défaut : Sugar Pure.
//   style  : object   — styles additionnels mergés sur le conteneur racine.
//
// Aucune dépendance externe : pas de tokens MEGGA, pas de palette importée.
// Le composant est entièrement auto-contenu — les couleurs internes (navy,
// rouge CH, vert sapin) appartiennent au document représenté, pas au design
// system de l'app hôte.
import type { CSSProperties, ReactNode } from 'react'

type Props = {
  dark?: boolean
  shadow?: string
  style?: CSSProperties
}

export default function SwissIdCardSkeleton({
  dark = false,
  shadow,
  style,
}: Props) {
  // Couleurs internes au document (artefact représenté, pas chrome UI)
  const docInk = dark ? '#E6EAF4' : '#0E1F3C'
  const docInkSoft = dark ? 'rgba(230,234,244,0.55)' : 'rgba(14,31,60,0.58)'
  const docInkMuted = dark ? 'rgba(230,234,244,0.38)' : 'rgba(14,31,60,0.40)'
  const docBg = dark
    ? 'linear-gradient(135deg, #161B27 0%, #1B2333 55%, #161B27 100%)'
    : 'linear-gradient(135deg, #EEF3F8 0%, #E4ECF4 50%, #DCE6EF 100%)'

  // Skeleton bar opaque (remplace les valeurs PII)
  const bar = (w: number, h = 10, opacity = 0.78): CSSProperties => ({
    width: w,
    height: h,
    borderRadius: 2,
    background: dark
      ? `rgba(230,234,244,${opacity})`
      : `rgba(14,31,60,${opacity})`,
  })

  // Micro-label 5 langues
  const L = ({ children }: { children: ReactNode }) => (
    <div
      style={{
        fontSize: 5.5,
        fontWeight: 500,
        letterSpacing: 0.12,
        color: docInkSoft,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {children}
    </div>
  )

  // Petit drapeau suisse (national identifier — seule touche de rouge admise)
  const SwissCross = ({ size = 12 }: { size?: number }) => (
    <div
      style={{
        width: size,
        height: size,
        background: '#D52B1E',
        display: 'grid',
        placeItems: 'center',
        borderRadius: 1,
        flexShrink: 0,
        boxShadow: '0 0.5px 1px rgba(0,0,0,0.18)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: size * 0.68,
          height: size * 0.68,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: size * 0.27,
            top: 0,
            width: size * 0.16,
            height: size * 0.68,
            background: '#fff',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: size * 0.27,
            left: 0,
            width: size * 0.68,
            height: size * 0.16,
            background: '#fff',
          }}
        />
      </div>
    </div>
  )

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 420,
        aspectRatio: '1.586 / 1',
        background: docBg,
        borderRadius: 12,
        boxShadow:
          shadow ||
          (dark
            ? '0 12px 32px rgba(0,0,0,0.40), 0 2px 8px rgba(0,0,0,0.30)'
            : '0 12px 32px rgba(15,23,42,0.08), 0 2px 8px rgba(15,23,42,0.04)'),
        overflow: 'hidden',
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        color: docInk,
        ...(style || {}),
      }}
    >
      {/* ── Courbes topographiques (Alpes) — pattern de fond organique ── */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: dark ? 0.11 : 0.17,
          pointerEvents: 'none',
        }}
        viewBox="0 0 420 265"
        preserveAspectRatio="none"
      >
        {[
          { y: 12, amp: 6, p1: 40, p2: 240, sw: 0.36, op: 0.7 },
          { y: 30, amp: 12, p1: 90, p2: 280, sw: 0.3, op: 0.55 },
          { y: 56, amp: 4, p1: 130, p2: 260, sw: 0.44, op: 0.85 },
          { y: 82, amp: 16, p1: 70, p2: 320, sw: 0.3, op: 0.5 },
          { y: 108, amp: 7, p1: 110, p2: 250, sw: 0.4, op: 0.75 },
          { y: 134, amp: 14, p1: 160, p2: 300, sw: 0.32, op: 0.55 },
          { y: 162, amp: 6, p1: 60, p2: 270, sw: 0.42, op: 0.78 },
          { y: 188, amp: 11, p1: 120, p2: 290, sw: 0.32, op: 0.55 },
          { y: 212, amp: 5, p1: 90, p2: 240, sw: 0.46, op: 0.9 },
          { y: 236, amp: 10, p1: 180, p2: 310, sw: 0.32, op: 0.55 },
          { y: 256, amp: 6, p1: 70, p2: 270, sw: 0.28, op: 0.45 },
        ].map((line, i) => (
          <path
            key={'main' + i}
            d={`M-15 ${line.y + line.amp * 0.3} C ${line.p1} ${line.y - line.amp}, ${line.p1 + 90} ${line.y + line.amp * 0.7}, 210 ${line.y + line.amp * 0.2} S ${line.p2} ${line.y - line.amp * 0.7}, 435 ${line.y + line.amp * 0.4}`}
            fill="none"
            stroke={dark ? '#E6EAF4' : '#0E1F3C'}
            strokeWidth={line.sw}
            opacity={line.op}
          />
        ))}
        <path
          d="M 62 96 Q 96 90 130 94"
          fill="none"
          stroke={dark ? '#E6EAF4' : '#0E1F3C'}
          strokeWidth="0.32"
          opacity="0.55"
        />
        <path
          d="M 235 174 Q 280 168 320 173 T 380 176"
          fill="none"
          stroke={dark ? '#E6EAF4' : '#0E1F3C'}
          strokeWidth="0.36"
          opacity="0.6"
        />
        <path
          d="M 30 222 Q 65 218 100 222"
          fill="none"
          stroke={dark ? '#E6EAF4' : '#0E1F3C'}
          strokeWidth="0.28"
          opacity="0.45"
        />
        <path
          d="M 200 48 Q 240 44 275 49"
          fill="none"
          stroke={dark ? '#E6EAF4' : '#0E1F3C'}
          strokeWidth="0.3"
          opacity="0.45"
        />
        <ellipse
          cx="346"
          cy="148"
          rx="34"
          ry="12"
          fill="none"
          stroke={dark ? '#E6EAF4' : '#0E1F3C'}
          strokeWidth="0.42"
          opacity="0.55"
        />
        <ellipse
          cx="349"
          cy="150"
          rx="20"
          ry="7"
          fill="none"
          stroke={dark ? '#E6EAF4' : '#0E1F3C'}
          strokeWidth="0.44"
          opacity="0.7"
        />
        <ellipse
          cx="351"
          cy="151"
          rx="9"
          ry="3.5"
          fill="none"
          stroke={dark ? '#E6EAF4' : '#0E1F3C'}
          strokeWidth="0.48"
          opacity="0.85"
        />
      </svg>

      {/* ── BANDEAU PAYS 5 LANGUES ── */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 14,
          right: 14,
          fontSize: 12.5,
          fontWeight: 800,
          letterSpacing: 0.2,
          color: docInk,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        SCHWEIZ SUISSE SVIZZERA SVIZRA SWITZERLAND
      </div>

      {/* ── PHOTO PRINCIPALE (gauche) ── */}
      <div
        style={{
          position: 'absolute',
          top: 32,
          left: 14,
          bottom: 40,
          width: 96,
          background: dark ? 'rgba(230,234,244,0.06)' : 'rgba(14,31,60,0.07)',
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
        }}
      >
        <svg
          width="46"
          height="46"
          viewBox="0 0 24 24"
          fill="none"
          stroke={dark ? 'rgba(230,234,244,0.42)' : 'rgba(14,31,60,0.32)'}
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="8.5" r="3.4" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0.2,
            pointerEvents: 'none',
          }}
          viewBox="0 0 96 200"
          preserveAspectRatio="none"
        >
          {[24, 52, 82, 114, 146, 175].map((y, i) => (
            <path
              key={i}
              d={`M-5 ${y} Q 22 ${y - 7} 48 ${y + 3} T 102 ${y - 5}`}
              fill="none"
              stroke={dark ? '#E6EAF4' : '#0E1F3C'}
              strokeWidth="0.5"
            />
          ))}
        </svg>
      </div>

      {/* ── Ligne d'encodage sous la photo ── */}
      <div
        style={{
          position: 'absolute',
          left: 14,
          bottom: 26,
          width: 96,
          fontSize: 4,
          fontWeight: 700,
          letterSpacing: 0.4,
          color: docInkMuted,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textAlign: 'center',
          fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
        }}
      >
        {'01·08·1991<172<T1A12A34<02·08·2028'}
      </div>

      {/* ── Signature cursive sous la photo ── */}
      <div
        style={{
          position: 'absolute',
          left: 14,
          bottom: 5,
          width: 96,
          height: 20,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <svg
          viewBox="0 0 96 20"
          width="100%"
          height="100%"
          preserveAspectRatio="none"
        >
          <path
            d="M3 13 Q 9 4 14 12 T 26 10 Q 33 5 39 13 T 52 11 Q 59 7 66 13 T 80 11 Q 86 8 93 12"
            fill="none"
            stroke={docInkSoft}
            strokeWidth="0.9"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* ── TITRE QUADRILINGUE + DRAPEAU ── */}
      <div
        style={{
          position: 'absolute',
          top: 36,
          left: 116,
          right: 56,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        <div style={{ marginTop: 1 }}>
          <SwissCross size={12} />
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            lineHeight: 1.35,
            fontSize: 6.5,
            fontWeight: 700,
            letterSpacing: 0.2,
            color: docInk,
          }}
        >
          <div>IDENTITÄTSKARTE · CARTE D'IDENTITÉ</div>
          <div>CARTA D'IDENTITÀ · CARTA D'IDENTITAD</div>
          <div>IDENTITY CARD</div>
        </div>
      </div>

      {/* ── Numéro de document top-right ── */}
      <div
        style={{
          position: 'absolute',
          top: 36,
          right: 14,
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: 0.55,
          fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
          color: docInk,
        }}
      >
        T1A12A34
      </div>

      {/* ── Picto montagnes stylisées ── */}
      <div
        style={{
          position: 'absolute',
          top: 54,
          right: 14,
          width: 42,
          height: 30,
        }}
      >
        <svg viewBox="0 0 38 28" width="38" height="28" fill="none">
          <path
            d="M1 26 L10 5 L19 26 Z"
            fill={dark ? '#7BAB91' : '#5A8674'}
            opacity="0.55"
          />
          <path
            d="M10 26 L18.5 10 L27 26 Z"
            fill={dark ? '#7BAB91' : '#5A8674'}
            opacity="0.78"
          />
          <path
            d="M20 26 L28 14 L37 26 Z"
            fill={dark ? '#7BAB91' : '#5A8674'}
          />
          <g
            stroke="#fff"
            strokeWidth="0.9"
            strokeLinecap="round"
            opacity="0.92"
          >
            <line x1="29.5" y1="19.5" x2="29.5" y2="22.5" />
            <line x1="28" y1="21" x2="31" y2="21" />
          </g>
        </svg>
      </div>

      {/* ── Ghost portrait fac-similé ── */}
      <div
        style={{
          position: 'absolute',
          top: 90,
          right: 18,
          width: 32,
          height: 44,
          background: dark ? 'rgba(230,234,244,0.05)' : 'rgba(14,31,60,0.06)',
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
          opacity: 0.62,
          pointerEvents: 'none',
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke={dark ? 'rgba(230,234,244,0.55)' : 'rgba(14,31,60,0.50)'}
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="8.5" r="3.4" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0.32,
            pointerEvents: 'none',
          }}
          viewBox="0 0 32 44"
          preserveAspectRatio="none"
        >
          {[7, 16, 25, 34, 41].map((y, i) => (
            <path
              key={i}
              d={`M-3 ${y} Q 8 ${y - 4} 16 ${y + 1} T 35 ${y - 3}`}
              fill="none"
              stroke={dark ? '#E6EAF4' : '#0E1F3C'}
              strokeWidth="0.45"
            />
          ))}
        </svg>
      </div>

      {/* ── CHAMPS — libellés 5 langues + skeleton bars ── */}
      <div
        style={{
          position: 'absolute',
          top: 88,
          left: 116,
          right: 14,
          bottom: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        }}
      >
        <div>
          <L>Name · Nom · Cognome · Num · Surname</L>
          <div style={{ ...bar(160, 10), marginTop: 2 }} />
        </div>
        <div>
          <L>Vorname(n) · Prénom(s) · Nome(i) · Prenum(s) · Given name(s)</L>
          <div style={{ ...bar(130, 10), marginTop: 2 }} />
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            gap: 12,
            alignItems: 'flex-end',
          }}
        >
          <div>
            <L>Geschlecht · Sexe</L>
            <L>Sesso · Sex</L>
            <div style={{ ...bar(12, 9), marginTop: 2 }} />
          </div>
          <div>
            <L>Nationalität · Nationalité</L>
            <L>Cittadinanza · Nationality</L>
            <div style={{ ...bar(34, 9), marginTop: 2 }} />
          </div>
          <div>
            <L>CAN Card Access Number</L>
            <L>&nbsp;</L>
            <div style={{ ...bar(52, 9), marginTop: 2 }} />
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          <div>
            <L>Geburtsdatum · Date de naissance</L>
            <L>Data di nascita · Date of birth</L>
            <div style={{ ...bar(72, 9), marginTop: 2 }} />
          </div>
          <div>
            <L>Gültig bis · Date d'expiration</L>
            <L>Data di scadenza · Date of expiry</L>
            <div style={{ ...bar(72, 9), marginTop: 2 }} />
          </div>
        </div>
      </div>
    </div>
  )
}
