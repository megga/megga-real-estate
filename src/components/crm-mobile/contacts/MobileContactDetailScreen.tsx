/**
 * Contenu de la fiche contact mobile, rendu par `MobileContactDetailPage`
 * sur `/dashboard/contacts/:id`. Hero + rappel KYC inline non-bloquant + 4
 * onglets (Aperçu / Activité / Matching / Docs). Détail du câblage réel sur le
 * docstring de `MobileContactDetailScreen`.
 */
import { useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useQuery } from '@tanstack/react-query'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { formatCHF } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useContact } from '@/hooks/useContacts'
import { useKycDossierByContact } from '@/hooks/useKycDossier'
import { useContactTimeline, type TimelineEvent } from '@/hooks/useContactTimeline'
import { useMatching, type MatchResult } from '@/hooks/useMatching'
import type { Contact } from '@/types/contact'
import type { KycDossierSummary } from '@/types/kyc'
import { countryName } from '@/lib/countries'
import { MOBILE_FONT, type MobileTokens } from '../tokens'
import { useMobileTokens } from '../useMobileTokens'
import ContactSeal from './ContactSeal'
import {
  avatarColor,
  criteriaChips,
  fmtDateFull,
  fmtDay,
  hasCriteria,
  initialsOf,
  kycMeta,
  matchStatus,
  prettifyAction,
  sourceLabel,
  timelineCat,
} from './detailShared'

type DocRow = { id: string; name: string; created_at: string }
type TabId = 'overview' | 'activity' | 'matching' | 'docs'

