/**
 * Écran KYC mobile (crm-mobile, P9) — liste des dossiers de conformité.
 * Câblage, filtres et comportement des deep-links : voir la docstring de
 * `MobileKycListScreen` ci-dessous.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useKycDossiers, type KycDossierRow } from '@/hooks/useKycDossier'
import type { KycDossierStatus } from '@/types/kyc'
import type { KycRiskLevel } from '@/lib/constants'
import { MOBILE_FONT, type MobileTokens } from '../tokens'
import { useMobileTokens } from '../useMobileTokens'
import { avatarColor } from '../contacts/detailShared'

type KycRow = Pick<KycDossierRow, 'id' | 'dossier_status' | 'risk_level' | 'checks_total' | 'checks_completed' | 'contact'>
type FilterKey = 'all' | 'pending' | 'none' | 'verified' | 'risk'
const FILTERS: FilterKey[] = ['all', 'pending', 'none', 'verified', 'risk']

// ─── Démo (harnais /dev/mobile) — gated, jamais de fetch/nav ──────────────
// NB : le littéral `dossier_status: 'verified'` déclencherait le guard « règle d'or »
// (tests/unit/kyc-verified-source-guard) qui interdit cette ÉCRITURE hors du trigger DB
// auto_verify_kyc_dossier. Ici c'est une fixture démo en LECTURE seule, pas une écriture
// → on passe par une constante typée pour éviter le faux positif sans affaiblir le guard.
const ST_VERIFIED: KycDossierStatus = 'verified'
const DEMO: KycRow[] = [
  { id: 'k1', contact: { id: 'c1', first_name: 'Marie', last_name: 'Bertrand', type: 'buyer' }, dossier_status: ST_VERIFIED, risk_level: 'low', checks_total: 5, checks_completed: 5 },
  { id: 'k2', contact: { id: 'c2', first_name: 'Jean-Marc', last_name: 'Aebischer', type: 'seller' }, dossier_status: 'pending', risk_level: 'medium', checks_total: 5, checks_completed: 3 },
  { id: 'k3', contact: { id: 'c3', first_name: 'Nadia', last_name: 'Berset', type: 'buyer' }, dossier_status: 'none', risk_level: 'high', checks_total: 5, checks_completed: 0 },
]

/** Mappe un niveau de risque KYC sur une teinte de token (pastille de la ligne). */
function riskTone(level: KycRiskLevel, tk: MobileTokens): string {
  // Informatif, jamais alarmant (rouge proscrit pour le KYC, CLAUDE.md).
  if (level === 'low') return tk.goal
  if (level === 'medium' || level === 'high') return tk.riskFg
  return tk.muted
}

/**
 * KYC mobile (P9) — liste des dossiers, read-focused v1. Câblé `useKycDossiers`
 * (RÉEL, RLS agence). Filtres tous/en cours/à démarrer/vérifiés/risque, gauge de
 * progression (contrôles), statut + risque NON-bloquants (jamais rouge/alarmant).
 * Tap → détail du dossier (`/dashboard/kyc/:id` : 4 onglets, marquage avec garde
 * LBA art.9, read-log nLPD). Deep-link `?openContactId` → fiche contact (bloc KYC
 * inline). `demo` alimente le harnais sans Supabase.
 */
