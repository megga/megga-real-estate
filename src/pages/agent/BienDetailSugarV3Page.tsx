// MEGGA CRM — Fiche bien « Vitrine » (Concept A)
// Port du handoff Claude Design (crm-screen-bien-vitrine.jsx), câblé sur le
// vrai backend. La PHOTO ouvre : galerie immersive + lightbox, puis identité
// (prix/statut), ruban de specs, puis description / caractéristiques /
// acheteurs / perf / mandat / diffusion. Dark mode (palette Vx). Grammaire
// Sugar Pure. Route : /dashboard/listings/:id
//
// Données RÉELLES préservées : useProperty / usePropertyStats /
// useUpdateProperty (+ transition draft→active) / useLogAudit (audit nLPD) /
// useTransactions (deals) / useContacts. Visuels illustratifs (sparkline perf,
// « +18% ») = reproduits de la maquette ; le contenu (desc, features, deals,
// mandat, photos) vient de la base.

import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import { CRM_TOKENS, crmSugarPalette, type DarkTone } from '@/components/crm-sugar/tokens'
import {
  SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import {
  vxPalette, VxIcon, vxFmtCHF, vxFmtNum, vxCompact,
  VxGallery, VxLightbox, VxStatusPill, VxMetaPill, VxCard, VxSectionHead,
  VxSpark, VxAvatar, VxEditInput, type VxIconName, type VxPalette,
} from '@/components/crm-sugar-v3/vitrine/vitrineKit'
import { fmtDateShort } from '@/components/crm-sugar-v3/tokens'
import { bdStageLabel } from '@/components/crm-sugar-v3/bien-detail/BdShared'
import {
  useProperty, useUpdateProperty, type CreatePropertyInput,
} from '@/hooks/useProperties'
import { usePropertyStats } from '@/hooks/usePropertyStats'
import { PropertyStaticMap } from '@/components/map/PropertyStaticMap'
import { useTransactions } from '@/hooks/useTransactions'
import { useContacts } from '@/hooks/useContacts'
import { useLogAudit } from '@/hooks/useAuditLog'
import { useMatching } from '@/hooks/useMatching'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Property } from '@/types/listing'

const DARK_TONE: DarkTone = 'meggaAi'

// ─── Brouillon d'édition (inchangé — câblage réel) ────────────────────────
interface BienEditDraft {
  title: string
  address: string
  price: number | string
  charges_monthly: number | string
  surface_m2: number | string
  rooms: number | string
  bedrooms: number | string
  bathrooms: number | string
  year_built: number | string
  energy_class: string
  description: string
  private_notes: string
  mandate_type: string
  mandate_commission_pct: number | string
  mandate_expires_at: string
}

function buildDraft(b: Property | null | undefined): BienEditDraft {
  return {
    title: b?.title ?? '',
    address: b?.address ?? '',
    price: b?.price ?? 0,
    charges_monthly: b?.charges_monthly ?? 0,
    surface_m2: b?.surface_m2 ?? 0,
    rooms: b?.rooms ?? 0,
    bedrooms: b?.bedrooms ?? 0,
    bathrooms: b?.bathrooms ?? 0,
    year_built: b?.year_built ?? '',
    energy_class: b?.energy_class ?? '',
    description: b?.description ?? '',
    private_notes: b?.private_notes ?? '',
    mandate_type: b?.mandate_type ?? 'exclusive',
    mandate_commission_pct: b?.mandate_commission_pct ?? 3.0,
    mandate_expires_at: b?.mandate_expires_at ?? '',
  }
}

function asNum(v: number | string): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

interface Toast {
  title: string
  lines: string[]
}
interface NextVisit {
  dateISO: string
  time: string
  contactId: string | null
}

// ─── Boutons (port BvBlackBtn / BvGhostBtn / BvCircleBtn) ──────────────────
function BvBlackBtn({
  children, onClick, icon, size = 'md', sp,
}: {
  children: ReactNode
  onClick?: () => void
  icon?: VxIconName
  size?: 'md' | 'lg'
  sp: VxPalette
}) {
  const [h, setH] = useState(false)
  const ht = size === 'lg' ? 48 : 42
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        height: ht,
        padding: size === 'lg' ? '0 24px' : '0 18px',
        borderRadius: 999,
        border: 0,
        background: h ? sp.blackHover : sp.black,
        color: sp.onAccent,
        fontFamily: 'inherit',
        fontWeight: 700,
        fontSize: size === 'lg' ? 14 : 13,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        boxShadow: h ? '0 10px 26px -8px rgba(11,12,14,.4)' : '0 6px 16px -8px rgba(11,12,14,.3)',
        transform: h ? 'translateY(-1px)' : 'none',
        transition: 'all .18s ease',
      }}
    >
      {icon && <VxIcon name={icon} size={14} stroke={sp.onAccent} sw={2} />}
      {children}
    </button>
  )
}

function BvGhostBtn({
  children, onClick, icon, sp, title,
}: {
  children: ReactNode
  onClick?: () => void
  icon?: VxIconName
  sp: VxPalette
  title?: string
}) {
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        height: 42,
        padding: '0 16px',
        borderRadius: 999,
        fontFamily: 'inherit',
        background: h ? sp.card : sp.cardSub,
        color: sp.inkSoft,
        border: '1px solid ' + sp.hairline,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: h ? sp.shadowSm : 'none',
        transition: 'all .16s ease',
      }}
    >
      {icon && <VxIcon name={icon} size={14} stroke={sp.inkSoft} sw={1.9} />}
      {children}
    </button>
  )
}

function BvCircleBtn({
  icon, onClick, title, sp, active,
}: {
  icon: VxIconName
  onClick?: () => void
  title?: string
  sp: VxPalette
  active?: boolean
}) {
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: 42,
        height: 42,
        borderRadius: 999,
        border: active ? 0 : '1px solid ' + sp.hairline,
        background: active ? sp.black : h ? sp.card : sp.cardSub,
        cursor: 'pointer',
        color: active ? sp.onAccent : sp.inkSoft,
        display: 'grid',
        placeItems: 'center',
        boxShadow: h && !active ? sp.shadowSm : 'none',
        transition: 'all .16s ease',
      }}
    >
      <VxIcon name={icon} size={17} stroke={active ? sp.onAccent : sp.inkSoft} sw={1.9} />
    </button>
  )
}

