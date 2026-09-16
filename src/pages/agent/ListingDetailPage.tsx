// MEGGA CRM — Fiche bien (bord à bord, trois colonnes)
// ─────────────────────────────────────────────────────────────────────────
// Route : /dashboard/listings/:id
//
// ⚖ REFAITE LE 16.09.2026 (Julien : « que ça prenne toute la dimension du pager,
// qu'on perde moins de temps à trouver les informations »). Même grammaire que la
// fiche contact refaite le même jour : UN en-tête, puis des colonnes pleine hauteur
// séparées par un filet, chacune défilant seule.
//
// Avant : une colonne bridée à 1120 px au milieu du cadre, deux cartes posées dans
// le cadre, et un défilement unique — le prix et l'adresse étaient au-dessus d'une
// mosaïque de 460 px, le mandat et les visites trois écrans plus bas.
//
//   En-tête  → ce qu'on cherche en premier : prix, adresse, taille, échéance du mandat
//   Col. 1   → le bien      (photos, caractéristiques, description)
//   Col. 2   → la vente     (mandat, diffusion, performance)
//   Col. 3   → les gens     (visites, acheteurs en cours, suggestions MEGGA AI)
//
// Honnêteté des données (cf. CLAUDE.md) :
//   • ⛔ La courbe « +18 % » de la performance a été RETIRÉE : c'était un repère
//     illustratif de la maquette, affiché comme une mesure. Vues / Favoris / Demandes
//     restent — eux sont réels (`usePropertyStats`).
//   • ⛔ « Prochaine visite » ne vient plus du `localStorage` de l'appareil : la fiche
//     lit les VRAIES visites du bien (`visits`), et « Planifier » ouvre le vrai
//     parcours (`/dashboard/visits/new?bienId=`). L'ancienne modale n'écrivait qu'une
//     date locale — « Ajoutée à votre planning local » — que ni le Calendrier ni un
//     collègue ne voyaient.
//   • Score MEGGA AI = estimation (icône sparkle), jamais une garantie.
//   • KYC acheteur = rappel DOUX non-bloquant (jamais un verrou).
//   • Diffusion = portail unique immobilier.ch ; le passage privé→public suit le vrai
//     chemin de publication (updateProperty draft→active + audit nLPD).

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import { crmPalette, crmVoileAssombrissant, type CrmPalette } from '@/components/crm/tokens'
import { CRM_KEYFRAMES } from '@/components/crm/CrmShell'
import CrmWorkspace from '@/components/crm/CrmWorkspace'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import {
  VxIcon, VxLightbox, VxPhoto, VxStatusPill, VxAvatar,
} from '@/components/crm-dossiers/vitrine/vitrineKit'
import {
  vxPalette, vxFmtCHF, vxFmtNum, type VxPalette,
} from '@/components/crm-dossiers/vitrine/vitrineTokens'
import { fmtDateShort } from '@/components/crm-dossiers/tokens'
import {
  useProperty, useUpdateProperty, type CreatePropertyInput,
} from '@/hooks/useProperties'
import { usePropertyStats } from '@/hooks/usePropertyStats'
import { useTransactions } from '@/hooks/useTransactions'
import { useContacts } from '@/hooks/useContacts'
import { useLogAudit } from '@/hooks/useAuditLog'
import { useMatching } from '@/hooks/useMatching'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Property } from '@/types/listing'
import { useCrmDarkPref } from '@/lib/crmDark'
import { useTabLabel } from '@/hooks/useCrmTabs'
import { useEcranActif } from '@/hooks/useEcranActif'
import { DOCK_PUSH_VAR } from '@/components/ai-copilot/panel/aiPanel'
import { majusculeInitiale } from '@/lib/utils'
import { pickAvatarBg } from '@/lib/crmAdapters'
import PlanifierVisite, { type VisiteurLie } from '@/components/crm/biens/fiche/PlanifierVisite'

// ─── Interfaces locales ────────────────────────────────────────────────────
interface Toast {
  title: string
  lines: string[]
}
/** Brouillon d'édition — 4 champs exposés par la modale (comme le handoff). */
interface EditDraft {
  title: string
  address: string
  price: number | string
  description: string
}
/** Une visite du bien, telle que la fiche la lit (`visits` + le nom du visiteur). */
interface VisiteBien {
  id: string
  scheduled_at: string
  status: string | null
  contact: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null
}

function asNum(v: number | string): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Nombre de miniatures sous la photo principale ; la dernière porte « +N » s'il en reste. */
const BF_VIGNETTES = 6
/** Le seul portail de diffusion — un nom propre, pas un texte à traduire. */
const PORTAIL_DIFFUSION = 'immobilier.ch'
/** Statuts d'une visite qui ne sont plus « à venir », même datés dans le futur. */
const VISITE_CLOSE = new Set(['cancelled', 'done', 'no_show'])

// ═══════════════════════════════════════════════════════════════════════════
//   ATOMES — mêmes barreaux que la fiche contact (`ContactDetailPager`)
// ═══════════════════════════════════════════════════════════════════════════

