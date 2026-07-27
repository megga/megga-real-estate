// MEGGA CRM — Fiche bien « Sugar Pure » V4 (mono-page dans le bento)
// ─────────────────────────────────────────────────────────────────────────
// RE-LAYOUT du handoff Claude Design (crm-screen-bien-fiche.jsx) posé sur le
// MÊME câblage réel que la V3 (BienDetailSugarV3Page). Ce n'est PAS un nouveau
// branchement : hooks, dérivations et mutations sont repris tels quels de la V3
// — seule la mise en page change (look « pager » : bento central arrondi, même
// cadre que Today / Pipeline / Mes biens, en-tête épinglé + corps scrollable,
// colonne bridée à 1120 px). Route cible : /dashboard/listings/:id
//
// Fond : crmSugarPalette(t, dark, darkTone).pageBg — le MÊME que Today/Pipeline
// (correctif clé vs V3 qui utilisait le dégradé local vxPalette.bgGradient).
//
// Honnêteté des données (cf. CLAUDE.md) :
//   • description / caractéristiques / features / deals / mandat / photos = base.
//   • sparkline de perf + « +18 % » = repères illustratifs de la maquette (repris
//     verbatim de la V3) ; Vues/Favoris/Demandes sont RÉELS (usePropertyStats).
//   • KYC acheteur = rappel DOUX non-bloquant (jamais un verrou).
//   • Diffusion = portail unique immobilier.ch ; le passage privé→public suit le
//     vrai chemin de publication (updateProperty draft→active + audit nLPD).
//   • Aucune donnée fabriquée : pas de description « magnifique … » ni de features
//     de secours inventées — repli honnête via listings:detail.autoDescription.
//   • Toasts honnêtes : aucun envoi auto / WhatsApp promis ; seule l'écriture DB
//     (édition + audit) est affirmée car elle a réellement lieu.

import {
  useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode,
} from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import {
  crmSugarPalette, type DarkTone, sugarThemeTokens, SUGAR_DARK_TONE,
} from '@/components/crm-sugar/tokens'
import {
  SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import {
  VxIcon, VxGallery, VxLightbox, VxStatusPill, VxMetaPill, VxSectionHead,
  VxSpark, VxAvatar, type VxIconName,
} from '@/components/crm-sugar-v3/vitrine/vitrineKit'
import {
  vxPalette, vxFmtCHF, vxFmtNum, vxCompact, type VxPalette,
} from '@/components/crm-sugar-v3/vitrine/vitrineTokens'
import { fmtDateShort } from '@/components/crm-sugar-v3/tokens'
import {
  useProperty, useUpdateProperty, type CreatePropertyInput,
} from '@/hooks/useProperties'
import { usePropertyStats } from '@/hooks/usePropertyStats'
import { useTransactions } from '@/hooks/useTransactions'
import { useContacts } from '@/hooks/useContacts'
import { useLogAudit } from '@/hooks/useAuditLog'
import { useMatching } from '@/hooks/useMatching'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Property } from '@/types/listing'

const DARK_TONE: DarkTone = SUGAR_DARK_TONE
const BF_MAXW = 1120 // largeur max de la colonne de contenu (bride le « trop large »)

// ─── Interfaces locales ────────────────────────────────────────────────────
interface Toast {
  title: string
  lines: string[]
}
interface NextVisit {
  dateISO: string
  time: string
  contactId: string | null
}
interface VisitContact {
  id: string
  firstName: string
  lastName: string
}
/** Brouillon d'édition — 4 champs exposés par la modale (comme le handoff). */
interface EditDraft {
  title: string
  address: string
  price: number | string
  description: string
}

function asNum(v: number | string): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// ═══════════════════════════════════════════════════════════════════════════
//   Primitives boutons (port Bf* — états STATIQUES, aucune animation de survol)
// ═══════════════════════════════════════════════════════════════════════════
function BfBlackBtn({
  children, onClick, icon, size = 'md', vx,
}: {
  children: ReactNode
  onClick?: () => void
  icon?: VxIconName
  size?: 'md' | 'lg'
  vx: VxPalette
}) {
  const [h, setH] = useState(false)
  const ht = size === 'lg' ? 46 : 42
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        height: ht,
        padding: size === 'lg' ? '0 22px' : '0 18px',
        borderRadius: 999,
        border: 0,
        background: h ? vx.blackHover : vx.black,
        color: vx.onAccent,
        fontFamily: 'inherit',
        fontWeight: 700,
        fontSize: size === 'lg' ? 14 : 13,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        transition: 'background .12s ease',
      }}
    >
      {icon && <VxIcon name={icon} size={14} stroke={vx.onAccent} sw={2} />}
      {children}
    </button>
  )
}

function BfGhostBtn({
  children, onClick, icon, vx, title,
}: {
  children: ReactNode
  onClick?: () => void
  icon?: VxIconName
  vx: VxPalette
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
        height: 40,
        padding: '0 15px',
        borderRadius: 999,
        fontFamily: 'inherit',
        background: h ? vx.cardSub2 : vx.cardSub,
        color: vx.inkSoft,
        border: 0,
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        transition: 'background .12s ease',
      }}
    >
      {icon && <VxIcon name={icon} size={14} stroke={vx.inkSoft} sw={1.9} />}
      {children}
    </button>
  )
}

function BfCircleBtn({
  icon, onClick, title, vx, active,
}: {
  icon: VxIconName
  onClick?: () => void
  title?: string
  vx: VxPalette
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
        width: 40,
        height: 40,
        borderRadius: 999,
        border: 0,
        background: active ? vx.black : h ? vx.cardSub2 : vx.cardSub,
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        transition: 'background .12s ease',
        flexShrink: 0,
      }}
    >
      <VxIcon name={icon} size={17} stroke={active ? vx.onAccent : vx.inkSoft} sw={1.9} />
    </button>
  )
}