// ─── Cellule de spec (ruban) — icône réelle MEIcon ────────────────────────
function BvSpec({ icon, label, value, sp }: { icon: MEIconName; label: string; value: ReactNode; sp: VxPalette }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: sp.cardSub, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <MEIcon name={icon} size={19} color={sp.ink} strokeWidth={1.7} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: sp.ink, letterSpacing: -0.4, lineHeight: 1, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: sp.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 5, whiteSpace: 'nowrap' }}>{label}</div>
      </div>
    </div>
  )
}

// ─── Stat de performance ──────────────────────────────────────────────────
function BvStat({ icon, label, value, sp }: { icon: VxIconName; label: string; value: string; sp: VxPalette }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: sp.muted, marginBottom: 7 }}>
        <VxIcon name={icon} size={13} stroke={sp.muted} sw={1.8} />
        <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: sp.ink, letterSpacing: -0.7, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

// ─── Ligne de diffusion (portail) ─────────────────────────────────────────
function BvPortal({ name, online, label, sp, dark }: { name: string; online: boolean; label?: string; sp: VxPalette; dark: boolean }) {
  const { t: tr } = useTranslation('listings')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 13, background: sp.cardSub }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: dark ? 'rgba(255,255,255,.08)' : '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, color: sp.ink, boxShadow: sp.shadowSm }}>{name[0]}</div>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: sp.ink }}>{name}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: online ? sp.ok : sp.muted, whiteSpace: 'nowrap' }}>
        <span style={{ width: 6, height: 6, borderRadius: 9, background: online ? sp.ok : sp.muted }} />
        {label ?? (online ? tr('detail.distributionSection.online') : tr('detail.distributionSection.offline'))}
      </span>
    </div>
  )
}

// ─── Événement timeline ───────────────────────────────────────────────────
const BV_HIST_ICON: Record<string, VxIconName> = {
  created: 'pencil',
  published: 'globe',
  updated: 'trend',
}
function BvEvent({ ev, last, sp }: { ev: { at: string; text: string; kind: string }; last: boolean; sp: VxPalette }) {
  return (
    <div style={{ display: 'flex', gap: 13 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 30, height: 30, borderRadius: 999, background: sp.cardSub, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <VxIcon name={BV_HIST_ICON[ev.kind] || 'dot'} size={14} stroke={sp.inkSoft} sw={1.8} />
        </div>
        {!last && <div style={{ width: 2, flex: 1, background: sp.hairline, marginTop: 2, minHeight: 14 }} />}
      </div>
      <div style={{ paddingBottom: last ? 0 : 18, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: sp.muted, letterSpacing: 0.2, fontVariantNumeric: 'tabular-nums' }}>{fmtDateShort(ev.at)}</div>
        <div style={{ fontSize: 13, color: sp.inkSoft, marginTop: 3, lineHeight: 1.5 }}>{ev.text}</div>
      </div>
    </div>
  )
}

interface VisitContact {
  id: string
  firstName: string
  lastName: string
}

// ─── Modal « Planifier une visite » ───────────────────────────────────────
function BvVisitModal({
  open, onClose, title, sp, dark, contacts, onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: string
  sp: VxPalette
  dark: boolean
  contacts: VisitContact[]
  onConfirm: (date: Date, time: string, contact: VisitContact | null) => void
}) {
  const { t: tr } = useTranslation('listings')
  const [day, setDay] = useState(0)
  const [time, setTime] = useState('14:00')
  const [who, setWho] = useState<string | null>(contacts[0]?.id ?? null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  const days: Date[] = []
  for (let i = 1; i <= 5; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    days.push(d)
  }
  const times = ['10:00', '11:30', '14:00', '15:30', '17:00']
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 180, background: 'rgba(15,23,42,.42)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', padding: 24, animation: 'vxFade .18s ease-out' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 460, maxWidth: '100%', background: dark ? '#22242F' : '#fff', borderRadius: 26, boxShadow: '0 40px 100px rgba(15,23,42,.4)', padding: 28, animation: 'vxScaleIn .22s cubic-bezier(.2,.8,.2,1)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: sp.muted, letterSpacing: 1, textTransform: 'uppercase' }}>{tr('detail.visitModal.title')}</div>
            <h3 style={{ margin: '6px 0 0', fontSize: 21, fontWeight: 800, color: sp.ink, letterSpacing: -0.5 }}>{title}</h3>
          </div>
          <div style={{ flex: 1 }} />
          <BvCircleBtn icon="close" onClick={onClose} sp={sp} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: sp.muted, marginBottom: 9, textTransform: 'uppercase', letterSpacing: 0.4 }}>{tr('detail.visitModal.day')}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {days.map((d, i) => {
            const on = i === day
            return (
              <button key={i} onClick={() => setDay(i)} style={{ flex: 1, minWidth: 56, padding: '9px 6px', borderRadius: 13, border: 0, cursor: 'pointer', fontFamily: 'inherit', background: on ? sp.black : sp.cardSub, color: on ? sp.onAccent : sp.inkSoft, textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', opacity: 0.7 }}>{d.toLocaleDateString('fr-CH', { weekday: 'short' })}</div>
                <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{d.getDate()}</div>
              </button>
            )
          })}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: sp.muted, marginBottom: 9, textTransform: 'uppercase', letterSpacing: 0.4 }}>{tr('detail.visitModal.time')}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {times.map(tm => {
            const on = tm === time
            return (
              <button key={tm} onClick={() => setTime(tm)} style={{ padding: '8px 14px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', background: on ? sp.black : sp.cardSub, color: on ? sp.onAccent : sp.inkSoft }}>{tm}</button>
            )
          })}
        </div>
        {contacts.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: sp.muted, marginBottom: 9, textTransform: 'uppercase', letterSpacing: 0.4 }}>{tr('detail.visitModal.visitor')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
              {contacts.map(c => {
                const on = c.id === who
                return (
                  <button key={c.id} onClick={() => setWho(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', background: sp.cardSub, border: 0, textAlign: 'left', boxShadow: on ? '0 0 0 2px ' + sp.ink + ' inset' : 'none' }}>
                    <VxAvatar name={c.firstName + ' ' + c.lastName} size={32} dark={dark} />
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: sp.ink }}>{c.firstName} {c.lastName}</span>
                    {on && <VxIcon name="check" size={16} stroke={sp.ink} sw={2.2} />}
                  </button>
                )
              })}
            </div>
          </>
        )}
        <BvBlackBtn sp={sp} size="lg" onClick={() => { onConfirm(days[day], time, contacts.find(c => c.id === who) ?? null); onClose() }}>
          <span style={{ flex: 1 }}>{tr('detail.visitModal.confirm')}</span>
        </BvBlackBtn>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//   ÉCRAN — Fiche bien Vitrine
