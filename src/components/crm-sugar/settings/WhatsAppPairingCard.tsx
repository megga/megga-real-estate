// MEGGA CRM Sugar v2 — Carte « Connecter WhatsApp » (Tier 3.k).
// Re-skin Sugar Pure de wa-pairing-card.jsx / wa-pairing-tokens.jsx : surface
// neutre (SET_PALETTE.*), glyphe WhatsApp vert pour l'ancrage de marque, bouton
// ghost DS-conforme. Câblé au hook réel useWhatsAppPairing (table
// whatsapp_agent_links + RPC generate_whatsapp_pairing_code).
//
// États dérivés du back :
//   - loading : status.isLoading            → squelette
//   - error   : status.isError              → bandeau « Statut indisponible » + réessayer
//   - linked  : link.verified === true      → numéro masqué + exemples + délier (no-op : pas de RPC unlink)
//   - waiting : pairing_code présent, pas encore vérifié → code à 6 chiffres + ping
//   - unlinked: défaut                       → CTA « Générer un code »
//
// `bare` : rend le corps sans la carte extérieure (pour l'embarquer dans une modale Sugar).

import { useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import type { TFunction } from 'i18next'
import { SET_PALETTE } from './data'
import { SetIcon } from './atoms'
import { useWhatsAppPairing } from '@/hooks/useWhatsAppPairing'

const SET = SET_PALETTE

// Numéro Meta Business MEGGA (prod pilote — vérifié dans agency_wa_numbers,
// label « MEGGA Business (pilote Gregory) »). C'est LE numéro auquel l'agent
// envoie son code d'appairage ; le webhook route l'inbound par ce wa_to.
// TODO(multi-agence, V2) : dériver ce numéro de agency_wa_numbers plutôt que
// le figer en dur quand chaque agence aura son propre numéro Business.
const MEGGA_WA_NUMBER = '+41 79 874 94 84'
const WA_BRAND = '#25D366' // vert WhatsApp officiel — réservé au glyphe, jamais au fond/bouton

// ── Glyphe WhatsApp (pastille verte officielle) ───────────────────────────
function WAGlyphSolid({ size = 20, waColor = WA_BRAND }: { size?: number; waColor?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="9" fill={waColor} />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="#FFFFFF"
        d="M22.5 9.5A9.1 9.1 0 0 0 8.2 20.5L7 25l4.6-1.2a9.1 9.1 0 0 0 4.35 1.1h.004A9.1 9.1 0 0 0 22.5 9.5Zm-6.55 13.86h-.003a7.56 7.56 0 0 1-3.85-1.05l-.276-.164-2.86.75.764-2.79-.18-.286a7.55 7.55 0 1 1 6.405 3.54Zm4.146-5.66c-.227-.114-1.344-.663-1.552-.739-.208-.076-.36-.114-.51.114-.151.227-.587.738-.72.889-.132.152-.265.17-.492.057-.227-.114-.959-.353-1.826-1.127-.675-.602-1.13-1.345-1.263-1.572-.132-.227-.014-.35.1-.463.103-.102.227-.265.34-.398.114-.133.151-.227.227-.379.076-.151.038-.284-.019-.398-.057-.114-.51-1.23-.7-1.685-.184-.442-.371-.382-.51-.39l-.435-.007a.83.83 0 0 0-.605.284c-.208.227-.794.776-.794 1.892 0 1.116.813 2.194.927 2.346.114.151 1.6 2.443 3.876 3.426.541.234.964.373 1.293.478.543.173 1.038.148 1.43.09.436-.065 1.344-.55 1.533-1.08.189-.531.189-.986.132-1.081-.056-.095-.207-.152-.435-.265Z"
      />
    </svg>
  )
}

// Masque un numéro suisse : indicatif pays (2 chiffres) + préfixe opérateur
// RÉELS + 2 derniers chiffres (dérivés des chiffres, plus figés à « +41 79 » —
// un mobile +41 76/78 affichait sinon un préfixe faux). Hypothèse CC=2 chiffres
// (E.164 CH, ce que renvoie le wa_id Meta du pilote) ; pas de parse E.164 complet.
function maskNumber(num: string | null | undefined): string {
  const digits = (num || '').replace(/\D/g, '')
  if (digits.length < 6) return num || '—'
  const cc = digits.slice(0, 2) // indicatif pays (41)
  const op = digits.slice(2, 4) // préfixe opérateur (79/78/76…)
  const last2 = digits.slice(-2)
  return `+${cc} ${op} ••• •• ${last2}`
}

// ── Tuile glyphe d'en-tête ────────────────────────────────────────────────
function WAHeadTile() {
  return (
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 'var(--crm-radius-md)',
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        background: SET.cardSubtle,
        boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
      }}
    >
      <WAGlyphSolid size={20} />
    </div>
  )
}

// ── En-tête commun ────────────────────────────────────────────────────────
function WAHeader({ status, t }: { status?: ReactNode; t: TFunction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)' }}>
      <WAHeadTile />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--crm-text-2xl)',
            fontWeight: 500,
            color: SET.ink,
            letterSpacing: -0.2,
            lineHeight: 1.25,
          }}
        >
          {t('integrations.whatsapp.title')}
        </div>
        <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: SET.muted, marginTop: 1 }}>
          {t('integrations.whatsapp.subtitle')}
        </div>
      </div>
      {status}
    </div>
  )
}

