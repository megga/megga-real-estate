/**
 * Écran de détail d'un dossier KYC (mobile, P9) : surface compliance
 * read-focused + un seul geste d'écriture, monté par MobileKycDetailPage.
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { useAuth } from '@/hooks/useAuth'
import {
  useKycCase,
  useKycDocuments,
  useKycAuditEvents,
  useLogKycRead,
  useLatestKycScreeningDecision,
} from '@/hooks/useKyc'
import { useMarkKycCheck, useMarkAllChecksCompleted } from '@/hooks/useKycDossier'
import { supabase } from '@/lib/supabase'
import type {
  KycCaseWithChecklist,
  KycChecklistItem,
  KycCheckCategory,
  KycDocument,
  KycAuditEvent,
} from '@/types/kyc'
import ContactSeal from '../contacts/ContactSeal'
import { avatarColor, fmtDateFull } from '../contacts/detailShared'
import SgToast from '../primitives/SgToast'
import { useSgToast } from '../primitives/useSgToast'
import { MOBILE_FONT, type MobileTokens } from '../tokens'
import { useMobileTokens } from '../useMobileTokens'
import { useFocusTrap } from '@/hooks/useFocusTrap'

// 5 contrôles LBA art. 3-7 (ordre fixe, miroir desktop).
const CHECK_KEYS: KycCheckCategory[] = ['id', 'address', 'pep', 'sanctions', 'funds']
const CHECK_ICON: Record<KycCheckCategory, MEIconName> = {
  id: 'user',
  address: 'home',
  pep: 'flag',
  sanctions: 'shield',
  funds: 'banknote',
}

type ScreeningGuard =
  | { status: 'ok' }
  | { status: 'match'; kind: 'sanctions' | 'pep' }
  | { status: 'pending' }
  | { status: 'missing' }

type TabId = 'synthese' | 'controles' | 'documents' | 'audit'

// ─── Démo (harnais /dev/mobile) — gated, aucun fetch/write/log Supabase ───────
const DEMO_CASE: KycCaseWithChecklist = {
  id: 'demo-kyc-1', agency_id: 'demo', transaction_id: 'demo-tx', contact_id: 'demo-c1',
  type: 'buyer_pp', risk_level: 'low', status: 'in_progress', completion_pct: 60,
  validated_by: null, validated_at: null, created_at: '2026-05-12T09:00:00.000Z',
  pep_status: 'clear', pep_details: null, sanctions_status: 'clear', sanctions_details: null,
  last_screening_at: '2026-06-18T14:00:00.000Z', contact_nationality: 'CH',
  transaction_amount: 1190000, risk_score: 18, risk_factors: null, notes: null,
  vigilance: 'standard', expires_at: '2027-05-12T09:00:00.000Z', dossier_status: 'pending',
  source_of_funds_type: null, source_of_funds_description: null, source_of_funds_doc_id: null,
  ai_analysis: null,
  contact: { first_name: 'Marie', last_name: 'Bertrand' },
  checklist: [
    { id: 'ck1', kyc_case_id: 'demo-kyc-1', label: 'Pièce d\'identité', category: 'id', is_required: true, is_completed: true, document_id: null, notes: null, completed_at: '2026-05-12T10:00:00.000Z', completed_by: 'Gregory Lyonnet' },
    { id: 'ck2', kyc_case_id: 'demo-kyc-1', label: 'Domicile', category: 'address', is_required: true, is_completed: true, document_id: null, notes: null, completed_at: '2026-05-12T10:05:00.000Z', completed_by: 'Gregory Lyonnet' },
    { id: 'ck3', kyc_case_id: 'demo-kyc-1', label: 'PEP', category: 'pep', is_required: true, is_completed: true, document_id: null, notes: null, completed_at: '2026-06-18T14:00:00.000Z', completed_by: null },
    { id: 'ck4', kyc_case_id: 'demo-kyc-1', label: 'Sanctions', category: 'sanctions', is_required: true, is_completed: false, document_id: null, notes: null, completed_at: null, completed_by: null },
    { id: 'ck5', kyc_case_id: 'demo-kyc-1', label: 'Source des fonds', category: 'funds', is_required: true, is_completed: false, document_id: null, notes: null, completed_at: null, completed_by: null },
  ],
}
const DEMO_DOCS: KycDocument[] = [
  { id: 'dd1', agency_id: 'demo', kyc_case_id: 'demo-kyc-1', transaction_id: null, contact_id: 'demo-c1', property_id: null, name: 'Passeport Marie Bertrand.pdf', type: 'application/pdf', storage_path: '', size_bytes: 842000, uploaded_by: null, status: 'validated', created_at: '2026-05-12T10:00:00.000Z', issued_at: null, expires_at: null, document_category: 'identity', sha256_hash: null },
  { id: 'dd2', agency_id: 'demo', kyc_case_id: 'demo-kyc-1', transaction_id: null, contact_id: 'demo-c1', property_id: null, name: 'Justificatif domicile.pdf', type: 'application/pdf', storage_path: '', size_bytes: 410000, uploaded_by: null, status: 'validated', created_at: '2026-05-12T10:05:00.000Z', issued_at: null, expires_at: null, document_category: 'domicile', sha256_hash: null },
]
const DEMO_AUDIT: KycAuditEvent[] = [
  { id: 'a1', agency_id: 'demo', actor_id: 'u1', actor_kind: 'user', action: 'Contrôle PEP marqué vérifié', entity_type: 'kyc_check', entity_id: 'demo-kyc-1', metadata: null, created_at: '2026-06-18T14:00:00.000Z', actor: { full_name: 'Gregory Lyonnet' } },
  { id: 'a2', agency_id: 'demo', actor_id: null, actor_kind: 'system', action: 'Screening Dilisense relancé', entity_type: 'kyc_case', entity_id: 'demo-kyc-1', metadata: null, created_at: '2026-06-18T13:58:00.000Z', actor: null },
  { id: 'a3', agency_id: 'demo', actor_id: 'u1', actor_kind: 'user', action: 'Dossier KYC ouvert', entity_type: 'kyc_case', entity_id: 'demo-kyc-1', metadata: null, created_at: '2026-05-12T09:00:00.000Z', actor: { full_name: 'Gregory Lyonnet' } },
]

/** État d'un contrôle : fait (`is_completed`), non requis (`is_required===false`), sinon à vérifier. */
function checkState(it: KycChecklistItem | null): 'done' | 'na' | 'pending' {
  if (!it) return 'pending'
  if (it.is_completed) return 'done'
  if (it.is_required === false) return 'na'
  return 'pending'
}