// ─── Cellule de spec (ruban héro) ──────────────────────────────────────────
function BfSpec({ icon, label, value, vx }: { icon: VxIconName; label: string; value: ReactNode; vx: VxPalette }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <div style={{ display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <VxIcon name={icon} size={28} stroke={vx.ink} sw={1.6} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: vx.ink, letterSpacing: -0.4, lineHeight: 1, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: vx.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 5, whiteSpace: 'nowrap' }}>{label}</div>
      </div>
    </div>
  )
}

// ─── Stat de performance (bandeau) ─────────────────────────────────────────
function BfStat({ icon, label, value, vx }: { icon: VxIconName; label: string; value: string; vx: VxPalette }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: vx.muted, marginBottom: 7 }}>
        <VxIcon name={icon} size={13} stroke={vx.muted} sw={1.8} />
        <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: vx.ink, letterSpacing: -0.7, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

// ─── Ligne de diffusion (portail unique) ───────────────────────────────────
function BfPortal({
  name, online, label, vx, action, onAction,
}: {
  name: string
  online: boolean
  label?: string
  vx: VxPalette
  action?: string
  onAction?: () => void
}) {
  const { t: tr } = useTranslation('listings')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 13, background: vx.cardSub }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: vx.card, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, color: vx.ink, boxShadow: vx.shadowSm }}>{name[0]}</div>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: vx.ink }}>{name}</span>
      {online ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: vx.ok, whiteSpace: 'nowrap' }}>
          <span style={{ width: 6, height: 6, borderRadius: 9, background: vx.ok }} />
          {label ?? tr('detail.distributionSection.online')}
        </span>
      ) : action ? (
        <BfGhostBtn vx={vx} onClick={onAction}>{action}</BfGhostBtn>
      ) : (
        <span style={{ fontSize: 11.5, fontWeight: 700, color: vx.muted }}>{label ?? tr('detail.distributionSection.offline')}</span>
      )}
    </div>
  )
}

