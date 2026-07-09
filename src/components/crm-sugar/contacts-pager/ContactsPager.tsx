// MEGGA CRM — Pager « Contacts » (refonte Claude Design, port fidèle).
// Un grand bento arrondi (viewport) qui glisse verticalement entre deux pages :
//   Page 0 → La liste (recherche, sous-nav audience, lignes)          [en haut]
//   Page 1 → Santé du portefeuille (agrégats + segments cliquables)   [en bas]
// Cliquer un segment de la Santé filtre la liste et remonte en page 0.
// Molette (accumulateur) / flèches + PageUp-Down / swipe / points latéraux.
// Réf. handoff : `crm-screen-contacts-proto.jsx` (CRMScreenContactsProto).
//
// Le chrome (SugarTopNav + SugarIconRail) est monté par la page conteneur
// (ContactsSugarV2Page) ; ce composant remplit le <main> avec le viewport.

import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import type { CrmContact } from '@/components/crm-sugar/mockData'
import type { SugarPalette } from '@/components/crm-sugar/tokens'
import { crmInitials } from '@/components/crm-sugar/tokens'

// ── Couleurs fonctionnelles (données métier — jamais accent UI) ─────────
const CTP_FN = { buyer: '#1E5BC6', seller: '#C45A00', tenant: '#0891B2', ok: '#059669' } as const
type Audience = 'buyer' | 'seller' | 'tenant'

// ── Dérivations depuis un CrmContact ────────────────────────────────────
function audienceOf(c: CrmContact): Audience {
  if (c.type === 'seller' || c.type === 'landlord') return 'seller'
  if (c.type === 'tenant' || c.criteria?.transaction === 'location') return 'tenant'
  return 'buyer'
}
function kycStatusOf(c: CrmContact): 'verified' | 'pending' | 'stale' | 'none' {
  const s = c.kyc?.status
  return s && s !== 'none' ? s : 'none'
}
const daysSince = (iso: string | undefined): number => {
  if (!iso) return 9999
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

// Budget compact « K / M » — donnée réelle des critères (remplace le score en liste).
const num1 = (n: number) => (Math.round(n * 10) / 10).toString()
const short = (n: number) =>
  n >= 1_000_000 ? num1(n / 1_000_000) + 'M' : n >= 1_000 ? num1(n / 1_000) + 'K' : String(n)
function budgetShort(c: CrmContact): string | null {
  const cr = c.criteria
  if (!cr) return null
  const isRent = cr.transaction === 'location'
  if (isRent) return cr.budgetMax ? short(cr.budgetMax) + '/mois' : null
  const lo = cr.budgetMin
  const hi = cr.budgetMax
  if (lo && hi)
    return hi >= 1_000_000 ? num1(lo / 1_000_000) + '–' + num1(hi / 1_000_000) + 'M' : short(lo) + '–' + short(hi)
  if (hi) return '≤ ' + short(hi)
  if (lo) return '≥ ' + short(lo)
  return null
}

// ── Modèle de filtre (liste + Santé partagent le même) ──────────────────
type Filter =
  | { type: 'audience'; value: 'all' | Audience; label?: string }
  | { type: 'kyc'; value: 'verified' | 'pending' | 'none'; label: string }
  | { type: 'source'; value: string; label: string }
  | { type: 'stale'; value: 'stale'; label: string }

function matchFilter(c: CrmContact, f: Filter): boolean {
  if (f.type === 'audience') return f.value === 'all' || audienceOf(c) === f.value
  if (f.type === 'kyc') {
    // La tuile « Aucun » agrège none + stale → le filtre doit couvrir les deux
    // (sinon le compteur diverge de la liste filtrée).
    if (f.value === 'none') return kycStatusOf(c) === 'none' || kycStatusOf(c) === 'stale'
    return kycStatusOf(c) === f.value
  }
  if (f.type === 'source') return (c.source || '') === f.value
  if (f.type === 'stale') return daysSince(c.lastActivityAt) >= 7
  return true
}

// ═══════════════════════════════════════════════════════════════════════
//   ATOMES (dark-aware via sp)
// ═══════════════════════════════════════════════════════════════════════
function CtpAvatar({ c, size = 38, sp }: { c: CrmContact; size?: number; sp: SugarPalette }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 999, flexShrink: 0,
      background: c.avatarBg || '#0B0C0E', color: '#fff',
      display: 'grid', placeItems: 'center', fontSize: size * 0.36, fontWeight: 700,
      letterSpacing: 0.2, boxShadow: `0 0 0 3px ${sp.avatarBorder}`,
    }}>
      {crmInitials(`${c.firstName} ${c.lastName}`)}
    </div>
  )
}