/**
 * Détail dossier KYC mobile (P9) — surface compliance-critique, read-focused +
 * UN seul geste d'écriture sûr (marquage de contrôle). Politique NON-BLOCANTE
 * (CLAUDE.md) : aucun libellé/teinte ne suggère un blocage du deal ; jamais de
 * rouge. La SEULE garde est l'intégrité LBA art. 9 (`screeningGuard`/`canMarkAll`,
 * copiée verbatim du desktop) : on ne peut pas auto-attester « vérifié » tant
 * qu'un match sanctions/PEP n'est pas examiné (chemin humain sur le bureau).
 * nLPD art. 12 : chaque consultation est journalisée (`useLogKycRead`, une fois
 * par montage). 100 % câblé `useKycCase`/`useKycDocuments`/`useKycAuditEvents`.
 * Différés v2 : re-screening, export PDF, upload de pièce, workflow d'examen de
 * match (createDecision). `demo` alimente le harnais sans toucher Supabase.
 */
export function MobileKycDetailScreen({ demo = false }: { demo?: boolean }) {
  const { dossierId } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('kyc')
  const { tk } = useMobileTokens()
  const { profile } = useAuth()
  const live = !demo
  const id = live ? dossierId : undefined
  const agentId = profile?.id ?? ''

  const { data: dossierLive, isError, refetch } = useKycCase(id)
  const { data: docsLive = [] } = useKycDocuments(id)
  const { data: auditLive = [] } = useKycAuditEvents(id)
  const { data: sanctionsDecision } = useLatestKycScreeningDecision(id, 'sanctions')
  const { data: pepDecision } = useLatestKycScreeningDecision(id, 'pep')
  const markCheck = useMarkKycCheck()
  const markAll = useMarkAllChecksCompleted()
  const logRead = useLogKycRead()

  const dossier = demo ? DEMO_CASE : dossierLive
  const docs = demo ? DEMO_DOCS : docsLive
  const audit = demo ? DEMO_AUDIT : auditLive

  const [tab, setTab] = useState<TabId>('synthese')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { toast, showToast } = useSgToast()

  // nLPD art. 12 — log d'accès consultation (une fois par montage, ref-guardé,
  // LIVE seulement). Même règle que la fiche desktop.
  const readLoggedRef = useRef<string | null>(null)
  const logReadMutate = logRead.mutate
  useEffect(() => {
    // On attend un acteur RÉEL : journaliser un accès avec actor_id vide
    // (profil pas encore chargé) corromprait la traçabilité nLPD. `agentId` est
    // dans les deps → l'effet re-tente quand le profil arrive.
    if (!live || !id || !agentId || !dossier?.agency_id || readLoggedRef.current === id) return
    readLoggedRef.current = id
    logReadMutate({ kycCaseId: id, agencyId: dossier.agency_id, actorId: agentId })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, dossier?.agency_id, id, agentId])

  // Index des checklist items par catégorie LBA (verbatim desktop).
  const checksByCategory = useMemo<Record<KycCheckCategory, KycChecklistItem | null>>(() => {
    const map: Record<KycCheckCategory, KycChecklistItem | null> = { id: null, address: null, pep: null, sanctions: null, funds: null }
    const items = (dossier as KycCaseWithChecklist | undefined)?.checklist ?? []
    items.forEach((c) => {
      if ((CHECK_KEYS as string[]).includes(c.category)) map[c.category as KycCheckCategory] = c
    })
    return map
  }, [dossier])

  // Garde compliance LBA art. 9 (verbatim desktop, avant tout early-return).
  const screeningGuard = useMemo<ScreeningGuard>(() => {
    if (!dossier) return { status: 'missing' }
    const sanctions = dossier.sanctions_status
    const pep = dossier.pep_status
    if (sanctions === 'match' && sanctionsDecision?.decision !== 'false_positive') return { status: 'match', kind: 'sanctions' }
    if (pep === 'match' && pepDecision?.decision !== 'false_positive') return { status: 'match', kind: 'pep' }
    if (sanctions === 'pending' || pep === 'pending') return { status: 'pending' }
    if (!sanctions || !pep || sanctions === 'not_checked' || pep === 'not_checked') return { status: 'missing' }
    return { status: 'ok' }
  }, [dossier, sanctionsDecision?.decision, pepDecision?.decision])

  if (live && isError && !dossier) {
    return (
      <div style={{ fontFamily: MOBILE_FONT, padding: 'var(--crm-space-7xl) var(--crm-space-4xl)' }}>
        <div role="alert" style={{ textAlign: 'center', padding: '40px 24px', background: tk.card, borderRadius: 'var(--crm-radius-4xl)', boxShadow: tk.shadowSm, border: `1px solid ${tk.cardBorder}` }}>
          <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: tk.ink }}>{t('dossier.detail.loadError')}</div>
          <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.muted, marginTop: 6 }}>{t('dossier.detail.loadErrorHint')}</div>
          <button type="button" onClick={() => refetch()} style={{ marginTop: 16, height: 44, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, background: tk.accent, color: tk.accentInk }}>{t('dossier.detail.retry')}</button>
        </div>
      </div>
    )
  }

  if (!dossier) {
    return (
      <div style={{ fontFamily: MOBILE_FONT, padding: '60px 18px', textAlign: 'center', color: tk.muted, fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>
        {t('dossier.detail.loading')}
      </div>
    )
  }

  // Avancement des 5 contrôles LBA (un check non requis compte fait — verbatim).
  const done = CHECK_KEYS.filter((k) => {
    const it = checksByCategory[k]
    return !!(it && (it.is_completed || it.is_required === false))
  }).length
  const total = CHECK_KEYS.length

  // Dernier screening = date d'action la plus récente connue (verbatim).
  let lastScreeningAt: string | null = dossier.last_screening_at ?? null
  Object.values(checksByCategory).forEach((c) => {
    if (c?.completed_at && (!lastScreeningAt || new Date(c.completed_at) > new Date(lastScreeningAt))) lastScreeningAt = c.completed_at
  })

  const isVerified = dossier.dossier_status === 'verified'
  const canMarkAll = !isVerified && screeningGuard.status === 'ok'

  // Pourquoi « tout marquer vérifié » est indisponible — orienté ACTION, sans
  // langage de blocage pipeline (intégrité LBA art. 9, pas un verrou de deal).
  const markAllBlockedLabel = (() => {
    if (screeningGuard.status === 'match') return screeningGuard.kind === 'sanctions' ? t('dossier.detail.reviewSanctionsFirst') : t('dossier.detail.reviewPepFirst')
    if (screeningGuard.status === 'pending') return t('dossier.detail.screeningRunning')
    if (screeningGuard.status === 'missing') return t('dossier.detail.runScreeningFirst')
    return null
  })()

  const handleMarkVerified = (category: KycCheckCategory) => {
    const item = checksByCategory[category]
    if (!item || !live || markCheck.isPending) return
    markCheck.mutate(
      { checkId: item.id, is_completed: true, actorId: agentId },
      { onError: () => showToast(t('dossier.detail.saveFailed')) },
    )
  }
  const requestMarkAll = () => { if (canMarkAll && !markAll.isPending) setConfirmOpen(true) }
  const confirmMarkAll = () => {
    setConfirmOpen(false)
    if (!live) return
    markAll.mutate({ kycCaseId: dossier.id, actorId: agentId }, { onError: () => showToast(t('dossier.detail.saveFailed')) })
  }

  const c = dossier.contact
  const name = c ? `${c.first_name} ${c.last_name}`.trim() : ''
  const initials = c ? `${(c.first_name || ' ')[0]}${(c.last_name || ' ')[0]}`.toUpperCase() : '?'
  const ctx: Ctx = { t, tk, lang: i18n.language }

  return (
    <div style={{ fontFamily: MOBILE_FONT, color: tk.ink }}>
      <DetailHeader ctx={ctx} name={name} initials={initials} avatarId={dossier.contact_id} verified={isVerified} done={done} total={total} />

      <div style={{ padding: 'var(--crm-space-2xl) var(--crm-space-4xl) var(--crm-space-xs)' }}>
        <SegTabs ctx={ctx} tab={tab} onChange={setTab} docCount={docs.length} />
      </div>

      <div key={tab} style={{ padding: '4px 18px 28px', animation: 'kycmRise .4s cubic-bezier(.2,.8,.2,1) both' }}>
        {tab === 'synthese' && (
          <SyntheseTab
            ctx={ctx} dossier={dossier} checksByCategory={checksByCategory}
            lastScreeningAt={lastScreeningAt} isVerified={isVerified} canMarkAll={canMarkAll}
            markAllPending={markAll.isPending} markAllBlockedLabel={markAllBlockedLabel}
            screeningGuard={screeningGuard} onMarkAll={requestMarkAll} goControles={() => setTab('controles')}
            onSeeContact={() => { if (live) navigate(`/dashboard/contacts/${dossier.contact_id}`) }}
          />
        )}
        {tab === 'controles' && (
          <ControlesTab ctx={ctx} checksByCategory={checksByCategory} markPending={markCheck.isPending} onMark={handleMarkVerified} />
        )}
        {tab === 'documents' && (
          <DocumentsTab ctx={ctx} docs={docs} live={live} onPreviewError={(m) => showToast(t('dossier.detail.previewError', { message: m }))} />
        )}
        {tab === 'audit' && <AuditTab ctx={ctx} events={audit} />}
      </div>

      {confirmOpen && <ConfirmMarkAllOverlay ctx={ctx} dossier={dossier} pending={markAll.isPending} onCancel={() => setConfirmOpen(false)} onConfirm={confirmMarkAll} />}
      <SgToast toast={toast} />
      <style>{'@keyframes kycmRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}'}</style>
    </div>
  )
}

interface Ctx { t: TFunction; tk: MobileTokens; lang: string }

/** Jauge circulaire done/total des contrôles (monochrome, miroir de la liste, jamais rouge). */
function Gauge({ done, total, verified, tk, size = 60 }: { done: number; total: number; verified: boolean; tk: MobileTokens; size?: number }) {
  const stroke = 5
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = total > 0 ? Math.max(0, Math.min(1, done / total)) : 0
  const col = verified ? tk.goal : tk.inkSoft
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }} aria-hidden="true">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={tk.hair} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={col} strokeWidth={stroke} fill="none" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.22,1,.36,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: size * 0.26, fontWeight: 600, color: tk.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3 }}>{done}/{total}</div>
    </div>
  )
}