// ── Statut « Lié » — texte vert sans fond ─────────────────────────────────
function WALinkedBadge({ t }: { t: TFunction }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--crm-space-sm)',
        fontSize: 'var(--crm-text-lg)',
        fontWeight: 600,
        color: SET.ok,
        letterSpacing: -0.1,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 'var(--crm-radius-pill)',
          background: SET.ok,
          boxShadow: `0 0 0 3px ${SET.ok}22`,
        }}
      />
      {t('integrations.whatsapp.linked')}
    </span>
  )
}

// ── Corps par état ────────────────────────────────────────────────────────
function WABody() {
  const { t } = useTranslation('settings')
  const { status, generateCode } = useWhatsAppPairing()
  const link = status.data

  // — loading —
  if (status.isLoading) {
    const bar = (w: number | string, h = 13): CSSProperties => ({
      width: w,
      height: h,
      borderRadius: 'var(--crm-radius-sm)',
      background: SET.cardSubtle,
      boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
    })
    return (
      <div style={{ display: 'grid', gap: 'var(--crm-space-3xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)' }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--crm-radius-md)',
              background: SET.cardSubtle,
              boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
            }}
          />
          <div style={{ display: 'grid', gap: 'var(--crm-space-sm)' }}>
            <div style={bar(150)} />
            <div style={bar(110, 11)} />
          </div>
        </div>
        <div style={{ display: 'grid', gap: 'var(--crm-space-md)' }}>
          <div style={bar('90%')} />
          <div style={bar('74%')} />
        </div>
      </div>
    )
  }

  // — error —
  if (status.isError) {
    return (
      <div style={{ display: 'grid', gap: 'var(--crm-space-3xl)' }}>
        <WAHeader t={t} />
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--crm-space-xl)',
            padding: 'var(--crm-space-xl) var(--crm-space-2xl)',
            borderRadius: 'var(--crm-radius-lg)',
            background: SET.cardSubtle,
            boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
          }}
        >
          <span style={{ color: SET.err, flexShrink: 0, marginTop: 1 }}>
            <SetIcon name="alert" size={18} stroke={SET.err} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: SET.ink, letterSpacing: -0.1 }}>
              {t('integrations.whatsapp.error.title')}
            </div>
            <div
              style={{
                fontSize: 'var(--crm-text-lg)',
                fontWeight: 500,
                color: SET.inkSoft,
                lineHeight: 1.45,
                marginTop: 2,
              }}
            >
              {t('integrations.whatsapp.error.desc')}
            </div>
          </div>
        </div>
        <WAGhostButton
          icon={<SetIcon name="arrowR" size={16} stroke={SET.inkSoft} sw={2} />}
          onClick={() => status.refetch()}
        >
          {t('integrations.whatsapp.error.retry')}
        </WAGhostButton>
      </div>
    )
  }

  // — linked —
  if (link?.verified) {
    const examples = t('integrations.whatsapp.examples', { returnObjects: true }) as string[]
    return (
      <div style={{ display: 'grid', gap: 'var(--crm-space-4xl)' }}>
        <WAHeader status={<WALinkedBadge t={t} />} t={t} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--crm-space-2xl)',
            padding: 'var(--crm-space-xl) var(--crm-space-2xl)',
            borderRadius: 'var(--crm-radius-lg)',
            background: SET.cardSubtle,
            boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 'var(--crm-text-lg)',
                fontWeight: 400,
                color: SET.muted,
              }}
            >
              {t('integrations.whatsapp.linkedNumber')}
            </div>
            <div
              style={{
                fontSize: 'var(--crm-text-xl)',
                fontWeight: 600,
                color: SET.ink,
                letterSpacing: -0.1,
                fontVariantNumeric: 'tabular-nums',
                fontFeatureSettings: '"tnum" 1',
                marginTop: 3,
                whiteSpace: 'nowrap',
              }}
            >
              {maskNumber(link.wa_number)}
            </div>
          </div>
          <span style={{ color: SET.ok, flexShrink: 0 }}>
            <SetIcon name="check" size={18} stroke={SET.ok} sw={2} />
          </span>
        </div>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', marginBottom: 10 }}>
            <SetIcon name="sparkle" size={14} stroke={SET.muted} />
            <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: SET.muted, whiteSpace: 'nowrap' }}>
              {t('integrations.whatsapp.writeLikeColleague')}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-md)' }}>
            {examples.map(e => (
              <span
                key={e}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: 'var(--crm-space-sm) var(--crm-space-xl)',
                  borderRadius: 'var(--crm-radius-pill)',
                  fontSize: 'var(--crm-text-lg)',
                  fontWeight: 500,
                  color: SET.inkSoft,
                  background: SET.card,
                  boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.06)',
                  whiteSpace: 'nowrap',
                }}
              >
                {e}
              </span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // — waiting : un code a été généré, en attente de vérification webhook —
  if (link?.pairing_code) {
    return (
      <div style={{ display: 'grid', gap: 'var(--crm-space-4xl)' }}>
        <WAHeader t={t} />
        {/* Code à 6 chiffres à envoyer */}
        <div
          style={{
            padding: 'var(--crm-space-4xl) var(--crm-space-3xl)',
            borderRadius: 'var(--crm-radius-xl)',
            background: SET.cardSubtle,
            boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 'var(--crm-text-6xl)',
              fontWeight: 600,
              color: SET.ink,
              letterSpacing: 8,
              fontVariantNumeric: 'tabular-nums',
              fontFeatureSettings: '"tnum" 1',
            }}
          >
            {link.pairing_code}
          </div>
          <div style={{ fontSize: 'var(--crm-text-md)', color: SET.muted, fontWeight: 500, marginTop: 8, lineHeight: 1.5 }}>
            <Trans
              i18nKey="integrations.whatsapp.waiting.sendCode"
              t={t}
              values={{ number: MEGGA_WA_NUMBER }}
              components={{ strong: <strong style={{ color: SET.inkSoft }} /> }}
            />
          </div>
        </div>
        {/* Bandeau d'attente */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--crm-space-xl)',
            padding: 'var(--crm-space-xl) var(--crm-space-2xl)',
            borderRadius: 'var(--crm-radius-lg)',
            background: SET.cardSubtle,
            boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
          }}
        >
          <span style={{ position: 'relative', width: 9, height: 9, flexShrink: 0 }}>
            <span style={{ position: 'absolute', inset: 0, borderRadius: 'var(--crm-radius-pill)', background: SET.ok }} />
            <span
              style={{
                position: 'absolute',
                inset: -3,
                borderRadius: 'var(--crm-radius-pill)',
                border: `2px solid ${SET.ok}`,
                animation: 'setPing 1.4s cubic-bezier(0,0,.2,1) infinite',
              }}
            />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: SET.ink, letterSpacing: -0.1 }}>
              {t('integrations.whatsapp.waiting.title')}
            </div>
            <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: SET.muted, marginTop: 1 }}>
              {t('integrations.whatsapp.waiting.desc')}
            </div>
          </div>
        </div>
        <WAGhostButton
          icon={<SetIcon name="arrowR" size={16} stroke={SET.inkSoft} sw={2} />}
          onClick={() => generateCode.mutate()}
          disabled={generateCode.isPending}
        >
          {generateCode.isPending
            ? t('integrations.whatsapp.generating')
            : t('integrations.whatsapp.regenerateCode')}
        </WAGhostButton>
      </div>
    )
  }

  // — unlinked (défaut) —
  return (
    <div style={{ display: 'grid', gap: 'var(--crm-space-4xl)' }}>
      <WAHeader t={t} />
      <p
        style={{
          margin: 0,
          fontSize: 'var(--crm-text-xl)',
          fontWeight: 500,
          color: SET.inkSoft,
          lineHeight: 1.55,
          maxWidth: 420,
        }}
      >
        <Trans
          i18nKey="integrations.whatsapp.unlinked.body"
          t={t}
          values={{ number: MEGGA_WA_NUMBER }}
          components={{ strong: <strong style={{ color: SET.ink }} /> }}
        />
      </p>
      <WAGhostButton
        icon={<WAGlyphSolid size={18} />}
        onClick={() => generateCode.mutate()}
        disabled={generateCode.isPending}
      >
        {generateCode.isPending
          ? t('integrations.whatsapp.generating')
          : t('integrations.whatsapp.generateCode')}
      </WAGhostButton>
    </div>
  )
}