/** Bouton d'action : accent pour le PRIMAIRE, voile pour le secondaire (règle du 10.08). */
function BfCta({ children, onClick, ghost, small, icon, vx }: {
  children: ReactNode
  onClick?: () => void
  ghost?: boolean
  small?: boolean
  icon?: MEIconName
  vx: VxPalette
}) {
  return (
    <button type="button" onClick={onClick} className={ghost ? 'bf-ghost' : 'bf-primary'} style={{
      display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: small ? 32 : 40,
      padding: small ? '0 var(--crm-space-xl)' : '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)',
      border: 0, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', fontWeight: 600,
      fontSize: small ? 'var(--crm-text-sm)' : 'var(--crm-text-md)',
      background: ghost ? vx.cardSub : vx.black, color: ghost ? vx.inkSoft : vx.onAccent,
    }}>
      {icon && <MEIcon name={icon} size={small ? 13 : 14} />}
      {children}
    </button>
  )
}

/** Sur-titre de bloc — 14 px / 600 en `muted`, le barreau de `CdGrp`. */
function BfGrp({ children, right, vx }: { children: ReactNode; right?: ReactNode; vx: VxPalette }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', minHeight: 32 }}>
      <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: vx.muted }}>{children}</div>
      {right}
    </div>
  )
}

/**
 * Une valeur en lecture : libellé 13/500, valeur 15/600. Le vide se dit par un tiret
 * peint en `ghost` — c'est le CONTRASTE qui signale le trou, comme sur la fiche contact.
 */
function BfRead({ label, value, vx }: { label: string; value: ReactNode; vx: VxPalette }) {
  const vide = value == null || value === '' || value === '—'
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: vx.muted }}>{label}</div>
      <div style={{ marginTop: 'var(--crm-space-xs)', fontSize: 'var(--crm-text-xl)', fontWeight: vide ? 500 : 600, color: vide ? vx.ghost : vx.ink, fontVariantNumeric: 'tabular-nums' }}>
        {vide ? '—' : value}
      </div>
    </div>
  )
}

/** Un essentiel de l'en-tête : son icône, puis sa valeur — jamais coupé en deux. */
function BfEssentiel({ icon, color, children, vx }: { icon: MEIconName; color?: string; children: ReactNode; vx: VxPalette }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', color: color ?? vx.inkSoft, whiteSpace: 'nowrap' }}>
      <MEIcon name={icon} size={14} color={vx.muted} />
      {children}
    </span>
  )
}

/** Un chiffre de performance — grand, parce qu'il se lit d'un coup d'œil. */
function BfChiffre({ label, value, vx }: { label: string; value: string; vx: VxPalette }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 'var(--crm-text-5xl)', fontWeight: 500, color: vx.ink, letterSpacing: -0.6, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ marginTop: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-md)', fontWeight: 500, color: vx.muted }}>{label}</div>
    </div>
  )
}

/** Ligne cliquable d'une liste de personnes (visite, acheteur, suggestion). */
function BfLigne({ children, onClick, vx }: { children: ReactNode; onClick?: () => void; vx: VxPalette }) {
  const style: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', width: '100%', boxSizing: 'border-box',
    padding: 'var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', border: 0, textAlign: 'left',
    background: vx.cardSub, fontFamily: 'inherit', color: vx.ink, cursor: onClick ? 'pointer' : 'default',
  }
  return onClick
    ? <button type="button" onClick={onClick} className="bf-ligne" style={style}>{children}</button>
    : <div style={style}>{children}</div>
}

/**
 * Où s'arrêtent les calques de la fiche — au bord du CONTENU, pas de la fenêtre.
 *
 * ⚠ Le toast est un enfant du root de la page, HORS du plan
 * de travail. Depuis que la page s'étend sous le dock MEGGA AI (`usePousseeDock`),
 * ils s'y étendraient avec elle : le voile passerait par-dessus le dock (z 130
 * contre 70) et la carte comme le toast se centreraient 202 px trop à droite. Ils
 * retranchent donc la poussée, comme le faisait la coquille avant eux.
 */
const HORS_DOCK = `var(${DOCK_PUSH_VAR}, 0px)`

