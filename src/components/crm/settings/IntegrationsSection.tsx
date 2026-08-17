// MEGGA CRM Sugar v2 — Settings Integrations section (Tier 3.k)
// Re-skin Sugar Pure de `crm-screen-settings-step3.jsx` (SettingsIntegrationsSection
// + IntegrationCard). Câblage RÉEL :
//   - Google      → useGoogleCalendar  (table google_calendar_tokens + Edge Function
//                   google-calendar-sync). Connecter = vrai OAuth signInWithOAuth.
//   - Microsoft   → useOutlookCalendar (miroir, provider azure).
//   - WhatsApp    → useWhatsAppPairing  (table whatsapp_agent_links + RPC). La carte
//                   ouvre une modale Sugar contenant le WhatsAppPairingCard (état réel).
//   - Skribble    → useEsignSignature (edge sign-document, table esign_provider_
//                   connections, cle chiffree dans Vault). Connecter = modale
//                   EsignConnectModal (cle API validee par login live). QES/AES CH.
//   - DocuSign    → carte RETIREE (2 juil.) : sans valeur ajoutee pour le marche
//                   suisse (Skribble = QES ZertES). Le gateway backend est conserve
//                   (esign-gateway.ts) pour une future activation US en BYO OAuth.
//
// Catalogue limité aux 4 services décidés avec le client. Les anciennes cartes mock
// (IAZI, RealAdvisor, SIX, Onfido, Veriff, Zapier) et le bandeau de fausses stats
// (« 12.3k synchronisations ») ont été retirés — aucune donnée mockée affichée comme réelle.

import { crmVoileEncre } from '@/components/crm/tokens'
import { useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { SectionHeader, SetGhostBtn, SetIcon, Toast } from './atoms'
import { SET_PALETTE } from './data'
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar'
import { useOutlookCalendar } from '@/hooks/useOutlookCalendar'
import { useWhatsAppPairing } from '@/hooks/useWhatsAppPairing'
import { WhatsAppPairingCard } from './WhatsAppPairingCard'
import { useEsignSignature } from '@/hooks/useEsignSignature'
import { EsignConnectModal } from './EsignConnectModal'
import { openHelpFor } from '@/lib/help-articles'

const SET = SET_PALETTE

// ─── Logos officiels (tuiles blanches de marque) ──────────────────────────
function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

function MsLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  )
}

// Skribble — paraphe orange souligné (officiel).
function SkribbleLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size * 1.6} height={size * 0.9} viewBox="0 0 54 30" fill="none">
      <defs>
        <linearGradient id="skribbleGrad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" />
          <stop stopColor="#D8D8D8" stopOpacity="0" offset="100%" />
        </linearGradient>
      </defs>
      <path
        fill="#FF531A"
        fillRule="nonzero"
        d="M.454 29.609h44.188v-4.534H.454zM35.527 14.189l-7.993-8.32-7.828 8.203-7.95-8.198L0 18.02l3.98 4.132 7.775-8.23 7.951 8.216v.014l7.832-8.24 7.994 8.216v.024l18.38-17.978L49.977 0z"
      />
      <path
        fill="url(#skribbleGrad)"
        opacity=".3"
        d="M11.712 13.864l-7.77 8.189L0 17.922 7.815 9.85zM27.553 13.88l-7.846 8.205-3.825-4.022 7.859-8.212z"
      />
    </svg>
  )
}