// ── Bouton ghost (DS-conforme) ────────────────────────────────────────────
function WAGhostButton({
  children,
  onClick,
  disabled,
  icon,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  icon?: ReactNode
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--crm-space-md)',
        width: 'fit-content',
        minHeight: 46,
        padding: '0 var(--crm-space-4xl)',
        borderRadius: 'var(--crm-radius-lg)',
        border: 0,
        background: hover && !disabled ? SET.cardSubtle : 'transparent',
        boxShadow: `inset 0 0 0 1px ${SET.line}`,
        color: SET.inkSoft,
        fontFamily: 'inherit',
        fontSize: 'var(--crm-text-xl)',
        fontWeight: 600,
        letterSpacing: -0.1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'all .16s ease',
      }}
    >
      {icon}
      {children}
    </button>
  )
}

// ── Carte ─────────────────────────────────────────────────────────────────
interface WhatsAppPairingCardProps {
  /** Rend le corps sans la carte extérieure (pour l'embarquer dans une modale Sugar). */
  bare?: boolean
}

export function WhatsAppPairingCard({ bare = false }: WhatsAppPairingCardProps) {
  if (bare) return <WABody />
  return (
    <div
      style={{
        boxSizing: 'border-box',
        background: SET.card,
        borderRadius: 'var(--crm-radius-5xl)',
        padding: 'var(--crm-space-7xl)',
        boxShadow: SET.shadow,
        fontFamily: 'inherit',
      }}
    >
      <WABody />
    </div>
  )
}