// ─── Toast (contenu dans le root, position absolute) ───────────────────────
function BfToast({ toast, dark }: { toast: Toast | null; dark: boolean }) {
  if (!toast) return null
  return (
    <div style={{ position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)', zIndex: 120, background: dark ? '#22242F' : '#0B0C0E', color: '#fff', borderRadius: 18, padding: '15px 19px', boxShadow: '0 24px 60px rgba(15,23,42,.4)', maxWidth: 440, animation: 'bfUp .3s cubic-bezier(.2,.8,.2,1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: toast.lines.length ? 8 : 0 }}>
        <span style={{ width: 24, height: 24, borderRadius: 999, background: 'rgba(255,255,255,.14)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <VxIcon name="check" size={14} stroke="#fff" sw={2.4} />
        </span>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{toast.title}</span>
      </div>
      {toast.lines.map((l, i) => (
        <div key={i} style={{ fontSize: 12.5, color: 'rgba(255,255,255,.72)', paddingLeft: 34, lineHeight: 1.5 }}>{l}</div>
      ))}
    </div>
  )
}

// ─── Modale « Modifier l'annonce » (Sugar, fond sombre opaque #17181A) ─────
function BfEditModal({
  open, onClose, bien, isRent, vx, dark, onSave,
}: {
  open: boolean
  onClose: () => void
  bien: Property
  isRent: boolean
  vx: VxPalette
  dark: boolean
  onSave: (d: EditDraft) => void
}) {
  const { t: tr } = useTranslation('listings')
  const [d, setD] = useState<EditDraft>({ title: '', address: '', price: 0, description: '' })
  useEffect(() => {
    if (open) setD({ title: bien.title, address: bien.address, price: bien.price ?? 0, description: bien.description ?? '' })
  }, [open, bien])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  const set = <K extends keyof EditDraft>(k: K, v: EditDraft[K]) => setD(p => ({ ...p, [k]: v }))
  const sub = dark ? '#1E1F21' : vx.cardSub
  const lbl: CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: vx.muted, letterSpacing: 0.3, marginBottom: 7 }
  const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', border: 0, outline: 'none', background: sub, color: vx.ink, borderRadius: 12, padding: '12px 14px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }
  const ov = dark ? 'rgba(4,6,10,.62)' : 'rgba(24,32,48,.34)'
  return (
    <div onMouseDown={onClose} style={{ position: 'absolute', inset: 0, zIndex: 130, background: ov, backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', padding: 24, animation: 'bfFade .18s ease-out' }}>
      <style>{`.bf-edit-inp:focus{box-shadow:0 0 0 2px ${vx.ink} inset}`}</style>
      <div onMouseDown={e => e.stopPropagation()} style={{ width: 520, maxWidth: '100%', maxHeight: '92%', overflowY: 'auto', background: dark ? '#17181A' : vx.card, borderRadius: 28, boxShadow: '0 40px 100px rgba(15,23,42,.34), 0 8px 24px rgba(15,23,42,.14)', padding: 28, animation: 'bfRise .24s cubic-bezier(.2,.8,.2,1)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 22 }}>
          <h3 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: vx.ink, letterSpacing: -0.5, flex: 1 }}>{tr('detail.editListing')}</h3>
          <button onClick={onClose} aria-label={tr('cancel')} style={{ width: 34, height: 34, borderRadius: 999, border: 0, background: sub, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <VxIcon name="close" size={15} stroke={vx.inkSoft} sw={1.9} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label style={lbl}>{tr('fiche.edit.titleLabel')}</label><input className="bf-edit-inp" value={d.title} onChange={e => set('title', e.target.value)} style={inp} /></div>
          <div><label style={lbl}>{tr('fiche.edit.addressLabel')}</label><input className="bf-edit-inp" value={d.address} onChange={e => set('address', e.target.value)} style={inp} /></div>
          {!isRent && (
            <div>
              <label style={lbl}>{tr('detail.salePriceLabel')}</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 700, color: vx.muted }}>CHF</span>
                <input className="bf-edit-inp" type="number" value={d.price} onChange={e => set('price', e.target.value)} style={{ ...inp, paddingLeft: 52, fontVariantNumeric: 'tabular-nums' }} />
              </div>
            </div>
          )}
          <div><label style={lbl}>{tr('detail.description.eyebrow')}</label><textarea className="bf-edit-inp" value={d.description} onChange={e => set('description', e.target.value)} rows={6} style={{ ...inp, lineHeight: 1.65, fontWeight: 500, resize: 'vertical' }} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: '0 0 auto', height: 46, padding: '0 22px', borderRadius: 999, border: 0, background: sub, color: vx.inkSoft, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{tr('cancel')}</button>
          <button onClick={() => onSave(d)} style={{ flex: 1, height: 46, borderRadius: 999, border: 0, background: vx.black, color: vx.onAccent, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{tr('detail.saveAndPublish')}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modale « Planifier une visite » (Sugar, fond sombre opaque #17181A) ───
function BfVisitModal({
  open, onClose, title, vx, dark, contacts, onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: string
  vx: VxPalette
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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  const days: Date[] = []
  for (let i = 1; i <= 5; i++) {
    const dd = new Date()
    dd.setDate(dd.getDate() + i)
    days.push(dd)
  }
  const times = ['10:00', '11:30', '14:00', '15:30', '17:00']
  const ov = dark ? 'rgba(4,6,10,.62)' : 'rgba(24,32,48,.34)'
  return (
    <div onMouseDown={onClose} style={{ position: 'absolute', inset: 0, zIndex: 130, background: ov, backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', padding: 24, animation: 'bfFade .18s ease-out' }}>
      <div onMouseDown={e => e.stopPropagation()} style={{ width: 462, maxWidth: '100%', maxHeight: '92%', overflowY: 'auto', background: dark ? '#17181A' : vx.card, borderRadius: 28, boxShadow: '0 40px 100px rgba(15,23,42,.34), 0 8px 24px rgba(15,23,42,.14)', padding: 28, animation: 'bfRise .24s cubic-bezier(.2,.8,.2,1)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: vx.ink, letterSpacing: -0.5 }}>{title}</h3>
          <div style={{ flex: 1 }} />
          <BfCircleBtn icon="close" onClick={onClose} vx={vx} />
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: vx.muted, marginBottom: 9, textTransform: 'uppercase', letterSpacing: 0.4 }}>{tr('detail.visitModal.day')}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {days.map((dd, i) => {
            const on = i === day
            return (
              <button key={i} onClick={() => setDay(i)} style={{ flex: 1, minWidth: 56, padding: '9px 6px', borderRadius: 13, border: 0, cursor: 'pointer', fontFamily: 'inherit', background: on ? vx.black : vx.cardSub, color: on ? vx.onAccent : vx.inkSoft, textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', opacity: 0.7 }}>{dd.toLocaleDateString('fr-CH', { weekday: 'short' })}</div>
                <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{dd.getDate()}</div>
              </button>
            )
          })}
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: vx.muted, marginBottom: 9, textTransform: 'uppercase', letterSpacing: 0.4 }}>{tr('detail.visitModal.time')}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {times.map(tm => {
            const on = tm === time
            return <button key={tm} onClick={() => setTime(tm)} style={{ padding: '8px 14px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', background: on ? vx.black : vx.cardSub, color: on ? vx.onAccent : vx.inkSoft }}>{tm}</button>
          })}
        </div>
        {contacts.length > 0 && (
          <>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: vx.muted, marginBottom: 9, textTransform: 'uppercase', letterSpacing: 0.4 }}>{tr('detail.visitModal.visitor')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
              {contacts.map(c => {
                const on = c.id === who
                return (
                  <button key={c.id} onClick={() => setWho(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', background: vx.cardSub, border: 0, textAlign: 'left', boxShadow: on ? '0 0 0 2px ' + vx.ink + ' inset' : 'none' }}>
                    <VxAvatar name={c.firstName + ' ' + c.lastName} size={32} dark={dark} />
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: vx.ink }}>{c.firstName} {c.lastName}</span>
                    {on && <VxIcon name="check" size={16} stroke={vx.ink} sw={2.2} />}
                  </button>
                )
              })}
            </div>
          </>
        )}
        <BfBlackBtn vx={vx} size="lg" onClick={() => { onConfirm(days[day], time, contacts.find(c => c.id === who) ?? null); onClose() }}>
          <span style={{ flex: 1, textAlign: 'center' }}>{tr('detail.visitModal.confirm')}</span>
        </BfBlackBtn>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//   ÉCRAN — Fiche bien Sugar Pure V4 (mono-page, bento)
// ═══════════════════════════════════════════════════════════════════════════
export default function BienDetailSugarV4Page() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t: tr } = useTranslation('listings')

  // Dark mode (clé localStorage partagée avec la galerie / la V3)
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
  const t = sugarThemeTokens(dark)
  const sp = crmSugarPalette(t, dark, DARK_TONE) // cadre/shell (pageBg = Today/Pipeline)
  const vx = vxPalette(dark) // intérieur des cartes (palette vitrine)

  // ── Données réelles (identiques à la V3) ──
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
  // Statut KYC des acheteurs en deal (rappel non-bloquant).
  const buyerIds = useMemo(
    () => Array.from(new Set(dealsForBien.map(d => d.contact_buyer_id).filter((x): x is string => !!x))),
    [dealsForBien],
  )
  const { data: buyerKyc = [] } = useQuery({
    queryKey: ['vitrine-buyer-kyc', buyerIds],
    queryFn: async (): Promise<{ contact_id: string; dossier_status: string | null }[]> => {
      if (buyerIds.length === 0) return []
      const { data, error: qErr } = await supabase
        .from('kyc_cases')
        .select('contact_id, dossier_status, created_at')
        .in('contact_id', buyerIds)
        .in('type', ['buyer_pp', 'buyer_pm'])
        .order('created_at', { ascending: false })
      if (qErr) throw qErr
      return (data ?? []) as { contact_id: string; dossier_status: string | null }[]
    },
    enabled: buyerIds.length > 0,
  })
  // Syndication portails externes — reflète property_syndications ; dégrade en []
  // si la table n'est pas déployée (la fiche ne casse pas).
  const { data: syndications = [] } = useQuery({
    queryKey: ['property-syndications', id],
    queryFn: async (): Promise<{ portal: string; status: string }[]> => {
      const { data, error: qErr } = await supabase
        .from('property_syndications')
        .select('portal, status')
        .eq('property_id', id ?? '')
      if (qErr) return []
      return (data ?? []) as { portal: string; status: string }[]
    },
    enabled: !!id,
  })

  // ── État UI ──
  const scrollRef = useRef<HTMLDivElement>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [visitOpen, setVisitOpen] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [lb, setLb] = useState<{ open: boolean; i: number }>({ open: false, i: 0 })
  const [nextVisit, setNextVisit] = useState<NextVisit | null>(null)

  useEffect(() => {
    if (!toast) return
    const tm = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(tm)
  }, [toast])
  useEffect(() => {
    setEditOpen(false)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [id])
  // Prochaine visite — même clé de stockage que la V3 (planning partagé).
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
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'ai':
      case 'julien': navigate('/dashboard/julien'); break
      case 'chat':
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': navigate('/dashboard/settings'); break
      default:
    }
  }

  // ── États transitoires (fond = pageBg Sugar, PAS le dégradé vitrine) ──
  if (isLoading) {
    return <div style={{ minHeight: '100vh', background: sp.pageBg, display: 'grid', placeItems: 'center', color: vx.muted, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{tr('detail.loading')}</div>
  }
  if (isError) {
    return <div style={{ minHeight: '100vh', background: sp.pageBg, display: 'grid', placeItems: 'center', color: vx.warn, fontFamily: "'Inter Tight', system-ui, sans-serif", padding: 40, textAlign: 'center' }}>{tr('detail.loadError', { message: error?.message ?? tr('detail.unknownError') })}</div>
  }
  if (!bien) {
    return <div style={{ minHeight: '100vh', background: sp.pageBg, display: 'grid', placeItems: 'center', color: vx.muted, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>{tr('detail.notFound')}</div>
  }

  // ── Dérivés réels (repris de la V3) ──
  const TYPE_KEYS = new Set(['apartment', 'house', 'villa', 'commercial', 'land'])
  const typeLabel = (code: string | null | undefined): string => {
    if (!code) return '—'
    if (TYPE_KEYS.has(code)) return tr(`type.${code}`)
    return code.charAt(0).toUpperCase() + code.slice(1)
  }
  const MANDATE_KEYS = new Set(['exclusive', 'simple', 'semi_exclusive'])
  const mandateTypeLabel = (code: string | null | undefined): string => {
    if (!code) return '—'
    if (MANDATE_KEYS.has(code)) return tr(`detail.mandate.type.${code}`)
    return code.charAt(0).toUpperCase() + code.slice(1)
  }
  const isRent = bien.transaction_type === 'rent'
  const price = bien.price
  const photos = bien.photos ?? []
  const photoCount = photos.length
  const ppm2 = bien.price && bien.surface_m2 ? Math.round(bien.price / bien.surface_m2) : null
  const mandatExp = bien.mandate_expires_at ? new Date(bien.mandate_expires_at) : null
  const daysToExp = mandatExp ? Math.round((mandatExp.getTime() - Date.now()) / 86_400_000) : null
  const features = bien.features ?? []
  // Off-market = non publié (proxy réel de la « visibilité privée » du handoff).
  const offMarket = !bien.published_at
  // État de syndication immobilier.ch (queued/published/withdrawn/error ou absent).
  const idxStatus = syndications.find(x => x.portal === 'immobilier_ch')?.status ?? null
  const idxOnline = idxStatus === 'published' || idxStatus === 'queued'
  const idxLabel = idxStatus === 'published'
    ? tr('detail.distributionSection.online')
    : idxStatus === 'queued'
      ? tr('detail.distributionSection.queued')
      : tr('detail.distributionSection.offline')
  // Repli honnête : description auto factuelle (jamais un texte marketing inventé).
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

  // Suggestions d'acheteurs (matches IA) hors deals existants.
  const bienMatches = allMatches.filter(
    m => m.propertyId === bien.id && m.status === 'suggested' && !dealsForBien.some(d => d.contact_buyer_id === m.contactId),
  )
  // KYC acheteurs : rappel doux (non-bloquant).
  const kycByContact = new Map<string, string | null>()
  for (const k of buyerKyc) if (!kycByContact.has(k.contact_id)) kycByContact.set(k.contact_id, k.dossier_status)
  const needsKyc = dealsForBien.some(
    d => d.contact_buyer_id && (kycByContact.get(d.contact_buyer_id) ?? 'none') !== 'verified',
  )

  const flash = (title: string, lines: string[]) => setToast({ title, lines })

  // Édition réelle (update + transition draft→active + audit nLPD) — 4 champs.
  const saveEdit = (d: EditDraft) => {
    const wasDraft = bien.status === 'draft'
    const patch: { id: string } & Partial<CreatePropertyInput> & { status?: string } = {
      id: bien.id,
      title: d.title || bien.title,
      address: d.address || bien.address,
      description: d.description,
    }
    if (!isRent) {
      const p = asNum(d.price)
      if (p != null) patch.price = p
    }
    if (wasDraft) patch.status = 'active' // published_at posé par le trigger DB
    updateProperty(patch, {
      onSuccess: () => {
        logAudit({
          category: 'bien',
          severity: 'info',
          action: wasDraft ? 'Annonce publiée' : 'Annonce modifiée',
          entityType: 'property',
          entityId: bien.id,
          objectLabel: d.title || bien.title,
          metadata: {
            price: patch.price ?? bien.price,
            ...(wasDraft ? { transition: 'draft → active' } : {}),
          },
        })
        setEditOpen(false)
        flash(
          wasDraft ? tr('detail.toast.publishedTitle') : tr('detail.toast.updatedTitle'),
          [wasDraft ? tr('detail.toast.statusActive') : null, tr('detail.toast.auditAdded')].filter((x): x is string => !!x),
        )
      },
    })
  }

  // Diffusion : passage privé→public par le vrai chemin de publication.
  // (La syndication immobilier.ch elle-même est pilotée en backend — on n'affirme
  //  donc PAS un push vers le portail, seulement la mise en ligne MEGGA.)
  const publishBien = () => {
    const patch: { id: string } & Partial<CreatePropertyInput> & { status?: string } = { id: bien.id }
    if (bien.status === 'draft') patch.status = 'active'
    updateProperty(patch, {
      onSuccess: () => {
        logAudit({
          category: 'bien',
          severity: 'info',
          action: 'Annonce publiée',
          entityType: 'property',
          entityId: bien.id,
          objectLabel: bien.title,
          metadata: { transition: 'draft → active' },
        })
        flash(tr('detail.toast.publishedTitle'), [tr('detail.toast.statusActive'), tr('detail.toast.auditAdded')])
      },
    })
  }

  const rootVars = {
    '--vx-card': vx.card,
    '--vx-hairline': vx.hairline,
    '--vx-shadow': vx.shadow,
    '--vx-shadow-hov': vx.shadowHov,
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

  const specCells = [
    { k: 'type', l: tr('detail.specs.propertyType'), v: typeLabel(bien.type) },
    { k: 'transaction', l: tr('detail.specs.transaction'), v: isRent ? tr('detail.transactionRent') : tr('detail.transactionSale') },
    { k: 'surface', l: tr('detail.specs.livingArea'), v: (bien.surface_m2 ?? '—') + ' m²' },
    { k: 'rooms', l: tr('detail.spec.rooms'), v: bien.rooms ?? '—' },
    { k: 'bedrooms', l: tr('detail.spec.bedrooms'), v: bien.bedrooms ?? '—' },
    { k: 'bathrooms', l: tr('detail.specs.bathrooms'), v: bien.bathrooms ?? '—' },
    { k: 'year', l: tr('detail.spec.year'), v: bien.year_built ?? '—' },
    { k: 'energy', l: tr('detail.specs.energyClass'), v: bien.energy_class ? tr('detail.specs.energyClassValue', { grade: bien.energy_class }) : '—' },
    { k: 'charges', l: tr('detail.specs.charges'), v: bien.charges_monthly ? 'CHF ' + bien.charges_monthly + (isRent ? tr('detail.perMonth') : '') : '—' },
  ]

  return (
    <div
      data-screen-label="Fiche bien · Sugar V4"
      style={{
        position: 'relative',
        background: sp.pageBg,
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter Tight', system-ui, sans-serif",
        color: sp.ink,
        fontVariantNumeric: 'tabular-nums',
        ...rootVars,
      }}
    >
      <style>{SUGAR_KEYFRAMES}</style>
      <style>{`
        @keyframes vxFade { from {opacity:0;} to {opacity:1;} }
        @keyframes bfUp { from { opacity:0; transform:translateY(14px);} to { opacity:1; transform:none;} }
        @keyframes bfFade { from {opacity:0;} to {opacity:1;} }
        @keyframes bfRise { from {opacity:0; transform:translateY(12px) scale(.985);} to {opacity:1; transform:none;} }
        .vx-tile { transition: transform .4s cubic-bezier(.2,.8,.2,1); }
        .bf-scroll::-webkit-scrollbar { width: 10px; }
        .bf-scroll::-webkit-scrollbar-thumb { background: ${dark ? 'rgba(255,255,255,.12)' : 'rgba(15,23,42,.14)'}; border-radius: 99px; border: 3px solid transparent; background-clip: content-box; }
        .bf-foot { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 26px; align-items: start; }
        @media (max-width: 980px){ .bf-foot { grid-template-columns: 1fr; } }
        @media (prefers-reduced-motion: reduce){ [style*="bfUp"]{ animation:none !important; opacity:1 !important; transform:none !important; } }
      `}</style>

      <SugarTopNav active="biens" t={t} sp={sp} onNavigate={onNavigate} onCmd={onCmd} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SugarIconRail active="biens" onNavigate={onNavigate} onCmd={onCmd} dark={dark} setDark={setDark} sp={sp} />
        <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingRight: 24, paddingBottom: 22 }}>
          {/* BENTO central (look pager, sans slide) */}
          <div style={{ position: 'relative', height: '100%', borderRadius: 26, overflow: 'hidden', border: `1px solid ${sp.frameBorder}`, boxShadow: sp.shadow, display: 'flex', flexDirection: 'column' }}>

            {/* En-tête épinglé */}
            <div style={{ flexShrink: 0, padding: '20px 34px 14px' }}>
              <div style={{ maxWidth: BF_MAXW, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button onClick={() => onNavigate('biens')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 14px', borderRadius: 999, background: vx.card, boxShadow: vx.shadowSm, border: 0, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: vx.inkSoft, cursor: 'pointer' }}>
                  <VxIcon name="arrowL" size={13} stroke={vx.inkSoft} /> {tr('title')}
                </button>
                <div style={{ flex: 1 }} />
                <BfCircleBtn icon="pencil" vx={vx} title={tr('detail.editListing')} onClick={() => setEditOpen(true)} />
              </div>
            </div>

            {/* Corps scrollable */}
            <div ref={scrollRef} className="bf-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 34px 40px' }}>
              <div style={{ maxWidth: BF_MAXW, margin: '0 auto' }}>

                {/* HÉRO : galerie + identité + ruban specs */}
                <div style={{ background: vx.card, borderRadius: 24, overflow: 'hidden', boxShadow: vx.shadow, marginBottom: 20, animation: 'bfUp .5s cubic-bezier(.2,.8,.2,1) both' }}>
                  <div style={{ position: 'relative' }}>
                    <VxGallery photos={photos} count={photoCount} dark={dark} onOpen={i => setLb({ open: true, i })} />
                  </div>
                  <div style={{ padding: '24px 28px 26px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 44, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 260 }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 13, flexWrap: 'wrap' }}>
                          <VxStatusPill status={bien.status} dark={dark} />
                          {offMarket && <VxMetaPill icon="lock" dark={dark}>{tr('fiche.offMarket')}</VxMetaPill>}
                          {bien.c2pa_verified && <VxMetaPill icon="shieldCheck" dark={dark}>{tr('detail.c2paVerified')}</VxMetaPill>}
                        </div>
                        <h1 style={{ margin: '0 0 8px', fontSize: 32, fontWeight: 800, color: vx.ink, letterSpacing: -0.9, lineHeight: 1.1, textWrap: 'balance' }}>
                          {bien.title}
                        </h1>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: vx.muted, fontSize: 14, fontWeight: 500 }}>
                          <VxIcon name="map" size={15} stroke={vx.muted} sw={1.8} />
                          {bien.address}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: vx.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>{isRent ? tr('detail.rentLabel') : tr('detail.salePriceLabel')}</div>
                        <div style={{ fontSize: 38, fontWeight: 800, color: vx.ink, letterSpacing: -1.4, lineHeight: 1, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {vxFmtCHF(price)}
                          {isRent && <span style={{ fontSize: 15, color: vx.muted, fontWeight: 600 }}>{tr('detail.perMonth')}</span>}
                        </div>
                        {bien.charges_monthly ? (
                          <div style={{ marginTop: 7, fontSize: 13, color: vx.muted, fontWeight: 500 }}>{tr('detail.chargesLine', { amount: bien.charges_monthly, suffix: isRent ? tr('detail.perMonth') : '' })}</div>
                        ) : null}
                      </div>
                    </div>
                    <div style={{ marginTop: 22, paddingTop: 20, borderTop: '1px solid ' + vx.hairline, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 18 }}>
                      <BfSpec icon="ruler" label={tr('detail.spec.surface')} value={(bien.surface_m2 ?? '—') + ' m²'} vx={vx} />
                      <BfSpec icon="home" label={tr('detail.spec.rooms')} value={bien.rooms ?? '—'} vx={vx} />
                      <BfSpec icon="bed" label={tr('detail.spec.bedrooms')} value={bien.bedrooms ?? '—'} vx={vx} />
                      <BfSpec icon="bath" label={tr('detail.spec.bathrooms')} value={bien.bathrooms ?? '—'} vx={vx} />
                      <BfSpec icon="cal" label={tr('detail.spec.year')} value={bien.year_built ?? '—'} vx={vx} />
                      <BfSpec icon="bolt" label={tr('detail.spec.energyClass')} value={bien.energy_class ?? '—'} vx={vx} />
                      <BfSpec icon="trend" label="CHF/m²" value={ppm2 ? vxCompact(ppm2) : '—'} vx={vx} />
                    </div>
                  </div>
                </div>

                {/* CORPS — une seule bento sectionnée (dividers hairline) */}
                <div style={{ background: vx.card, borderRadius: 24, boxShadow: vx.shadow, overflow: 'hidden', animation: 'bfUp .5s cubic-bezier(.2,.8,.2,1) .05s both' }}>

                  {/* Description + équipements */}
                  <div style={{ padding: '26px 28px' }}>
                    <VxSectionHead dark={dark} eyebrow={tr('detail.description.eyebrow')} title={tr('detail.description.publicTitle')} />
                    <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.75, color: vx.inkSoft, fontWeight: 400, textWrap: 'pretty' }}>{publicDesc}</p>
                    {features.length > 0 && (
                      <div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {features.map(f => (
                          <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 30, padding: '0 13px', borderRadius: 999, background: vx.cardSub, color: vx.inkSoft, fontSize: 12.5, fontWeight: 600 }}>
                            <VxIcon name="check" size={12} stroke={vx.ok} sw={2.4} />{f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ height: 1, background: vx.hairline }} />

                  {/* Performance — bandeau pleine largeur (Vues/Favoris/Demandes RÉELS) */}
                  <div style={{ padding: '18px 28px', display: 'flex', alignItems: 'center', gap: 30, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: vx.muted, letterSpacing: 1.1, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{tr('detail.performance.eyebrow')}</div>
                    <BfStat icon="eye" label={tr('detail.performance.views')} value={vxFmtNum(stats.views)} vx={vx} />
                    <BfStat icon="heart" label={tr('detail.performance.favorites')} value={vxFmtNum(stats.favorites)} vx={vx} />
                    <BfStat icon="cal" label={tr('detail.performance.requests')} value={vxFmtNum(stats.visitRequests)} vx={vx} />
                    <div style={{ flex: '1.4 1 160px', minWidth: 160 }}><VxSpark points={[210, 260, 240, 320, 360, 410, 480]} color={vx.ok} /></div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: vx.ok, whiteSpace: 'nowrap' }}>
                      <VxIcon name="trend" size={13} stroke={vx.ok} sw={2} /> {tr('fiche.performance.trendShort', { percent: 18 })}
                    </span>
                  </div>
                  <div style={{ height: 1, background: vx.hairline }} />

                  {/* Caractéristiques */}
                  <div style={{ padding: '26px 28px' }}>
                    <VxSectionHead dark={dark} eyebrow={tr('detail.specs.eyebrow')} title={tr('detail.specs.title')} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                      {specCells.map(s => (
                        <div key={s.k} style={{ padding: 15, borderRadius: 15, background: vx.cardSub }}>
                          <div style={{ fontSize: 11, color: vx.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>{s.l}</div>
                          <div style={{ marginTop: 7, fontSize: 16, fontWeight: 700, color: vx.ink, letterSpacing: -0.3, fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ height: 1, background: vx.hairline }} />

                  {/* Acheteurs en cours */}
                  <div style={{ padding: '26px 28px' }}>
                    <VxSectionHead
                      dark={dark}
                      eyebrow={tr('detail.buyers.eyebrow', { count: dealsForBien.length })}
                      title={tr('detail.buyers.title')}
                      right={<BfGhostBtn vx={vx} icon="arrowR" onClick={() => onNavigate('pipeline')}>{tr('detail.buyers.pipeline')}</BfGhostBtn>}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {dealsForBien.length === 0 && bienMatches.length === 0 && (
                        <div style={{ padding: '16px 4px', fontSize: 13.5, color: vx.muted, fontWeight: 500 }}>{tr('fiche.buyers.empty')}</div>
                      )}
                      {dealsForBien.map(d => {
                        const c = d.contact_buyer_id ? contactsById.get(d.contact_buyer_id) : null
                        return (
                          <button key={d.id} onClick={() => navigate(`/dashboard/transactions/${d.id}`)} style={{ textAlign: 'left', padding: '13px 18px 13px 15px', background: vx.cardSub, borderRadius: 16, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 13, border: 0, fontFamily: 'inherit', width: 'auto', maxWidth: '100%' }}>
                            {c && <VxAvatar name={c.first_name + ' ' + c.last_name} size={40} dark={dark} />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {/* Verbatim maquette : nom de l'acheteur seul (l'étape/offre du deal
                                  ne s'affiche pas ici — la fiche renvoie au deal au clic). */}
                              <div style={{ fontSize: 14, fontWeight: 700, color: vx.ink }}>{c ? c.first_name + ' ' + c.last_name : tr('detail.buyers.buyerFallback')}</div>
                            </div>
                            <VxIcon name="chevR" size={16} stroke={vx.muted} sw={1.8} />
                          </button>
                        )
                      })}
                      {bienMatches.map(m => (
                        <div key={m.id} style={{ padding: '12px 15px', borderRadius: 16, background: vx.cardSub, display: 'inline-flex', alignItems: 'center', gap: 13, maxWidth: '100%' }}>
                          <VxAvatar name={m.contactName} size={36} dark={dark} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: vx.ink }}>{m.contactName}</div>
                            <div style={{ fontSize: 12, color: vx.muted, fontWeight: 500, marginTop: 1 }}>{tr('detail.buyers.matchAffinity', { score: m.score })}</div>
                          </div>
                          <BfGhostBtn vx={vx} icon="send" onClick={() => onNavigate('matching')}>{tr('detail.buyers.propose')}</BfGhostBtn>
                        </div>
                      ))}
                    </div>
                    {needsKyc && (
                      <div style={{ marginTop: 14, padding: '13px 15px', borderRadius: 16, background: vx.cardSub, display: 'inline-flex', gap: 12, alignItems: 'center', maxWidth: '100%' }}>
                        <VxIcon name="shield" size={22} stroke={vx.ink} sw={1.6} />
                        <div style={{ flex: 1, fontSize: 12.5, color: vx.inkSoft, lineHeight: 1.5 }}>
                          <Trans i18nKey="detail.buyers.kycNotice" t={tr}>
                            <b style={{ color: vx.ink }}>KYC à compléter</b> pour un acheteur, optionnel à ce stade, requis avant signature.
                          </Trans>
                        </div>
                        <BfGhostBtn vx={vx} onClick={() => onNavigate('kyc')}>{tr('detail.buyers.startKyc')}</BfGhostBtn>
                      </div>
                    )}
                  </div>
                  <div style={{ height: 1, background: vx.hairline }} />

                  {/* Pied opérationnel : Visites · Mandat · Diffusion */}
                  <div className="bf-foot" style={{ padding: '26px 28px' }}>
                    {/* Prochaine visite */}
                    {nextVisit ? (() => {
                      const vd = new Date(nextVisit.dateISO)
                      const vc = nextVisit.contactId ? contactsById.get(nextVisit.contactId) : null
                      return (
                        <div>
                          <VxSectionHead dark={dark} eyebrow={tr('detail.nextVisit.eyebrow')} />
                          <div style={{ fontSize: 21, fontWeight: 800, color: vx.ink, letterSpacing: -0.5, textTransform: 'capitalize', lineHeight: 1.15 }}>{vd.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: vx.inkSoft, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{nextVisit.time}</div>
                          {vc && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 14, padding: 12, borderRadius: 14, background: vx.cardSub }}>
                              <VxAvatar name={vc.first_name + ' ' + vc.last_name} size={36} dark={dark} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 700, color: vx.ink }}>{vc.first_name} {vc.last_name}</div>
                                <div style={{ fontSize: 11.5, color: vx.muted, fontWeight: 500 }}>{tr('detail.nextVisit.visitor')}</div>
                              </div>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                            <BfGhostBtn vx={vx} icon="cal" onClick={() => setVisitOpen(true)}>{tr('detail.nextVisit.reschedule')}</BfGhostBtn>
                            <BfGhostBtn vx={vx} onClick={() => { saveNextVisit(null); flash(tr('detail.nextVisit.cancelledTitle'), [tr('detail.nextVisit.cancelledLine')]) }}>{tr('detail.nextVisit.cancel')}</BfGhostBtn>
                          </div>
                        </div>
                      )
                    })() : (
                      <div>
                        <VxSectionHead dark={dark} eyebrow={tr('fiche.visits.eyebrow')} />
                        <div style={{ fontSize: 14, fontWeight: 600, color: vx.inkSoft, lineHeight: 1.5 }}>{tr('fiche.visits.none')}</div>
                        <div style={{ marginTop: 14 }}><BfBlackBtn vx={vx} icon="cal" onClick={() => setVisitOpen(true)}>{tr('detail.scheduleVisit')}</BfBlackBtn></div>
                      </div>
                    )}

                    {/* Mandat + vendeur */}
                    <div>
                      <VxSectionHead dark={dark} eyebrow={tr('detail.mandate.eyebrow')} />
                      <h3 style={{ margin: '-8px 0 16px', fontSize: 18, fontWeight: 800, color: vx.ink, letterSpacing: -0.4, textTransform: 'capitalize' }}>{tr('detail.mandate.heading', { type: mandateTypeLabel(bien.mandate_type) })}</h3>
                      {owner && (
                        <button onClick={() => navigate(`/dashboard/contacts/${owner.id}`)} style={{ width: '100%', textAlign: 'left', padding: 13, background: vx.cardSub, border: 0, borderRadius: 15, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                          <VxAvatar name={owner.first_name + ' ' + owner.last_name} size={40} dark={dark} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: vx.ink }}>{owner.first_name} {owner.last_name}</div>
                            <div style={{ fontSize: 11.5, color: vx.muted, fontWeight: 500 }}>{tr('detail.mandate.sellerViewProfile')}</div>
                          </div>
                          <VxIcon name="chevR" size={16} stroke={vx.muted} sw={1.8} />
                        </button>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                        {mandatRows.map(r => (
                          <div key={r.l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <span style={{ fontSize: 13, color: vx.muted, fontWeight: 500, whiteSpace: 'nowrap' }}>{r.l}</span>
                            <span style={{ fontSize: 13.5, color: vx.ink, fontWeight: 700, fontVariantNumeric: 'tabular-nums', display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}>
                              {r.v}
                              {r.note && <span style={{ fontSize: 11, fontWeight: 700, color: r.warn ? vx.warn : vx.muted, padding: '2px 8px', borderRadius: 999, background: r.warn ? vx.warnBg : vx.cardSub }}>{r.note}</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                      {daysToExp != null && daysToExp <= 60 && (
                        <div style={{ marginTop: 16 }}>
                          <BfBlackBtn vx={vx} icon="pencil" onClick={() => flash(tr('fiche.mandate.renewToastTitle'), [tr('fiche.mandate.renewToastLine')])}>{tr('fiche.mandate.renew')}</BfBlackBtn>
                        </div>
                      )}
                    </div>

                    {/* Diffusion */}
                    <div>
                      <VxSectionHead dark={dark} eyebrow={tr('detail.distributionSection.eyebrow')} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <BfPortal
                          name="immobilier.ch"
                          online={idxOnline}
                          label={idxLabel}
                          vx={vx}
                          action={offMarket ? tr('fiche.diffusion.publish') : undefined}
                          onAction={publishBien}
                        />
                      </div>
                      <button
                        onClick={() => flash(tr('fiche.diffusion.previewToastTitle'), [idxOnline ? tr('fiche.diffusion.previewOnlineLine') : tr('fiche.diffusion.previewOfflineLine')])}
                        style={{ marginTop: 12, width: '100%', height: 40, borderRadius: 13, border: 0, background: vx.cardSub, color: vx.ink, fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                      >
                        <VxIcon name="external" size={14} stroke={vx.ink} sw={1.8} /> {tr('fiche.diffusion.publicPreview')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Lightbox contenue — clippée au bento central (pager), comme le handoff */}
            {photoCount > 0 && (
              <VxLightbox contained open={lb.open} index={lb.i} photos={photos} count={photoCount} onClose={() => setLb({ open: false, i: lb.i })} onIndex={i => setLb({ open: true, i })} />
            )}
          </div>
        </main>
      </div>

      {/* Modales (contenues dans le root, position absolute · fond sombre opaque) */}
      <BfEditModal open={editOpen} onClose={() => setEditOpen(false)} bien={bien} isRent={isRent} vx={vx} dark={dark} onSave={saveEdit} />
      <BfVisitModal
        open={visitOpen}
        onClose={() => setVisitOpen(false)}
        title={bien.title}
        vx={vx}
        dark={dark}
        contacts={visitContacts}
        onConfirm={(d, tm, contact) => {
          saveNextVisit({ dateISO: d.toISOString(), time: tm, contactId: contact ? contact.id : null })
          flash(tr('detail.visitModal.scheduledTitle'), [tr('detail.visitModal.scheduledLine', { date: d.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' }), time: tm }), tr('detail.visitModal.scheduledHint')])
        }}
      />
      <BfToast toast={toast} dark={dark} />
    </div>
  )
}