// WhatsApp — combiné officiel blanc sur fond vert.
function WhatsAppLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="40 40 214 214" fill="none">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="#FFFFFF"
        d="M223.777,70.979c-19.623-19.646-45.719-30.47-73.522-30.482c-57.288,0-103.914,46.623-103.937,103.929c-0.007,18.318,4.778,36.198,13.874,51.961l-14.745,53.858l55.098-14.453c15.181,8.28,32.273,12.645,49.668,12.651h0.043c57.282,0,103.912-46.629,103.936-103.936C254.202,116.737,243.4,90.624,223.777,70.979z M150.256,230.89h-0.035c-15.501-0.006-30.705-4.171-43.968-12.042l-3.155-1.871l-32.696,8.576l8.727-31.878l-2.054-3.27c-8.647-13.753-13.215-29.65-13.208-45.974c0.019-47.63,38.772-86.38,86.424-86.38c23.073,0.008,44.764,9.005,61.074,25.335c16.31,16.329,25.286,38.033,25.277,61.116C236.623,192.136,197.87,230.89,150.256,230.89z M197.641,166.189c-2.597-1.299-15.364-7.582-17.745-8.449c-2.38-0.865-4.112-1.299-5.843,1.301c-1.731,2.6-6.709,8.449-8.224,10.183c-1.515,1.732-3.03,1.95-5.626,0.649c-2.598-1.299-10.965-4.042-20.885-12.89c-7.72-6.886-12.932-15.39-14.447-17.991c-1.515-2.6-0.162-4.005,1.139-5.3c1.168-1.164,2.597-3.034,3.896-4.55s1.731-2.6,2.597-4.333s0.433-3.25-0.217-4.549c-0.649-1.301-5.843-14.084-8.007-19.284c-2.108-5.063-4.249-4.378-5.843-4.458c-1.513-0.075-3.246-0.092-4.978-0.092c-1.731,0-4.544,0.65-6.925,3.25c-2.38,2.6-9.089,8.883-9.089,21.666c0,12.783,9.305,25.131,10.604,26.865c1.298,1.733,18.313,27.964,44.364,39.214c6.195,2.676,11.033,4.273,14.805,5.471c6.222,1.977,11.883,1.697,16.357,1.029c4.99-0.746,15.365-6.283,17.529-12.349c2.164-6.067,2.164-11.267,1.515-12.35C201.969,168.14,200.238,167.49,197.641,166.189z"
      />
    </svg>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────
type ProviderId = 'google' | 'microsoft' | 'skribble' | 'whatsapp'
// Catégorie = clé canonique (sert de discriminant de filtre) ; le libellé visible
// est résolu via i18n (catLabel).
type Category = 'productivity' | 'signature' | 'messaging'

interface Integration {
  id: string
  category: Category
  provider: ProviderId
  /** Nom de marque (proper noun) — non traduit. */
  name: string
  /** Clé i18n de la description. */
  descKey: string
  logoBg: string
  logo: ReactNode
  /** true uniquement si un wire OAuth/pairing réel existe (Google / Microsoft / WhatsApp). */
  connectable: boolean
  /** Providers sans backend (DocuSign / Skribble) : état honnête « Sur demande ». */
  onRequest?: boolean
  connected: boolean
  account?: string
}

// Libellé i18n d'une catégorie (la valeur reste la clé canonique pour le filtre).
function catLabel(t: TFunction, c: Category): string {
  return t(`integrations.categories.${c}`)
}

// Catalogue figé (5 services). connected/account sont surchargés depuis les hooks
// réels au render pour Google / Microsoft / WhatsApp.
const CATALOGUE: Integration[] = [
  {
    id: 'google',
    category: 'productivity',
    provider: 'google',
    name: 'Google',
    descKey: 'integrations.catalogue.google.desc',
    logoBg: '#FFFFFF',
    logo: <GoogleG size={22} />,
    connectable: true,
    connected: false,
  },
  {
    id: 'microsoft',
    category: 'productivity',
    provider: 'microsoft',
    name: 'Microsoft 365',
    descKey: 'integrations.catalogue.microsoft.desc',
    logoBg: '#FFFFFF',
    logo: <MsLogo size={22} />,
    connectable: true,
    connected: false,
  },
  {
    id: 'skribble',
    category: 'signature',
    provider: 'skribble',
    name: 'Skribble',
    descKey: 'integrations.catalogue.skribble.desc',
    logoBg: '#FFFFFF',
    logo: <SkribbleLogo size={22} />,
    connectable: false,
    onRequest: true,
    connected: false,
  },
  {
    id: 'whatsapp',
    category: 'messaging',
    provider: 'whatsapp',
    name: 'WhatsApp Business',
    descKey: 'integrations.catalogue.whatsapp.desc',
    logoBg: '#25D366',
    logo: <WhatsAppLogo size={22} />,
    connectable: true,
    connected: false,
  },
]

// ─── IntegrationLogo (tuile blanche de marque) ────────────────────────────
function IntegrationLogo({ item, size = 44 }: { item: Integration; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: item.logoBg,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        boxShadow: `0 4px 12px ${crmVoileEncre(false, 0.10)}, inset 0 0 0 1px rgba(0,0,0,0.04)`,
      }}
    >
      {item.logo}
    </div>
  )
}