// ─── Démo (harnais /dev/mobile) — gated, n'atteint jamais Supabase ────────
const DEMO_CONTACT: Contact = {
  id: 'demo-c1', agency_id: 'demo', first_name: 'Marie', last_name: 'Bertrand',
  email: 'm.bertrand@bluewin.ch', phone: '+41 79 412 88 02', type: 'buyer',
  source: 'website', score: 'hot', tags: ['Famille'], notes: null,
  created_at: '2026-04-02T09:00:00.000Z', whatsapp_phone: null, language: 'fr',
  birth_date: null, nationality: 'CH', residence_country: 'CH', home_address: null,
  budget_announced: 1250000, budget_estimated_ai: null,
  search_zones: ['Carouge', 'Champel'],
  search_criteria: { type: 'vente', budget_min: 950000, budget_max: 1250000, zones: ['Carouge', 'Champel'], rooms_min: 4, surface_min: 110, features: ['Balcon', 'Ascenseur'] },
  ai_seriousness_score: null, ai_purchase_probability: 72, ai_timing: null,
  ai_engagement_level: null, ai_tension_level: null, ai_price_reduction_probability: null,
  last_interaction_at: '2026-06-20T15:32:00.000Z', updated_at: null,
}
const DEMO_DOSSIER: KycDossierSummary = {
  id: 'demo-k1', agency_id: 'demo', contact_id: 'demo-c1', transaction_id: null,
  type: 'buyer_pp', risk_level: 'low', risk_score: null, dossier_status: 'pending',
  vigilance: 'standard', validated_at: null, expires_at: null,
  created_at: '2026-05-02T09:00:00.000Z', pep_status: null, sanctions_status: null,
  last_screening_at: null, checks_total: 5, checks_completed: 2,
}
const DEMO_TIMELINE: TimelineEvent[] = [
  { id: 't1', action: 'match_sent', entity_type: 'contact', entity_id: 'demo-c1', metadata: null, created_at: '2026-06-20T15:32:00.000Z', actor_name: null },
  { id: 't2', action: 'call_logged', entity_type: 'contact', entity_id: 'demo-c1', metadata: null, created_at: '2026-06-12T10:15:00.000Z', actor_name: 'Gregory Lyonnet' },
  { id: 't3', action: 'visit_planned', entity_type: 'contact', entity_id: 'demo-c1', metadata: null, created_at: '2026-06-05T14:30:00.000Z', actor_name: 'Gregory Lyonnet' },
  { id: 't4', action: 'contact_created', entity_type: 'contact', entity_id: 'demo-c1', metadata: null, created_at: '2026-04-02T09:00:00.000Z', actor_name: 'Gregory Lyonnet' },
]
const DEMO_MATCHES: MatchResult[] = [
  {
    id: 'm1', contactId: 'demo-c1', contactName: 'Marie Bertrand', propertyId: 'demo-p1',
    marketListingId: null, source: 'internal',
    listing: { title: 'Appartement 5p · Carouge', price: 1190000, address: 'Rue Ancienne 6', city: 'Carouge', canton: 'GE', postal_code: '1227', rooms: 5, bedrooms: 3, surface_m2: 124, photos: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&q=80'], type: 'apartment', description: '', features: {}, floor: 3, total_floors: 5, year_built: 2016, charges_monthly: 0 },
    score: 94, reasons: { budget: { match: true, score: 1, detail: '' }, zone: { match: true, score: 1, detail: '' }, type: { match: true, score: 1, detail: '' }, rooms: { match: true, score: 1, detail: '' }, features: { match: true, score: 1, detail: '' } },
    status: 'visit_planned', sentVia: null, sentAt: null, createdAt: '2026-06-18T09:00:00.000Z',
  },
  {
    id: 'm2', contactId: 'demo-c1', contactName: 'Marie Bertrand', propertyId: 'demo-p2',
    marketListingId: null, source: 'internal',
    listing: { title: 'Duplex 4.5p · Champel', price: 1240000, address: 'Av. de Champel 24', city: 'Genève', canton: 'GE', postal_code: '1206', rooms: 4, bedrooms: 2, surface_m2: 112, photos: ['https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=900&q=80'], type: 'apartment', description: '', features: {}, floor: 2, total_floors: 4, year_built: 2009, charges_monthly: 0 },
    score: 81, reasons: { budget: { match: true, score: 1, detail: '' }, zone: { match: true, score: 1, detail: '' }, type: { match: true, score: 1, detail: '' }, rooms: { match: false, score: 0, detail: '' }, features: { match: true, score: 1, detail: '' } },
    status: 'sent', sentVia: 'email', sentAt: '2026-06-15T09:00:00.000Z', createdAt: '2026-06-15T09:00:00.000Z',
  },
]
const DEMO_DOCS: DocRow[] = [
  { id: 'd1', name: 'Bon de visite Carouge.pdf', created_at: '2026-05-08T09:00:00.000Z' },
  { id: 'd2', name: 'Pré-qualification financière UBS.pdf', created_at: '2026-04-04T09:00:00.000Z' },
]

/**
 * Fiche contact détail mobile (P8/2) — read-focused v1, port du proto v2.
 * Hero (identité + sceau KYC vérifié) · KYC inline NON-bloquant (rappel doux) ·
 * onglets Aperçu / Activité / Matching / Docs. 100 % câblé réel (`useContact`
 * snake_case, `useKycDossierByContact`, `useContactTimeline`, `useMatching`,
 * documents). Édition inline / upload / WhatsApp / Mode focus = différés v2.
 * `demo` alimente le harnais /dev/mobile sans toucher Supabase ni naviguer.
 */
export function MobileContactDetailScreen({ demo = false }: { demo?: boolean }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('contacts')
  const { tk } = useMobileTokens()
  const { profile } = useAuth()
  const live = !demo

  const { data: contactLive, isLoading, isError, refetch } = useContact(live ? id : undefined)
  const { data: dossierLive } = useKycDossierByContact(live ? id : undefined)
  const { data: timelineLive = [], isLoading: tlLoading } = useContactTimeline(live ? id : undefined)
  const { matches: matchesLive, isLoading: matchLoading } = useMatching(live ? id : undefined, { enabled: live })
  const { data: docsLive = [], isLoading: docsLoading } = useQuery({
    queryKey: ['contact-docs-mobile', id, profile?.agency_id],
    queryFn: async (): Promise<DocRow[]> => {
      if (!id || !profile?.agency_id) return []
      const { data, error } = await supabase
        .from('documents')
        .select('id, name, created_at')
        .eq('contact_id', id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return (data ?? []) as DocRow[]
    },
    enabled: live && !!id && !!profile?.agency_id,
  })

  const contact = demo ? DEMO_CONTACT : contactLive
  const dossier = demo ? DEMO_DOSSIER : dossierLive
  const timeline = demo ? DEMO_TIMELINE : timelineLive
  const matches = demo ? DEMO_MATCHES : matchesLive
  const docs = demo ? DEMO_DOCS : docsLive

  const [tab, setTab] = useState<TabId>('overview')

  if (live && isError && !contact) {
    return (
      <div style={fullState()}>
        <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 800, color: tk.ink }}>{t('cd.error.title')}</div>
        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: tk.muted, marginTop: 6, lineHeight: 1.5 }}>{t('cd.error.message')}</div>
        <button type="button" onClick={() => refetch()} style={{ marginTop: 16, height: 44, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 800, background: tk.accent, color: tk.accentInk }}>{t('cd.error.retry')}</button>
      </div>
    )
  }
  if (live && (isLoading || !contact)) {
    return <div style={{ ...fullState(), fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: tk.muted }}>{t('cd.loading')}</div>
  }
  if (!contact) return null

  const goKyc = () => { if (live && id) navigate(`/dashboard/kyc?openContactId=${encodeURIComponent(id)}`) }
  const verified = dossier?.dossier_status === 'verified'

  return (
    <div style={{ fontFamily: MOBILE_FONT, color: tk.ink, padding: 'var(--crm-space-sm) var(--crm-space-3xl) var(--crm-space-md)' }}>
      <Hero contact={contact} verified={verified} t={t} tk={tk} />

      <div style={{ marginTop: 12 }}>
        <KycInline dossier={dossier ?? null} onOpen={goKyc} t={t} tk={tk} />
      </div>

      <Segmented tab={tab} setTab={setTab} t={t} tk={tk} />

      <div key={tab} style={{ animation: 'cv2Up .35s cubic-bezier(.2,.8,.2,1) both' }}>
        {tab === 'overview' && <OverviewTab contact={contact} t={t} tk={tk} i18nLang={i18n.language} onRefine={() => { if (live) navigate('/dashboard/matching') }} />}
        {tab === 'activity' && <ActivityTab events={timeline} loading={live && tlLoading} t={t} tk={tk} i18nLang={i18n.language} />}
        {tab === 'matching' && <MatchingTab matches={matches} loading={live && matchLoading} t={t} tk={tk} onOpen={(m) => { if (live && m.propertyId) navigate(`/dashboard/listings/${m.propertyId}`) }} onAtelier={() => { if (live) navigate('/dashboard/matching') }} />}
        {tab === 'docs' && <DocsTab docs={docs} loading={live && docsLoading} t={t} tk={tk} i18nLang={i18n.language} />}
      </div>

      <style>{'@keyframes cv2Up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}'}</style>
    </div>
  )
}