// ═══════════════════════════════════════════════════════════════════════════
export default function BienDetailSugarV3Page() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t: tr } = useTranslation('listings')

  // Dark mode (partagé avec la galerie via la même clé localStorage)
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('megga.sugar.dark', dark ? '1' : '0')
  }, [dark])
  const t = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const navSp = crmSugarPalette(t, dark, DARK_TONE)
  const sp = vxPalette(dark)

  // ── Données réelles ──
  const { data: bien, isLoading, isError, error } = useProperty(id)
  const { stats } = usePropertyStats(id)
  const { mutate: updateProperty } = useUpdateProperty()
  const { mutate: logAudit } = useLogAudit()
  const { data: transactions } = useTransactions()
  const dealsForBien = useMemo(
    () => (transactions ?? []).filter(tx => tx.property_id === id),
    [transactions, id],
  )
  const { contacts: contactsAll } = useContacts()
  const contactsById = useMemo(() => {
    const m = new Map<string, { id: string; first_name: string; last_name: string }>()
    ;(contactsAll ?? []).forEach(c => {
      m.set(c.id, { id: c.id, first_name: c.first_name ?? '', last_name: c.last_name ?? '' })
    })
    return m
  }, [contactsAll])

  // Matches IA (suggestions d'acheteurs) — moteur réel, filtré sur ce bien.
  const { matches: allMatches } = useMatching()
  // Statut KYC des acheteurs en deal sur ce bien (rappel non-bloquant).
  const buyerIds = useMemo(
    () => Array.from(new Set(dealsForBien.map(d => d.contact_buyer_id).filter((x): x is string => !!x))),
    [dealsForBien],
  )
  const { data: buyerKyc = [] } = useQuery({
    queryKey: ['vitrine-buyer-kyc', buyerIds],
    queryFn: async (): Promise<{ contact_id: string; dossier_status: string | null }[]> => {
      if (buyerIds.length === 0) return []
      const { data, error } = await supabase
        .from('kyc_cases')
        .select('contact_id, dossier_status, created_at')
        .in('contact_id', buyerIds)
        .in('type', ['buyer_pp', 'buyer_pm'])
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as { contact_id: string; dossier_status: string | null }[]
    },
    enabled: buyerIds.length > 0,
  })
  // Syndication portails externes (Phase 2) — reflète property_syndications.
  // Résilient : si la table n'est pas encore déployée, on dégrade en liste vide
  // (la fiche ne casse pas). La publication se pilote via le copilote WhatsApp.
  const { data: syndications = [] } = useQuery({
    queryKey: ['property-syndications', id],
    queryFn: async (): Promise<{ portal: string; status: string }[]> => {
      const { data, error } = await supabase
        .from('property_syndications')
        .select('portal, status')
        .eq('property_id', id ?? '')
      if (error) return []
      return (data ?? []) as { portal: string; status: string }[]
    },
    enabled: !!id,
  })

  // ── État UI ──
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<BienEditDraft>(() => buildDraft(bien))
  const [toast, setToast] = useState<Toast | null>(null)
  const [lb, setLb] = useState<{ open: boolean; i: number }>({ open: false, i: 0 })
  const [descTab, setDescTab] = useState<'public' | 'private'>('public')
  const [visitOpen, setVisitOpen] = useState(false)
  const [nextVisit, setNextVisit] = useState<NextVisit | null>(null)

  useEffect(() => { if (!editing) setDraft(buildDraft(bien)) }, [bien, editing])
  useEffect(() => {
    if (!toast) return
    const tm = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(tm)
  }, [toast])
  useLayoutEffect(() => { window.scrollTo(0, 0) }, [id])
  // Prochaine visite (aide de planification locale, par bien)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('megga_vitrine_nextvisit_' + id)
      setNextVisit(raw ? (JSON.parse(raw) as NextVisit) : null)
    } catch {
      setNextVisit(null)
    }
  }, [id])
  const saveNextVisit = (nv: NextVisit | null) => {
    setNextVisit(nv)
    try {
      if (nv) window.localStorage.setItem('megga_vitrine_nextvisit_' + id, JSON.stringify(nv))
      else window.localStorage.removeItem('megga_vitrine_nextvisit_' + id)
    } catch {
      /* ignore */
    }
  }

  const onCmd = () => {}
  const onNavigate = (screen: SugarScreenId | string) => {
    switch (screen) {
      case 'today': navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'matching': navigate('/dashboard/matching'); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': navigate('/dashboard/listings'); break
      case 'biens-new': navigate('/dashboard/listings/new'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'docs': navigate('/dashboard/documents'); break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'reseau': navigate('/dashboard/network'); break
      case 'ai':
      case 'julien': navigate('/dashboard/julien'); break
      case 'chat':
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': navigate('/dashboard/settings'); break
      default:
    }
  }

  // ── États transitoires (avant les returns conditionnels : aucun hook après) ──
  const fullBg = dark ? sp.bg : sp.bgGradient
  if (isLoading) {
    return <div style={{ minHeight: '100vh', background: fullBg, display: 'grid', placeItems: 'center', color: sp.muted, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{tr('detail.loading')}</div>
  }
  if (isError) {
    return <div style={{ minHeight: '100vh', background: fullBg, display: 'grid', placeItems: 'center', color: sp.warn, fontFamily: "'Inter Tight', system-ui, sans-serif", padding: 40, textAlign: 'center' }}>{tr('detail.loadError', { message: error?.message ?? tr('detail.unknownError') })}</div>
  }
  if (!bien) {
    return <div style={{ minHeight: '100vh', background: fullBg, display: 'grid', placeItems: 'center', color: sp.muted, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{tr('detail.notFound')}</div>
  }

  // ── Dérivés réels ──
  // Libellé de type de bien : réutilise listings:type.* (mappe le code), sinon
  // capitalise le code brut (compat valeurs hors mapping).
  const TYPE_KEYS = new Set(['apartment', 'house', 'villa', 'commercial', 'land'])
  const typeLabel = (code: string | null | undefined): string => {
    if (!code) return '—'
    if (TYPE_KEYS.has(code)) return tr(`type.${code}`)
    return code.charAt(0).toUpperCase() + code.slice(1)
  }
  // Libellé de type de mandat : mappe les codes connus, sinon code brut (capitalize).
  const MANDATE_KEYS = new Set(['exclusive', 'simple', 'semi_exclusive'])
  const mandateTypeLabel = (code: string | null | undefined): string => {
    if (!code) return '—'
    if (MANDATE_KEYS.has(code)) return tr(`detail.mandate.type.${code}`)
    return code.charAt(0).toUpperCase() + code.slice(1)
  }
  const ref = bien.id.slice(0, 12).toUpperCase()
  const isRent = bien.transaction_type === 'rent'
  const price = bien.price
  const photos = bien.photos ?? []
  const photoCount = photos.length
  const ppm2 = bien.price && bien.surface_m2 ? Math.round(bien.price / bien.surface_m2) : null
  const mandatExp = bien.mandate_expires_at ? new Date(bien.mandate_expires_at) : null
  const daysToExp = mandatExp ? Math.round((mandatExp.getTime() - Date.now()) / 86_400_000) : null
  const features = bien.features ?? []
  const publishedTo = bien.published_at ? ['MEGGA'] : []
  // État de syndication immobilier.ch (queued/published/withdrawn/error ou absent).
  const idxStatus = syndications.find(x => x.portal === 'immobilier_ch')?.status ?? null
  const idxOnline = idxStatus === 'published' || idxStatus === 'queued'
  const idxLabel = idxStatus === 'published'
    ? tr('detail.distributionSection.online')
    : idxStatus === 'queued'
      ? tr('detail.distributionSection.queued')
      : tr('detail.distributionSection.offline')
  const publicDesc =
    bien.description ||
    tr('detail.autoDescription', {
      rooms: bien.rooms || '—',
      surface: bien.surface_m2 || '—',
      address: bien.address || '',
      year: bien.year_built || '—',
      energyClass: bien.energy_class || tr('detail.energyClassUnknown'),
    })

  // Vendeur (owner) : dérivé du contact_seller_id d'un deal, si présent.
  const sellerId = dealsForBien.map(d => d.contact_seller_id).find(Boolean) ?? null
  const owner = sellerId ? contactsById.get(sellerId) ?? null : null

  // Candidats visite = acheteurs des deals sur ce bien.
  const visitContacts: VisitContact[] = Array.from(
    new Map(
      dealsForBien
        .map(d => (d.contact_buyer_id ? contactsById.get(d.contact_buyer_id) : null))
        .filter((c): c is { id: string; first_name: string; last_name: string } => !!c)
        .map(c => [c.id, { id: c.id, firstName: c.first_name, lastName: c.last_name }] as const),
    ).values(),
  )

  // Historique réel (créé / publié / modifié) — pas de mock.
  const history: { at: string; text: string; kind: string }[] = [
    { at: bien.created_at, text: tr('detail.history.created'), kind: 'created' },
    bien.published_at ? { at: bien.published_at, text: tr('detail.history.published'), kind: 'published' } : null,
    bien.updated_at && bien.updated_at !== bien.created_at ? { at: bien.updated_at, text: tr('detail.history.updated'), kind: 'updated' } : null,
  ].filter((e): e is { at: string; text: string; kind: string } => !!e)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  // Suggestions d'acheteurs (matches IA) pour ce bien, hors deals existants.
  const bienMatches = allMatches.filter(
    m => m.propertyId === bien.id && m.status === 'suggested' && !dealsForBien.some(d => d.contact_buyer_id === m.contactId),
  )
  // KYC acheteurs : rappel doux (non-bloquant) si un acheteur en deal n'est pas vérifié.
  const kycByContact = new Map<string, string | null>()
  for (const k of buyerKyc) if (!kycByContact.has(k.contact_id)) kycByContact.set(k.contact_id, k.dossier_status)
  const needsKyc = dealsForBien.some(
    d => d.contact_buyer_id && (kycByContact.get(d.contact_buyer_id) ?? 'none') !== 'verified',
  )

  const setField = <K extends keyof BienEditDraft>(k: K, v: BienEditDraft[K]) =>
    setDraft(d => ({ ...d, [k]: v }))
  const cancelEditing = () => { setDraft(buildDraft(bien)); setEditing(false) }
  const flash = (title: string, lines: string[]) => setToast({ title, lines })

  // Save réel (update + transition draft→active + audit nLPD) — préservé.
  const saveAndPublish = () => {
    const wasDraft = bien.status === 'draft'
    const patch: { id: string } & Partial<CreatePropertyInput> & { status?: string; published_at?: string } = {
      id: bien.id,
      title: draft.title,
      address: draft.address,
      description: draft.description,
      private_notes: draft.private_notes,
    }
    const p = asNum(draft.price); if (p != null) patch.price = p
    const charges = asNum(draft.charges_monthly); if (charges != null) patch.charges_monthly = charges
    const area = asNum(draft.surface_m2); if (area != null) patch.surface_m2 = area
    const rooms = asNum(draft.rooms); if (rooms != null) patch.rooms = rooms
    const beds = asNum(draft.bedrooms); if (beds != null) patch.bedrooms = beds
    const baths = asNum(draft.bathrooms); if (baths != null) patch.bathrooms = baths
    const year = asNum(draft.year_built); if (year != null) patch.year_built = year
    if (draft.energy_class) patch.energy_class = draft.energy_class
    if (draft.mandate_type) patch.mandate_type = draft.mandate_type
    const commission = asNum(draft.mandate_commission_pct); if (commission != null) patch.mandate_commission_pct = commission
    if (draft.mandate_expires_at) patch.mandate_expires_at = draft.mandate_expires_at
    if (wasDraft) {
      patch.status = 'active'
      // published_at posé par le trigger DB set_property_published_at (1er passage en 'active')
    }
    updateProperty(patch, {
      onSuccess: () => {
        logAudit({
          category: 'bien',
          severity: 'info',
          action: wasDraft ? 'Annonce publiée' : 'Annonce modifiée',
          entityType: 'property',
          entityId: bien.id,
          objectLabel: draft.title || bien.title,
          metadata: {
            price: p ?? bien.price,
            mandate_type: draft.mandate_type,
            surface_m2: area ?? bien.surface_m2,
            ...(wasDraft ? { transition: 'draft → active' } : {}),
          },
        })
        setEditing(false)
        setToast({
          title: wasDraft ? tr('detail.toast.publishedTitle') : tr('detail.toast.updatedTitle'),
          lines: [
            wasDraft ? tr('detail.toast.statusActive') : null,
            tr('detail.toast.auditAdded'),
          ].filter((x): x is string => !!x),
        })
      },
    })
  }

  const rootVars = {
    '--vx-card': sp.card,
    '--vx-hairline': sp.hairline,
    '--vx-shadow': sp.shadow,
    '--vx-shadow-hov': sp.shadowHov,
  } as CSSProperties

  const mandatRows = [
    { l: tr('detail.mandate.commission'), v: bien.mandate_commission_pct ? bien.mandate_commission_pct + ' %' : '—' },
    { l: tr('detail.mandate.signedOn'), v: bien.mandate_signed_at ? fmtDateShort(bien.mandate_signed_at) : '—' },
    {
      l: tr('detail.mandate.expiresOn'),
      v: bien.mandate_expires_at ? fmtDateShort(bien.mandate_expires_at) : '—',
      note: daysToExp != null ? (daysToExp > 0 ? tr('detail.mandate.expiresIn', { count: daysToExp }) : tr('detail.mandate.overdue', { count: Math.abs(daysToExp) })) : null,
      warn: daysToExp != null && daysToExp <= 30,
    },
  ]

  return (
    <div data-screen-label="Fiche bien · Vitrine" style={{ minHeight: '100vh', background: fullBg, color: sp.ink, fontFamily: "'Inter Tight', system-ui, sans-serif", fontVariantNumeric: 'tabular-nums', ...rootVars }}>
      <style>{SUGAR_KEYFRAMES}</style>
      <style>{`
        @keyframes vxFadeUp { from { transform:translateY(16px); opacity:0; } to { transform:none; opacity:1; } }
        @keyframes vxFade { from {opacity:0;} to {opacity:1;} }
        @keyframes vxScaleIn { from {opacity:0; transform:scale(.96);} to {opacity:1; transform:scale(1);} }
        .vx-tile { transition: transform .4s cubic-bezier(.2,.8,.2,1); }
        .vx-desc-text { font-size:14.5px; line-height:1.75; color:${sp.inkSoft}; font-weight:400; }
        @media (max-width: 1080px){ .vx-body { grid-template-columns:1fr !important; } .vx-hero-gallery { height:340px !important; } }
        @media (prefers-reduced-motion: reduce){ [style*="vxFadeUp"]{ animation:none !important; opacity:1 !important; transform:none !important; } }
      `}</style>

      <SugarTopNav active="biens" t={t} sp={navSp} onNavigate={onNavigate} onCmd={onCmd} />
      <div style={{ display: 'flex' }}>
        <SugarIconRail active="biens" onNavigate={onNavigate} onCmd={onCmd} dark={dark} setDark={setDark} sp={navSp} />

        <main style={{ flex: 1, padding: '40px 40px 90px', minWidth: 0, maxWidth: 1300 }}>
          {/* Header */}
          <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
            <BvGhostBtn icon="arrowL" sp={sp} onClick={() => onNavigate('biens')}>{tr('title')}</BvGhostBtn>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: sp.muted, letterSpacing: 0.3 }}>{ref}</span>
            <div style={{ flex: 1 }} />
            {editing && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 13px', borderRadius: 999, background: sp.black, color: sp.onAccent, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                <span style={{ width: 6, height: 6, borderRadius: 9, background: sp.warn, animation: 'vxFade 1s ease-in-out infinite alternate' }} />
                {tr('detail.editingBadge')}
              </span>
            )}
            <BvCircleBtn icon={editing ? 'close' : 'pencil'} sp={sp} title={editing ? tr('detail.cancelEdit') : tr('detail.editListing')} onClick={() => { if (editing) cancelEditing(); else setEditing(true) }} />
            {!editing && <BvGhostBtn sp={sp} onClick={() => setVisitOpen(true)}>{tr('detail.scheduleVisit')}</BvGhostBtn>}
            <BvBlackBtn sp={sp} onClick={editing ? saveAndPublish : () => flash(tr('detail.distribution'), [publishedTo.length ? tr('detail.onlineOn', { portals: publishedTo.join(', ') }) : tr('detail.notPublishedYet')])}>
              {editing ? tr('detail.saveAndPublish') : bien.published_at ? tr('detail.manageDistribution') : tr('detail.publishProperty')}
            </BvBlackBtn>
          </header>

          {/* HERO : galerie + identité + ruban specs */}
          <div style={{ background: sp.card, border: '1px solid ' + sp.hairline, borderRadius: 24, overflow: 'hidden', boxShadow: sp.shadow, marginBottom: 22, animation: 'vxFadeUp .5s cubic-bezier(.2,.8,.2,1) both' }}>
            <div style={{ position: 'relative' }} className="vx-hero-gallery">
              <VxGallery photos={photos} count={photoCount} dark={dark} onOpen={i => setLb({ open: true, i })} />
              <button onClick={() => setLb({ open: true, i: 0 })} title={tr('detail.viewPhotos', { count: photoCount })} style={{ position: 'absolute', right: 16, bottom: 16, width: 46, height: 46, borderRadius: 999, border: 0, cursor: 'pointer', background: 'rgba(255,255,255,.94)', color: '#15171C', display: 'grid', placeItems: 'center', boxShadow: '0 6px 18px -6px rgba(0,0,0,.4)' }}>
                <MEIcon name="gallery" size={20} color="#15171C" strokeWidth={1.8} />
              </button>
            </div>

            {/* identité */}
            <div style={{ padding: '26px 30px 0' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                    <VxStatusPill status={bien.status} dark={dark} />
                    {bien.c2pa_verified && <VxMetaPill icon="shieldCheck" dark={dark}>{tr('detail.c2paVerified')}</VxMetaPill>}
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: sp.muted, letterSpacing: 1, textTransform: 'uppercase' }}>
                    {[bien.canton, isRent ? tr('detail.transactionRent') : tr('detail.transactionSale'), typeLabel(bien.type)].filter(Boolean).join(' · ')}
                  </div>
                  <h1 style={{ margin: '9px 0 8px', fontSize: 34, fontWeight: 800, color: sp.ink, letterSpacing: -0.9, lineHeight: 1.1 }}>
                    {editing ? <VxEditInput dark={dark} value={draft.title} onChange={v => setField('title', v)} block style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.9 }} /> : bien.title}
                  </h1>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: sp.muted, fontSize: 14, fontWeight: 500 }}>
                    <VxIcon name="map" size={15} stroke={sp.muted} sw={1.8} />
                    {editing ? <VxEditInput dark={dark} value={draft.address} onChange={v => setField('address', v)} style={{ fontSize: 14, width: 300, color: sp.ink }} /> : bien.address}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: sp.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>{isRent ? tr('detail.rentLabel') : tr('detail.salePriceLabel')}</div>
                  <div style={{ fontSize: 40, fontWeight: 800, color: sp.ink, letterSpacing: -1.4, lineHeight: 1, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {editing ? <VxEditInput dark={dark} type="number" prefix="CHF" value={draft.price} onChange={v => setField('price', v)} style={{ fontSize: 30, fontWeight: 800, width: 190, letterSpacing: -1 }} /> : vxFmtCHF(price)}
                    {isRent && <span style={{ fontSize: 15, color: sp.muted, fontWeight: 600 }}>{tr('detail.perMonth')}</span>}
                  </div>
                  {bien.charges_monthly ? (
                    <div style={{ marginTop: 7, fontSize: 13, color: sp.muted, fontWeight: 500 }}>{tr('detail.chargesLine', { amount: bien.charges_monthly, suffix: isRent ? tr('detail.perMonth') : '' })}</div>
                  ) : null}
                </div>
              </div>

              {/* ruban specs */}
              <div style={{ marginTop: 24, paddingTop: 22, paddingBottom: 24, borderTop: '1px solid ' + sp.hairline, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 18 }}>
                <BvSpec icon="surface" label={tr('detail.spec.surface')} value={(bien.surface_m2 ?? '—') + ' m²'} sp={sp} />
                <BvSpec icon="home" label={tr('detail.spec.rooms')} value={bien.rooms ?? '—'} sp={sp} />
                <BvSpec icon="bed" label={tr('detail.spec.bedrooms')} value={bien.bedrooms ?? '—'} sp={sp} />
                <BvSpec icon="bath" label={tr('detail.spec.bathrooms')} value={bien.bathrooms ?? '—'} sp={sp} />
                <BvSpec icon="calendar" label={tr('detail.spec.year')} value={bien.year_built ?? '—'} sp={sp} />
                <BvSpec icon="bolt" label={tr('detail.spec.energyClass')} value={bien.energy_class ?? '—'} sp={sp} />
                <BvSpec icon="trending-up" label="CHF/m²" value={ppm2 ? vxCompact(ppm2) : '—'} sp={sp} />
              </div>
            </div>
          </div>

          {/* Localisation — carte statique (Mapbox Static Images, lazy ; coords du bien) */}
          <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid ' + sp.hairline, height: 220, position: 'relative', marginBottom: 22 }}>
            <PropertyStaticMap lat={bien.lat} lng={bien.lng} address={bien.address} className="w-full h-full" emptyHint={tr('detail.locationUnavailable')} />
          </div>

          {/* BODY : 2 colonnes */}
          <div className="vx-body" style={{ display: 'grid', gridTemplateColumns: '1.62fr 1fr', gap: 22, alignItems: 'start' }}>
            {/* COLONNE PRINCIPALE */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}>
              {/* Description */}
              <VxCard index={0}>
                <VxSectionHead
                  dark={dark}
                  eyebrow={tr('detail.description.eyebrow')}
                  title={descTab === 'public' ? tr('detail.description.publicTitle') : tr('detail.description.privateTitle')}
                  right={
                    <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 999, background: sp.cardSub }}>
                      {([{ id: 'public', l: tr('detail.description.tabPublic'), icon: 'globe' }, { id: 'private', l: tr('detail.description.tabPrivate'), icon: 'lock' }] as const).map(o => {
                        const a = descTab === o.id
                        return (
                          <button key={o.id} onClick={() => setDescTab(o.id as 'public' | 'private')} style={{ height: 30, padding: '0 13px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', background: a ? sp.card : 'transparent', color: a ? sp.ink : sp.muted, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, boxShadow: a ? sp.shadowSm : 'none', transition: 'all .15s' }}>
                            <VxIcon name={o.icon} size={11} stroke={a ? sp.ink : sp.muted} sw={1.9} />{o.l}
                          </button>
                        )
                      })}
                    </div>
                  }
                />
                {descTab === 'public' ? (
                  editing ? (
                    <textarea value={draft.description} onChange={e => setField('description', e.target.value)} rows={6} placeholder={publicDesc} style={{ width: '100%', padding: 15, borderRadius: 14, background: sp.cardSub, border: 0, fontFamily: 'inherit', fontSize: 14.5, color: sp.ink, lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box', boxShadow: 'inset 0 0 0 2px ' + sp.ink }} />
                  ) : (
                    <p className="vx-desc-text" style={{ margin: 0 }}>{publicDesc}</p>
                  )
                ) : editing ? (
                  <textarea value={draft.private_notes} onChange={e => setField('private_notes', e.target.value)} rows={5} placeholder={tr('detail.description.privatePlaceholder')} style={{ width: '100%', padding: 15, borderRadius: 14, background: sp.cardSub, border: 0, fontFamily: 'inherit', fontSize: 14.5, color: sp.ink, lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box', boxShadow: 'inset 0 0 0 2px ' + sp.ink }} />
                ) : bien.private_notes ? (
                  <>
                    <p className="vx-desc-text" style={{ margin: 0 }}>{bien.private_notes}</p>
                    <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: sp.cardSub, color: sp.muted, fontSize: 11, fontWeight: 600 }}>
                      <VxIcon name="lock" size={11} stroke={sp.muted} sw={2} /> {tr('detail.description.privateOnly')}
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 14, background: sp.cardSub, color: sp.muted, fontSize: 12.5, fontWeight: 600 }}>
                    <VxIcon name="lock" size={13} stroke={sp.muted} sw={1.9} /> {tr('detail.description.privateEmpty')}
                  </div>
                )}
              </VxCard>

              {/* Caractéristiques */}
              <VxCard index={1}>
                <VxSectionHead dark={dark} eyebrow={tr('detail.specs.eyebrow')} title={tr('detail.specs.title')} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                  {[
                    { k: 'type', l: tr('detail.specs.propertyType'), v: typeLabel(bien.type) },
                    { k: 'transaction', l: tr('detail.specs.transaction'), v: isRent ? tr('detail.transactionRent') : tr('detail.transactionSale') },
                    { k: 'surface', l: tr('detail.specs.livingArea'), v: (bien.surface_m2 ?? '—') + ' m²' },
                    { k: 'rooms', l: tr('detail.spec.rooms'), v: bien.rooms ?? '—' },
                    { k: 'bedrooms', l: tr('detail.spec.bedrooms'), v: bien.bedrooms ?? '—' },
                    { k: 'bathrooms', l: tr('detail.specs.bathrooms'), v: bien.bathrooms ?? '—' },
                    { k: 'year', l: tr('detail.spec.year'), v: bien.year_built ?? '—' },
                    { k: 'energy', l: tr('detail.specs.energyClass'), v: bien.energy_class ? tr('detail.specs.energyClassValue', { grade: bien.energy_class }) : '—' },
                    { k: 'charges', l: tr('detail.specs.charges'), v: bien.charges_monthly ? 'CHF ' + bien.charges_monthly + (isRent ? tr('detail.perMonth') : '') : '—' },
                  ].map(s => (
                    <div key={s.k} style={{ padding: 15, borderRadius: 15, background: sp.cardSub }}>
                      <div style={{ fontSize: 11, color: sp.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>{s.l}</div>
                      <div style={{ marginTop: 7, fontSize: 16, fontWeight: 700, color: sp.ink, letterSpacing: -0.3, fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
                    </div>
                  ))}
                </div>
                {features.length > 0 && (
                  <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {features.map(f => (
                      <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 30, padding: '0 13px', borderRadius: 999, background: sp.cardSub, color: sp.inkSoft, fontSize: 12.5, fontWeight: 600 }}>
                        <VxIcon name="check" size={12} stroke={sp.ok} sw={2.4} />{f}
                      </span>
                    ))}
                  </div>
                )}
              </VxCard>

              {/* Acheteurs en cours */}
              {(dealsForBien.length > 0 || bienMatches.length > 0) && (
                <VxCard index={2}>
                  <VxSectionHead
                    dark={dark}
                    eyebrow={tr('detail.buyers.eyebrow', { count: dealsForBien.length })}
                    title={tr('detail.buyers.title')}
                    right={<BvGhostBtn sp={sp} icon="arrowR" onClick={() => onNavigate('pipeline')}>{tr('detail.buyers.pipeline')}</BvGhostBtn>}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {dealsForBien.map(d => {
                      const c = d.contact_buyer_id ? contactsById.get(d.contact_buyer_id) : null
                      const offer = d.price_offered ?? d.price_final
                      return (
                        <div key={d.id} onClick={() => navigate(`/dashboard/transactions/${d.id}`)} style={{ padding: '14px 16px', background: sp.cardSub, borderRadius: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 13 }}>
                          {c && <VxAvatar name={c.first_name + ' ' + c.last_name} size={40} dark={dark} />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: sp.ink }}>{c ? c.first_name + ' ' + c.last_name : tr('detail.buyers.buyerFallback')}</div>
                            <div style={{ fontSize: 12, color: sp.muted, fontWeight: 500, marginTop: 1 }}>
                              {bdStageLabel(d.stage)}{offer ? tr('detail.buyers.offerSuffix', { amount: vxFmtCHF(offer) }) : ''}
                            </div>
                          </div>
                          <VxIcon name="chevR" size={16} stroke={sp.muted} sw={1.8} />
                        </div>
                      )
                    })}
                    {bienMatches.map(m => (
                      <div key={m.id} style={{ padding: '12px 16px', borderRadius: 16, border: '1px dashed ' + sp.hairline, display: 'flex', alignItems: 'center', gap: 13 }}>
                        <VxAvatar name={m.contactName} size={36} dark={dark} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: sp.ink }}>{m.contactName}</div>
                          <div style={{ fontSize: 12, color: sp.muted, fontWeight: 500, marginTop: 1 }}>{tr('detail.buyers.matchAffinity', { score: m.score })}</div>
                        </div>
                        <BvGhostBtn sp={sp} icon="send" onClick={() => onNavigate('matching')}>{tr('detail.buyers.propose')}</BvGhostBtn>
                      </div>
                    ))}
                  </div>
                  {needsKyc && (
                    <div style={{ marginTop: 14, padding: '13px 15px', borderRadius: 16, background: sp.cardSub, display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ width: 28, height: 28, borderRadius: 999, background: dark ? 'rgba(255,255,255,.08)' : '#fff', display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: sp.shadowSm }}>
                        <VxIcon name="shield" size={14} stroke={sp.muted} sw={1.8} />
                      </span>
                      <div style={{ flex: 1, fontSize: 12.5, color: sp.inkSoft, lineHeight: 1.5 }}>
                        <Trans i18nKey="detail.buyers.kycNotice" t={tr}>
                          <b style={{ color: sp.ink }}>KYC à compléter</b> pour un acheteur — optionnel à ce stade, requis avant signature.
                        </Trans>
                      </div>
                      <BvGhostBtn sp={sp} onClick={() => onNavigate('kyc')}>{tr('detail.buyers.startKyc')}</BvGhostBtn>
                    </div>
                  )}
                </VxCard>
              )}
            </div>

            {/* SIDEBAR */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}>
              {/* Prochaine visite */}
              {nextVisit && (() => {
                const vd = new Date(nextVisit.dateISO)
                const vc = nextVisit.contactId ? contactsById.get(nextVisit.contactId) : null
                return (
                  <VxCard index={0} padding={22}>
                    <VxSectionHead dark={dark} eyebrow={tr('detail.nextVisit.eyebrow')} />
                    <div style={{ fontSize: 21, fontWeight: 800, color: sp.ink, letterSpacing: -0.5, textTransform: 'capitalize', lineHeight: 1.15 }}>
                      {vd.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: sp.inkSoft, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{nextVisit.time}</div>
                    {vc && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 14, padding: 12, borderRadius: 14, background: sp.cardSub }}>
                        <VxAvatar name={vc.first_name + ' ' + vc.last_name} size={36} dark={dark} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: sp.ink }}>{vc.first_name} {vc.last_name}</div>
                          <div style={{ fontSize: 11.5, color: sp.muted, fontWeight: 500 }}>{tr('detail.nextVisit.visitor')}</div>
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                      <BvGhostBtn sp={sp} icon="cal" onClick={() => setVisitOpen(true)}>{tr('detail.nextVisit.reschedule')}</BvGhostBtn>
                      <BvGhostBtn sp={sp} onClick={() => { saveNextVisit(null); flash(tr('detail.nextVisit.cancelledTitle'), [tr('detail.nextVisit.cancelledLine')]) }}>{tr('detail.nextVisit.cancel')}</BvGhostBtn>
                    </div>
                  </VxCard>
                )
              })()}

              {/* Performance */}
              <VxCard index={1} padding={22}>
                <VxSectionHead dark={dark} eyebrow={tr('detail.performance.eyebrow')} />
                <div style={{ display: 'flex', gap: 12 }}>
                  <BvStat icon="eye" label={tr('detail.performance.views')} value={vxFmtNum(stats.views)} sp={sp} />
                  <BvStat icon="heart" label={tr('detail.performance.favorites')} value={vxFmtNum(stats.favorites)} sp={sp} />
                  <BvStat icon="cal" label={tr('detail.performance.requests')} value={vxFmtNum(stats.visitRequests)} sp={sp} />
                </div>
                <div style={{ marginTop: 16 }}><VxSpark points={[210, 260, 240, 320, 360, 410, 480]} color={sp.ok} /></div>
                <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: sp.ok }}>
                  <VxIcon name="trend" size={13} stroke={sp.ok} sw={2} /> {tr('detail.performance.trend', { percent: 18 })}
                </div>
              </VxCard>

              {/* Mandat */}
              <VxCard index={2} padding={22}>
                <VxSectionHead dark={dark} eyebrow={tr('detail.mandate.eyebrow')} />
                <h3 style={{ margin: '-8px 0 16px', fontSize: 18, fontWeight: 800, color: sp.ink, letterSpacing: -0.4, textTransform: 'capitalize' }}>{tr('detail.mandate.heading', { type: mandateTypeLabel(bien.mandate_type) })}</h3>
                {owner && (
                  <button onClick={() => navigate(`/dashboard/contacts/${owner.id}`)} style={{ width: '100%', textAlign: 'left', padding: 13, background: sp.cardSub, border: 0, borderRadius: 15, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <VxAvatar name={owner.first_name + ' ' + owner.last_name} size={40} dark={dark} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: sp.ink }}>{owner.first_name} {owner.last_name}</div>
                      <div style={{ fontSize: 11.5, color: sp.muted, fontWeight: 500 }}>{tr('detail.mandate.sellerViewProfile')}</div>
                    </div>
                    <VxIcon name="chevR" size={16} stroke={sp.muted} sw={1.8} />
                  </button>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {mandatRows.map(r => (
                    <div key={r.l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontSize: 13, color: sp.muted, fontWeight: 500, whiteSpace: 'nowrap' }}>{r.l}</span>
                      <span style={{ fontSize: 13.5, color: sp.ink, fontWeight: 700, fontVariantNumeric: 'tabular-nums', display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}>
                        {r.v}
                        {r.note && <span style={{ fontSize: 11, fontWeight: 700, color: r.warn ? sp.warn : sp.muted, padding: '2px 8px', borderRadius: 999, background: r.warn ? sp.warnBg : sp.cardSub }}>{r.note}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </VxCard>

              {/* Diffusion */}
              <VxCard index={3} padding={22}>
                <VxSectionHead dark={dark} eyebrow={tr('detail.distributionSection.eyebrow')} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(() => {
                    const rows: { name: string; online: boolean; label?: string }[] = []
                    if (bien.published_at) rows.push({ name: 'MEGGA', online: true })
                    if (idxStatus) rows.push({ name: 'immobilier.ch', online: idxOnline, label: idxLabel })
                    if (rows.length === 0) {
                      return <BvPortal name={tr('detail.distributionSection.notPublished')} online={false} sp={sp} dark={dark} />
                    }
                    return rows.map(p => <BvPortal key={p.name} name={p.name} online={p.online} label={p.label} sp={sp} dark={dark} />)
                  })()}
                </div>
              </VxCard>

              {/* Historique */}
              <VxCard index={4} padding={22}>
                <VxSectionHead dark={dark} eyebrow={tr('detail.historySection.eyebrow')} />
                <div>
                  {history.map((ev, i) => <BvEvent key={i} ev={ev} last={i === history.length - 1} sp={sp} />)}
                </div>
              </VxCard>
            </div>
          </div>
        </main>
      </div>

      {/* Lightbox */}
      {photoCount > 0 && (
        <VxLightbox open={lb.open} index={lb.i} photos={photos} count={photoCount} onClose={() => setLb({ open: false, i: lb.i })} onIndex={i => setLb({ open: true, i })} />
      )}

      {/* Modal visite */}
      <BvVisitModal
        open={visitOpen}
        onClose={() => setVisitOpen(false)}
        title={bien.title}
        sp={sp}
        dark={dark}
        contacts={visitContacts}
        onConfirm={(d, tm, contact) => {
          saveNextVisit({ dateISO: d.toISOString(), time: tm, contactId: contact ? contact.id : null })
          flash(tr('detail.visitModal.scheduledTitle'), [tr('detail.visitModal.scheduledLine', { date: d.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' }), time: tm }), tr('detail.visitModal.scheduledHint')])
        }}
      />

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 220, background: dark ? '#22242F' : '#0B0C0E', color: '#fff', borderRadius: 18, padding: '16px 20px', boxShadow: '0 24px 60px rgba(15,23,42,.4)', maxWidth: 440, animation: 'vxFadeUp .3s cubic-bezier(.2,.8,.2,1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: toast.lines.length ? 8 : 0 }}>
            <span style={{ width: 24, height: 24, borderRadius: 999, background: 'rgba(255,255,255,.14)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><VxIcon name="check" size={14} stroke="#fff" sw={2.4} /></span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{toast.title}</span>
          </div>
          {toast.lines.map((l, i) => <div key={i} style={{ fontSize: 12.5, color: 'rgba(255,255,255,.7)', paddingLeft: 34, lineHeight: 1.5 }}>{l}</div>)}
        </div>
      )}
    </div>
  )
}