// ─── StatusPill ───────────────────────────────────────────────────────────
function StatusPill({ item, t }: { item: Integration; t: TFunction }) {
  if (item.connected) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--crm-space-sm)',
          height: 24,
          padding: '0 var(--crm-space-lg)',
          borderRadius: 'var(--crm-radius-pill)',
          background: SET.ok,
          color: '#FFFFFF',
          fontSize: 'var(--crm-text-sm)',
          fontWeight: 500,
          letterSpacing: -0.05,
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: 'var(--crm-radius-pill)', background: '#FFFFFF' }} />
        {t('integrations.status.connected')}
      </span>
    )
  }
  if (item.onRequest) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--crm-space-sm)',
          height: 24,
          padding: '0 var(--crm-space-lg)',
          borderRadius: 'var(--crm-radius-pill)',
          background: SET.cardSubtle,
          color: SET.muted,
          fontSize: 'var(--crm-text-sm)',
          fontWeight: 500,
          letterSpacing: -0.05,
        }}
      >
        <SetIcon name="clock" size={10} stroke={SET.muted} sw={2.2} />
        {t('integrations.status.onRequest')}
      </span>
    )
  }
  return null
}

// ─── IntegrationCard ──────────────────────────────────────────────────────
interface IntegrationCardProps {
  item: Integration
  onClick: () => void
  onConnect: () => void
  onDisconnect: () => void
  connecting: boolean
  t: TFunction
}

function IntegrationCard({ item, onClick, onConnect, onDisconnect, connecting, t }: IntegrationCardProps) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: SET.card,
        borderRadius: 'var(--crm-radius-4xl)',
        padding: 'var(--crm-space-6xl)',
        boxShadow: hover ? SET.shadowHover : SET.shadow,
        cursor: 'pointer',
        transition: 'all .2s ease',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--crm-space-2xl)',
        minHeight: 184,
        position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <StatusPill item={item} t={t} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)' }}>
        <IntegrationLogo item={item} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 'var(--crm-text-lg)',
              fontWeight: 400,
              color: SET.muted,
            }}
          >
            {catLabel(t, item.category)}
          </div>
          <div
            style={{
              fontSize: 'var(--crm-text-2xl)',
              fontWeight: 500,
              color: SET.ink,
              letterSpacing: -0.2,
              marginTop: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.name}
          </div>
        </div>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 'var(--crm-text-lg)',
          color: SET.inkSoft,
          fontWeight: 500,
          lineHeight: 1.55,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {t(item.descKey)}
      </p>

      <div style={{ flex: 1 }} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--crm-space-lg)',
          paddingTop: 'var(--crm-space-xl)',
          borderTop: `1px solid ${SET.line}`,
        }}
      >
        {item.connected ? (
          <>
            <div style={{ minWidth: 0, marginRight: 10 }}>
              <div
                style={{
                  fontSize: 'var(--crm-text-md)',
                  color: SET.ink,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.account || t('integrations.card.linkedAccount')}
              </div>
              <div style={{ fontSize: 'var(--crm-text-sm)', color: SET.muted, fontWeight: 500 }}>{t('integrations.card.synced')}</div>
            </div>
            <button
              onClick={e => {
                e.stopPropagation()
                onDisconnect()
              }}
              style={{
                height: 32,
                padding: '0 var(--crm-space-2xl)',
                borderRadius: 'var(--crm-radius-pill)',
                border: 0,
                background: SET.cardSubtle,
                color: SET.err,
                fontFamily: 'inherit',
                fontSize: 'var(--crm-text-md)',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {t('integrations.actions.disconnect')}
            </button>
          </>
        ) : item.onRequest ? (
          // État HONNÊTE pour DocuSign / Skribble : aucun backend, pas de faux OAuth.
          <>
            <span style={{ fontSize: 'var(--crm-text-sm)', color: SET.muted, fontWeight: 500, lineHeight: 1.4, maxWidth: 150 }}>
              {t('integrations.card.assistedActivation')}
            </span>
            <button
              onClick={e => e.stopPropagation()}
              style={{
                height: 32,
                padding: '0 var(--crm-space-2xl)',
                borderRadius: 'var(--crm-radius-pill)',
                border: 0,
                background: SET.cardSubtle,
                color: SET.inkSoft,
                fontFamily: 'inherit',
                fontSize: 'var(--crm-text-md)',
                fontWeight: 600,
                cursor: 'default',
                whiteSpace: 'nowrap',
              }}
            >
              {t('integrations.status.onRequest')}
            </button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 'var(--crm-text-md)', color: SET.muted, fontWeight: 500 }}>{t('integrations.status.notConnected')}</span>
            <button
              onClick={e => {
                e.stopPropagation()
                onConnect()
              }}
              disabled={connecting}
              style={{
                height: 32,
                padding: '0 var(--crm-space-2xl)',
                borderRadius: 'var(--crm-radius-pill)',
                border: 0,
                background: SET.black,
                color: SET.blackInk,
                fontFamily: 'inherit',
                fontSize: 'var(--crm-text-md)',
                fontWeight: 500,
                cursor: connecting ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--crm-space-sm)',
                whiteSpace: 'nowrap',
                opacity: connecting ? 0.7 : 1,
              }}
            >
              {connecting ? (
                <>
                  <span
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: 'var(--crm-radius-pill)',
                      border: `2px solid ${SET.blackInk}4d`,
                      borderTopColor: SET.blackInk,
                      animation: 'setSpin .7s linear infinite',
                    }}
                  />
                  {t('integrations.actions.connecting')}
                </>
              ) : (
                <>
                  <SetIcon name="link" size={11} stroke={SET.blackInk} sw={2.4} />
                  {t('integrations.actions.connect')}
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Modale détails ───────────────────────────────────────────────────────
// ─── Volet « Synchronisation calendrier » (Google / Outlook connecté) ──────
// Sens (Import/Export/Bidirectionnel) + sous-agendas (MEGGA éditable · Perso
// « Occupé » lecture seule · Jours fériés). Préférences persistées localement ;
// le backend applique aujourd'hui la synchro bidirectionnelle par défaut.
interface CalSyncPrefs { direction: 'in' | 'out' | 'two'; megga: boolean; perso: boolean; holidays: boolean }
const CAL_SYNC_DEFAULT: CalSyncPrefs = { direction: 'two', megga: true, perso: true, holidays: false }

function CalSyncSwitch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: 38, height: 22, borderRadius: 'var(--crm-radius-pill)', border: 0, background: on ? SET.black : '#D1D5DB', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: 'var(--crm-radius-pill)', background: on ? SET.blackInk : '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  )
}

function CalSyncRow({ label, meta, on, onToggle, last }: { label: string; meta: string; on: boolean; onToggle: () => void; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-xl) var(--crm-space-2xl)', borderBottom: last ? 'none' : `1px solid ${SET.line}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--crm-text-lg)', color: SET.ink, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 'var(--crm-text-sm)', color: SET.muted, fontWeight: 500, marginTop: 1 }}>{meta}</div>
      </div>
      <CalSyncSwitch on={on} onClick={onToggle} />
    </div>
  )
}