/** Style d'un conteneur plein écran centré (états chargement / erreur / vide). */
function fullState(): CSSProperties {
  return { minHeight: '60dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 32, fontFamily: MOBILE_FONT }
}

/** Carte d'identité : avatar, nom (+ sceau KYC si vérifié), pastilles source/zone/tag, tuiles tél/e-mail cliquables. */
function Hero({ contact, verified, t, tk }: { contact: Contact; verified: boolean; t: TFunction; tk: MobileTokens }) {
  const src = sourceLabel(contact.source)
  const ville = (contact.search_criteria?.zones ?? contact.search_zones ?? []).filter(Boolean)[0]
  const tag = (contact.tags ?? [])[0]
  const fields: { labelKey: string; value: string | null; num?: boolean }[] = [
    { labelKey: 'mobile.detail.phone', value: contact.phone, num: true },
    { labelKey: 'mobile.detail.email', value: contact.email },
  ]
  return (
    <div style={{ background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 'var(--crm-radius-5xl)', boxShadow: tk.shadowLg, padding: 'var(--crm-space-5xl)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)' }}>
        <span style={{ width: 60, height: 60, borderRadius: 'var(--crm-radius-pill)', flexShrink: 0, background: avatarColor(contact.id), color: '#fff', display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-4xl)', fontWeight: 800 }}>{initialsOf(contact)}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 'var(--crm-text-5xl)', fontWeight: 800, color: tk.ink, letterSpacing: -0.6, lineHeight: 1.05, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)' }}>
            <span style={{ minWidth: 0, flexShrink: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contact.first_name} {contact.last_name}</span>
            {verified ? <ContactSeal size={18} /> : null}
          </h1>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-sm)', marginTop: 14 }}>
        {contact.source ? <Pill tk={tk}>{t(src.key, { defaultValue: src.raw })}</Pill> : null}
        {ville ? <Pill tk={tk}>{ville}</Pill> : null}
        {tag ? <Pill tk={tk}>{tag}</Pill> : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-md)', marginTop: 14 }}>
        {fields.map((f) => (
          <a
            key={f.labelKey}
            href={f.value ? (f.num ? `tel:${f.value}` : `mailto:${f.value}`) : undefined}
            style={{ padding: 'var(--crm-space-lg) var(--crm-space-xl)', borderRadius: 'var(--crm-radius-xl)', background: tk.cardSubtle, minWidth: 0, textDecoration: 'none', display: 'block', pointerEvents: f.value ? 'auto' : 'none' }}
          >
            <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 800, color: tk.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 5 }}>{t(f.labelKey)}</div>
            <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 700, color: f.value ? tk.ink : tk.muted, letterSpacing: -0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: f.num ? 'tabular-nums' : 'normal' }}>{f.value || '—'}</div>
          </a>
        ))}
      </div>
    </div>
  )
}