function CtpTypePill({ aud, label }: { aud: Audience; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 9px',
      borderRadius: 999, background: CTP_FN[aud], color: '#fff',
      fontSize: 11, fontWeight: 700, letterSpacing: 0.1, whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

function CtpKyc({ status, sp, dark, labels }: {
  status: ReturnType<typeof kycStatusOf>
  sp: SugarPalette
  dark: boolean
  labels: { verified: string; pending: string; stale: string }
}) {
  if (status === 'verified')
    return <span title={labels.verified} style={{ display: 'inline-flex', alignItems: 'center', color: dark ? '#6F8CFF' : CTP_FN.buyer, fontSize: 12, fontWeight: 700 }}>{labels.verified}</span>
  if (status === 'pending')
    return <span style={{ fontSize: 12, fontWeight: 600, color: sp.sub }}>{labels.pending}</span>
  if (status === 'stale')
    return <span style={{ fontSize: 12, fontWeight: 600, color: sp.sub }}>{labels.stale}</span>
  return <span style={{ fontSize: 12, fontWeight: 600, color: sp.sub, opacity: 0.6 }}>{'—'}</span>
}

function CtpBar({ pct, color, dark }: { pct: number; color: string; dark: boolean }) {
  return (
    <div style={{ height: 8, borderRadius: 999, background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(3, pct)}%`, height: '100%', borderRadius: 999, background: color, transition: 'width .5s cubic-bezier(.22,1,.36,1)' }} />
    </div>
  )
}

function CtpCta({ children, dark, onClick }: { children: ReactNode; dark: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 15px',
      borderRadius: 999, background: dark ? '#F2F2F6' : '#0B0C0E', color: dark ? '#0B0C0E' : '#FFFFFF', border: 0,
      fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer',
    }}>{children}</button>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   PAGE 0 — LA LISTE
// ═══════════════════════════════════════════════════════════════════════
function CtpTopList({ contacts, sp, dark, filter, setFilter, onOpenContact, onNewContact }: {
  contacts: CrmContact[]
  sp: SugarPalette
  dark: boolean
  filter: Filter
  setFilter: (f: Filter) => void
  onOpenContact: (id: string) => void
  onNewContact: () => void
}) {
  const { t } = useTranslation('contacts')
  const surface = dark ? sp.cardBg : '#FFFFFF'
  const panelSh = dark ? `inset 0 0 0 1px ${sp.cardBorder}, ${sp.shadow}` : sp.shadow
  const hairStrong = dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)'
  const hairSoft = dark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'

  const kycLabels = {
    verified: t('pager.kyc.verified'),
    pending: t('pager.kyc.pending'),
    stale: t('pager.kyc.stale'),
  }
  const audLabel: Record<Audience, string> = {
    buyer: t('contactType.buyer'),
    seller: t('contactType.seller'),
    tenant: t('contactType.tenant'),
  }
  const relLabel = (iso: string | undefined) => {
    const d = daysSince(iso)
    if (d <= 0) return t('pager.today')
    if (d === 1) return t('pager.yesterday')
    if (d < 30) return t('relativeTime.j', { n: d })
    if (d < 365) return t('relativeTime.mois', { n: Math.round(d / 30) })
    return t('relativeTime.mois', { n: Math.round(d / 30) })
  }

  const tabs: { id: 'all' | Audience; label: string; n: number }[] = [
    { id: 'all', label: t('segments.all'), n: contacts.length },
    { id: 'buyer', label: t('segments.buyer'), n: contacts.filter(c => audienceOf(c) === 'buyer').length },
    { id: 'seller', label: t('segments.seller'), n: contacts.filter(c => audienceOf(c) === 'seller').length },
    { id: 'tenant', label: t('segments.tenant'), n: contacts.filter(c => audienceOf(c) === 'tenant').length },
  ]
  const rows = useMemo(() => contacts.filter(c => matchFilter(c, filter)), [contacts, filter])
  const segActive = filter.type !== 'audience'
  const GRID = '1.7fr .8fr 1fr 1fr 1.1fr 34px'

  return (
    <div style={{ position: 'absolute', inset: 0, padding: '26px 34px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden', background: sp.pageBg }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: -1, color: sp.ink, lineHeight: 1 }}>{t('pager.title')}</h1>
        <div style={{ flex: 1 }} />
        <CtpCta dark={dark} onClick={onNewContact}>{t('pager.newContact')}</CtpCta>
      </div>

      {/* Sous-nav par audience + éventuel filtre issu de la Santé */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {tabs.map(tb => {
          const on = !segActive && (filter.type === 'audience' ? filter.value : 'all') === tb.id
          return (
            <button key={tb.id} onClick={() => setFilter({ type: 'audience', value: tb.id })} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 15px', borderRadius: 999,
              border: on ? '0' : `1px solid ${dark ? 'rgba(255,255,255,.12)' : 'rgba(11,12,14,.1)'}`,
              background: on ? (dark ? '#F2F2F6' : '#0B0C0E') : surface,
              color: on ? (dark ? '#0B0C0E' : '#fff') : sp.soft,
              fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: on ? 'none' : sp.shadowSm,
            }}>{tb.label}</button>
          )
        })}
        {segActive && (
          <button onClick={() => setFilter({ type: 'audience', value: 'all' })} title={t('pager.removeFilter')} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 8px 0 14px', borderRadius: 999,
            border: 0, background: dark ? 'rgba(30,91,198,0.22)' : '#E8EFFE', color: CTP_FN.buyer,
            fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            {filter.label}
            <span style={{ display: 'grid', placeItems: 'center', width: 20, height: 20, borderRadius: 999, background: dark ? 'rgba(255,255,255,.12)' : 'rgba(30,91,198,.14)', fontSize: 13, lineHeight: 1 }}>{'✕'}</span>
          </button>
        )}
      </div>

      {/* Liste (scrollable) */}
      <div style={{ flex: 1, minHeight: 0, background: surface, borderRadius: 22, boxShadow: panelSh, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '12px 22px', fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: sp.sub, borderBottom: `1px solid ${hairStrong}` }}>
          <div>{t('pager.col.contact')}</div><div>{t('pager.col.type')}</div><div>{t('pager.col.budget')}</div><div>{t('pager.col.kyc')}</div><div>{t('pager.col.last')}</div><div />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {rows.length === 0 && (
            <div style={{ padding: '48px 22px', textAlign: 'center', color: sp.sub, fontSize: 14, fontWeight: 600 }}>{t('pager.emptyFilter')}</div>
          )}
          {rows.map((c, i) => {
            const aud = audienceOf(c)
            const budget = budgetShort(c)
            return (
              <div key={c.id} className="ctp-row" role="button" tabIndex={0}
                onClick={() => onOpenContact(c.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenContact(c.id) } }}
                style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, alignItems: 'center', padding: '13px 22px', borderBottom: i < rows.length - 1 ? `1px solid ${hairSoft}` : '0', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <CtpAvatar c={c} sp={sp} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.firstName} {c.lastName}</div>
                  </div>
                </div>
                <div><CtpTypePill aud={aud} label={audLabel[aud]} /></div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: budget ? sp.ink : sp.sub, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{budget || '—'}</div>
                <div><CtpKyc status={kycStatusOf(c)} sp={sp} dark={dark} labels={kycLabels} /></div>
                <div style={{ fontSize: 13, color: sp.soft, fontWeight: 600 }}>{relLabel(c.lastActivityAt)}</div>
                <div style={{ color: sp.sub, opacity: 0.6, fontSize: 18, textAlign: 'center' }}>{'›'}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   PAGE 1 — SANTÉ DU PORTEFEUILLE
// ═══════════════════════════════════════════════════════════════════════
function CtpHealthPage({ contacts, sp, dark, onSegment }: {
  contacts: CrmContact[]
  sp: SugarPalette
  dark: boolean
  onSegment: (f: Filter) => void
}) {
  const { t } = useTranslation('contacts')
  const surface = dark ? sp.cardBg : '#FFFFFF'
  const panelSh = dark ? `inset 0 0 0 1px ${sp.cardBorder}, ${sp.shadow}` : sp.shadow
  const panelShSm = dark ? `inset 0 0 0 1px ${sp.cardBorder}, ${sp.shadowSm}` : sp.shadowSm
  const n = contacts.length || 1

  const audLabel: Record<Audience, string> = {
    buyer: t('segments.buyer'), seller: t('segments.seller'), tenant: t('segments.tenant'),
  }
  const srcLabel = (s: string): string => {
    const key = `pager.src.${s}`
    const translated = t(key)
    return translated === key ? (s || t('pager.src.other')) : translated
  }

  const kycVerified = contacts.filter(c => kycStatusOf(c) === 'verified').length
  const toRelance = contacts.filter(c => daysSince(c.lastActivityAt) >= 7).length
  const buyerBudgets = contacts.filter(c => audienceOf(c) === 'buyer')
    .map(c => c.criteria?.budgetMax).filter((x): x is number => !!x).sort((a, b) => a - b)
  const medBudget = buyerBudgets.length ? buyerBudgets[Math.floor((buyerBudgets.length - 1) / 2)] : 0
  const medBudgetShort = medBudget >= 1_000_000 ? num1(medBudget / 1_000_000) + 'M' : medBudget >= 1_000 ? Math.round(medBudget / 1_000) + 'K' : null

  const byAud: { a: Audience; n: number }[] = (['buyer', 'tenant', 'seller'] as Audience[]).map(a => ({ a, n: contacts.filter(c => audienceOf(c) === a).length }))
  const kyc = [
    { k: t('pager.kyc.verified'), val: 'verified' as const, n: contacts.filter(c => kycStatusOf(c) === 'verified').length, col: CTP_FN.ok },
    { k: t('pager.kyc.pending'), val: 'pending' as const, n: contacts.filter(c => kycStatusOf(c) === 'pending').length, col: CTP_FN.seller },
    { k: t('pager.kyc.noneShort'), val: 'none' as const, n: contacts.filter(c => kycStatusOf(c) === 'none' || kycStatusOf(c) === 'stale').length, col: sp.sub },
  ]
  const bySrc = Object.entries(contacts.reduce<Record<string, number>>((m, c) => { const s = c.source || 'other'; m[s] = (m[s] || 0) + 1; return m }, {}))
    .map(([k, v]) => ({ k, n: v })).sort((a, b) => b.n - a.n)
  const maxSrc = Math.max(1, ...bySrc.map(s => s.n))

  const kpis = [
    { label: t('health.kpi.active'), val: contacts.length, seg: { type: 'audience', value: 'all', label: t('segments.all') } as Filter },
    { label: t('health.kpi.medBudget'), val: medBudgetShort || '—', seg: { type: 'audience', value: 'buyer', label: t('segments.buyer') } as Filter },
    { label: t('health.kpi.kycVerified'), val: `${kycVerified}/${contacts.length}`, seg: { type: 'kyc', value: 'verified', label: t('health.seg.kycVerified') } as Filter },
    { label: t('health.kpi.relance'), val: toRelance, seg: { type: 'stale', value: 'stale', label: t('health.seg.stale') } as Filter },
  ]

  const Card = ({ title, children }: { title: string; children: ReactNode }) => (
    <section style={{ background: surface, borderRadius: 22, boxShadow: panelSh, padding: '20px 22px' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, letterSpacing: -0.2, color: sp.ink }}>{title}</h3>
      {children}
    </section>
  )

  const SegRow = ({ dot, label, count, pct, color, seg }: { dot: string; label: string; count: number; pct: number; color: string; seg?: Filter }) => (
    <button className="ctp-seg-row" onClick={() => seg && onSegment(seg)} style={{
      display: 'block', width: '100%', textAlign: 'left', border: 0, background: 'transparent', padding: 0, cursor: seg ? 'pointer' : 'default', fontFamily: 'inherit',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: dot }} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: sp.ink, flex: 1 }}>{label}</span>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
      </div>
      <CtpBar pct={pct} color={color} dark={dark} />
    </button>
  )

  return (
    <div style={{ position: 'absolute', inset: 0, padding: '34px 36px', boxSizing: 'border-box', overflowY: 'auto', background: sp.pageBg, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 1000, margin: 'auto 0' }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: -1, color: sp.ink, lineHeight: 1 }}>{t('health.title')}</h1>
          <div style={{ fontSize: 13.5, color: sp.sub, fontWeight: 500, marginTop: 8 }}>{t('health.intro')}</div>
        </div>

        {/* Bandeau KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
          {kpis.map(k => (
            <button key={k.label} className="ctp-seg" onClick={() => onSegment(k.seg)} style={{
              textAlign: 'left', background: surface, borderRadius: 18, boxShadow: panelShSm, padding: '16px 18px',
              border: 0, fontFamily: 'inherit', cursor: 'pointer',
            }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: sp.ink, letterSpacing: -1, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{k.val}</div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: sp.sub, letterSpacing: 0.3, textTransform: 'uppercase', marginTop: 8 }}>{k.label}</div>
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 16, alignItems: 'stretch' }}>
          <div className="ctp-seg">
            <Card title={t('health.byAudience')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {byAud.map(r => (
                  <SegRow key={r.a} dot={CTP_FN[r.a]} label={audLabel[r.a]} count={r.n} pct={(r.n / n) * 100} color={CTP_FN[r.a]}
                    seg={{ type: 'audience', value: r.a, label: audLabel[r.a] }} />
                ))}
              </div>
            </Card>
          </div>

          <div className="ctp-seg">
            <Card title={t('health.kycCoverage')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {kyc.map(r => (
                  <SegRow key={r.val} dot={r.col} label={r.k} count={r.n} pct={(r.n / n) * 100} color={r.col}
                    seg={{ type: 'kyc', value: r.val, label: t('health.seg.kyc', { status: r.k }) }} />
                ))}
              </div>
            </Card>
          </div>

          <div className="ctp-seg">
            <Card title={t('health.sources')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {bySrc.map(r => (
                  <button key={r.k} className="ctp-seg-row" onClick={() => onSegment({ type: 'source', value: r.k, label: t('health.seg.source', { source: srcLabel(r.k) }) })} style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    <span style={{ width: 96, fontSize: 12.5, fontWeight: 700, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{srcLabel(r.k)}</span>
                    <div style={{ flex: 1 }}><CtpBar pct={(r.n / maxSrc) * 100} color={dark ? 'rgba(255,255,255,.85)' : 'rgba(11,12,14,.82)'} dark={dark} /></div>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: sp.ink, fontVariantNumeric: 'tabular-nums', width: 16, textAlign: 'right' }}>{r.n}</span>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   POINTS + INDICE
// ═══════════════════════════════════════════════════════════════════════
function CtpPageDots({ page, onGo, dark, count, labels }: { page: number; onGo: (i: number) => void; dark: boolean; count: number; labels: string[] }) {
  const activeCol = dark ? '#F2F2F6' : '#0B0C0E'
  const idleCol = dark ? 'rgba(255,255,255,.22)' : 'rgba(11,12,14,.18)'
  if (count < 2) return null
  return (
    <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 30, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
      {Array.from({ length: count }).map((_, i) => (
        <button key={i} onClick={() => onGo(i)} title={labels[i]} style={{
          width: 8, height: i === page ? 26 : 8, borderRadius: 999, border: 0, cursor: 'pointer', padding: 0,
          background: i === page ? activeCol : idleCol, transition: 'height .5s cubic-bezier(.76,0,.24,1), background .4s ease',
        }} />
      ))}
    </div>
  )
}

function CtpScrollHint({ page, onGo, sp, labels, count }: { page: number; onGo: (i: number) => void; sp: SugarPalette; labels: string[]; count: number }) {
  const nextLabel = page + 1 < count ? labels[page + 1] : null
  const prevLabel = page > 0 ? labels[page - 1] : null
  const target = nextLabel || prevLabel
  if (!target) return null
  const dir = nextLabel ? 1 : -1
  return (
    <button className="ctp-scroll-hint" onClick={() => onGo(page + dir)} aria-label={target} style={{
      position: 'absolute', bottom: 18, left: 24, zIndex: 60, display: 'flex', alignItems: 'center', gap: 11,
      padding: 6, border: 0, background: 'transparent', fontFamily: 'inherit', cursor: 'pointer',
    }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, fontSize: 16, fontWeight: 700, lineHeight: 1, color: sp.sub }}>{nextLabel ? '↓' : '↑'}</span>
      <span className="ctp-hint-label" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', whiteSpace: 'nowrap',
        maxWidth: 0, overflow: 'hidden', opacity: 0, transform: 'translateX(-6px)',
        transition: 'max-width .4s cubic-bezier(.76,0,.24,1), opacity .3s ease, transform .4s cubic-bezier(.76,0,.24,1)',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: sp.ink }}>{target}</span>
      </span>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   PAGER CONTACTS
// ═══════════════════════════════════════════════════════════════════════
export interface ContactsPagerProps {
  contacts: CrmContact[]
  sp: SugarPalette
  dark: boolean
  onOpenContact: (id: string) => void
  onNewContact: () => void
  /** Liste vide (compte neuf) → page 0 = firstRunSlot, pager mono-page. */
  fresh: boolean
  firstRunSlot?: ReactNode
  /** Modale « Nouveau contact » embarquée dans le cadre (overlay). */
  modalOpen: boolean
  modalSlot?: ReactNode
}

export default function ContactsPager({
  contacts, sp, dark, onOpenContact, onNewContact, fresh, firstRunSlot, modalOpen, modalSlot,
}: ContactsPagerProps) {
  const { t } = useTranslation('contacts')
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState<Filter>({ type: 'audience', value: 'all' })
  const pageCount = fresh ? 1 : 2
  const pageLabels = [t('pager.title'), t('health.title')]

  const pageRef = useRef(0)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const posRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lock = useRef(false)
  const acc = useRef(0)
  const accTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const modalOpenRef = useRef(modalOpen)
  useEffect(() => { modalOpenRef.current = modalOpen }, [modalOpen])
  const freshRef = useRef(fresh)
  useEffect(() => { freshRef.current = fresh; if (fresh) setPage(0) }, [fresh])

  const animateTo = useCallback((target: number, instant?: boolean) => {
    const vp = viewportRef.current, track = trackRef.current
    if (!vp || !track) return
    const h = vp.clientHeight
    const end = -target * h
    if (instant) { posRef.current = end; track.style.transform = `translateY(${end}px)`; return }
    const start = posRef.current
    const dur = 700
    const t0 = performance.now()
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur)
      const y = start + (end - start) * ease(p)
      posRef.current = y
      track.style.transform = `translateY(${y}px)`
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const go = useCallback((dir: number) => {
    const max = (freshRef.current ? 1 : 2) - 1
    setPage((p) => Math.min(max, Math.max(0, p + dir)))
  }, [])
  const goTo = useCallback((i: number) => {
    if (lock.current) return
    lock.current = true
    setPage(i)
    setTimeout(() => { lock.current = false }, 820)
  }, [])

  // Clic sur un segment Santé → filtre + remontée page 0 (sans verrou résiduel).
  const applySegment = useCallback((seg: Filter) => { setFilter(seg); lock.current = false; setPage(0) }, [])

  useLayoutEffect(() => {
    animateTo(pageRef.current, true)
    const onResize = () => animateTo(pageRef.current, true)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [animateTo])

  useEffect(() => { pageRef.current = page; animateTo(page) }, [page, animateTo])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const canScrollNatively = (node: EventTarget | null, dir: number) => {
      let n = node as HTMLElement | null
      while (n && n !== el && n.nodeType === 1) {
        const oy = getComputedStyle(n).overflowY
        if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) {
          if (dir > 0 && n.scrollTop + n.clientHeight < n.scrollHeight - 1) return true
          if (dir < 0 && n.scrollTop > 1) return true
        }
        n = n.parentElement
      }
      return false
    }
    const onWheel = (e: WheelEvent) => {
      if (modalOpenRef.current || freshRef.current) return
      if (canScrollNatively(e.target, e.deltaY > 0 ? 1 : -1)) { acc.current = 0; return }
      e.preventDefault()
      if (lock.current) return
      acc.current += e.deltaY
      if (accTimer.current) clearTimeout(accTimer.current)
      accTimer.current = setTimeout(() => { acc.current = 0 }, 180)
      if (Math.abs(acc.current) > 40) {
        const dir = acc.current > 0 ? 1 : -1
        acc.current = 0
        lock.current = true
        go(dir)
        setTimeout(() => { lock.current = false }, 820)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    const onKey = (e: KeyboardEvent) => {
      if (modalOpenRef.current || freshRef.current) return
      const tag = (e.target && (e.target as HTMLElement).tagName) || ''
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target && (e.target as HTMLElement).isContentEditable)) return
      if (['ArrowDown', 'PageDown'].includes(e.key)) { e.preventDefault(); if (!lock.current) { lock.current = true; go(1); setTimeout(() => { lock.current = false }, 820) } }
      if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); if (!lock.current) { lock.current = true; go(-1); setTimeout(() => { lock.current = false }, 820) } }
    }
    window.addEventListener('keydown', onKey)
    let touchY: number | null = null
    const onTS = (e: TouchEvent) => { touchY = e.touches[0].clientY }
    const onTM = (e: TouchEvent) => {
      if (touchY == null || lock.current || modalOpenRef.current || freshRef.current) return
      const dy = touchY - e.touches[0].clientY
      if (Math.abs(dy) > 60) { lock.current = true; go(dy > 0 ? 1 : -1); touchY = null; setTimeout(() => { lock.current = false }, 820) }
    }
    el.addEventListener('touchstart', onTS, { passive: true })
    el.addEventListener('touchmove', onTM, { passive: true })
    return () => {
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      el.removeEventListener('touchstart', onTS)
      el.removeEventListener('touchmove', onTM)
    }
  }, [go])

  return (
    <main style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingRight: 24, paddingBottom: 22 }}>
      <style>{`
        .ctp-scroll-hint { opacity: .55; transition: opacity .35s ease; }
        .ctp-scroll-hint:hover, .ctp-scroll-hint:focus-visible { opacity: 1; }
        .ctp-scroll-hint:hover .ctp-hint-label, .ctp-scroll-hint:focus-visible .ctp-hint-label { max-width: 220px !important; opacity: 1 !important; transform: translateX(0) !important; }
        .ctp-row { transition: background .15s ease; }
        .ctp-row:hover { background: ${dark ? 'rgba(255,255,255,.04)' : 'rgba(15,23,42,.03)'}; }
        .ctp-seg, .ctp-seg-row, .ctp-row, .ctp-scroll-hint { -webkit-tap-highlight-color: transparent; }
        /* Pas d'anneau à la souris ; anneau visible au clavier (a11y). */
        .ctp-seg:focus:not(:focus-visible), .ctp-seg-row:focus:not(:focus-visible), .ctp-row:focus:not(:focus-visible), .ctp-scroll-hint:focus:not(:focus-visible) { outline: none; }
        .ctp-seg:focus-visible, .ctp-seg-row:focus-visible, .ctp-row:focus-visible, .ctp-scroll-hint:focus-visible { outline: 2px solid ${dark ? '#8DA4FF' : '#0041D9'}; outline-offset: 2px; border-radius: 10px; }
      `}</style>
      <div ref={viewportRef} style={{
        position: 'relative', height: '100%', borderRadius: 26, overflow: 'hidden',
        border: `1px solid ${sp.frameBorder}`, boxShadow: sp.shadow,
      }}>
        <div ref={trackRef} style={{ height: '100%', willChange: 'transform' }}>
          <div style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
            {fresh
              ? firstRunSlot
              : <CtpTopList contacts={contacts} sp={sp} dark={dark} filter={filter} setFilter={setFilter} onOpenContact={onOpenContact} onNewContact={onNewContact} />}
          </div>
          {!fresh && (
            <div style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
              <CtpHealthPage contacts={contacts} sp={sp} dark={dark} onSegment={applySegment} />
            </div>
          )}
        </div>
        <CtpPageDots page={page} onGo={goTo} dark={dark} count={pageCount} labels={pageLabels} />
        {modalOpen && modalSlot && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 45, borderRadius: 26, overflow: 'hidden' }}>
            {modalSlot}
          </div>
        )}
      </div>
      {!fresh && <CtpScrollHint page={page} onGo={goTo} sp={sp} labels={pageLabels} count={pageCount} />}
    </main>
  )
}