/** En-tête fiche : avatar, nom, sceau « vérifié » et jauge d'avancement des contrôles. */
function DetailHeader({ ctx, name, initials, avatarId, verified, done, total }: { ctx: Ctx; name: string; initials: string; avatarId: string; verified: boolean; done: number; total: number }) {
  const { tk } = ctx
  return (
    <div style={{ padding: 'var(--crm-space-xs) var(--crm-space-4xl) 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)', padding: 'var(--crm-space-3xl) var(--crm-space-4xl)', background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 'var(--crm-radius-5xl)', boxShadow: tk.shadow }}>
        <span style={{ width: 56, height: 56, borderRadius: 'var(--crm-radius-pill)', flexShrink: 0, background: avatarColor(avatarId), color: '#fff', display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-3xl)', fontWeight: 600, letterSpacing: -0.3 }}>{initials}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)' }}>
            <span style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: tk.ink, letterSpacing: -0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name || '—'}</span>
            {verified ? <ContactSeal size={17} /> : null}
          </div>
        </div>
        <Gauge done={done} total={total} verified={verified} tk={tk} size={60} />
      </div>
    </div>
  )
}

/** Onglets segmentés synthèse / contrôles / documents / audit, avec compteurs. */
function SegTabs({ ctx, tab, onChange, docCount }: { ctx: Ctx; tab: TabId; onChange: (t: TabId) => void; docCount: number }) {
  const { t, tk } = ctx
  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'synthese', label: t('dossier.tabs.synthese') },
    { id: 'controles', label: t('dossier.tabs.controles'), count: CHECK_KEYS.length },
    { id: 'documents', label: t('dossier.tabs.documents'), count: docCount },
    { id: 'audit', label: t('dossier.tabs.audit') },
  ]
  return (
    <div style={{ display: 'flex', gap: 'var(--crm-space-md)' }}>
      {tabs.map((tb) => {
        const on = tb.id === tab
        return (
          <button key={tb.id} type="button" onClick={() => onChange(tb.id)} style={{ flex: 1, height: 38, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, letterSpacing: -0.2, background: on ? tk.accent : tk.card, color: on ? tk.accentInk : tk.inkSoft, boxShadow: on ? tk.shadow : tk.shadowSm, whiteSpace: 'nowrap' }}>
            {tb.label}{tb.count != null ? ` ${tb.count}` : ''}
          </button>
        )
      })}
    </div>
  )
}