function CalendarSyncPanel({ provider, t }: { provider: 'google' | 'microsoft'; t: TFunction }) {
  const storageKey = `megga.calendar.sync.${provider}`
  const [sync, setSync] = useState<CalSyncPrefs>(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null
      if (raw) return { ...CAL_SYNC_DEFAULT, ...(JSON.parse(raw) as Partial<CalSyncPrefs>) }
    } catch { /* défaut */ }
    return CAL_SYNC_DEFAULT
  })
  const patch = (p: Partial<CalSyncPrefs>) =>
    setSync(prev => {
      const next = { ...prev, ...p }
      try { window.localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })

  const DIRS: { k: CalSyncPrefs['direction']; l: string }[] = [
    { k: 'in', l: t('integrations.calSync.import') },
    { k: 'out', l: t('integrations.calSync.export') },
    { k: 'two', l: t('integrations.calSync.both') },
  ]
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 400, color: SET.muted, marginBottom: 10 }}>
        {t('integrations.calSync.title')}
      </div>
      <div style={{ display: 'flex', gap: 'var(--crm-space-xs)', background: SET.cardSubtle, borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-xs)', marginBottom: 12 }}>
        {DIRS.map(dir => {
          const on = sync.direction === dir.k
          return (
            <button key={dir.k} onClick={() => patch({ direction: dir.k })} style={{ flex: 1, height: 34, borderRadius: 'var(--crm-radius-sm)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 500, background: on ? SET.black : 'transparent', color: on ? SET.blackInk : SET.muted, transition: 'background .15s' }}>
              {dir.l}
            </button>
          )
        })}
      </div>
      <div style={{ background: SET.cardSubtle, borderRadius: 'var(--crm-radius-xl)', overflow: 'hidden' }}>
        <CalSyncRow label={t('integrations.calSync.meggaRow')} meta={t('integrations.calSync.meggaMeta')} on={sync.megga} onToggle={() => patch({ megga: !sync.megga })} />
        <CalSyncRow label={t('integrations.calSync.persoRow')} meta={t('integrations.calSync.persoMeta')} on={sync.perso} onToggle={() => patch({ perso: !sync.perso })} />
        <CalSyncRow label={t('integrations.calSync.holidaysRow')} meta={t('integrations.calSync.holidaysMeta')} on={sync.holidays} onToggle={() => patch({ holidays: !sync.holidays })} last />
      </div>
      <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', alignItems: 'flex-start', marginTop: 12, background: SET.cardSubtle, borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-lg) var(--crm-space-xl)' }}>
        <SetIcon name="lock" size={15} stroke={SET.muted} />
        <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: SET.inkSoft, lineHeight: 1.5 }}>{t('integrations.calSync.lbaNote')}</div>
      </div>
    </div>
  )
}

