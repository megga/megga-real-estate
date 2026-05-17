// MEGGA CRM Sugar v3 — Dashboard Analytics (Sprint 4) — Session de relance
// Port pixel-près de sprint-4/crm-dashboard-relance-session.jsx.
//
// Modal fullscreen Sugar : layout 3 colonnes (contexte | éditeur | preview).
// MEGGA AI prépare un brouillon par lead, l'agent ajuste avec la toolbar IA
// (Formaliser / Chaleureux / Court / Détaillé / Recréer) puis signe et envoie.
// État persisté dans localStorage (clé `megga.session.relance.v1`).

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import { DB_SP } from './tokens'
import { DbIcon, type DbIconName } from './icons'
import {
  RELANCE_LEADS,
  TONE_ACTIONS,
  TONE_VARIANTS,
  clearSession,
  getInitialDraft,
  loadSession,
  saveSession,
  type DraftTemplate,
  type IconName,
  type RelanceLead,
  type RelanceSessionState,
  type ToneId,
} from './relanceData'
import { useDashboardAudit } from './useDashboardAudit'

// ─── Hook streaming (réécriture progressive) ───────────────────────────
function useStreamingText(initial: string) {
  const [current, setCurrent] = useState(initial)
  const [streaming, setStreaming] = useState(false)
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (animRef.current != null) window.clearInterval(animRef.current)
    }
  }, [])

  const stream = useCallback((to: string) => {
    if (animRef.current != null) window.clearInterval(animRef.current)
    setStreaming(true)
    let i = 0
    setCurrent('')
    animRef.current = window.setInterval(() => {
      i += Math.max(2, Math.floor(to.length / 220))
      if (i >= to.length) {
        setCurrent(to)
        setStreaming(false)
        if (animRef.current != null) window.clearInterval(animRef.current)
        animRef.current = null
      } else {
        setCurrent(to.slice(0, i))
      }
    }, 18)
  }, [])

  return { current, setCurrent, streaming, stream }
}

// ─── Petits utilitaires UI ─────────────────────────────────────────────
function RAvatar({ lead, size = 56 }: { lead: RelanceLead; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: lead.avatarBg,
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        fontSize: size * 0.32,
        fontWeight: 700,
        flexShrink: 0,
        boxShadow: `0 0 0 4px ${lead.avatarBg}26`,
      }}
    >
      {lead.first[0]}
      {lead.last[0]}
    </div>
  )
}

function RKycChip({ status }: { status: RelanceLead['kyc'] }) {
  const M = {
    verified: {
      l: 'KYC vérifié',
      bg: '#15643F',
      shadow:
        '0 1px 2px rgba(21,100,63,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)',
    },
    pending: {
      l: 'KYC en cours',
      bg: '#A0521E',
      shadow:
        '0 1px 2px rgba(160,82,30,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)',
    },
    none: {
      l: 'KYC à faire',
      bg: '#202127',
      shadow:
        '0 1px 2px rgba(32,33,39,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)',
    },
  }
  const m = M[status]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 9px',
        borderRadius: 999,
        background: m.bg,
        color: '#fff',
        boxShadow: m.shadow,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 0.2,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 999, background: '#fff' }} />
      {m.l}
    </span>
  )
}

// Mapping IconName → DbIconName for history items
const ICON_MAP: Record<IconName, DbIconName> = {
  eye: 'eye',
  check: 'check',
  mail: 'mail',
  phone: 'phone',
  doc: 'doc',
  msg: 'msg',
  clock: 'clock',
}