/** Pastille arrondie neutre (source, zone ou tag). */
function Pill({ children, tk }: { children: ReactNode; tk: MobileTokens }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: 'var(--crm-space-xs) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: tk.cardSubtle, color: tk.ink, fontSize: 'var(--crm-text-sm)', fontWeight: 700, letterSpacing: 0.1, whiteSpace: 'nowrap' }}>{children}</span>
}

/** Rappel KYC inline, jamais bloquant : progression des vérifications + CTA « vérifier ». */
function KycInline({ dossier, onOpen, t, tk }: { dossier: KycDossierSummary | null; onOpen: () => void; t: TFunction; tk: MobileTokens }) {
  const status = dossier?.dossier_status ?? 'none'
  const m = kycMeta(status)
  const band = m.band(tk)
  const ink = m.ink(tk)
  const subInk = m.subInk(tk)
  const total = dossier?.checks_total ?? 0
  const done = dossier?.checks_completed ?? 0
  return (
    <div style={{ background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 'var(--crm-radius-5xl)', boxShadow: tk.shadow, overflow: 'hidden' }}>
      <div style={{ padding: 'var(--crm-space-2xl) var(--crm-space-5xl) 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 800, color: tk.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>{t('mobile.detail.kyc.title')}</span>
        {total > 0 && !m.verified ? (
          <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 700, color: tk.muted, fontVariantNumeric: 'tabular-nums' }}>{t('mobile.detail.kyc.progress', { done, total })}</span>
        ) : null}
      </div>
      <div style={{ background: band, padding: 'var(--crm-space-3xl) var(--crm-space-5xl)', margin: '15px 0 0', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)' }}>
        <MEIcon name="shield" size={22} color={ink} strokeWidth={1.8} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 800, color: ink, letterSpacing: -0.2 }}>{t(m.labelKey)}</div>
          <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: subInk, marginTop: 2 }}>{m.verified ? t('mobile.detail.kyc.compliant') : t('mobile.detail.kyc.lba')}</div>
        </div>
        {m.verified ? (
          <MEIcon name="check" size={20} color={ink} strokeWidth={2.6} />
        ) : (
          <button type="button" onClick={onOpen} style={{ flexShrink: 0, height: 32, padding: '0 var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', background: tk.ctaBg, color: tk.ctaInk, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 800, letterSpacing: -0.1 }}>{t('mobile.detail.kyc.verify')}</button>
        )}
      </div>
    </div>
  )
}

const TABS: { id: TabId; key: string }[] = [
  { id: 'overview', key: 'mobile.detail.tab.overview' },
  { id: 'activity', key: 'mobile.detail.tab.activity' },
  { id: 'matching', key: 'mobile.detail.tab.matching' },
  { id: 'docs', key: 'mobile.detail.tab.docs' },
]
/** Barre de sélection des 4 onglets. */
function Segmented({ tab, setTab, t, tk }: { tab: TabId; setTab: (id: TabId) => void; t: TFunction; tk: MobileTokens }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--crm-space-sm)', margin: '14px 0 4px' }}>
      {TABS.map((tb) => {
        const on = tb.id === tab
        return (
          <button key={tb.id} type="button" onClick={() => setTab(tb.id)} style={{ flex: 1, height: 38, border: 0, cursor: 'pointer', borderRadius: 'var(--crm-radius-pill)', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: on ? 800 : 700, letterSpacing: -0.2, color: on ? tk.accentInk : tk.inkSoft, background: on ? tk.accent : tk.card, boxShadow: on ? tk.shadow : tk.shadowSm }}>
            {t(tb.key)}
          </button>
        )
      })}
    </div>
  )
}