// ─── Toast (contenu dans le root, position absolute) ───────────────────────
function BfToast({ toast, sp, dark }: { toast: Toast | null; sp: CrmPalette; dark: boolean }) {
  if (!toast) return null
  return (
    <div style={{ position: 'absolute', bottom: 22, left: `calc((100% - ${HORS_DOCK}) / 2)`, transform: 'translateX(-50%)', zIndex: 120, background: dark ? sp.solidBg : sp.ink, color: '#fff', borderRadius: 18, padding: '15px 19px', boxShadow: '0 24px 60px rgba(15,23,42,.4)', maxWidth: 440, animation: 'bfUp .3s cubic-bezier(.2,.8,.2,1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: toast.lines.length ? 8 : 0 }}>
        <span style={{ width: 24, height: 24, borderRadius: 999, background: 'rgba(255,255,255,.14)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <VxIcon name="check" size={14} stroke="#fff" sw={2.4} />
        </span>
        <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600 }}>{toast.title}</span>
      </div>
      {toast.lines.map((l, i) => (
        <div key={i} style={{ fontSize: 'var(--crm-text-md)', color: 'rgba(255,255,255,.72)', paddingLeft: 34, lineHeight: 1.5 }}>{l}</div>
      ))}
    </div>
  )
}

// ─── Modale « Modifier l'annonce » ─────────────────────────────────────────
function BfEditModal({
  open, onClose, bien, isRent, vx, sp, onSave,
}: {
  open: boolean
  onClose: () => void
  bien: Property
  isRent: boolean
  sp: CrmPalette
  vx: VxPalette
  onSave: (d: EditDraft) => void
}) {
  const { t: tr } = useTranslation('listings')
  const [d, setD] = useState<EditDraft>({ title: '', address: '', price: 0, description: '' })
  useEffect(() => {
    if (open) setD({ title: bien.title, address: bien.address, price: bien.price ?? 0, description: bien.description ?? '' })
  }, [open, bien])
  // ⛔ Écran caché muet : la modale reste montée derrière l'onglet regardé.
  const ecranActif = useEcranActif()
  useEffect(() => {
    if (!open || !ecranActif) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, ecranActif])
  if (!open) return null
  const set = <K extends keyof EditDraft>(k: K, v: EditDraft[K]) => setD(p => ({ ...p, [k]: v }))
  const sub = vx.cardSub
  const lbl: CSSProperties = { display: 'block', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: vx.muted, letterSpacing: 0.3, marginBottom: 7 }
  const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', border: 0, outline: 'none', background: sub, color: vx.ink, borderRadius: 12, padding: '12px 14px', fontSize: 'var(--crm-text-lg)', fontWeight: 600, fontFamily: 'inherit' }
  return (
    <div onMouseDown={onClose} style={{ position: 'absolute', inset: 0, zIndex: 130, background: crmVoileAssombrissant(0.4), backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', padding: 24, animation: 'bfFade .18s ease-out' }}>
      <style>{`.bf-edit-inp:focus{box-shadow:0 0 0 2px ${vx.ink} inset}`}</style>
      <div onMouseDown={e => e.stopPropagation()} style={{ width: 520, maxWidth: '100%', maxHeight: '92%', overflowY: 'auto', background: sp.solidBg, borderRadius: 28, boxShadow: '0 40px 100px rgba(15,23,42,.34), 0 8px 24px rgba(15,23,42,.14)', padding: 28, animation: 'bfRise .24s cubic-bezier(.2,.8,.2,1)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 22 }}>
          <h3 style={{ margin: 0, fontSize: 'var(--crm-text-4xl)', fontWeight: 500, color: vx.ink, letterSpacing: -0.5, flex: 1 }}>{tr('detail.editListing')}</h3>
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
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: vx.muted }}>CHF</span>
                <input className="bf-edit-inp" type="number" value={d.price} onChange={e => set('price', e.target.value)} style={{ ...inp, paddingLeft: 52, fontVariantNumeric: 'tabular-nums' }} />
              </div>
            </div>
          )}
          <div><label style={lbl}>{tr('detail.description.eyebrow')}</label><textarea className="bf-edit-inp" value={d.description} onChange={e => set('description', e.target.value)} rows={6} style={{ ...inp, lineHeight: 1.65, fontWeight: 500, resize: 'vertical' }} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: '0 0 auto', height: 46, padding: '0 22px', borderRadius: 999, border: 0, background: sub, color: vx.inkSoft, fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, cursor: 'pointer' }}>{tr('cancel')}</button>
          <button onClick={() => onSave(d)} style={{ flex: 1, height: 46, borderRadius: 999, border: 0, background: vx.black, color: vx.onAccent, fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, cursor: 'pointer' }}>{tr('detail.saveAndPublish')}</button>
        </div>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
//   ÉCRAN — Fiche bien
// ═══════════════════════════════════════════════════════════════════════════
interface BienDetailProps {
  /**
   * Bien de DÉMONSTRATION, pour un aperçu sans session (`/dev/biens`).
   *
   * Fourni, il court-circuite les hooks : `useProperty(undefined)` désactive sa
   * requête (`enabled: !!id`), donc rien n'est lu en base — ce n'est pas un
   * échafaudage posé dans un hook, c'est le hook qu'on n'interroge pas. Idiome
   * repris de `MobileBienVitrineScreen`, qui porte le même prop depuis le P7.
   *
   * ⛔ Les écritures (publication, édition, audit) sont neutralisées quand il
   * est là : un banc d'essai visuel ne doit toucher à rien.
   */
  demoData?: Property
}

export default function ListingDetailPage({ demoData }: BienDetailProps = {}) {
  const { id: idRoute } = useParams<{ id: string }>()
  const id = demoData ? undefined : idRoute
  const navigate = useNavigate()
  const { t: tr, i18n } = useTranslation('listings')
  const locale = `${(i18n.language || 'fr').slice(0, 2)}-CH`

  const [dark, setDark] = useCrmDarkPref()
  const sp = crmPalette(dark) // cadre (pageBg = Today/Pipeline)
  const vx = vxPalette(dark) // intérieur de la fiche

  // ── Données réelles ──
  const { data: bienLive, isLoading, isError, error } = useProperty(id)
  const bien = demoData ?? bienLive
  // Libellé de l'onglet — le titre du bien, sinon son adresse (même ordre que
  // `crm_tabs_resolve_labels` côté serveur, pour que les deux ne divergent pas).
  useTabLabel(bien ? (bien.title || bien.address || null) : null)
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
  // Les visites RÉELLES du bien — celles du Calendrier, pas une date gardée sur l'appareil.
  const { data: visites = [] } = useQuery({
    queryKey: ['bien-visites', id],
    queryFn: async (): Promise<VisiteBien[]> => {
      const { data, error: qErr } = await supabase
        .from('visits')
        .select('id, scheduled_at, status, contact:contacts(first_name, last_name)')
        .eq('property_id', id ?? '')
        .order('scheduled_at', { ascending: true })
      if (qErr) throw qErr
      return (data ?? []) as unknown as VisiteBien[]
    },
    enabled: !!id,
  })

  // ── État UI ──
  const colsRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [visiteOpen, setVisiteOpen] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [lb, setLb] = useState<{ open: boolean; i: number }>({ open: false, i: 0 })
  // Horloge figée au montage : « à venir » ne doit pas basculer pendant qu'on lit.
  const [maintenant] = useState(() => Date.now())

  useEffect(() => {
    if (!toast) return
    const tm = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(tm)
  }, [toast])
  useEffect(() => {
    setEditOpen(false)
    setVisiteOpen(false)
    colsRef.current?.querySelectorAll<HTMLElement>('.bf-col').forEach(c => { c.scrollTop = 0 })
  }, [id])

  // ── États transitoires ──
  const etat = (texte: string, couleur: string) => (
    <div style={{ minHeight: '100vh', background: sp.pageBg, display: 'grid', placeItems: 'center', color: couleur, fontFamily: 'var(--crm-font), system-ui, sans-serif', padding: 'var(--crm-space-6xl)', textAlign: 'center' }}>{texte}</div>
  )
  if (!demoData && isLoading) return etat(tr('detail.loading'), vx.muted)
  if (isError) return etat(tr('detail.loadError', { message: error?.message ?? tr('detail.unknownError') }), vx.warn)
  if (!bien) return etat(tr('detail.notFound'), vx.muted)

  // ── Dérivés ──
  // Toute la table `type.*` (bureau, attique, chalet… y sont) ; le code brut en dernier recours.
  const typeLabel = (code: string | null | undefined): string =>
    code ? tr(`type.${code}`, { defaultValue: code.charAt(0).toUpperCase() + code.slice(1) }) : ''
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
  const ppm2 = bien.price && bien.surface_m2 && !isRent ? Math.round(bien.price / bien.surface_m2) : null
  const mandatExp = bien.mandate_expires_at ? new Date(bien.mandate_expires_at) : null
  const daysToExp = mandatExp ? Math.round((mandatExp.getTime() - maintenant) / 86_400_000) : null
  const mandatUrgent = daysToExp != null && daysToExp <= 30
  const features = bien.features ?? []
  // Off-market = non publié (proxy réel de la « visibilité privée »).
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

  // Visites : à venir d'abord ; les passées ne se comptent qu'en résumé.
  const aVenir = visites.filter(v => new Date(v.scheduled_at).getTime() >= maintenant && !VISITE_CLOSE.has(v.status ?? ''))
  const passees = visites.filter(v => new Date(v.scheduled_at).getTime() < maintenant).length
  const visiteur = (v: VisiteBien) => {
    const c = Array.isArray(v.contact) ? v.contact[0] : v.contact
    const nom = c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : ''
    return nom || tr('detail.nextVisit.visitor')
  }
  const quandVisite = (iso: string) => {
    const d = new Date(iso)
    const jour = majusculeInitiale(d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }))
    const heure = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    return `${jour} · ${heure}`
  }

  const flash = (title: string, lines: string[]) => setToast({ title, lines })
  // Le formulaire s'ouvre SUR la fiche : le bien est déjà choisi (cf. `PlanifierVisite`).
  const planifierVisite = () => setVisiteOpen(true)
  // Qui proposer d'abord : les acheteurs en cours sur ce bien, puis les suggestions.
  const liees: VisiteurLie[] = [
    ...dealsForBien.flatMap(d => {
      const c = d.contact_buyer_id ? contactsById.get(d.contact_buyer_id) : null
      return c ? [{ contactId: c.id, nom: `${c.first_name} ${c.last_name}`.trim(), dealId: d.id }] : []
    }),
    ...bienMatches.map(m => ({ contactId: m.contactId, nom: m.contactName, score: m.score })),
  ].filter((l, i, tous) => tous.findIndex(x => x.contactId === l.contactId) === i)

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
    if (demoData) return // aperçu : aucune écriture
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
    if (demoData) return // aperçu : aucune écriture
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

  const lieu = [bien.address, [bien.postal_code, bien.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const taille = [
    bien.surface_m2 ? `${bien.surface_m2} m²` : null,
    bien.rooms ? tr('form.preview.roomsCount', { count: bien.rooms }) : null,
  ].filter(Boolean).join(' · ')
  const mandatEssentiel = daysToExp == null
    ? null
    : daysToExp >= 0
      ? tr('fiche.header.mandateExpires', { type: mandateTypeLabel(bien.mandate_type), count: daysToExp })
      : tr('fiche.header.mandateOverdue', { type: mandateTypeLabel(bien.mandate_type), count: Math.abs(daysToExp) })

  const specs: { k: string; l: string; v: ReactNode }[] = [
    { k: 'type', l: tr('detail.specs.propertyType'), v: typeLabel(bien.type) },
    { k: 'transaction', l: tr('detail.specs.transaction'), v: isRent ? tr('detail.transactionRent') : tr('detail.transactionSale') },
    { k: 'surface', l: tr('detail.specs.livingArea'), v: bien.surface_m2 ? `${bien.surface_m2} m²` : null },
    { k: 'rooms', l: tr('detail.spec.rooms'), v: bien.rooms },
    { k: 'bedrooms', l: tr('detail.spec.bedrooms'), v: bien.bedrooms },
    { k: 'bathrooms', l: tr('detail.specs.bathrooms'), v: bien.bathrooms },
    { k: 'year', l: tr('fiche.specs.yearBuilt'), v: bien.year_built },
    { k: 'energy', l: tr('detail.specs.energyClass'), v: bien.energy_class },
    { k: 'charges', l: tr('detail.specs.charges'), v: bien.charges_monthly ? vxFmtCHF(bien.charges_monthly) + (isRent ? tr('detail.perMonth') : '') : null },
    { k: 'ppm2', l: tr('fiche.specs.pricePerM2'), v: ppm2 ? vxFmtCHF(ppm2) : null },
  ]

  const mandatRows = [
    { l: tr('fiche.mandate.type'), v: bien.mandate_type ? majusculeInitiale(mandateTypeLabel(bien.mandate_type)) : null },
    { l: tr('detail.mandate.commission'), v: bien.mandate_commission_pct ? bien.mandate_commission_pct + ' %' : null },
    { l: tr('detail.mandate.signedOn'), v: bien.mandate_signed_at ? fmtDateShort(bien.mandate_signed_at) : null },
    { l: tr('detail.mandate.expiresOn'), v: bien.mandate_expires_at ? fmtDateShort(bien.mandate_expires_at) : null },
  ]

  const vignettes = photoCount > 1 ? photos.slice(0, BF_VIGNETTES) : []

  return (
    <div
      data-screen-label="Fiche bien"
      style={{
        position: 'relative',
        background: sp.pageBg,
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--crm-font), system-ui, sans-serif',
        color: sp.ink,
      }}
    >
      <style>{CRM_KEYFRAMES}</style>
      <style>{`
        @keyframes bfUp { from { opacity:0; transform:translateY(14px);} to { opacity:1; transform:none;} }
        @keyframes bfFade { from {opacity:0;} to {opacity:1;} }
        @keyframes bfRise { from {opacity:0; transform:translateY(12px) scale(.985);} to {opacity:1; transform:none;} }
        /* Requête de CONTENEUR : la fiche vit dans le cadre du CRM, dont la largeur dépend
           de la barre latérale et du dock MEGGA AI, pas de l'écran. */
        .bf-fiche { container-type: inline-size; }
        .bf-cols { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr) minmax(0, 1fr); }
        .bf-col { min-height: 0; overflow-y: auto; padding: var(--crm-space-6xl); border-left: 1px solid ${vx.hairline}; display: flex; flex-direction: column; gap: var(--crm-space-6xl); }
        .bf-col:first-child { border-left: 0; }
        .bf-bloc { display: flex; flex-direction: column; gap: var(--crm-space-2xl); }
        .bf-bloc + .bf-bloc { border-top: 1px solid ${vx.hairline}; padding-top: var(--crm-space-6xl); }
        .bf-ligne, .bf-ghost, .bf-primary, .bf-photo { transition: background .12s ease, opacity .12s ease; }
        .bf-ligne:hover, .bf-ghost:hover { background: ${vx.cardSub2} !important; }
        .bf-primary:hover { background: ${vx.blackHover} !important; }
        .bf-photo:hover { opacity: .92; }
        @container (max-width: 1080px) {
          .bf-cols { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: min-content; overflow-y: auto; }
          .bf-col { overflow: visible; }
          .bf-col-gens { grid-column: 1 / -1; border-left: 0; border-top: 1px solid ${vx.hairline}; }
        }
        @container (max-width: 700px) {
          .bf-cols { grid-template-columns: minmax(0, 1fr); }
          .bf-col { border-left: 0; border-top: 1px solid ${vx.hairline}; }
          .bf-col:first-child { border-top: 0; }
        }
        @media (prefers-reduced-motion: reduce){ [style*="bfUp"]{ animation:none !important; opacity:1 !important; transform:none !important; } }
      `}</style>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <CrmWorkspace active="biens" sp={sp} dark={dark} setDark={setDark}>
        {/* Mêmes marges que le pager de « Mes biens » : le cadre ne saute pas quand on
            ouvre une fiche depuis la galerie. */}
        <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingTop: 'var(--crm-space-lg)', paddingLeft: 'var(--crm-space-lg)', paddingRight: 'var(--crm-space-7xl)', paddingBottom: 'var(--crm-space-6xl)' }}>
          <div className="bf-fiche" style={{ position: 'relative', height: '100%', borderRadius: 'var(--crm-radius-6xl)', overflow: 'hidden', border: `1px solid ${sp.frameBorder}`, boxShadow: sp.shadow, background: vx.card, display: 'flex', flexDirection: 'column' }}>

            {/* ═══ En-tête : retour, identité, essentiels, actions ═══ */}
            <header style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)', padding: 'var(--crm-space-4xl) var(--crm-space-6xl)', borderBottom: `1px solid ${vx.hairline}` }}>
              <button type="button" onClick={() => navigate('/dashboard/listings')} aria-label={tr('fiche.back')} title={tr('fiche.back')} className="bf-ghost" style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 'var(--crm-radius-pill)', background: vx.cardSub, border: 0, display: 'grid', placeItems: 'center', cursor: 'pointer', color: vx.inkSoft }}>
                <MEIcon name="arrow-left" size={15} />
              </button>
              {/* La vignette RECONNAÎT le bien avant qu'on lise son titre — comme l'avatar
                  d'une fiche contact. Elle ouvre les photos. */}
              <button type="button" onClick={() => photoCount && setLb({ open: true, i: 0 })} aria-label={tr('fiche.photos.open')} disabled={!photoCount} className="bf-photo" style={{ position: 'relative', width: 56, height: 56, flexShrink: 0, borderRadius: 'var(--crm-radius-lg)', overflow: 'hidden', border: 0, padding: 0, background: vx.cardSub, cursor: photoCount ? 'pointer' : 'default', display: 'grid', placeItems: 'center', color: vx.muted }}>
                {photoCount ? <VxPhoto src={photos[0]} dark={dark} /> : <MEIcon name="home" size={20} />}
              </button>

              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 'var(--crm-space-2xl)', rowGap: 'var(--crm-space-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', minWidth: 0, flex: '1 1 auto' }}>
                    <h1 style={{ margin: 0, minWidth: 0, fontSize: 'var(--crm-text-4xl)', fontWeight: 500, letterSpacing: -0.6, color: vx.ink, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={bien.title}>{bien.title}</h1>
                    <VxStatusPill status={bien.status} dark={dark} />
                    {offMarket && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', padding: 'var(--crm-space-xs) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: vx.cardSub, color: vx.inkSoft, fontSize: 'var(--crm-text-sm)', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        <MEIcon name="lock" size={12} />{tr('fiche.offMarket')}
                      </span>
                    )}
                    <button type="button" onClick={() => setEditOpen(true)} title={tr('detail.editListing')} aria-label={tr('detail.editListing')} className="bf-ghost" style={{ width: 28, height: 28, borderRadius: 'var(--crm-radius-pill)', border: 0, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0, color: vx.muted }}>
                      <MEIcon name="edit" size={14} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', flexShrink: 0, marginLeft: 'auto' }}>
                    <BfCta ghost vx={vx} onClick={planifierVisite}>{tr('detail.scheduleVisit')}</BfCta>
                    <BfCta vx={vx} onClick={() => navigate('/dashboard/matching')}>{tr('fiche.cta.propose')}</BfCta>
                  </div>
                </div>

                {/* Les essentiels — ce qu'un agent cherche avant tout le reste. */}
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 'var(--crm-space-2xl)', rowGap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>
                  <BfEssentiel vx={vx} icon="banknote" color={vx.ink}>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{price ? vxFmtCHF(price) : '—'}</span>
                    {isRent && price ? <span style={{ color: vx.muted, fontWeight: 500 }}>{tr('detail.perMonth')}</span> : null}
                  </BfEssentiel>
                  {taille && <BfEssentiel vx={vx} icon="ruler">{taille}</BfEssentiel>}
                  {lieu && <BfEssentiel vx={vx} icon="location">{lieu}</BfEssentiel>}
                  {mandatEssentiel && <BfEssentiel vx={vx} icon="clock" color={mandatUrgent ? vx.warn : vx.inkSoft}>{mandatEssentiel}</BfEssentiel>}
                </div>
              </div>
            </header>

            {/* ═══ Corps — trois colonnes, chacune défile seule ═══ */}
            <div ref={colsRef} className="bf-cols">

              {/* ── 1. Le bien ── */}
              <section className="bf-col">
                <div className="bf-bloc">
                  {photoCount ? (
                    <button type="button" onClick={() => setLb({ open: true, i: 0 })} aria-label={tr('fiche.photos.open')} className="bf-photo" style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', border: 0, padding: 0, borderRadius: 'var(--crm-radius-xl)', overflow: 'hidden', cursor: 'pointer', background: vx.cardSub }}>
                      <VxPhoto src={photos[0]} dark={dark} />
                      <span style={{ position: 'absolute', right: 'var(--crm-space-lg)', bottom: 'var(--crm-space-lg)', display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', padding: 'var(--crm-space-xs) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: sp.solidBg, color: sp.ink, fontSize: 'var(--crm-text-sm)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        <MEIcon name="camera" size={12} />{photoCount}
                      </span>
                    </button>
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '4 / 3', borderRadius: 'var(--crm-radius-xl)', background: vx.cardSub, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                      <div style={{ display: 'grid', justifyItems: 'center', gap: 'var(--crm-space-lg)', color: vx.muted }}>
                        <MEIcon name="camera" size={22} />
                        <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600 }}>{tr('fiche.photos.none')}</span>
                        <BfCta small ghost vx={vx} icon="plus" onClick={() => navigate(`/dashboard/listings/${bien.id}/edit`)}>{tr('fiche.photos.add')}</BfCta>
                      </div>
                    </div>
                  )}
                  {vignettes.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${BF_VIGNETTES}, minmax(0, 1fr))`, gap: 'var(--crm-space-sm)' }}>
                      {vignettes.map((src, i) => {
                        const reste = i === BF_VIGNETTES - 1 ? photoCount - BF_VIGNETTES : 0
                        return (
                          <button key={i} type="button" onClick={() => setLb({ open: true, i })} aria-label={tr('fiche.photos.open')} className="bf-photo" style={{ position: 'relative', aspectRatio: '1 / 1', border: 0, padding: 0, borderRadius: 'var(--crm-radius-md)', overflow: 'hidden', cursor: 'pointer', background: vx.cardSub }}>
                            <VxPhoto src={src} index={i} dark={dark} />
                            {reste > 0 && (
                              <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: sp.solidBg, color: sp.ink, fontSize: 'var(--crm-text-lg)', fontWeight: 600, opacity: 0.88 }}>+{reste}</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="bf-bloc">
                  <BfGrp vx={vx}>{tr('detail.specs.eyebrow')}</BfGrp>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 'var(--crm-space-2xl)', rowGap: 'var(--crm-space-3xl)' }}>
                    {specs.map(s => <BfRead key={s.k} label={s.l} value={s.v} vx={vx} />)}
                  </div>
                </div>

                <div className="bf-bloc">
                  <BfGrp vx={vx} right={<BfCta small ghost vx={vx} icon="edit" onClick={() => setEditOpen(true)}>{tr('fiche.edit.action')}</BfCta>}>
                    {tr('detail.description.eyebrow')}
                  </BfGrp>
                  <p style={{ margin: 0, fontSize: 'var(--crm-text-lg)', lineHeight: 1.65, color: vx.inkSoft, whiteSpace: 'pre-line', textWrap: 'pretty' }}>{publicDesc}</p>
                  {features.length > 0 && (
                    <div style={{ display: 'flex', gap: 'var(--crm-space-sm)', flexWrap: 'wrap' }}>
                      {features.map(f => (
                        <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', height: 30, padding: '0 var(--crm-space-xl)', borderRadius: 'var(--crm-radius-pill)', background: vx.cardSub, color: vx.inkSoft, fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>
                          <MEIcon name="check" size={12} color={vx.ok} />{f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* ── 2. La vente ── */}
              <section className="bf-col">
                <div className="bf-bloc">
                  <BfGrp vx={vx} right={daysToExp != null && daysToExp <= 60
                    ? <BfCta small vx={vx} onClick={() => flash(tr('fiche.mandate.renewToastTitle'), [tr('fiche.mandate.renewToastLine')])}>{tr('fiche.mandate.renew')}</BfCta>
                    : undefined}>
                    {tr('detail.mandate.eyebrow')}
                  </BfGrp>
                  {/* L'échéance est déjà dans l'en-tête : ici elle ne se répète que si elle PRESSE. */}
                  {mandatUrgent && daysToExp != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', padding: 'var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', background: vx.warnBg, color: vx.warn, fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>
                      <MEIcon name="alert" size={14} />
                      {daysToExp >= 0 ? tr('fiche.mandate.expiresIn', { count: daysToExp }) : tr('detail.mandate.overdue', { count: Math.abs(daysToExp) })}
                    </div>
                  )}
                  {/* Libellé à gauche, valeur à droite : dans une colonne étroite, trois cellules
                      côte à côte cassaient « 15 mars 2027 » sur deux lignes. */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)' }}>
                    {mandatRows.map(r => (
                      <div key={r.l} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--crm-space-lg)' }}>
                        <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: vx.muted, whiteSpace: 'nowrap' }}>{r.l}</span>
                        <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: r.v ? 600 : 500, color: r.v ? vx.ink : vx.ghost, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.v ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                  {owner && (
                    <BfLigne vx={vx} onClick={() => navigate(`/dashboard/contacts/${owner.id}`)}>
                      <VxAvatar name={owner.first_name + ' ' + owner.last_name} bg={pickAvatarBg(owner.id)} size={36} dark={dark} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600 }}>{owner.first_name} {owner.last_name}</div>
                        <div style={{ fontSize: 'var(--crm-text-sm)', color: vx.muted, fontWeight: 500 }}>{tr('detail.mandate.sellerViewProfile')}</div>
                      </div>
                      <MEIcon name="chevron-right" size={16} color={vx.muted} />
                    </BfLigne>
                  )}
                </div>

                <div className="bf-bloc">
                  <BfGrp vx={vx}>{tr('detail.distributionSection.eyebrow')}</BfGrp>
                  <BfLigne vx={vx}>
                    <span style={{ width: 32, height: 32, borderRadius: 'var(--crm-radius-md)', background: vx.card, display: 'grid', placeItems: 'center', color: vx.inkSoft, flexShrink: 0 }}>
                      <MEIcon name="globe" size={16} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-lg)', fontWeight: 600 }}>{PORTAIL_DIFFUSION}</span>
                    {offMarket
                      ? <BfCta small vx={vx} onClick={publishBien}>{tr('fiche.diffusion.publish')}</BfCta>
                      : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: idxOnline ? vx.ok : vx.muted, whiteSpace: 'nowrap' }}>
                          <span style={{ width: 6, height: 6, borderRadius: 'var(--crm-radius-pill)', background: idxOnline ? vx.ok : vx.ghost }} />
                          {idxLabel}
                        </span>
                      )}
                  </BfLigne>
                  <div>
                    <BfCta small ghost vx={vx} icon="external" onClick={() => flash(tr('fiche.diffusion.previewToastTitle'), [idxOnline ? tr('fiche.diffusion.previewOnlineLine') : tr('fiche.diffusion.previewOfflineLine')])}>
                      {tr('fiche.diffusion.publicPreview')}
                    </BfCta>
                  </div>
                </div>

                <div className="bf-bloc">
                  <BfGrp vx={vx}>{tr('detail.performance.eyebrow')}</BfGrp>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', columnGap: 'var(--crm-space-2xl)' }}>
                    <BfChiffre vx={vx} label={tr('detail.performance.views')} value={vxFmtNum(stats.views)} />
                    <BfChiffre vx={vx} label={tr('detail.performance.favorites')} value={vxFmtNum(stats.favorites)} />
                    <BfChiffre vx={vx} label={tr('detail.performance.requests')} value={vxFmtNum(stats.visitRequests)} />
                  </div>
                </div>
              </section>

              {/* ── 3. Les gens ── */}
              <section className="bf-col bf-col-gens">
                <div className="bf-bloc">
                  <BfGrp vx={vx} right={<BfCta small ghost vx={vx} icon="plus" onClick={planifierVisite}>{tr('fiche.visits.plan')}</BfCta>}>
                    {tr('fiche.visits.eyebrow')}
                  </BfGrp>
                  {aVenir.length === 0 ? (
                    <div style={{ fontSize: 'var(--crm-text-lg)', color: vx.muted, fontWeight: 500 }}>{tr('fiche.visits.none')}</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
                      {aVenir.map(v => (
                        <BfLigne key={v.id} vx={vx} onClick={() => navigate(`/dashboard/visits/${v.id}`)}>
                          <span style={{ width: 36, height: 36, borderRadius: 'var(--crm-radius-md)', background: vx.card, display: 'grid', placeItems: 'center', color: vx.inkSoft, flexShrink: 0 }}>
                            <MEIcon name="calendar" size={16} />
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{quandVisite(v.scheduled_at)}</div>
                            <div style={{ fontSize: 'var(--crm-text-sm)', color: vx.muted, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{visiteur(v)}</div>
                          </div>
                          <MEIcon name="chevron-right" size={16} color={vx.muted} />
                        </BfLigne>
                      ))}
                    </div>
                  )}
                  {passees > 0 && (
                    <div style={{ fontSize: 'var(--crm-text-md)', color: vx.muted, fontWeight: 500 }}>{tr('fiche.visits.past', { count: passees })}</div>
                  )}
                </div>

                <div className="bf-bloc">
                  <BfGrp vx={vx} right={<BfCta small ghost vx={vx} onClick={() => navigate('/dashboard/pipeline')}>{tr('detail.buyers.pipeline')}</BfCta>}>
                    {tr('detail.buyers.title')}
                    {dealsForBien.length > 0 && <span style={{ marginLeft: 'var(--crm-space-sm)', color: vx.ink, fontVariantNumeric: 'tabular-nums' }}>{dealsForBien.length}</span>}
                  </BfGrp>
                  {dealsForBien.length === 0 ? (
                    <div style={{ fontSize: 'var(--crm-text-lg)', color: vx.muted, fontWeight: 500 }}>{tr('fiche.buyers.empty')}</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
                      {dealsForBien.map(d => {
                        const c = d.contact_buyer_id ? contactsById.get(d.contact_buyer_id) : null
                        const nom = c ? `${c.first_name} ${c.last_name}` : tr('detail.buyers.buyerFallback')
                        return (
                          <BfLigne key={d.id} vx={vx} onClick={() => navigate(`/dashboard/transactions/${d.id}`)}>
                            <VxAvatar name={nom} bg={c ? pickAvatarBg(c.id) : undefined} size={36} dark={dark} />
                            <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-lg)', fontWeight: 600 }}>{nom}</span>
                            <MEIcon name="chevron-right" size={16} color={vx.muted} />
                          </BfLigne>
                        )
                      })}
                    </div>
                  )}
                  {needsKyc && (
                    <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', alignItems: 'center', padding: 'var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', background: vx.cardSub }}>
                      <MEIcon name="shield" size={18} color={vx.ink} />
                      <div style={{ flex: 1, fontSize: 'var(--crm-text-md)', color: vx.inkSoft, lineHeight: 1.5 }}>
                        <Trans i18nKey="detail.buyers.kycNotice" t={tr}>
                          <span style={{ color: vx.ink, fontWeight: 600 }}>KYC à compléter</span> pour un acheteur, optionnel à ce stade, requis avant signature.
                        </Trans>
                      </div>
                      <BfCta small ghost vx={vx} onClick={() => navigate('/dashboard/kyc')}>{tr('detail.buyers.startKyc')}</BfCta>
                    </div>
                  )}
                </div>

                {bienMatches.length > 0 && (
                  <div className="bf-bloc">
                    <BfGrp vx={vx}>{tr('fiche.suggestions.title')}</BfGrp>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
                      {bienMatches.map(m => (
                        <BfLigne key={m.id} vx={vx}>
                          {/* Même teinte que la liste et la fiche du contact : on le reconnaît d'un écran à l'autre. */}
                          <VxAvatar name={m.contactName} bg={pickAvatarBg(m.contactId)} size={36} dark={dark} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.contactName}</div>
                            {/* Un score IA se lit comme une ESTIMATION : l'étincelle le dit. */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xs)', fontSize: 'var(--crm-text-sm)', color: vx.muted, fontWeight: 500, minWidth: 0 }}>
                              <MEIcon name="sparkle" size={11} />
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tr('fiche.suggestions.affinity', { score: m.score })}</span>
                            </div>
                          </div>
                          <BfCta small ghost vx={vx} icon="send" onClick={() => navigate('/dashboard/matching')}>{tr('detail.buyers.propose')}</BfCta>
                        </BfLigne>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Lightbox contenue — clippée au cadre de la fiche */}
            {photoCount > 0 && (
              <VxLightbox contained dark={dark} open={lb.open} index={lb.i} photos={photos} count={photoCount} onClose={() => setLb({ open: false, i: lb.i })} onIndex={i => setLb({ open: true, i })} />
            )}

            {/* Modales DANS le cadre, comme celles de la Messagerie : centrées sur la fiche
                (et non sur la fenêtre, barre latérale comprise), le flou épousant le cadre. */}
            {visiteOpen && (
              <PlanifierVisite
                bien={bien}
                dark={dark}
                sp={sp}
                vx={vx}
                liees={liees}
                demo={!!demoData}
                onClose={() => setVisiteOpen(false)}
                onPlanned={() => { void queryClient.invalidateQueries({ queryKey: ['bien-visites', id] }) }}
                onOpenVisit={(visitId) => navigate(`/dashboard/visits/${visitId}`)}
              />
            )}
            <BfEditModal open={editOpen} onClose={() => setEditOpen(false)} bien={bien} isRent={isRent} vx={vx} sp={sp} onSave={saveEdit} />
          </div>
        </main>
        </CrmWorkspace>
      </div>

      <BfToast toast={toast} sp={sp} dark={dark} />
    </div>
  )
}