// ─── Session recap (écran final) ───────────────────────────────────────
function SessionRecap({
  state,
  leads,
  onFinish,
}: {
  state: RelanceSessionState
  leads: RelanceLead[]
  onFinish: () => void
}) {
  const counts = Object.values(state.treated).reduce<Record<string, number>>(
    (a, t) => {
      a[t.action] = (a[t.action] || 0) + 1
      return a
    },
    {},
  )
  const sent = counts.sent || 0
  const called = counts.called || 0
  const postponed = counts.postponed || 0
  const total = leads.length
  const duration = Math.max(1, Math.round((Date.now() - state.startedAt) / 60000))

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        gap: 28,
        animation: 'rlnUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: 999,
          background: DB_SP.black,
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <DbIcon name="party" size={38} stroke="#fff" sw={1.6} />
      </div>

      <div style={{ textAlign: 'center', maxWidth: 520 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: DB_SP.muted,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Session terminée
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 38,
            fontWeight: 800,
            color: DB_SP.ink,
            letterSpacing: -1,
            lineHeight: 1.1,
          }}
        >
          {total} leads traités en {duration} min.
        </h2>
        <p
          style={{
            margin: '12px 0 0',
            fontSize: 15,
            color: DB_SP.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          MEGGA AI suivra les réponses et te notifiera des retours dès demain matin.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14,
          width: '100%',
          maxWidth: 720,
        }}
      >
        {[
          { l: 'Emails envoyés', v: sent },
          { l: 'Appels programmés', v: called },
          { l: 'Reportés à J+7', v: postponed },
        ].map((m) => (
          <div
            key={m.l}
            style={{
              background: DB_SP.card,
              borderRadius: 18,
              padding: 20,
              boxShadow: DB_SP.shadow,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: DB_SP.muted,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}
            >
              {m.l}
            </span>
            <span
              style={{
                fontSize: 38,
                fontWeight: 800,
                color: DB_SP.ink,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: -1,
                lineHeight: 1,
              }}
            >
              {m.v}
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={onFinish}
        style={{
          height: 52,
          padding: '0 28px',
          borderRadius: 999,
          border: 0,
          background: DB_SP.black,
          color: '#fff',
          fontFamily: 'inherit',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: -0.1,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 10px 24px rgba(11,12,14,0.25)',
        }}
      >
        Retour au Dashboard
        <DbIcon name="arrow" size={14} stroke="#fff" sw={2} />
      </button>
    </div>
  )
}

// ─── Colonne gauche : contexte lead ────────────────────────────────────
function LeadContextPanel({ lead }: { lead: RelanceLead }) {
  return (
    <aside
      style={{
        background: DB_SP.card,
        borderRadius: 22,
        padding: 22,
        boxShadow: DB_SP.shadow,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        minHeight: 0,
      }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <RAvatar lead={lead} size={56} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: DB_SP.ink,
              letterSpacing: -0.4,
              lineHeight: 1.1,
            }}
          >
            {lead.first} {lead.last}
          </div>
          <div style={{ fontSize: 11.5, color: DB_SP.muted, fontWeight: 600, marginTop: 3 }}>
            Score MEGGA{' '}
            <strong
              style={{
                color: lead.score >= 80 ? DB_SP.ok : DB_SP.ink,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {lead.score}
            </strong>{' '}
            · Dormant{' '}
            <strong style={{ color: DB_SP.ink }}>{lead.dormSince} j</strong>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: DB_SP.muted,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}
        >
          Bien suivi
        </span>
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: DB_SP.ink,
            letterSpacing: -0.2,
            lineHeight: 1.3,
          }}
        >
          {lead.bien}
        </span>
        <span style={{ fontSize: 11.5, color: DB_SP.muted, fontWeight: 500 }}>CHF {lead.bienPrice}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 10px',
            borderRadius: 999,
            background: DB_SP.cardSubtle,
            fontSize: 11,
            fontWeight: 700,
            color: DB_SP.ink,
          }}
        >
          Budget {lead.budget}
        </span>
        <RKycChip status={lead.kyc} />
      </div>

      <div style={{ padding: '12px 14px', borderRadius: 12, background: DB_SP.cardSubtle }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: DB_SP.muted,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          Pourquoi MEGGA AI l'a sélectionné
        </div>
        <div style={{ fontSize: 12.5, color: DB_SP.inkSoft, lineHeight: 1.5, fontWeight: 500 }}>
          {lead.reason}
        </div>
        {lead.quote && (
          <div
            style={{
              marginTop: 8,
              paddingLeft: 10,
              borderLeft: `2px solid ${DB_SP.ghost}`,
              fontSize: 12,
              color: DB_SP.muted,
              fontStyle: 'italic',
              lineHeight: 1.45,
            }}
          >
            {lead.quote}
          </div>
        )}
      </div>

      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: DB_SP.muted,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Historique récent
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lead.history.map((h, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  background: DB_SP.cardSubtle,
                  color: DB_SP.inkSoft,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <DbIcon name={ICON_MAP[h.icon]} size={12} stroke={DB_SP.inkSoft} sw={1.8} />
              </div>
              <div style={{ minWidth: 0, paddingTop: 2 }}>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: DB_SP.ink,
                    letterSpacing: -0.1,
                    lineHeight: 1.2,
                  }}
                >
                  {h.t}
                </div>
                <div style={{ fontSize: 10.5, color: DB_SP.muted, fontWeight: 500, marginTop: 2 }}>
                  {h.d}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: 'auto',
          padding: 14,
          borderRadius: 14,
          background: DB_SP.black,
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          MEGGA AI · prochaine étape
        </div>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: '#fff',
            letterSpacing: -0.2,
            lineHeight: 1.3,
          }}
        >
          {lead.nextStep}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.45,
          }}
        >
          {lead.nextStepHint}
        </div>
      </div>
    </aside>
  )
}