/** Carte générique (fond, bordure, ombre légère) réutilisée par les onglets. */
function Card({ tk, children, pad = 18 }: { tk: MobileTokens; children: ReactNode; pad?: number }) {
  return <div style={{ background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 'var(--crm-radius-4xl)', boxShadow: tk.shadowSm, padding: pad }}>{children}</div>
}
/** Sur-titre en petites capitales espacées, en tête de section. */
function Eyebrow({ tk, children }: { tk: MobileTokens; children: ReactNode }) {
  return <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: tk.muted}}>{children}</div>
}

/** Onglet « Synthèse » : état du dossier (non-bloquant), encart screening, les 5 contrôles et les infos clés. */
function SyntheseTab({
  ctx, dossier, checksByCategory, lastScreeningAt, isVerified, canMarkAll, markAllPending,
  markAllBlockedLabel, screeningGuard, onMarkAll, goControles, onSeeContact,
}: {
  ctx: Ctx; dossier: KycCaseWithChecklist; checksByCategory: Record<KycCheckCategory, KycChecklistItem | null>
  lastScreeningAt: string | null; isVerified: boolean; canMarkAll: boolean
  markAllPending: boolean; markAllBlockedLabel: string | null; screeningGuard: ScreeningGuard
  onMarkAll: () => void; goControles: () => void; onSeeContact: () => void
}) {
  const { t, tk, lang } = ctx
  const typeLabel = dossier.type.startsWith('buyer') ? t('dossier.synthese.typeBuyer') : t('dossier.synthese.typeSeller')
  const infos: { label: string; value: string }[] = [
    { label: t('dossier.synthese.riskLevel'), value: t(`riskBadge.${dossier.risk_level}`) },
    { label: t('dossier.synthese.contactType'), value: typeLabel },
    { label: t('dossier.synthese.openedOn'), value: fmtDateFull(dossier.created_at, lang) || '—' },
    { label: t('dossier.synthese.lastScreening'), value: lastScreeningAt ? fmtDateFull(lastScreeningAt, lang) : '—' },
    { label: t('dossier.synthese.expiry'), value: dossier.expires_at ? fmtDateFull(dossier.expires_at, lang) : '—' },
    { label: t('dossier.synthese.reference'), value: dossier.id },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)' }}>
      {/* État du dossier (non-bloquant) */}
      <Card tk={tk} pad={20}>
        <Eyebrow tk={tk}>{t('dossier.synthese.stateEyebrow')}</Eyebrow>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginTop: 8 }}>
          {isVerified ? <MEIcon name="check" size={18} color={tk.goal} strokeWidth={2.4} /> : null}
          <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: isVerified ? tk.goal : tk.ink, letterSpacing: -0.3 }}>
            {isVerified ? t('dossier.synthese.stateVerifiedTitle') : t('dossier.synthese.stateUnverifiedTitle')}
          </div>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: tk.muted, lineHeight: 1.5 }}>
          {isVerified ? t('dossier.synthese.stateVerifiedBody') : t('dossier.synthese.stateUnverifiedBody')}
        </p>
        {!isVerified ? (
          <div style={{ marginTop: 16 }}>
            <button type="button" onClick={onMarkAll} disabled={!canMarkAll || markAllPending} style={{ height: 48, width: '100%', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: canMarkAll && !markAllPending ? 'pointer' : 'default', background: canMarkAll ? tk.accent : tk.cardSubtle, color: canMarkAll ? tk.accentInk : tk.muted, fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, letterSpacing: -0.2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-md)', boxShadow: canMarkAll ? tk.shadowSm : 'none' }}>
              <MEIcon name="check" size={15} color={canMarkAll ? tk.accentInk : tk.muted} strokeWidth={2.4} />
              {markAllPending ? t('dossier.synthese.markingAll') : t('dossier.synthese.markAllVerified')}
            </button>
            {!canMarkAll && markAllBlockedLabel ? (
              <div style={{ marginTop: 9, fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted, textAlign: 'center', lineHeight: 1.45 }}>{markAllBlockedLabel}</div>
            ) : null}
          </div>
        ) : null}
      </Card>

      {/* Encart screening (informatif, JAMAIS bloquant ni rouge) */}
      <ComplianceNote ctx={ctx} guard={screeningGuard} />

      {/* Mini-liste des 5 contrôles → onglet Contrôles */}
      <Card tk={tk}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <Eyebrow tk={tk}>{t('dossier.synthese.checksEyebrow')}</Eyebrow>
          <button type="button" onClick={goControles} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.ink }}>
            {t('dossier.synthese.seeDetail')}<MEIcon name="chevron-right" size={13} color={tk.ink} strokeWidth={2.2} />
          </button>
        </div>
        {CHECK_KEYS.map((k, i) => {
          const it = checksByCategory[k]
          const st = checkState(it)
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-lg) 0', boxShadow: i === CHECK_KEYS.length - 1 ? 'none' : `inset 0 -1px 0 ${tk.hair}` }}>
              <span style={{ width: 34, height: 34, borderRadius: 'var(--crm-radius-md)', flexShrink: 0, display: 'grid', placeItems: 'center', background: st === 'done' ? tk.accent : tk.cardSubtle }}>
                <MEIcon name={CHECK_ICON[k]} size={16} color={st === 'done' ? tk.accentInk : tk.inkSoft} strokeWidth={1.9} />
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.ink, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t(`check.${k}.title`)}</span>
              <CheckPill ctx={ctx} state={st} />
            </div>
          )
        })}
      </Card>

      {/* Informations */}
      <Card tk={tk}>
        <Eyebrow tk={tk}>{t('dossier.synthese.infoEyebrow')}</Eyebrow>
        <div style={{ marginTop: 4 }}>
          {infos.map((row, i) => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--crm-space-2xl)', padding: 'var(--crm-space-lg) 0', boxShadow: i === infos.length - 1 ? 'none' : `inset 0 -1px 0 ${tk.hair}` }}>
              <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.muted }}>{row.label}</span>
              <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.ink, textAlign: 'right', maxWidth: '60%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.value}</span>
            </div>
          ))}
        </div>
      </Card>

      <button type="button" onClick={onSeeContact} style={{ height: 46, width: '100%', borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${tk.cardBorder}`, cursor: 'pointer', background: tk.card, boxShadow: tk.shadowSm, fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, letterSpacing: -0.2, color: tk.ink, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-md)' }}>
        <MEIcon name="user" size={16} color={tk.ink} strokeWidth={1.9} />{t('mobile.detail.seeContact')}
      </button>
    </div>
  )
}

/** Encart screening : un match sanctions/PEP s'affiche en ambre informatif (jamais rouge ni bloquant), examen renvoyé au bureau ; sinon rien. */
function ComplianceNote({ ctx, guard }: { ctx: Ctx; guard: ScreeningGuard }) {
  const { t, tk } = ctx
  if (guard.status === 'match') {
    return (
      <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-2xl) var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-2xl)', background: tk.riskBg }}>
        <MEIcon name="shield" size={16} color={tk.riskFg} strokeWidth={1.9} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.riskFg, lineHeight: 1.5 }}>{guard.kind === 'sanctions' ? t('dossier.alert.matchSanctions') : t('dossier.alert.matchPep')}</div>
          <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.riskFg, opacity: 0.85, marginTop: 4, lineHeight: 1.45 }}>{t('mobile.detail.examineOnDesktop')}</div>
        </div>
      </div>
    )
  }
  return null
}

/** Pastille d'état d'un contrôle (fait / non requis / à vérifier), monochrome. */
function CheckPill({ ctx, state }: { ctx: Ctx; state: 'done' | 'na' | 'pending' }) {
  const { t, tk } = ctx
  const label = state === 'done' ? t('mobile.check.done') : state === 'na' ? t('mobile.check.na') : t('mobile.check.pending')
  const col = state === 'done' ? tk.goal : tk.muted
  return <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: col, letterSpacing: -0.1, whiteSpace: 'nowrap' }}>{label}</span>
}

/** Onglet « Contrôles » : les 5 contrôles LBA en détail + geste « marquer vérifié » par contrôle. */
function ControlesTab({ ctx, checksByCategory, markPending, onMark }: { ctx: Ctx; checksByCategory: Record<KycCheckCategory, KycChecklistItem | null>; markPending: boolean; onMark: (k: KycCheckCategory) => void }) {
  const { t, tk } = ctx
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)' }}>
      <Eyebrow tk={tk}>{t('dossier.detail.fiveChecks')}</Eyebrow>
      {CHECK_KEYS.map((k) => {
        const it = checksByCategory[k]
        const st = checkState(it)
        return (
          <Card key={k} tk={tk} pad={18}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-xl)' }}>
              <span style={{ width: 44, height: 44, borderRadius: 'var(--crm-radius-xl)', flexShrink: 0, display: 'grid', placeItems: 'center', background: st === 'done' ? tk.accent : tk.cardSubtle }}>
                <MEIcon name={CHECK_ICON[k]} size={20} color={st === 'done' ? tk.accentInk : tk.ink} strokeWidth={1.85} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: tk.ink, letterSpacing: -0.2 }}>{t(`check.${k}.title`)}</span>
                  <CheckPill ctx={ctx} state={st} />
                </div>
                <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: tk.inkSoft, lineHeight: 1.5, marginTop: 4 }}>{t(`check.${k}.sub`)}</div>
                {it?.notes ? <div style={{ marginTop: 10, padding: 'var(--crm-space-lg) var(--crm-space-xl)', borderRadius: 'var(--crm-radius-lg)', background: tk.cardSubtle, fontSize: 'var(--crm-text-md)', fontWeight: 500, color: tk.inkSoft, lineHeight: 1.5 }}>{it.notes}</div> : null}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--crm-space-lg)', marginTop: 12, minHeight: 30 }}>
                  <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted, lineHeight: 1.4 }}>
                    {it?.completed_at ? fmtDateFull(it.completed_at, ctx.lang) : ''}{it?.completed_by ? ` · ${t('mobile.check.completedBy', { name: it.completed_by })}` : ''}
                  </span>
                  {st !== 'done' ? (
                    <button type="button" onClick={() => onMark(k)} disabled={markPending} style={{ height: 40, padding: '0 var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: markPending ? 'default' : 'pointer', background: tk.accent, color: tk.accentInk, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, letterSpacing: -0.1, display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', boxShadow: tk.shadowSm, opacity: markPending ? 0.55 : 1, flexShrink: 0 }}>
                      <MEIcon name="check" size={13} color={tk.accentInk} strokeWidth={2.4} />{t('mobile.check.markVerified')}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

/** Onglet « Documents » : liste en lecture, aperçu via URL signée 60 s (Storage) ; upload différé v2. */
function DocumentsTab({ ctx, docs, live, onPreviewError }: { ctx: Ctx; docs: KycDocument[]; live: boolean; onPreviewError: (m: string) => void }) {
  const { t, tk, lang } = ctx
  const fmtSize = (b: number | null) => (b == null ? '' : b > 1_000_000 ? `${(b / 1_000_000).toFixed(1)} Mo` : `${Math.max(1, Math.round(b / 1000))} Ko`)
  const preview = async (doc: KycDocument) => {
    if (!live || !doc.storage_path) return
    const { data, error } = await supabase.storage.from('kyc-documents').createSignedUrl(doc.storage_path, 60)
    if (error) { onPreviewError(error.message); return }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }
  if (docs.length === 0) {
    return (
      <Card tk={tk} pad={28}>
        <div style={{ textAlign: 'center', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.muted, lineHeight: 1.5 }}>{t('mobile.docs.empty')}</div>
      </Card>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)' }}>
      {docs.map((doc) => (
        <button key={doc.id} type="button" onClick={() => void preview(doc)} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-xl) var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-2xl)', border: `1px solid ${tk.cardBorder}`, background: tk.card, boxShadow: tk.shadowSm, cursor: 'pointer', fontFamily: 'inherit' }}>
          <span style={{ width: 38, height: 38, borderRadius: 'var(--crm-radius-md)', flexShrink: 0, display: 'grid', placeItems: 'center', background: tk.cardSubtle }}>
            <MEIcon name="file" size={17} color={tk.inkSoft} strokeWidth={1.9} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</span>
            <span style={{ display: 'block', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted, marginTop: 1 }}>{[fmtSize(doc.size_bytes), fmtDateFull(doc.created_at, lang)].filter(Boolean).join(' · ')}</span>
          </span>
          <MEIcon name="eye" size={16} color={tk.ghost} strokeWidth={1.9} />
        </button>
      ))}
    </div>
  )
}

/** Onglet « Audit » : événements réels du dossier, bascule Timeline (fil) / Registre (tableau). */
function AuditTab({ ctx, events }: { ctx: Ctx; events: KycAuditEvent[] }) {
  const { t, tk, lang } = ctx
  const [view, setView] = useState<'timeline' | 'registre'>('timeline')
  const actorOf = (ev: KycAuditEvent): string => {
    // Ordre défensif (miroir de la piste d'audit desktop) : le type d'acteur
    // prime sur la jointure profil — un événement IA/système ne peut jamais être
    // crédité à un humain (honnêteté de la piste d'audit).
    if (ev.actor_kind === 'ai') return t('mobile.audit.actorAi')
    if (ev.actor_kind === 'system') return t('mobile.audit.actorSystem')
    const nm = ev.actor?.full_name?.trim()
    if (nm) return nm
    return '—'
  }
  const stamp = (iso: string) => {
    const d = fmtDateFull(iso, lang)
    let time = ''
    try { time = new Date(iso).toLocaleTimeString(lang.startsWith('fr') ? 'fr-CH' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) } catch { time = '' }
    return { d, time }
  }
  return (
    <Card tk={tk}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--crm-space-lg)', marginBottom: 14 }}>
        <Eyebrow tk={tk}>{t('mobile.audit.title')}</Eyebrow>
        {events.length > 0 ? (
          <div style={{ display: 'inline-flex', gap: 'var(--crm-space-2xs)', padding: 'var(--crm-space-2xs)', borderRadius: 'var(--crm-radius-pill)', background: tk.cardSubtle }}>
            {(['timeline', 'registre'] as const).map((v) => {
              const on = v === view
              return (
                <button key={v} type="button" onClick={() => setView(v)} style={{ height: 30, padding: '0 var(--crm-space-xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, background: on ? tk.accent : 'transparent', color: on ? tk.accentInk : tk.muted, boxShadow: on ? tk.shadowSm : 'none' }}>
                  {v === 'timeline' ? t('mobile.audit.timeline') : t('mobile.audit.registre')}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      {events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--crm-space-5xl) var(--crm-space-md)', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.muted }}>{t('mobile.audit.empty')}</div>
      ) : view === 'timeline' ? (
        <div>
          {events.map((ev, i) => {
            const last = i === events.length - 1
            const s = stamp(ev.created_at)
            return (
              <div key={ev.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--crm-space-xl)', paddingBottom: last ? 0 : 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 'var(--crm-radius-pill)', flexShrink: 0, marginTop: 3, background: tk.accent }} />
                  {!last ? <span style={{ width: 2, flex: 1, minHeight: 16, marginTop: 5, background: tk.hair }} /> : null}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.ink, letterSpacing: -0.15, lineHeight: 1.35 }}>{ev.action}</div>
                  <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{[s.d, s.time].filter(Boolean).join(' · ')} · {actorOf(ev)}</div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr>
                {[t('mobile.audit.colTime'), t('mobile.audit.colAction'), t('mobile.audit.colActor')].map((h) => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: tk.muted, padding: '0 var(--crm-space-md) var(--crm-space-md)', borderBottom: `1.5px solid ${tk.ink}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((ev, i) => {
                const last = i === events.length - 1
                const s = stamp(ev.created_at)
                return (
                  <tr key={ev.id}>
                    <td style={{ padding: 'var(--crm-space-lg) var(--crm-space-md)', borderBottom: last ? 'none' : `1px solid ${tk.hair}`, verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.inkSoft }}>{s.d}</div>
                      <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: tk.muted, marginTop: 1 }}>{s.time}</div>
                    </td>
                    <td style={{ padding: 'var(--crm-space-lg) var(--crm-space-md)', borderBottom: last ? 'none' : `1px solid ${tk.hair}`, verticalAlign: 'top', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.ink, letterSpacing: -0.15 }}>{ev.action}</td>
                    <td style={{ padding: 'var(--crm-space-lg) var(--crm-space-md)', borderBottom: last ? 'none' : `1px solid ${tk.hair}`, verticalAlign: 'top', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.inkSoft, whiteSpace: 'nowrap' }}>{actorOf(ev)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

/** Feuille de confirmation « tout marquer vérifié » (LBA art. 7) : rappelle les statuts sanctions/PEP/vigilance avant l'écriture. */
function ConfirmMarkAllOverlay({ ctx, dossier, pending, onCancel, onConfirm }: { ctx: Ctx; dossier: KycCaseWithChecklist; pending: boolean; onCancel: () => void; onConfirm: () => void }) {
  const { t, tk } = ctx
  const refPiegeFocus = useFocusTrap(true, onCancel)
  // Nommé par son titre visible, pas par une chaîne recopiée.
  const titreId = useId()
  const statusLabel = (s: string) => (s === 'clear' ? t('dossier.confirm.clear') : t(`dossier.confirm.status.${s}`, { defaultValue: s }))
  return createPortal(
    <div ref={refPiegeFocus} role="dialog" aria-modal="true" aria-labelledby={titreId} onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 100, background: tk.overlay, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: MOBILE_FONT, animation: 'kycmFade .2s ease both' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, background: tk.card, borderRadius: '24px 24px 0 0', padding: '10px 22px calc(28px + env(safe-area-inset-bottom))', boxShadow: tk.shadowLg, animation: 'kycmUp .32s cubic-bezier(.2,.8,.2,1) both' }}>
        <div style={{ width: 38, height: 5, borderRadius: 'var(--crm-radius-pill)', background: tk.hair, margin: '0 auto 18px' }} />
        <Eyebrow tk={tk}>{t('dossier.confirm.eyebrow')}</Eyebrow>
        <h2 id={titreId} style={{ margin: '10px 0 10px', fontSize: 'var(--crm-text-4xl)', fontWeight: 500, color: tk.ink, letterSpacing: -0.5, lineHeight: 1.2 }}>{t('dossier.confirm.title')}</h2>
        <p style={{ margin: '0 0 16px', fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: tk.inkSoft, lineHeight: 1.55 }}>{t('dossier.confirm.body')}</p>
        <div style={{ background: tk.cardSubtle, borderRadius: 'var(--crm-radius-xl)', padding: 'var(--crm-space-2xl) var(--crm-space-3xl)', marginBottom: 20, fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: tk.inkSoft, lineHeight: 1.7 }}>
          <div><span style={{ color: tk.ink, fontWeight: 600 }}>{t('dossier.confirm.sanctions')}</span> {statusLabel(dossier.sanctions_status)}</div>
          <div><span style={{ color: tk.ink, fontWeight: 600 }}>{t('dossier.confirm.pep')}</span> {statusLabel(dossier.pep_status)}</div>
          <div><span style={{ color: tk.ink, fontWeight: 600 }}>{t('dossier.confirm.vigilance')}</span> {dossier.vigilance === 'renforced' ? t('dossier.confirm.vigilanceEnhanced') : t('dossier.confirm.vigilanceStandard')}</div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--crm-space-xl)' }}>
          <button type="button" onClick={onCancel} style={{ flex: 1, height: 50, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', background: tk.cardSubtle, color: tk.inkSoft, fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, letterSpacing: -0.2 }}>{t('dossier.confirm.cancel')}</button>
          <button type="button" onClick={onConfirm} disabled={pending} style={{ flex: 1, height: 50, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: pending ? 'default' : 'pointer', background: tk.accent, color: tk.accentInk, fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, letterSpacing: -0.2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-md)', boxShadow: tk.shadowSm, opacity: pending ? 0.6 : 1 }}>
            <MEIcon name="check" size={15} color={tk.accentInk} strokeWidth={2.4} />{t('dossier.confirm.submit')}
          </button>
        </div>
        <style>{'@keyframes kycmFade{from{opacity:0}to{opacity:1}}@keyframes kycmUp{from{transform:translateY(100%)}to{transform:none}}'}</style>
      </div>
    </div>,
    document.body,
  )
}