const CV_MEGGA_GRAD = 'radial-gradient(100% 88% at 13% 110%, #7C63F0 0%, rgba(124,99,240,0) 58%), radial-gradient(96% 88% at 88% 114%, #C44FB8 0%, rgba(196,79,184,0) 58%), radial-gradient(145% 110% at 50% 124%, #9A6AD9 0%, rgba(154,106,217,0) 64%), linear-gradient(180deg, #07060B 0%, #0C091A 42%, #170E2A 100%)'

/** Pastille translucide posée sur le dégradé de la carte critères. */
function GlassChip({ children }: { children: ReactNode }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: 'var(--crm-space-sm) var(--crm-space-xl)', borderRadius: 'var(--crm-radius-pill)', background: 'rgba(255,255,255,0.13)', color: '#fff', fontSize: 'var(--crm-text-sm)', fontWeight: 700, letterSpacing: 0.1, whiteSpace: 'nowrap', backdropFilter: 'blur(4px)' }}>{children}</span>
}

/** Onglet Aperçu : critères de recherche (carte dégradée) + bloc informations. */
function OverviewTab({ contact, t, tk, i18nLang, onRefine }: { contact: Contact; t: TFunction; tk: MobileTokens; i18nLang: string; onRefine: () => void }) {
  const sc = contact.search_criteria
  const chips = hasCriteria(sc) ? criteriaChips(sc) : []
  const features = (sc?.features ?? []).filter(Boolean)
  const infos: { labelKey: string; value: string | null }[] = [
    { labelKey: 'mobile.detail.infos.language', value: contact.language ? contact.language.toUpperCase() : null },
    // `nationality` est stocké en ISO alpha-2 depuis la migration 20260718160000 :
    // sans countryName() la fiche afficherait « RU » au lieu de « Russie ».
    { labelKey: 'mobile.detail.infos.nationality', value: contact.nationality ? countryName(contact.nationality) : null },
    { labelKey: 'mobile.detail.infos.created', value: contact.created_at ? fmtDateFull(contact.created_at, i18nLang) : null },
    { labelKey: 'mobile.detail.infos.lastInteraction', value: contact.last_interaction_at ? fmtDay(contact.last_interaction_at, i18nLang) : null },
  ].filter((r) => r.value)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xl)', marginTop: 12 }}>
      {hasCriteria(sc) ? (
        <div style={{ position: 'relative', borderRadius: 'var(--crm-radius-5xl)', overflow: 'hidden', padding: 'var(--crm-space-4xl)', color: '#fff', background: CV_MEGGA_GRAD, boxShadow: tk.shadow }}>
          <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.82)' }}>{t('mobile.detail.criteria.eyebrow')}</span>
          <h3 style={{ margin: '14px 0 0', fontSize: 'var(--crm-text-3xl)', fontWeight: 800, color: '#fff', letterSpacing: -0.4 }}>{t('mobile.detail.criteria.title')}</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-sm)', marginTop: 14 }}>
            {chips.map((ch, i) => <GlassChip key={i}>{ch.key ? t(ch.key) : ch.text}</GlassChip>)}
          </div>
          {features.length ? (
            <div style={{ marginTop: 13 }}>
              <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 800, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 8 }}>{t('mobile.detail.criteria.indispensable')}</div>
              <div style={{ display: 'flex', gap: 'var(--crm-space-sm)', flexWrap: 'wrap' }}>{features.map((f) => <GlassChip key={f}>{f}</GlassChip>)}</div>
            </div>
          ) : null}
          <button type="button" onClick={onRefine} style={{ width: '100%', marginTop: 16, height: 44, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', background: '#fff', color: '#0B0C0E', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 800, letterSpacing: -0.2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-md)' }}>
            {t('mobile.detail.criteria.refine')} <MEIcon name="arrow-right" size={16} color="#0B0C0E" strokeWidth={2} />
          </button>
        </div>
      ) : null}

      {infos.length ? (
        <div style={{ background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 'var(--crm-radius-5xl)', boxShadow: tk.shadow, padding: 'var(--crm-space-4xl)' }}>
          <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 800, color: tk.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>{t('mobile.detail.infos.title')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-md)' }}>
            {infos.map((r) => (
              <div key={r.labelKey} style={{ padding: 'var(--crm-space-lg) var(--crm-space-xl)', borderRadius: 'var(--crm-radius-xl)', background: tk.cardSubtle, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 800, color: tk.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 5 }}>{t(r.labelKey)}</div>
                <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 700, color: tk.ink, letterSpacing: -0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.value}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!hasCriteria(sc) && !infos.length ? <EmptyState icon="search" title={t('mobile.detail.criteria.empty')} tk={tk} /> : null}
    </div>
  )
}

/** Onglet Activité : timeline réelle du contact (catégorie, date, auteur si connu). */
function ActivityTab({ events, loading, t, tk, i18nLang }: { events: TimelineEvent[]; loading: boolean; t: TFunction; tk: MobileTokens; i18nLang: string }) {
  if (loading) return <SkeletonList tk={tk} />
  if (!events.length) return <EmptyState icon="calendar" title={t('mobile.detail.timeline.empty')} tk={tk} />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)', marginTop: 12 }}>
      {events.map((ev) => {
        const cat = timelineCat(ev.action)
        const tone = cat.tone ?? tk.muted
        // Auteur affiché UNIQUEMENT s'il est connu. Un actor_name absent ne prouve
        // PAS une action IA (peut être système/cron, ou jointure profils bloquée
        // par RLS) — on n'attribue jamais faussement la paternité à « MEGGA AI ».
        const who = ev.actor_name ? t('mobile.detail.timeline.by', { name: ev.actor_name }) : null
        return (
          <div key={ev.id} style={{ background: tk.cardSubtle, borderRadius: 'var(--crm-radius-2xl)', padding: 'var(--crm-space-xl) var(--crm-space-2xl)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--crm-space-lg)', marginBottom: 9 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: 'var(--crm-space-xs) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: tone, color: '#fff', fontSize: 'var(--crm-text-sm)', fontWeight: 800, letterSpacing: 0.1, whiteSpace: 'nowrap' }}>{t(cat.labelKey)}</span>
              <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 700, color: tk.muted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtDay(ev.created_at, i18nLang)}</span>
            </div>
            <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 700, color: tk.ink, letterSpacing: -0.2 }}>{prettifyAction(ev.action)}</div>
            {who ? <div style={{ fontSize: 'var(--crm-text-md)', color: tk.inkSoft, fontWeight: 500, lineHeight: 1.5, marginTop: 3 }}>{who}</div> : null}
          </div>
        )
      })}
    </div>
  )
}