// ─── Colonne centrale : éditeur + toolbar IA ───────────────────────────
interface EditorPanelProps {
  subject: string
  setSubject: (s: string) => void
  body: string
  setBody: (s: string) => void
  streaming: boolean
  activeTone: ToneId | null
  onTone: (id: ToneId) => void
  onBlur: () => void
  lead: RelanceLead
}

function EditorPanel({
  subject,
  setSubject,
  body,
  setBody,
  streaming,
  activeTone,
  onTone,
  onBlur,
  lead,
}: EditorPanelProps) {
  return (
    <main
      style={{
        background: DB_SP.card,
        borderRadius: 22,
        boxShadow: DB_SP.shadow,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: `1px solid ${DB_SP.hairline}`,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: DB_SP.muted,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            Brouillon MEGGA AI
          </div>
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 800,
              color: DB_SP.ink,
              letterSpacing: -0.3,
              marginTop: 2,
            }}
          >
            Email à {lead.first}
            {streaming && (
              <span
                style={{
                  marginLeft: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '2px 9px',
                  borderRadius: 999,
                  background: DB_SP.black,
                  color: '#fff',
                  fontSize: 9.5,
                  fontWeight: 800,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  animation: 'rlnPulse 1.4s ease-in-out infinite',
                }}
              >
                <DbIcon name="sparkle" size={10} stroke="#fff" sw={1.8} />
                MEGGA AI rédige
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          minHeight: 0,
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: DB_SP.muted,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            Objet
          </span>
          <input
            className="rln-input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onBlur={onBlur}
            disabled={streaming}
            style={{
              height: 42,
              padding: '0 14px',
              borderRadius: 12,
              border: `1.5px solid ${DB_SP.hairline}`,
              background: streaming ? DB_SP.cardSubtle : '#fff',
              color: DB_SP.ink,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'inherit',
              outline: 'none',
              letterSpacing: -0.2,
              transition: 'border-color .15s ease',
            }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: DB_SP.muted,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            Corps du message
          </span>
          <div
            style={{
              flex: 1,
              minHeight: 280,
              position: 'relative',
              border: `1.5px solid ${DB_SP.hairline}`,
              borderRadius: 12,
              background: streaming ? DB_SP.cardSubtle : '#fff',
              transition: 'border-color .15s ease',
            }}
          >
            <textarea
              className="rln-input"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onBlur={onBlur}
              disabled={streaming}
              style={{
                width: '100%',
                height: '100%',
                boxSizing: 'border-box',
                padding: '14px 16px',
                borderRadius: 12,
                border: 0,
                background: 'transparent',
                color: DB_SP.ink,
                fontSize: 13.5,
                fontWeight: 500,
                fontFamily: 'inherit',
                lineHeight: 1.6,
                resize: 'none',
                outline: 'none',
              }}
            />
            {streaming && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 12,
                  right: 14,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: DB_SP.black,
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  pointerEvents: 'none',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: '#fff',
                    animation: 'rlnPulse 1s ease-in-out infinite',
                  }}
                />
                Écriture en cours
              </div>
            )}
          </div>
        </label>
      </div>

      <div
        style={{
          padding: '14px 20px',
          background: DB_SP.cardSubtle,
          borderTop: `1px solid ${DB_SP.hairline}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DbIcon name="sparkle" size={14} stroke={DB_SP.ink} sw={1.8} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: DB_SP.ink,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            Ajustement IA
          </span>
          {activeTone && (
            <span style={{ fontSize: 10.5, fontWeight: 600, color: DB_SP.muted, letterSpacing: 0.2 }}>
              · ton actuel :{' '}
              <strong style={{ color: DB_SP.ink }}>
                {TONE_ACTIONS.find((t) => t.id === activeTone)?.label}
              </strong>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TONE_ACTIONS.map((t) => (
            <button
              key={t.id}
              className="rln-tone-btn"
              disabled={streaming}
              onClick={() => onTone(t.id)}
              title={t.hint}
              style={{
                height: 36,
                padding: '0 14px',
                borderRadius: 999,
                border: 0,
                background: activeTone === t.id ? DB_SP.black : '#fff',
                color: activeTone === t.id ? '#fff' : DB_SP.ink,
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 700,
                cursor: streaming ? 'not-allowed' : 'pointer',
                letterSpacing: -0.1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                boxShadow:
                  activeTone === t.id
                    ? '0 4px 12px rgba(11,12,14,0.18)'
                    : DB_SP.shadowSm,
                transition: 'all .15s ease',
                whiteSpace: 'nowrap',
                opacity: streaming ? 0.4 : 1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}

// ─── Colonne droite : preview email ────────────────────────────────────
function PreviewPanel({
  subject,
  body,
  lead,
  streaming,
}: {
  subject: string
  body: string
  lead: RelanceLead
  streaming: boolean
}) {
  const render = (str: string): string =>
    (str || '')
      .replace(/\[Prénom\]/g, lead.first)
      .replace(/\[Bien\]/g, lead.bien.split(' · ')[0])
      .replace(/\[Agent\]/g, 'Julien Berset')

  return (
    <aside
      style={{
        background: DB_SP.cardSubtle,
        borderRadius: 22,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        gap: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: DB_SP.muted,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}
        >
          Aperçu côté destinataire
        </span>
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          boxShadow: DB_SP.shadow,
          padding: 20,
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            paddingBottom: 12,
            borderBottom: `1px solid ${DB_SP.hairline}`,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              background: DB_SP.mandate,
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            JB
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: DB_SP.ink, letterSpacing: -0.2 }}>
              Julien Berset
            </div>
            <div style={{ fontSize: 11, color: DB_SP.muted, fontWeight: 500 }}>
              julien.berset@megga.ch
            </div>
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: DB_SP.muted,
              fontWeight: 600,
              textAlign: 'right',
              whiteSpace: 'nowrap',
            }}
          >
            à {lead.first.toLowerCase()}.{lead.last.toLowerCase()}@…
          </div>
        </div>

        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: DB_SP.ink,
            letterSpacing: -0.4,
            lineHeight: 1.25,
          }}
        >
          {render(subject) || <span style={{ color: DB_SP.ghost }}>(sujet vide)</span>}
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            fontSize: 13,
            color: DB_SP.inkSoft,
            lineHeight: 1.65,
            whiteSpace: 'pre-wrap',
            fontWeight: 500,
          }}
        >
          {render(body)}
          {streaming && <span className="rln-stream-cursor" />}
        </div>
      </div>
    </aside>
  )
}

// ─── Styles helpers ────────────────────────────────────────────────────
const ghostBtn: CSSProperties = {
  height: 38,
  padding: '0 14px',
  borderRadius: 999,
  border: 0,
  background: 'transparent',
  color: DB_SP.inkSoft,
  fontFamily: 'inherit',
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
  letterSpacing: -0.1,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  whiteSpace: 'nowrap',
}
const secondaryBtn: CSSProperties = {
  height: 46,
  padding: '0 18px',
  borderRadius: 999,
  border: 0,
  background: DB_SP.card,
  color: DB_SP.ink,
  fontFamily: 'inherit',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  letterSpacing: -0.1,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  boxShadow: DB_SP.shadowSm,
  whiteSpace: 'nowrap',
}

// ─── Composant principal — modal fullscreen ────────────────────────────
export interface RelanceSessionResult {
  counts: Record<string, number>
  total: number
  treated: RelanceSessionState['treated']
}

interface DBRelanceSessionProps {
  open: boolean
  onClose: () => void
  onComplete?: (result: RelanceSessionResult) => void
}

export function DBRelanceSession({ open, onClose, onComplete }: DBRelanceSessionProps) {
  const LEADS = RELANCE_LEADS
  const audit = useDashboardAudit()

  const [state, setState] = useState<RelanceSessionState>(() => {
    const saved = loadSession()
    if (saved && saved.version === 1) return saved
    return {
      version: 1,
      currentIdx: 0,
      treated: {},
      drafts: {},
      startedAt: Date.now(),
    }
  })

  useEffect(() => {
    if (open) saveSession(state)
  }, [state, open])

  // AuditEvent (a) : ouverture de la session de relance — handoff DoD.
  // Une seule trace par ouverture (pas à chaque re-render quand `open` reste true).
  useEffect(() => {
    if (open) {
      audit('open-relance-session', `Session relance · ${LEADS.length} leads dormants`, {
        totalLeads: LEADS.length,
        resumedAt: state.currentIdx > 0 ? state.currentIdx : undefined,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // ── A11y : focus restore + ESC + scroll-lock ──────────────────────────
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    // Mémorise le bouton qui a ouvert le modal pour rendre le focus à la fermeture.
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    // Scroll-lock du body (pas de scroll de l'app derrière la modale).
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Focus le conteneur modale (TabIndex -1) au mount pour que les lecteurs
    // d'écran annoncent le dialog.
    window.setTimeout(() => dialogRef.current?.focus(), 0)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        // Pause au lieu de fermer brutalement (cohérent avec le bouton pause)
        handleClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      // Restaure le focus sur l'élément qui a ouvert la modale.
      previouslyFocusedRef.current?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const idx = state.currentIdx
  const lead = LEADS[idx]
  const isDone = idx >= LEADS.length

  const initialDraft = useMemo<DraftTemplate | null>(
    () => (lead ? state.drafts[lead.id] || getInitialDraft(lead) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lead?.id],
  )

  const [subject, setSubject] = useState(initialDraft?.subject || '')
  const { current: body, setCurrent: setBody, streaming, stream } = useStreamingText(
    initialDraft?.body || '',
  )
  const [activeTone, setActiveTone] = useState<ToneId | null>(null)

  useEffect(() => {
    if (!lead) return
    const d = state.drafts[lead.id] || getInitialDraft(lead)
    setSubject(d.subject)
    setBody(d.body)
    setActiveTone(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id])

  const persistDraft = useCallback(
    (overrides?: Partial<DraftTemplate>) => {
      if (!lead) return
      setState((s) => ({
        ...s,
        drafts: {
          ...s.drafts,
          [lead.id]: {
            subject: overrides?.subject ?? subject,
            body: overrides?.body ?? body,
          },
        },
      }))
    },
    [lead, subject, body],
  )

  const applyTone = (toneId: ToneId) => {
    if (!lead || streaming) return
    const variant = TONE_VARIANTS[toneId]
    if (!variant) return
    const next = variant({ subject, body }, lead)
    setActiveTone(toneId)
    setSubject(next.subject)
    stream(next.body)
    window.setTimeout(() => persistDraft({ subject: next.subject, body: next.body }), 50)
  }

  const advance = (action: 'sent' | 'called' | 'postponed') => {
    if (!lead) return
    persistDraft()
    // AuditEvent (b) : trace l'action sur le lead courant — handoff DoD.
    const auditAction =
      action === 'sent'
        ? 'relance-sent'
        : action === 'called'
          ? 'relance-called'
          : 'relance-postponed'
    audit(auditAction, `${lead.first} ${lead.last} · ${lead.bien.split(' · ')[0]}`, {
      leadId: lead.id,
      action,
      idx: state.currentIdx,
    })
    setState((s) => ({
      ...s,
      treated: { ...s.treated, [lead.id]: { action, ts: Date.now() } },
      currentIdx: s.currentIdx + 1,
    }))
  }

  const goPrev = () => {
    if (idx === 0) return
    persistDraft()
    setState((s) => ({ ...s, currentIdx: Math.max(0, s.currentIdx - 1) }))
  }

  const handleClose = () => {
    persistDraft()
    onClose()
  }

  const handleFinish = () => {
    const counts = Object.values(state.treated).reduce<Record<string, number>>(
      (a, t) => {
        a[t.action] = (a[t.action] || 0) + 1
        return a
      },
      {},
    )
    onComplete?.({ counts, total: LEADS.length, treated: state.treated })
    clearSession()
    onClose()
  }

  if (!open) return null

  const content = (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rln-dialog-title"
      tabIndex={-1}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: DB_SP.bg,
        backgroundImage:
          'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',
        animation: 'rlnFade .3s ease both',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Manrope, system-ui, sans-serif',
        outline: 'none',
      }}
    >
      <style>{`
        .rln-tone-btn:hover:not([disabled]) { background: ${DB_SP.cardSubtle} !important; }
        .rln-input:focus { border-color: ${DB_SP.ink} !important; }
        .rln-stream-cursor { display: inline-block; width: 2px; height: 1.1em; background: ${DB_SP.ink}; margin-left: 1px; animation: rlnPulse 1s ease-in-out infinite; vertical-align: text-bottom; }
      `}</style>

      {isDone || !lead ? (
        <SessionRecap state={state} leads={LEADS} onFinish={handleFinish} />
      ) : (
        <>
          {/* HEADER */}
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '18px 28px',
              background: 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              borderBottom: `1px solid ${DB_SP.hairline}`,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  background: DB_SP.black,
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <DbIcon name="sparkle" size={16} stroke="#fff" sw={1.6} />
              </div>
              <div>
                <div
                  id="rln-dialog-title"
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: DB_SP.muted,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  MEGGA AI · Session de relance
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: DB_SP.ink,
                    letterSpacing: -0.3,
                    marginTop: 6,
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Lead {idx + 1} sur {LEADS.length} ·{' '}
                  {Object.keys(state.treated).length} traité
                  {Object.keys(state.treated).length > 1 ? 's' : ''}
                </div>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                height: 6,
                background: DB_SP.cardSubtle,
                borderRadius: 999,
                overflow: 'hidden',
                margin: '0 24px',
                maxWidth: 380,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${(idx / LEADS.length) * 100}%`,
                  background: DB_SP.black,
                  borderRadius: 999,
                  transition: 'width .35s cubic-bezier(.2,.8,.2,1)',
                }}
              />
            </div>

            <div style={{ display: 'inline-flex', gap: 8, marginLeft: 'auto' }}>
              <button
                onClick={handleClose}
                title="Mettre en pause"
                aria-label="Mettre la session de relance en pause"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  border: 0,
                  background: DB_SP.cardSubtle,
                  color: DB_SP.inkSoft,
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <DbIcon name="pause" size={15} stroke="currentColor" sw={1.8} />
              </button>
              <button
                onClick={handleClose}
                title="Fermer (Échap)"
                aria-label="Fermer la session de relance"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  border: 0,
                  background: DB_SP.cardSubtle,
                  color: DB_SP.inkSoft,
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <DbIcon name="close" size={15} stroke="currentColor" sw={2.2} />
              </button>
            </div>
          </header>

          {/* BODY 3 COLONNES */}
          <div
            key={lead.id}
            style={{
              flex: 1,
              minHeight: 0,
              display: 'grid',
              gridTemplateColumns: '320px 1fr 380px',
              gap: 20,
              padding: '24px 28px',
              animation: 'rlnSlide .4s cubic-bezier(.2,.8,.2,1) both',
            }}
          >
            <LeadContextPanel lead={lead} />
            <EditorPanel
              subject={subject}
              setSubject={setSubject}
              body={body}
              setBody={setBody}
              streaming={streaming}
              activeTone={activeTone}
              onTone={applyTone}
              onBlur={() => persistDraft()}
              lead={lead}
            />
            <PreviewPanel subject={subject} body={body} lead={lead} streaming={streaming} />
          </div>

          {/* FOOTER */}
          <footer
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 28px',
              background: 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              borderTop: `1px solid ${DB_SP.hairline}`,
              flexShrink: 0,
              gap: 14,
            }}
          >
            <button
              onClick={goPrev}
              disabled={idx === 0}
              style={{
                ...ghostBtn,
                opacity: idx === 0 ? 0.4 : 1,
                cursor: idx === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <DbIcon name="arrowL" size={13} stroke={DB_SP.inkSoft} sw={2} />
              Précédent
            </button>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button onClick={() => advance('called')} style={secondaryBtn}>
                <DbIcon name="phone" size={13} stroke={DB_SP.inkSoft} sw={2} />
                Plutôt l'appeler
              </button>
              <button onClick={() => advance('postponed')} style={secondaryBtn}>
                <DbIcon name="clock" size={13} stroke={DB_SP.inkSoft} sw={2} />
                Reporter à J+7
              </button>
              <button
                onClick={() => advance('sent')}
                disabled={streaming}
                style={{
                  height: 46,
                  padding: '0 22px',
                  borderRadius: 999,
                  border: 0,
                  background: streaming ? DB_SP.ghost : DB_SP.black,
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: streaming ? 'not-allowed' : 'pointer',
                  letterSpacing: -0.1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 9,
                  boxShadow: streaming ? 'none' : '0 8px 20px rgba(11,12,14,0.22)',
                  whiteSpace: 'nowrap',
                }}
              >
                Envoyer & suivant
                <DbIcon name="send" size={14} stroke="#fff" sw={2} />
              </button>
            </div>
          </footer>
        </>
      )}
    </div>
  )

  return createPortal(content, document.body)
}