export function MobileKycListScreen({ demo = false }: { demo?: boolean }) {
  const navigate = useNavigate()
  const { t } = useTranslation('kyc')
  const { tk } = useMobileTokens()
  const live = !demo
  const [params] = useSearchParams()
  const openContactId = params.get('openContactId')

  // Deep-link contact → KYC : sur mobile, on ouvre la fiche contact (qui porte
  // le bloc KYC inline). On ne reste pas sur la liste.
  useEffect(() => {
    if (live && openContactId) navigate(`/dashboard/contacts/${openContactId}`, { replace: true })
  }, [live, openContactId, navigate])

  const { data: liveDossiers = [], isLoading, isError, refetch } = useKycDossiers(undefined, { enabled: live })
  const dossiers: KycRow[] = demo ? DEMO : liveDossiers
  const [filter, setFilter] = useState<FilterKey>('all')

  // Base commune : on ignore les lignes sans contact joignable (RLS / orphelin)
  // pour que les compteurs des filtres correspondent aux lignes affichées.
  const visible = useMemo(() => dossiers.filter((d) => d.contact != null), [dossiers])

  const counts = useMemo(() => ({
    all: visible.length,
    pending: visible.filter((d) => d.dossier_status === 'pending').length,
    none: visible.filter((d) => d.dossier_status === 'none').length,
    verified: visible.filter((d) => d.dossier_status === 'verified').length,
    risk: visible.filter((d) => d.risk_level === 'high').length,
  }), [visible])

  const filtered = useMemo(() => visible.filter((d) => {
    if (filter === 'all') return true
    if (filter === 'verified') return d.dossier_status === 'verified'
    if (filter === 'pending') return d.dossier_status === 'pending'
    if (filter === 'none') return (d.dossier_status as KycDossierStatus) === 'none'
    if (filter === 'risk') return d.risk_level === 'high'
    return true
  }), [visible, filter])

  const filterKey: Record<FilterKey, string> = {
    all: 'list.filters.all', pending: 'list.filters.pending', none: 'list.filters.none', verified: 'list.filters.verified', risk: 'list.filters.highRisk',
  }

  return (
    <div style={{ fontFamily: MOBILE_FONT, color: tk.ink }}>
      <header style={{ display: 'flex', alignItems: 'center', padding: 'calc(env(safe-area-inset-top) + 14px) 18px 4px' }}>
        <button type="button" onClick={() => { if (live) navigate('/dashboard/more') }} aria-label={t('mobile.back', { defaultValue: 'Plus' })} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 38, padding: '0 var(--crm-space-2xl) 0 var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${tk.cardBorder}`, cursor: 'pointer', background: tk.card, boxShadow: tk.shadowSm, fontFamily: 'inherit' }}>
          <MEIcon name="chevron-left" size={18} color={tk.ink} strokeWidth={2.2} />
          <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.ink }}>{t('mobile.back', { defaultValue: 'Plus' })}</span>
        </button>
      </header>

      <div style={{ padding: 'var(--crm-space-xs) var(--crm-space-4xl) 0' }}>
        <h1 style={{ margin: '4px 0 0', fontSize: 'var(--crm-text-6xl)', fontWeight: 500, letterSpacing: -1, color: tk.ink, lineHeight: 1.05 }}>{t('title')}</h1>
        <p style={{ margin: '8px 0 0', fontSize: 'var(--crm-text-md)', fontWeight: 500, color: tk.muted, lineHeight: 1.5 }}>{t('list.intro')}</p>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 'var(--crm-space-md)', overflowX: 'auto', margin: '14px 0 0', padding: 'var(--crm-space-2xs) var(--crm-space-4xl) var(--crm-space-xs)', scrollbarWidth: 'none' }}>
        {FILTERS.map((f) => {
          const on = f === filter
          return (
            <button key={f} type="button" onClick={() => setFilter(f)} style={{ flexShrink: 0, height: 34, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, letterSpacing: -0.2, background: on ? tk.accent : tk.card, color: on ? tk.accentInk : tk.inkSoft, boxShadow: on ? tk.shadow : tk.shadowSm, whiteSpace: 'nowrap' }}>
              {t(filterKey[f], { count: counts[f] })}
            </button>
          )
        })}
      </div>

      <div style={{ padding: 'var(--crm-space-3xl) var(--crm-space-4xl) 0' }}>
        {live && isLoading && dossiers.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)' }}>
            {[0, 1, 2, 3].map((i) => <div key={i} style={{ height: 80, borderRadius: 'var(--crm-radius-4xl)', background: tk.cardSubtle, boxShadow: tk.shadowSm }} />)}
          </div>
        ) : live && isError && dossiers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '44px 24px', background: tk.card, borderRadius: 'var(--crm-radius-4xl)', boxShadow: tk.shadowSm, border: `1px solid ${tk.cardBorder}` }}>
            <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: tk.ink }}>{t('list.errorTitle')}</div>
            <button type="button" onClick={() => refetch()} style={{ marginTop: 16, height: 44, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, background: tk.accent, color: tk.accentInk }}>{t('list.retry')}</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: tk.card, borderRadius: 'var(--crm-radius-4xl)', boxShadow: tk.shadowSm, border: `1px solid ${tk.cardBorder}` }}>
            <div style={{ width: 52, height: 52, borderRadius: 'var(--crm-radius-pill)', background: tk.cardSubtle, display: 'grid', placeItems: 'center', margin: '0 auto' }}>
              <MEIcon name="shield" size={24} color={tk.muted} strokeWidth={1.8} />
            </div>
            <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: tk.muted, marginTop: 14, maxWidth: 260, marginInline: 'auto', lineHeight: 1.45 }}>{t('list.emptyFilter')}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)' }}>
            {filtered.map((d) => <Row key={d.id} d={d} t={t} tk={tk} onOpen={() => { if (live) navigate(`/dashboard/kyc/${d.id}`) }} />)}
          </div>
        )}
      </div>
    </div>
  )
}

/** Anneau de progression des contrôles KYC (done/total) ; teinte « objectif » si vérifié. */
function Ring({ done, total, verified, tk }: { done: number; total: number; verified: boolean; tk: MobileTokens }) {
  const size = 50, stroke = 5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = total > 0 ? Math.max(0, Math.min(1, done / total)) : 0
  const col = verified ? tk.goal : tk.inkSoft
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={tk.hair} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={col} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.22,1,.36,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3 }}>{done}/{total}</div>
    </div>
  )
}

/** Ligne dossier : avatar, identité, statut + risque (non-bloquants) et anneau. Tap → détail. */
function Row({ d, t, tk, onOpen }: { d: KycRow; t: TFunction; tk: MobileTokens; onOpen: () => void }) {
  const c = d.contact!
  const initials = `${(c.first_name || ' ')[0]}${(c.last_name || ' ')[0]}`.toUpperCase()
  const verified = d.dossier_status === 'verified'
  const status = (d.dossier_status ?? 'none') as KycDossierStatus
  return (
    <button type="button" onClick={onOpen} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)', padding: 'var(--crm-space-3xl)', background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 'var(--crm-radius-4xl)', cursor: 'pointer', boxShadow: tk.shadowSm, fontFamily: 'inherit' }}>
      <span style={{ width: 48, height: 48, borderRadius: 'var(--crm-radius-pill)', flexShrink: 0, background: avatarColor(c.id), color: '#fff', display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-2xl)', fontWeight: 600, letterSpacing: -0.3 }}>{initials}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: tk.ink, letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.first_name} {c.last_name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginTop: 4 }}>
          <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: verified ? tk.goal : tk.muted, letterSpacing: -0.1 }}>{t(`dossierStatus.${status}`)}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted }}>
            <span style={{ width: 5, height: 5, borderRadius: 'var(--crm-radius-pill)', background: riskTone(d.risk_level, tk) }} />{t(`riskBadge.${d.risk_level}`)}
          </span>
        </div>
      </div>
      <Ring done={d.checks_completed} total={d.checks_total} verified={verified} tk={tk} />
    </button>
  )
}