/** Onglet Matching : biens proposés (photo, score IA, statut) ; tape → fiche bien ou atelier. */
function MatchingTab({ matches, loading, t, tk, onOpen, onAtelier }: { matches: MatchResult[]; loading: boolean; t: TFunction; tk: MobileTokens; onOpen: (m: MatchResult) => void; onAtelier: () => void }) {
  if (loading) return <SkeletonList tk={tk} />
  if (!matches.length) {
    return (
      <div style={{ marginTop: 12 }}>
        <EmptyState icon="home" title={t('mobile.detail.matching.empty')} desc={t('mobile.detail.matching.emptyDesc')} tk={tk} />
        <button type="button" onClick={onAtelier} style={{ marginTop: 12, width: '100%', height: 46, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 800, background: tk.accent, color: tk.accentInk }}>{t('mobile.detail.matching.openAtelier')}</button>
      </div>
    )
  }
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', margin: '0 2px 11px' }}>
        <MEIcon name="sparkle" size={14} color={tk.muted} />
        <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 800, color: tk.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>{t('mobile.detail.matching.eyebrow')}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xl)' }}>
        {matches.map((m) => {
          const st = matchStatus(m.status)
          const tone = st.tone ?? tk.muted
          const photo = m.listing.photos?.[0]
          const navigable = !!m.propertyId
          return (
            <button key={m.id} type="button" onClick={() => onOpen(m)} disabled={!navigable} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 0, border: `1px solid ${tk.cardBorder}`, borderRadius: 'var(--crm-radius-3xl)', overflow: 'hidden', background: tk.card, boxShadow: tk.shadow, cursor: navigable ? 'pointer' : 'default', fontFamily: 'inherit' }}>
              <div style={{ position: 'relative', height: 150, background: tk.cardSubtle }}>
                {photo ? <img src={photo} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}><MEIcon name="home" size={30} color={tk.ghost} /></div>}
                <span style={{ position: 'absolute', top: 11, left: 11, display: 'inline-flex', alignItems: 'center', padding: 'var(--crm-space-xs) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: tone, color: '#fff', fontSize: 'var(--crm-text-sm)', fontWeight: 800, letterSpacing: 0.1 }}>{t(st.labelKey)}</span>
                <span style={{ position: 'absolute', top: 11, right: 11, display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', padding: 'var(--crm-space-xs) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: 'rgba(8,9,12,0.74)', color: '#fff', fontSize: 'var(--crm-text-md)', fontWeight: 800, fontVariantNumeric: 'tabular-nums', backdropFilter: 'blur(4px)' }}><MEIcon name="sparkle" size={12} color="#fff" />{m.score}</span>
              </div>
              <div style={{ padding: 'var(--crm-space-xl) var(--crm-space-2xl) var(--crm-space-2xl)' }}>
                <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 800, color: tk.ink, letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.listing.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginTop: 5, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 800, color: tk.ink, letterSpacing: -0.4, fontVariantNumeric: 'tabular-nums' }}>{formatCHF(m.listing.price)}</span>
                  <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted }}>{[m.listing.city, m.listing.rooms ? t('mobile.detail.matching.rooms', { n: m.listing.rooms }) : null, m.listing.surface_m2 ? `${m.listing.surface_m2} m²` : null].filter(Boolean).join(' · ')}</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Onglet Documents : fichiers réels rattachés au contact (lecture seule). */