function DetailsModal({
  item,
  onClose,
  onConnect,
  onDisconnect,
  onPair,
  t,
}: {
  item: Integration
  onClose: () => void
  onConnect: () => void
  onDisconnect: () => void
  onPair: () => void
  t: TFunction
}) {
  const permKey =
    item.provider === 'google'
      ? 'integrations.details.permissions.google'
      : item.provider === 'microsoft'
        ? 'integrations.details.permissions.microsoft'
        : item.provider === 'whatsapp'
          ? 'integrations.details.permissions.whatsapp'
          : 'integrations.details.permissions.signature'
  const permissions = t(permKey, { returnObjects: true }) as string[]

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: crmVoileEncre(false, 0.40),
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        animation: 'setFadeIn .2s ease both',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: SET.card,
          borderRadius: 'var(--crm-radius-5xl)',
          padding: 32,
          maxWidth: 540,
          width: '92%',
          boxShadow: `0 40px 80px ${crmVoileEncre(false, 0.30)}`,
          animation: 'setScaleIn .25s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3xl)', marginBottom: 22 }}>
          <IntegrationLogo item={item} size={56} />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 'var(--crm-text-lg)',
                fontWeight: 400,
                color: SET.muted,
              }}
            >
              {catLabel(t, item.category)}
            </div>
            <h3
              style={{
                margin: '2px 0 0',
                fontSize: 'var(--crm-text-4xl)',
                fontWeight: 500,
                color: SET.ink,
                letterSpacing: -0.4,
              }}
            >
              {item.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--crm-radius-pill)',
              border: 0,
              background: SET.cardSubtle,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              color: SET.ink,
            }}
          >
            <SetIcon name="x" size={16} stroke={SET.ink} />
          </button>
        </div>

        <p style={{ margin: '0 0 22px', fontSize: 'var(--crm-text-xl)', color: SET.inkSoft, lineHeight: 1.55 }}>
          {t(item.descKey)}
        </p>

        {item.connected ? (
          <div style={{ padding: 'var(--crm-space-2xl) var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-xl)', background: SET.cardSubtle, marginBottom: 18 }}>
            <div
              style={{
                fontSize: 'var(--crm-text-lg)',
                fontWeight: 400,
                color: SET.muted,
                marginBottom: 8,
              }}
            >
              {t('integrations.details.activeConnection')}
            </div>
            <div style={{ fontSize: 'var(--crm-text-lg)', color: SET.ink, fontWeight: 600 }}>
              {item.account || t('integrations.card.linkedAccount')}
            </div>
          </div>
        ) : item.onRequest ? (
          // Hint honnête : intégration disponible mais activée manuellement par MEGGA.
          <div
            style={{
              padding: 'var(--crm-space-2xl) var(--crm-space-3xl)',
              borderRadius: 'var(--crm-radius-xl)',
              background: SET.cardSubtle,
              marginBottom: 18,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--crm-space-lg)',
            }}
          >
            <SetIcon name="info" size={16} stroke={SET.muted} />
            <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: SET.inkSoft, lineHeight: 1.5 }}>
              {t('integrations.details.onRequestHint')}
            </span>
          </div>
        ) : null}

        {item.connected && (item.provider === 'google' || item.provider === 'microsoft') && (
          <CalendarSyncPanel provider={item.provider} t={t} />
        )}

        <div
          style={{
            fontSize: 'var(--crm-text-lg)',
            fontWeight: 400,
            color: SET.muted,
            marginBottom: 10,
          }}
        >
          {item.provider === 'whatsapp'
            ? t('integrations.details.whatYouCanDo')
            : t('integrations.details.permissionsGranted')}
        </div>
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--crm-space-sm)',
            marginBottom: 22,
          }}
        >
          {permissions.map((p, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--crm-space-md)',
                fontSize: 'var(--crm-text-lg)',
                color: SET.inkSoft,
                fontWeight: 500,
              }}
            >
              <SetIcon name="check" size={14} stroke={SET.ok} sw={2.4} />
              {p}
            </li>
          ))}
        </ul>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--crm-space-lg)' }}>
          <SetGhostBtn icon={<SetIcon name="external" size={13} />} onClick={() => {}}>
            {t('integrations.details.documentation')}
          </SetGhostBtn>
          {item.connected ? (
            <button
              onClick={() => {
                onClose()
                onDisconnect()
              }}
              style={{
                height: 44,
                padding: '0 var(--crm-space-6xl)',
                borderRadius: 'var(--crm-radius-pill)',
                border: 0,
                background: SET.cardSubtle,
                color: SET.err,
                fontFamily: 'inherit',
                fontSize: 'var(--crm-text-lg)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('integrations.actions.disconnect')}
            </button>
          ) : item.onRequest ? (
            <button
              disabled
              style={{
                height: 44,
                padding: '0 var(--crm-space-6xl)',
                borderRadius: 'var(--crm-radius-pill)',
                border: 0,
                background: SET.cardSubtle,
                color: SET.muted,
                fontFamily: 'inherit',
                fontSize: 'var(--crm-text-lg)',
                fontWeight: 600,
                cursor: 'not-allowed',
              }}
            >
              {t('integrations.status.onRequest')}
            </button>
          ) : (
            <button
              onClick={() => {
                onClose()
                if (item.provider === 'whatsapp') onPair()
                else onConnect()
              }}
              style={{
                height: 44,
                padding: '0 var(--crm-space-6xl)',
                borderRadius: 'var(--crm-radius-pill)',
                border: 0,
                background: SET.black,
                color: SET.blackInk,
                fontFamily: 'inherit',
                fontSize: 'var(--crm-text-lg)',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: `0 6px 16px ${crmVoileEncre(false, 0.18)}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--crm-space-md)',
              }}
            >
              <SetIcon name="link" size={14} stroke={SET.blackInk} />
              {item.provider === 'whatsapp'
                ? t('integrations.actions.linkWhatsapp')
                : t('integrations.actions.connect')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── Modale liaison WhatsApp (embarque le WhatsAppPairingCard réel) ───────
function WhatsAppPairModal({ onClose, t }: { onClose: () => void; t: TFunction }) {
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: crmVoileEncre(false, 0.42),
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--crm-space-5xl)',
        animation: 'setFadeIn .2s ease both',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 528,
          maxWidth: '100%',
          background: SET.card,
          borderRadius: 'var(--crm-radius-5xl)',
          padding: 28,
          boxShadow: `0 40px 100px ${crmVoileEncre(false, 0.30)}`,
          maxHeight: '86vh',
          overflowY: 'auto',
          animation: 'setScaleIn .25s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--crm-space-xs)', marginBottom: 4 }}>
          {/* Seul point d'entrée de l'article « Piloter le CRM depuis WhatsApp ».
              La liaison WhatsApp vit dans une modale, pas dans un écran : elle n'a
              pas d'onglet, donc pas de clé d'aide déductible. Sans ce bouton,
              l'article restait publié et injoignable — comme il l'était depuis
              son écriture. */}
          <button
            onClick={() => openHelpFor('whatsapp')}
            aria-label={t('common:nav.helpCenter')}
            style={{
              width: 34,
              height: 34,
              borderRadius: 'var(--crm-radius-pill)',
              border: 0,
              background: SET.cardSubtle,
              color: SET.inkSoft,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <SetIcon name="help" size={15} stroke={SET.inkSoft} sw={2} />
          </button>
          <button
            onClick={onClose}
            aria-label={t('common:actions.close')}
            style={{
              width: 34,
              height: 34,
              borderRadius: 'var(--crm-radius-pill)',
              border: 0,
              background: SET.cardSubtle,
              color: SET.inkSoft,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <SetIcon name="x" size={14} stroke={SET.inkSoft} sw={2.4} />
          </button>
        </div>
        {/* Corps réel câblé à useWhatsAppPairing */}
        <WhatsAppPairingCard bare />
      </div>
    </div>,
    document.body,
  )
}

// ─── Section ──────────────────────────────────────────────────────────────
export function IntegrationsSection() {
  const { t } = useTranslation('settings')
  // État réel Google / Microsoft via les vrais hooks OAuth.
  const google = useGoogleCalendar()
  const outlook = useOutlookCalendar()
  // État réel WhatsApp (lecture seule ici : verified → carte « Connecté »).
  const { status: waStatus } = useWhatsAppPairing()
  const waLinked = !!waStatus.data?.verified
  // État réel Skribble (e-signature) via l'edge sign-document.
  const esign = useEsignSignature()

  const [filter, setFilter] = useState<string>('all')
  const [details, setDetails] = useState<Integration | null>(null)
  const [confirmDisc, setConfirmDisc] = useState<Integration | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [waPair, setWaPair] = useState(false)
  const [esignConnect, setEsignConnect] = useState(false)

  // Surcharge l'état connected/account depuis les hooks réels. DocuSign / Skribble
  // restent onRequest (pas de backend). Les autres restent connected:false.
  const items = useMemo<Integration[]>(
    () =>
      CATALOGUE.map(it => {
        if (it.id === 'google') {
          return { ...it, connected: google.isConnected, account: google.googleEmail ?? undefined }
        }
        if (it.id === 'microsoft') {
          return { ...it, connected: outlook.isConnected, account: outlook.outlookEmail ?? undefined }
        }
        if (it.id === 'whatsapp') {
          return {
            ...it,
            connected: waLinked,
            account: waLinked ? waStatus.data?.wa_number ?? t('integrations.whatsapp.linkedNumber') : undefined,
          }
        }
        // Skribble : connectable RÉEL (cle API -> edge sign-document). DocuSign
        // reste « Sur demande » (onboarding OAuth self-service = phase ulterieure).
        if (it.id === 'skribble') {
          const conn = esign.connections.find(
            (c) => c.provider === 'skribble' && c.status === 'connected',
          )
          return {
            ...it,
            connectable: true,
            onRequest: false,
            connected: !!conn,
            account: conn?.display_name ?? undefined,
          }
        }
        return it
      }),
    [
      google.isConnected,
      google.googleEmail,
      outlook.isConnected,
      outlook.outlookEmail,
      waLinked,
      waStatus.data?.wa_number,
      esign.connections,
      t,
    ],
  )

  const categories = ['all', ...Array.from(new Set(items.map(i => i.category)))]
  const visible = filter === 'all' ? items : items.filter(i => i.category === filter)
  const connected = items.filter(i => i.connected)

  // Connect : vrai OAuth Supabase (Google / Microsoft) — redirection vers la page
  // officielle du provider, retour sur /auth/callback. WhatsApp passe par la modale.
  const handleConnect = async (id: string) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    if (item.provider === 'google' || item.provider === 'microsoft') {
      // Succès = redirection hors de l'app ; on ne revient ici que sur échec
      // (« Manual linking » désactivé, identité déjà liée à un autre compte…).
      const { error } = item.provider === 'google'
        ? await google.connectGoogleCalendar()
        : await outlook.connectOutlookCalendar()
      if (error) {
        setToast(t('integrations.toast.connectFailed', { error }))
        setTimeout(() => setToast(null), 2400)
      }
      return
    }
    if (item.provider === 'whatsapp') setWaPair(true)
    else if (item.provider === 'skribble') setEsignConnect(true)
  }

  const disconnect = async (id: string) => {
    const item = items.find(i => i.id === id)
    setConfirmDisc(null)
    if (!item) return
    try {
      if (item.provider === 'google') await google.disconnectGoogleCalendar()
      else if (item.provider === 'microsoft') await outlook.disconnectOutlookCalendar()
      else if (item.provider === 'skribble') await esign.disconnect({ provider: 'skribble' })
      else return // pas de wire de déconnexion pour ce provider (WhatsApp unlink = chip future)
      setToast(t('integrations.toast.disconnected', { name: item.name }))
      setTimeout(() => setToast(null), 2400)
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('integrations.toast.unknownError')
      setToast(t('integrations.toast.disconnectFailed', { error: msg }))
      setTimeout(() => setToast(null), 2400)
    }
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--crm-space-5xl)',
          paddingBottom: 40,
          animation: 'setFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <SectionHeader
          kicker={t('integrations.header.kicker')}
          title={t('integrations.header.title')}
          sub={t('integrations.header.sub', { active: connected.length, total: items.length })}
        />

        {/* Filtre catégories (pilules + badge count) */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--crm-space-sm)',
            flexWrap: 'wrap',
            background: SET.card,
            borderRadius: 'var(--crm-radius-5xl)',
            padding: 'var(--crm-space-md)',
            boxShadow: SET.shadowSm,
          }}
        >
          {categories.map(c => {
            const active = filter === c
            return (
              <button
                key={c}
                onClick={() => setFilter(c)}
                style={{
                  height: 36,
                  padding: '0 var(--crm-space-3xl)',
                  borderRadius: 'var(--crm-radius-pill)',
                  border: 0,
                  background: active ? SET.black : 'transparent',
                  color: active ? SET.blackInk : SET.inkSoft,
                  fontFamily: 'inherit',
                  fontSize: 'var(--crm-text-md)',
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  letterSpacing: -0.05,
                  transition: 'all .15s',
                }}
                onMouseEnter={e => {
                  if (!active) e.currentTarget.style.background = SET.cardSubtle
                }}
                onMouseLeave={e => {
                  if (!active) e.currentTarget.style.background = 'transparent'
                }}
              >
                {c === 'all' ? t('integrations.filters.all') : catLabel(t, c as Category)}
                <span style={{ marginLeft: 7, fontSize: 'var(--crm-text-sm)', fontWeight: 500, opacity: 0.6 }}>
                  {c === 'all' ? items.length : items.filter(i => i.category === c).length}
                </span>
              </button>
            )
          })}
        </div>

        {/* Grille intégrations */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 'var(--crm-space-3xl)',
          }}
        >
          {visible.map(it => (
            <IntegrationCard
              key={it.id}
              item={it}
              onClick={() => setDetails(it)}
              onConnect={() => handleConnect(it.id)}
              onDisconnect={() => setConfirmDisc(it)}
              connecting={false}
              t={t}
            />
          ))}
        </div>
      </div>

      <Toast open={!!toast} label={toast || ''} />

      {details && (
        <DetailsModal
          item={details}
          onClose={() => setDetails(null)}
          onConnect={() => handleConnect(details.id)}
          onDisconnect={() => setConfirmDisc(details)}
          onPair={() => setWaPair(true)}
          t={t}
        />
      )}

      {waPair && <WhatsAppPairModal onClose={() => setWaPair(false)} t={t} />}

      {esignConnect && (
        <EsignConnectModal
          onClose={() => setEsignConnect(false)}
          onConnected={() => {
            setEsignConnect(false)
            setToast(t('integrations.toast.skribbleConnected'))
            setTimeout(() => setToast(null), 2400)
          }}
        />
      )}

      {/* Confirm déconnexion */}
      {confirmDisc &&
        createPortal(
          <div
            onClick={() => setConfirmDisc(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 200,
              background: crmVoileEncre(false, 0.40),
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'grid',
              placeItems: 'center',
              animation: 'setFadeIn .2s ease both',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: SET.card,
                borderRadius: 'var(--crm-radius-5xl)',
                padding: 32,
                maxWidth: 460,
                width: '90%',
                boxShadow: `0 40px 80px ${crmVoileEncre(false, 0.30)}`,
                animation: 'setScaleIn .25s cubic-bezier(.2,.8,.2,1) both',
              }}
            >
              <h3
                style={{
                  margin: '0 0 8px',
                  fontSize: 'var(--crm-text-4xl)',
                  fontWeight: 500,
                  color: SET.ink,
                  letterSpacing: -0.3,
                }}
              >
                {t('integrations.disconnectConfirm.title', { name: confirmDisc.name })}
              </h3>
              <p style={{ margin: '0 0 24px', fontSize: 'var(--crm-text-xl)', color: SET.inkSoft, lineHeight: 1.55 }}>
                {t('integrations.disconnectConfirm.body')}
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--crm-space-lg)' }}>
                <SetGhostBtn onClick={() => setConfirmDisc(null)}>{t('integrations.disconnectConfirm.keep')}</SetGhostBtn>
                <button
                  onClick={() => disconnect(confirmDisc.id)}
                  style={{
                    height: 44,
                    padding: '0 var(--crm-space-6xl)',
                    borderRadius: 'var(--crm-radius-pill)',
                    border: 0,
                    background: SET.err,
                    color: '#FFFFFF',
                    fontFamily: 'inherit',
                    fontSize: 'var(--crm-text-lg)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 6px 16px rgba(239,68,68,0.30)',
                  }}
                >
                  {t('integrations.actions.disconnect')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