function DocsTab({ docs, loading, t, tk, i18nLang }: { docs: DocRow[]; loading: boolean; t: TFunction; tk: MobileTokens; i18nLang: string }) {
  if (loading) return <SkeletonList tk={tk} />
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 800, color: tk.muted, letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 2px 11px' }}>{t('mobile.detail.docs.title')}</div>
      {!docs.length ? (
        <EmptyState icon="file" title={t('mobile.detail.docs.empty')} desc={t('mobile.detail.docs.emptyDesc')} tk={tk} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)' }}>
          {docs.map((d) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-3xl)', background: tk.card, border: `1px solid ${tk.cardBorder}`, boxShadow: tk.shadowSm }}>
              <div style={{ width: 46, height: 46, borderRadius: 'var(--crm-radius-xl)', flexShrink: 0, background: tk.cardSubtle, display: 'grid', placeItems: 'center' }}>
                <MEIcon name="file" size={20} color={tk.inkSoft} strokeWidth={1.7} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 800, color: tk.ink, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                <div style={{ fontSize: 'var(--crm-text-sm)', color: tk.muted, fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{fmtDay(d.created_at, i18nLang)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** État vide générique (icône + titre + description optionnelle). */
function EmptyState({ icon, title, desc, tk }: { icon: MEIconName; title: string; desc?: string; tk: MobileTokens }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 24px', background: tk.card, borderRadius: 'var(--crm-radius-4xl)', boxShadow: tk.shadowSm, border: `1px solid ${tk.cardBorder}` }}>
      <div style={{ width: 52, height: 52, borderRadius: 'var(--crm-radius-pill)', background: tk.cardSubtle, display: 'grid', placeItems: 'center', margin: '0 auto' }}>
        <MEIcon name={icon} size={24} color={tk.muted} strokeWidth={1.8} />
      </div>
      <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 800, letterSpacing: -0.3, color: tk.ink, marginTop: 14 }}>{title}</div>
      {desc ? <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.muted, marginTop: 5, maxWidth: 250, marginInline: 'auto', lineHeight: 1.45 }}>{desc}</div> : null}
    </div>
  )
}

/** Placeholder de chargement (3 barres grises). */
function SkeletonList({ tk }: { tk: MobileTokens }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)', marginTop: 12 }}>
      {[0, 1, 2].map((i) => <div key={i} style={{ height: 72, borderRadius: 'var(--crm-radius-2xl)', background: tk.cardSubtle, boxShadow: tk.shadowSm }} />)}
    </div>
  )
}
