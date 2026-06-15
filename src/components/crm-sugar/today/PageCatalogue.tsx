// MEGGA CRM — Refonte « Aujourd'hui » · PAGE « CATALOGUE DE MATCHS » (port fidèle)
// ----------------------------------------------------------------------------
// Port 1:1 de `today-proto-catalogue.jsx` (composants rendus uniquement — les
// helpers de concept non rendus, CritStrip / CatDReason / CatDIntent, ne sont
// pas portés). Mur de matchs (1 featured + 4 cases, débordement « +N »), fiche
// détail (modale éditoriale), lightbox galerie, overlay « tout le catalogue ».
// Quick wins : état « Proposé » persistant, filtres quantifiés, tri.

import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { TK } from './tk'
import { RXIcon, Av, Orbs } from './kit'
import { PHOTO } from './data'
import { useMatching, type MatchResult } from '@/hooks/useMatching'

// Critères = les 5 VRAIES raisons du moteur de matching (pas de KYC fabriqué).
const CATA_CRIT = ['Budget', 'Zone', 'Type', 'Pièces', 'Souhaits']

interface CatAnnonceur { type: string; name: string; agent?: string; role?: string; phone?: string; initials: string; mandat?: string }
interface CatDetailData {
  addr: string; beds: number; baths: number | null; year: number; floor: string | number; charges: number; drop: number
  annonceur: CatAnnonceur
  features: string[]
  desc: string
  gallery?: string[]
}

interface CatItem {
  id: number
  photo: string
  place: string
  price: string
  pn: number
  specs: string
  buyer: string
  bi: string
  av: string
  score: number
  tag: string
  cat: string
  days: number
  c: string
  why: string
  // Détail réel attaché (match live) — sinon catDetail retombe sur CAT_META (démo).
  detail?: CatDetailData
  // Vrai id du match (pour « Mettre dans le dossier » → sendMatch). Absent = seed.
  matchId?: string
}

// ─── Adaptateurs match réel → item de catalogue ─────────────────────────
const CAT_AV = ['#5b6cff', '#E08A45', '#39B7C9', '#34C796', '#9b7cf0', '#8B5CF6', '#2370ff', '#74d184', '#d8923f', '#c0566b']
function hashInt(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
function catInitials(name: string): string {
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '··'
}
function fmtApos(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")
}
function tagOf(status: MatchResult['status']): string {
  switch (status) {
    case 'sent': return 'Dossier envoyé'
    case 'visit_planned': return 'Visite prévue'
    case 'interested': return 'Intéressé'
    default: return 'Nouveau'
  }
}
function catOf(status: MatchResult['status']): string {
  return status === 'suggested' ? 'nouveau' : 'relance'
}
function criteriaBits(r: MatchResult['reasons']): string {
  return [r.budget, r.zone, r.type, r.rooms, r.features].map((x) => (x?.match ? '1' : '0')).join('')
}
function topWhy(r: MatchResult['reasons']): string {
  const matched = Object.values(r).filter((x) => x?.match && x.detail).sort((a, b) => b.score - a.score)
  return matched[0]?.detail || 'Nouveau match — premier contact à initier.'
}
function featuresArr(f: Record<string, string> | null | undefined): string[] {
  if (!f) return []
  return Object.values(f).filter((v): v is string => typeof v === 'string' && v.length > 0).slice(0, 8)
}
function matchToCatItem(m: MatchResult, idx: number): CatItem {
  const L = m.listing
  const isVilla = /villa|maison/i.test(L.type || '')
  const place = L.city || L.canton || 'Bien'
  return {
    id: hashInt(m.id) || idx + 1,
    matchId: m.id,
    photo: L.photos?.[0] || PHOTO.champel,
    place,
    price: fmtApos(L.price),
    pn: L.price,
    specs: isVilla ? `Villa · ${L.surface_m2} m²` : `${L.rooms} p · ${L.surface_m2} m²`,
    buyer: m.contactName,
    bi: catInitials(m.contactName),
    av: CAT_AV[hashInt(m.contactId) % CAT_AV.length],
    score: m.score,
    tag: tagOf(m.status),
    cat: catOf(m.status),
    days: L.days_on_market ?? 0,
    c: criteriaBits(m.reasons),
    why: topWhy(m.reasons),
    detail: {
      addr: [L.address, [L.postal_code, L.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || place,
      beds: L.bedrooms ?? 0,
      baths: null, // non exposé par le matching — pas de valeur inventée
      year: L.year_built ?? 0,
      floor: L.floor != null ? `${L.floor}e` : '—',
      charges: L.charges_monthly ?? 0,
      drop: 0, // pas d'historique de prix exposé — pas de prix barré inventé
      annonceur: {
        type: m.source === 'market' ? 'Veille marché' : 'Mandat interne',
        name: L.agency_name || L.source_portal || (m.source === 'market' ? 'Annonceur externe' : 'Votre agence'),
        agent: L.source_portal ? `via ${L.source_portal}` : undefined,
        role: m.source === 'market' ? 'Source' : undefined,
        initials: catInitials(L.agency_name || L.source_portal || 'AN'),
      },
      features: featuresArr(L.features),
      desc: L.description || '',
      gallery: L.photos && L.photos.length > 0 ? L.photos : undefined,
    },
  }
}

const SEED_CATA: CatItem[] = [
  { id: 1, photo: PHOTO.carouge, place: 'Carouge', price: "890'000", pn: 890000, specs: '3.5 p · 78 m²', buyer: 'Marie Bertrand', bi: 'MB', av: '#5b6cff', score: 94, tag: 'A visité', cat: 'relance', days: 6, c: '11111', why: "A visité il y a 6 j. Signal d'achat fort, aucune offre concurrente détectée." },
  { id: 2, photo: PHOTO.champel, place: 'Champel', price: "1'400'000", pn: 1400000, specs: '4.5 p · 112 m²', buyer: 'Nadia Khan', bi: 'NK', av: '#d8923f', score: 91, tag: 'Nouveau', cat: 'nouveau', days: 0, c: '11110', why: 'Sensible à la performance énergétique A — argument clé sur ce bien.' },
  { id: 3, photo: PHOTO.cologny, place: 'Cologny', price: "3'850'000", pn: 3850000, specs: 'Villa · 245 m²', buyer: 'Antoine Picard', bi: 'AP', av: '#34C796', score: 90, tag: 'Offre en cours', cat: 'relance', days: 2, c: '11111', why: 'Offre déposée — suivi signature, relance prioritaire aujourd\'hui.' },
  { id: 4, photo: PHOTO.eauxvives, place: 'Eaux-Vives', price: "1'180'000", pn: 1180000, specs: '3 p · 84 m²', buyer: 'Sophie Marchand', bi: 'SM', av: '#8B5CF6', score: 88, tag: 'Nouveau', cat: 'nouveau', days: 1, c: '11110', why: 'Profil quasi-idéal sur tous les axes : budget, zone, surface.' },
  { id: 5, photo: PHOTO.carouge, place: 'Carouge', price: "890'000", pn: 890000, specs: '3.5 p · 78 m²', buyer: 'David Rey', bi: 'DR', av: '#2370ff', score: 84, tag: 'Nouveau', cat: 'nouveau', days: 3, c: '11010', why: 'Balcon plein sud = must-have coché. À contacter rapidement.' },
  { id: 8, photo: PHOTO.cologny, place: 'Cologny', price: "3'850'000", pn: 3850000, specs: 'Villa · 245 m²', buyer: 'Julie Sturm', bi: 'JS', av: '#c0566b', score: 72, tag: 'Investisseuse', cat: 'nouveau', days: 4, c: '01100', why: 'Angle rendement locatif à présenter pour convaincre.' },
]

const critArr = (m: CatItem) => CATA_CRIT.map((k, i) => ({ k, ok: m.c[i] === '1' }))
const critCount = (m: CatItem) => m.c.split('').filter((x) => x === '1').length
const fmtCHFk = (n: number) => 'CHF ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")

const CATA_FILTERS = [
  { key: 'tous', label: 'Tous', test: () => true },
  { key: 'relance', label: 'À relancer', test: (m: CatItem) => m.cat === 'relance' },
  { key: 'nouveau', label: 'Nouveaux', test: (m: CatItem) => m.cat === 'nouveau' },
]

const CATA_SORTS = [
  { key: 'score', label: 'Score', cmp: (a: CatItem, b: CatItem) => b.score - a.score },
  { key: 'valeur', label: 'Valeur', cmp: (a: CatItem, b: CatItem) => b.pn - a.pn },
  { key: 'recence', label: 'Récence', cmp: (a: CatItem, b: CatItem) => a.days - b.days },
]

// ─── Tuile ──────────────────────────────────────────────────────────────
function CatalogTile({ m, big = false, onOpen, delay = 0, shown, proposed }: { m: CatItem; big?: boolean; onOpen: (m: CatItem) => void; delay?: number; shown: boolean; proposed: boolean }) {
  const [h, setH] = useState(false)
  return (
    <div onClick={() => onOpen(m)} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', height: '100%', cursor: 'pointer',
        border: `1px solid ${proposed ? 'rgba(52,199,150,.5)' : h ? TK.borderHi : TK.border}`, boxShadow: h ? TK.shadowLg : TK.shadow,
        opacity: shown ? 1 : 0, transform: shown ? (h ? 'translateY(-3px)' : 'none') : 'translateY(18px)',
        transition: `opacity .55s ease ${delay}ms, transform .55s cubic-bezier(.22,1,.36,1) ${shown && h ? 0 : delay}ms, box-shadow .25s, border-color .25s` }}>
      <img src={m.photo} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
        transform: h ? 'scale(1.06)' : 'scale(1)', transition: 'transform 1.2s cubic-bezier(.22,1,.36,1)',
        filter: proposed ? 'saturate(.65) brightness(.82)' : 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,8,12,.16) 0%, rgba(8,8,12,.04) 38%, rgba(8,8,12,.93) 100%)' }} />

      {/* proposé (le score reste interne — tri du mur par l'algo) */}
      {proposed && (
        <div style={{ position: 'absolute', top: 13, right: 13, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999,
          background: 'rgba(21,100,63,.9)', border: '1px solid rgba(52,199,150,.6)' }}>
          <RXIcon name="check" size={big ? 14 : 12} color="#9be9c1" sw={2.6} /><span style={{ fontSize: big ? 13 : 11.5, fontWeight: 800, color: '#DBF4E6' }}>Proposé</span>
        </div>
      )}
      <div style={{ position: 'absolute', top: 14, left: 14 }}>
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, whiteSpace: 'nowrap',
          background: 'rgba(8,8,12,.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          padding: big ? '9px 15px' : '7px 13px', borderRadius: 999, border: `1px solid ${TK.borderHi}` }}>
          <span style={{ fontSize: big ? 11 : 10, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(255,255,255,.7)' }}>{m.place}</span>
          <span style={{ fontSize: big ? 15 : 12.5, fontWeight: 800, letterSpacing: -0.2, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>CHF {m.price}</span>
        </span>
      </div>

      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Av initials={m.bi} av={m.av} size={big ? 42 : 34} ring />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: big ? 17 : 14, fontWeight: 800, color: '#fff', letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.buyer}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Détail (modale, skin dark) · SANS SCORE ─────────────────────────────
const CAT_INTERIORS = [
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=1200&q=80&auto=format&fit=crop',
]

interface CatMeta {
  addr: string; beds: number; baths: number; year: number; floor: string; charges: number; drop: number
  annonceur: CatAnnonceur
  features: string[]
  desc: string
}

const CAT_META: Record<string, CatMeta> = {
  Carouge: { addr: 'Rue Ancienne 6, 1227 Carouge', beds: 3, baths: 2, year: 1996, floor: '3e', charges: 420, drop: 45000,
    annonceur: { type: 'Agence', name: 'Régie du Rhône', agent: 'Camille Rey', role: 'Courtière', phone: '+41 22 718 24 10', initials: 'RR', mandat: 'Exclusif' },
    features: ['Balcon plein sud', 'Cave', 'Place de parc', 'Ascenseur', 'Parquet'],
    desc: 'Appartement traversant au cœur du Vieux-Carouge. Séjour lumineux ouvert sur balcon plein sud, chambres calmes côté cour. Cave et place de parc. Proche écoles, marché et tram.' },
  Champel: { addr: 'Av. de Champel 24, 1206 Genève', beds: 3, baths: 2, year: 2019, floor: '5e', charges: 380, drop: 0,
    annonceur: { type: 'Agence', name: 'Naef Immobilier', agent: 'Olivier Blanc', role: 'Courtier', phone: '+41 22 839 39 50', initials: 'NI', mandat: 'Simple' },
    features: ['Performance énergétique A', 'Balcon', 'Cave', 'Parking', 'Vue dégagée'],
    desc: 'Appartement récent dans une résidence basse consommation. Grandes baies vitrées, cuisine ouverte haut de gamme, deux salles d\'eau. Quartier résidentiel prisé, proche hôpital et parcs.' },
  Cologny: { addr: 'Chemin de la Tour 9, 1223 Cologny', beds: 5, baths: 3, year: 2008, floor: '—', charges: 0, drop: 0,
    annonceur: { type: 'Particulier', name: 'Vendeur particulier', agent: 'Henri De Mestral', role: 'Propriétaire', phone: '+41 79 204 61 88', initials: 'HM', mandat: 'Direct' },
    features: ['Jardin 800 m²', 'Piscine', 'Double garage', 'Cave à vin', 'Vue lac'],
    desc: 'Villa individuelle sur parcelle arborée avec vue sur le lac. Vastes volumes, réception traversante, suite parentale, piscine et double garage. Cadre rare au cœur de Cologny.' },
  'Eaux-Vives': { addr: 'Rue Versonnex 12, 1207 Genève', beds: 2, baths: 1, year: 2015, floor: '4e', charges: 290, drop: 45000,
    annonceur: { type: 'Agence', name: 'Moser Vernet & Cie', agent: 'Luc Favre', role: 'Courtier', phone: '+41 22 809 09 09', initials: 'MV', mandat: 'Simple' },
    features: ['Proche tram', 'Balcon', 'Cave', 'Lumineux', 'Cuisine équipée'],
    desc: 'Appartement lumineux à deux pas du lac et des Eaux-Vives. Séjour orienté sud, cuisine équipée, balcon. Idéal premier achat ou pied-à-terre, transports immédiats.' },
}

function catDetail(m: CatItem) {
  const roomsRaw = m.specs.split('·')[0].trim()
  const surfaceM = (m.specs.match(/(\d+)\s*m²/) || [])[1]
  const surface = surfaceM ? parseInt(surfaceM, 10) : null
  const title = (/villa/i.test(roomsRaw) ? 'Villa' : roomsRaw.replace(/\bp\b/, 'pièces').replace('.', ',')) + ' — ' + m.place
  const ppm2 = surface ? Math.round(m.pn / surface) : null
  // Détail réel (match live) si attaché, sinon CAT_META (démo). Les images
  // intérieures décoratives ne complètent que si l'annonce a < 2 photos réelles.
  const base: CatMeta = m.detail
    ? { addr: m.detail.addr, beds: m.detail.beds, baths: m.detail.baths ?? 0, year: m.detail.year, floor: m.detail.floor as string, charges: m.detail.charges, drop: m.detail.drop, annonceur: m.detail.annonceur, features: m.detail.features, desc: m.detail.desc }
    : (CAT_META[m.place] || CAT_META.Carouge)
  const realGallery = m.detail?.gallery
  const gallery = realGallery && realGallery.length >= 2 ? realGallery : [m.photo, ...CAT_INTERIORS]
  const priceWas = base.drop ? m.pn + base.drop : null
  return { ...base, baths: m.detail ? m.detail.baths : base.baths, title, roomsRaw, surface, ppm2, priceWas, gallery }
}

// Icônes propriété — délègue à MEIcon quand un équivalent existe (CATD_ME) ;
// les tracés locaux (CATD_I) ne servent que pour prev/next.
const CATD_ME: Record<string, MEIconName> = {
  rooms: 'home', area: 'surface', bed: 'bed', bath: 'bath', year: 'calendar',
  floor: 'building', pin: 'location', sun: 'sun', shield: 'shield', down: 'arrow-down',
}
const CATD_I: Record<string, string> = {
  rooms: 'M4 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M4 21h14M12 12h.01',
  area: 'M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5',
  bed: 'M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M3 14h18M7 9V7a1 1 0 0 1 1-1h3v3',
  bath: 'M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3ZM6 12V6.5A2 2 0 0 1 8 4.5',
  year: 'M7 3v3M17 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z',
  floor: 'M3 20h4v-4h4v-4h4v-4h4V4',
  pin: 'M12 21s-6.5-6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5-6.5 11-6.5 11ZM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  sun: 'M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8',
  shield: 'M12 3l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3ZM9 12l2 2 4-4',
  down: 'M12 5v13M6 12l6 6 6-6',
  prev: 'M15 6l-6 6 6 6',
  next: 'M9 6l6 6-6 6',
}
function CatDIcon({ name, size = 15, sw = 1.7, color = 'currentColor' }: { name: string; size?: number; sw?: number; color?: string }) {
  const me = CATD_ME[name]
  if (me) {
    return <MEIcon name={me} size={size} color={color} strokeWidth={sw} />
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <path d={CATD_I[name]} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" /></svg>
  )
}

function CatDFeature({ children }: { children: ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, whiteSpace: 'nowrap',
      background: TK.card, border: `1px solid ${TK.cardBorder}`, color: TK.inkDim, fontSize: 12, fontWeight: 600 }}>{children}</span>
  )
}

// Ligne de critère épurée (ledger) — coche custom MEIcon, pas de sous-texte.
function CatMatchLine({ label, ok, first }: { label: string; ok: boolean; first: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0',
      borderTop: first ? 'none' : `1px solid ${TK.border}` }}>
      <span style={{ width: 16, height: 16, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
        <MEIcon name={ok ? 'check' : 'minus'} size={15} color={ok ? '#34C796' : TK.faint} strokeWidth={2.4} />
      </span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: ok ? TK.ink : TK.sub, letterSpacing: -0.1 }}>{label}</span>
      {!ok && <span style={{ fontSize: 11, fontWeight: 600, color: TK.sub, whiteSpace: 'nowrap' }}>à affiner</span>}
    </div>
  )
}

// ─── Atomes de la modale premium ────────────────────────────────────────
function CatRailCard({ children, pad = 16 }: { children: ReactNode; pad?: number }) {
  return (
    <div style={{ background: TK.frameHi, border: `1px solid ${TK.border}`, borderRadius: 18, padding: pad,
      boxShadow: '0 1px 2px rgba(0,0,0,.35)' }}>{children}</div>
  )
}

function CatEyebrow({ children, color = TK.sub }: { children: ReactNode; color?: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color, marginBottom: 11 }}>{children}</div>
  )
}

function CatSpecCell({ icon, label, value }: { icon: string; label: string; value: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '13px 13px 12px', borderRadius: 14,
      background: TK.card, border: `1px solid ${TK.cardBorder}` }}>
      <CatDIcon name={icon} size={17} color={TK.sub} />
      <span style={{ fontSize: 11, fontWeight: 600, color: TK.faint, letterSpacing: 0.2 }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: TK.ink, letterSpacing: -0.3, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

function CatPriceRow({ icon, label, value, accent, last }: { icon: string; label: string; value: ReactNode; accent?: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: last ? 'none' : `1px solid ${TK.border}` }}>
      {icon === 'down' ? <CatDIcon name="down" size={14} color={accent || TK.sub} /> : <RXIcon name={icon} size={14} sw={1.7} color={accent || TK.sub} />}
      <span style={{ flex: 1, fontSize: 12.5, color: TK.sub, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: accent || TK.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

// ─── Galerie photo « épouse la modale » — lightbox hi-fi contenue ───────
function CatGallery({ photos, start = 0, title, onClose }: { photos: string[]; start?: number; title: string; onClose: () => void }) {
  const [i, setI] = useState(start)
  const n = photos.length
  const lightMode = TK.frameSolid === '#FFFFFF'
  const stripRef = useRef<HTMLDivElement>(null)
  const prev = useCallback(() => setI((x) => (x - 1 + n) % n), [n])
  const next = useCallback(() => setI((x) => (x + 1) % n), [n])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() } else if (e.key === 'ArrowLeft') { e.stopPropagation(); prev() } else if (e.key === 'ArrowRight') { e.stopPropagation(); next() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [prev, next, onClose])
  useEffect(() => {
    const s = stripRef.current; if (!s) return
    const el = s.querySelector<HTMLElement>('[data-sel="true"]')
    if (el) s.scrollTo({ left: el.offsetLeft - s.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' })
  }, [i])
  const navBtn: React.CSSProperties = { position: 'absolute', top: '50%', transform: 'translateY(-50%)', zIndex: 3, width: 50, height: 50,
    borderRadius: 999, border: '1px solid rgba(255,255,255,.16)', cursor: 'pointer', display: 'grid', placeItems: 'center',
    background: 'rgba(12,13,17,.5)', color: '#fff', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column',
        background: lightMode ? TK.bg : '#0A0B0E', animation: 'cat-galfade-in .3s cubic-bezier(.22,1,.36,1)' }}>
      <style>{`
        @keyframes cat-galfade-in { from { opacity:0; } to { opacity:1; } }
        @keyframes cat-galphoto { from { opacity:0; transform:scale(1.035); } to { opacity:1; transform:none; } }
        .cat-gal-strip::-webkit-scrollbar { display:none; }
      `}</style>
      {/* scène photo */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', background: lightMode ? '#D8DBE1' : '#08090C' }}>
        <img key={i} src={photos[i]} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', animation: 'cat-galphoto .45s cubic-bezier(.22,1,.36,1)' }} />
        {/* scrim haut */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 128, zIndex: 1, pointerEvents: 'none',
          background: 'linear-gradient(180deg, rgba(8,9,12,.66) 0%, rgba(8,9,12,0) 100%)' }} />
        {/* chrome */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, zIndex: 2, display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', gap: 16, padding: '18px 20px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: -0.4,
              textShadow: '0 1px 14px rgba(0,0,0,.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.88)', fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap', background: 'rgba(12,13,17,.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              padding: '7px 13px', borderRadius: 999, border: '1px solid rgba(255,255,255,.14)' }}>{i + 1} / {n}</span>
            <button onClick={onClose} title="Fermer (Échap)" style={{ width: 40, height: 40, borderRadius: 999,
              border: '1px solid rgba(255,255,255,.16)', background: 'rgba(12,13,17,.5)', color: '#fff', cursor: 'pointer',
              display: 'grid', placeItems: 'center', fontSize: 20, lineHeight: 1, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>×</button>
          </div>
        </div>
        <button onClick={prev} aria-label="Précédente" style={{ ...navBtn, left: 18 }}><CatDIcon name="prev" size={22} color="#fff" /></button>
        <button onClick={next} aria-label="Suivante" style={{ ...navBtn, right: 18 }}><CatDIcon name="next" size={22} color="#fff" /></button>
      </div>
      {/* pellicule */}
      <div ref={stripRef} className="cat-gal-strip" style={{ flexShrink: 0, display: 'flex', gap: 9, padding: '13px 16px', background: lightMode ? '#FFFFFF' : '#0C0D11',
        overflowX: 'auto', scrollbarWidth: 'none', borderTop: `1px solid ${lightMode ? TK.border : 'rgba(255,255,255,.06)'}` }}>
        {photos.map((p, idx) => (
          <button key={idx} data-sel={idx === i} onClick={() => setI(idx)} style={{ flexShrink: 0, width: 120, height: 78,
            borderRadius: 12, overflow: 'hidden', padding: 0, cursor: 'pointer', position: 'relative',
            border: idx === i ? `2.5px solid ${lightMode ? '#0B0C0E' : '#fff'}` : '2.5px solid transparent',
            opacity: idx === i ? 1 : 0.5, transition: 'opacity .2s, border-color .2s' }}>
            <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </button>
        ))}
      </div>
    </div>
  )
}

function CatalogDetail({ m, proposed, onPropose, onClose }: { m: CatItem; proposed: boolean; onPropose: (m: CatItem) => void; onClose: () => void }) {
  const [active, setActive] = useState(0)
  const [galOpen, setGalOpen] = useState(false)
  const D = catDetail(m)
  const g = D.gallery, n = g.length
  const okN = critCount(m)
  const first = m.buyer.split(' ')[0]
  const reasons = critArr(m).slice().sort((a, b) => Number(b.ok) - Number(a.ok))
  const tileA = g[(active + 1) % n], tileB = g[(active + 2) % n]
  const compatTone = okN >= 4 ? '#34C796' : '#F2B855'
  const compatLabel = okN >= 5 ? 'Profil parfaitement aligné'
    : okN >= 4 ? 'Bien aligné avec sa recherche'
      : okN >= 3 ? 'Aligné — quelques écarts'
        : 'Plusieurs écarts à lever'
  const lightMode = TK.frameSolid === '#FFFFFF'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'grid', placeItems: 'center',
      background: 'rgba(6,6,10,.76)', backdropFilter: 'blur(7px)', animation: 'cat-overlay .25s ease', padding: '4vh 24px' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(1060px, 96%)', maxHeight: '92%', display: 'flex', flexDirection: 'column',
        borderRadius: 26, overflow: 'hidden', position: 'relative', background: TK.frameSolid, boxShadow: TK.shadowLg,
        border: `1px solid ${TK.borderHi}`, animation: 'cat-pop .34s cubic-bezier(.22,1,.36,1)' }}>

        {/* ── header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '16px 20px', borderBottom: `1px solid ${TK.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: TK.sub, whiteSpace: 'nowrap' }}>Détail du match</span>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 999, border: `1px solid ${TK.border}`, background: TK.card, color: TK.inkDim, cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>

        {/* ── corps : grille éditoriale 2 colonnes ── */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 332px', gap: 22, padding: '22px 24px 26px', alignItems: 'start' }}>

            {/* ── colonne principale ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
              {/* collage photo éditorial */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.62fr 1fr', gridTemplateRows: '1fr 1fr', gap: 9, height: 312 }}>
                <button onClick={() => setGalOpen(true)} style={{ gridRow: '1 / span 2', position: 'relative', borderRadius: 18, overflow: 'hidden', padding: 0, border: 0, cursor: 'pointer' }}>
                  <img src={g[active]} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,8,12,.28) 0%, transparent 30%, transparent 64%, rgba(8,8,12,.5) 100%)' }} />
                </button>
                <button onClick={() => { setActive((active + 1) % n); setGalOpen(true) }} style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', padding: 0, border: 0, cursor: 'pointer' }}>
                  <img src={tileA} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
                <button onClick={() => { setActive((active + 2) % n); setGalOpen(true) }} style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', padding: 0, border: 0, cursor: 'pointer' }}>
                  <img src={tileB} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  {n > 3 && (
                    <>
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,12,.6)' }} />
                      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>+{n - 3}</div>
                          <div style={{ fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,.8)', marginTop: 2 }}>photos</div>
                        </div>
                      </div>
                    </>
                  )}
                </button>
              </div>

              {/* titre + adresse */}
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: 27, fontWeight: 800, letterSpacing: -0.8, color: TK.ink, lineHeight: 1.06, textWrap: 'balance' }}>{D.title}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 10, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: TK.inkDim }}><CatDIcon name="pin" size={14} color={TK.sub} />{D.addr}</span>
                </div>
              </div>

              {/* caractéristiques (grille de cellules) */}
              <div>
                <CatEyebrow>Caractéristiques</CatEyebrow>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9 }}>
                  <CatSpecCell icon="rooms" label="Pièces" value={D.roomsRaw.replace(/\bp\b/, 'pièces').replace('.', ',')} />
                  {D.surface && <CatSpecCell icon="area" label="Surface" value={`${D.surface} m²`} />}
                  <CatSpecCell icon="bed" label="Chambres" value={D.beds} />
                  <CatSpecCell icon="bath" label="Salles d'eau" value={D.baths ?? '—'} />
                  <CatSpecCell icon="year" label="Année" value={D.year} />
                  <CatSpecCell icon="floor" label="Étage" value={D.floor === '—' ? 'Villa' : D.floor} />
                </div>
              </div>

              {/* atouts */}
              <div>
                <CatEyebrow>Atouts</CatEyebrow>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {D.features.map((ft, i) => <CatDFeature key={i}>{ft}</CatDFeature>)}
                </div>
              </div>

              {/* description */}
              <div>
                <CatEyebrow>Description</CatEyebrow>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: TK.inkDim, textWrap: 'pretty' }}>{D.desc}</p>
              </div>

              {/* localisation — emplacement carte (intégration Mapbox à venir) */}
              <div>
                <CatEyebrow>Localisation</CatEyebrow>
                <div style={{ position: 'relative', height: 172, borderRadius: 16, overflow: 'hidden', border: `1px solid ${TK.cardBorder}`,
                  background: `
                    linear-gradient(90deg, rgba(255,255,255,.05) 0 2px, transparent 2px) 18px 0/96px 100%,
                    linear-gradient(90deg, rgba(255,255,255,.035) 0 1.5px, transparent 1.5px) 0 0/44px 100%,
                    linear-gradient(0deg, rgba(255,255,255,.05) 0 2px, transparent 2px) 0 30px/100% 88px,
                    linear-gradient(0deg, rgba(255,255,255,.035) 0 1.5px, transparent 1.5px) 0 0/100% 40px,
                    linear-gradient(118deg, rgba(255,255,255,.06) 0 3px, transparent 3px) -40px 0/220px 100%,
                    radial-gradient(120% 90% at 62% 30%, rgba(46,86,140,.20) 0%, transparent 55%),
                    ${TK.card}` }}>
                  {/* trait diagonal façon avenue + filet d'eau */}
                  <div style={{ position: 'absolute', left: '-6%', right: '-6%', top: '58%', height: 7, transform: 'rotate(-7deg)',
                    background: 'rgba(255,255,255,.07)' }} />
                  <div style={{ position: 'absolute', left: 0, bottom: 0, width: '42%', height: '38%',
                    background: 'linear-gradient(135deg, rgba(46,86,140,.28), rgba(46,86,140,.10))',
                    borderTopRightRadius: 40 }} />
                  {/* marqueur pin centré */}
                  <div style={{ position: 'absolute', left: '50%', top: '46%', transform: 'translate(-50%,-100%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ width: 34, height: 34, borderRadius: '50% 50% 50% 2px', transform: 'rotate(45deg)', display: 'grid', placeItems: 'center',
                      background: lightMode ? '#0B0C0E' : '#F2F2F6', boxShadow: '0 6px 16px rgba(0,0,0,.45)' }}>
                      <span style={{ transform: 'rotate(-45deg)', display: 'grid', placeItems: 'center' }}>
                        <CatDIcon name="pin" size={15} color={lightMode ? '#fff' : '#0A0A0F'} />
                      </span>
                    </span>
                  </div>
                  {/* attribution Mapbox */}
                  <span style={{ position: 'absolute', right: 10, bottom: 11, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9.5,
                    fontWeight: 600, letterSpacing: 0.3, color: 'rgba(255,255,255,.5)' }}>© Mapbox</span>
                </div>
              </div>
            </div>

            {/* ── rail latéral sticky ── */}
            <div style={{ position: 'sticky', top: 0, display: 'flex', flexDirection: 'column', gap: 13 }}>

              {/* prix */}
              <CatRailCard pad={18}>
                <CatEyebrow>Prix de vente</CatEyebrow>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 30, fontWeight: 800, color: TK.ink, letterSpacing: -1, fontVariantNumeric: 'tabular-nums', lineHeight: 1, whiteSpace: 'nowrap' }}>CHF {m.price}</div>
                  {D.priceWas && <span style={{ fontSize: 13, color: TK.faint, textDecoration: 'line-through', fontVariantNumeric: 'tabular-nums' }}>CHF {fmtCHFk(D.priceWas).replace('CHF ', '')}</span>}
                </div>
                <div style={{ marginTop: 13 }}>
                  {D.charges > 0 && <CatPriceRow icon="doc" label="Charges" value={`CHF ${fmtCHFk(D.charges).replace('CHF ', '')} / mois`} />}
                  <CatPriceRow icon="clock" label="Sur le marché" value={m.days === 0 ? "Aujourd'hui" : `${m.days} jours`} last />
                </div>
              </CatRailCard>

              {/* acheteur + preuve du match */}
              <CatRailCard pad={18}>
                <CatEyebrow>Acheteur</CatEyebrow>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Av initials={m.bi} av={m.av} size={46} ring />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: TK.ink, letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.buyer}</div>
                    <div style={{ fontSize: 12, color: TK.sub, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.tag} · cherche {m.specs}</div>
                  </div>
                </div>
                {/* compatibilité — concept épuré : verdict qualitatif + ledger */}
                <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${TK.border}` }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: TK.sub, marginBottom: 5 }}>Compatibilité</div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: compatTone, letterSpacing: -0.3, marginBottom: 13 }}>{compatLabel}</div>
                  <div>
                    {reasons.map((r, i) => (
                      <CatMatchLine key={r.k} label={r.k} ok={r.ok} first={i === 0} />
                    ))}
                  </div>
                </div>
              </CatRailCard>

              {/* annonceur — source de l'annonce (veille marché) */}
              <CatRailCard pad={18}>
                <CatEyebrow>Annonceur</CatEyebrow>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, display: 'grid', placeItems: 'center',
                    background: TK.frameHi, border: `1px solid ${TK.border}`, fontSize: 14, fontWeight: 800,
                    color: TK.ink, letterSpacing: -0.3 }}>{D.annonceur.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: TK.ink, letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{D.annonceur.name}</div>
                  </div>
                </div>
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${TK.border}`, display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {D.annonceur.agent && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <CatDIcon name="pin" size={15} color={TK.sub} />
                      <span style={{ flex: 1, fontSize: 13, color: TK.ink, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{D.annonceur.agent}</span>
                      {D.annonceur.role && <span style={{ fontSize: 12, color: TK.sub, fontWeight: 500, flexShrink: 0 }}>{D.annonceur.role}</span>}
                    </div>
                  )}
                  {D.annonceur.phone ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <RXIcon name="phone" size={15} sw={1.7} color={TK.sub} />
                      <span style={{ flex: 1, fontSize: 13, color: TK.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{D.annonceur.phone}</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <RXIcon name="spark" size={15} sw={1.7} color={TK.sub} />
                      <span style={{ flex: 1, fontSize: 13, color: TK.sub, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{D.annonceur.type}{D.annonceur.mandat ? ` · ${D.annonceur.mandat}` : ''}</span>
                    </div>
                  )}
                </div>
              </CatRailCard>

            </div>
          </div>
        </div>

        {/* ── footer sticky ── action principale alignée à droite ── */}
        <div style={{ padding: '14px 24px 18px', borderTop: `1px solid ${TK.border}`, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 11, flexShrink: 0, background: TK.frameSolid }}>
          <button onClick={() => onPropose(m)} style={{ height: 48, padding: '0 22px', borderRadius: 999, border: 0, cursor: 'pointer',
            background: proposed ? '#15643F' : '#424bfb',
            color: '#FFFFFF',
            fontFamily: 'inherit', fontSize: 14.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 9, whiteSpace: 'nowrap',
            transition: 'background-color .25s ease' }}>
            {proposed ? <>Ajouté au dossier de {first}</> : <>Mettre dans le dossier de {first}</>}
          </button>
        </div>

        {/* ── galerie « épouse la modale » ── */}
        {galOpen && <CatGallery photos={g} start={active} title={D.title} onClose={() => setGalOpen(false)} />}
      </div>
    </div>
  )
}

// ─── Tuile « +N autres » (débordement du mur) ───────────────────────────
function CatalogMoreTile({ items, onOpen, delay = 0, shown }: { items: (CatItem & { proposed: boolean })[]; onOpen: () => void; delay?: number; shown: boolean }) {
  const [h, setH] = useState(false)
  const n = items.length
  const lightMode = TK.frameSolid === '#FFFFFF'
  const overlay = lightMode
    ? 'linear-gradient(180deg, rgba(255,255,255,.5) 0%, rgba(255,255,255,.78) 100%)'
    : 'linear-gradient(180deg, rgba(8,8,12,.7) 0%, rgba(8,8,12,.92) 100%)'
  const ringCol = lightMode ? '#FFFFFF' : '#14141E'
  const bigCol = lightMode ? TK.ink : '#fff'
  const pillBg = lightMode ? '#0B0C0E' : '#F2F2F6'
  const pillFg = lightMode ? '#FFFFFF' : '#0A0A0F'
  return (
    <div onClick={onOpen} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', height: '100%', cursor: 'pointer',
        border: `1px solid ${h ? TK.borderHi : TK.border}`, boxShadow: h ? TK.shadowLg : TK.shadow,
        background: TK.frameSolid, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 16,
        opacity: shown ? 1 : 0, transform: shown ? (h ? 'translateY(-3px)' : 'none') : 'translateY(18px)',
        transition: `opacity .55s ease ${delay}ms, transform .55s cubic-bezier(.22,1,.36,1) ${shown && h ? 0 : delay}ms, box-shadow .25s, border-color .25s` }}>
      {/* aperçu photos en mosaïque douce derrière */}
      <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', opacity: lightMode ? 0.22 : 0.16 }}>
        {items.slice(0, 4).map((m, i) => (
          <img key={i} src={m.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ))}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: overlay }} />
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end' }}>
        {/* stack d'avatars */}
        <div style={{ display: 'flex' }}>
          {items.slice(0, 4).map((m, i) => (
            <div key={i} style={{ marginLeft: i ? -10 : 0, borderRadius: 999, boxShadow: `0 0 0 2px ${ringCol}` }}>
              <Av initials={m.bi} av={m.av} size={26} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1, color: bigCol, fontVariantNumeric: 'tabular-nums' }}>+{n}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: TK.inkDim, marginTop: 4 }}>autre{n > 1 ? 's' : ''} match{n > 1 ? 's' : ''}</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 11, padding: '7px 13px', borderRadius: 999,
          background: pillBg, color: pillFg, fontSize: 12, fontWeight: 700 }}>
          Voir tout le catalogue <RXIcon name="arrow" size={13} sw={2.2} color={pillFg} />
        </div>
      </div>
    </div>
  )
}

// ─── Overlay « tout le catalogue » (galerie dense scrollable) ───────────
function CatalogGalleryCard({ m, proposed, onOpen }: { m: CatItem; proposed: boolean; onOpen: (m: CatItem) => void }) {
  const [h, setH] = useState(false)
  return (
    <div onClick={() => onOpen(m)} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', height: 236, cursor: 'pointer',
        border: `1px solid ${proposed ? 'rgba(52,199,150,.5)' : h ? TK.borderHi : TK.border}`, boxShadow: h ? TK.shadowLg : TK.shadow,
        transform: h ? 'translateY(-3px)' : 'none', transition: 'transform .25s cubic-bezier(.22,1,.36,1), box-shadow .25s, border-color .25s' }}>
      <img src={m.photo} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
        transform: h ? 'scale(1.06)' : 'scale(1)', transition: 'transform 1.1s cubic-bezier(.22,1,.36,1)', filter: proposed ? 'saturate(.65) brightness(.82)' : 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,8,12,.12) 0%, rgba(8,8,12,.04) 40%, rgba(8,8,12,.93) 100%)' }} />
      <div style={{ position: 'absolute', top: 11, left: 11 }}>
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap',
          background: 'rgba(8,8,12,.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          padding: '6px 12px', borderRadius: 999, border: `1px solid ${TK.borderHi}` }}>
          <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: 'rgba(255,255,255,.7)' }}>{m.place}</span>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: -0.2, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>CHF {m.price}</span>
        </span>
      </div>
      {proposed && (
        <div style={{ position: 'absolute', top: 11, right: 11, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 999,
          background: 'rgba(21,100,63,.9)', border: '1px solid rgba(52,199,150,.6)' }}>
          <RXIcon name="check" size={11} sw={2.6} color="#9be9c1" /><span style={{ fontSize: 10.5, fontWeight: 800, color: '#DBF4E6' }}>Proposé</span>
        </div>
      )}
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 11, display: 'flex', alignItems: 'center', gap: 9 }}>
        <Av initials={m.bi} av={m.av} size={30} ring />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff', letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.buyer}</div>
        </div>
      </div>
    </div>
  )
}

function CatalogGalleryOverlay({ list, proposedSet, sortLabel, onCycleSort, onOpen, onClose }: { list: CatItem[]; proposedSet: Set<number>; sortLabel: string; onCycleSort: () => void; onOpen: (m: CatItem) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
  const lightMode = TK.frameSolid === '#FFFFFF'
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: TK.bg, display: 'flex', flexDirection: 'column' }}>
      <Orbs />
      {/* header pleine page */}
      <div style={{ position: 'relative', zIndex: 1, padding: '28px 34px 18px', borderBottom: `1px solid ${TK.border}`, flexShrink: 0 }}>
        <button onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px 7px 10px', borderRadius: 999, marginBottom: 14,
          border: `1px solid ${TK.cardBorder}`, background: TK.card, color: TK.inkDim, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700 }}>
          <span style={{ display: 'inline-flex', transform: 'scaleX(-1)' }}><RXIcon name="arrow" size={14} sw={2.2} color={TK.inkDim} /></span>Retour au mur</button>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: -1.2, lineHeight: 1, color: TK.ink }}>Tout le catalogue</h1>
              <span style={{ fontSize: 13, fontWeight: 800, color: lightMode ? '#FFFFFF' : '#0A0A0F', background: lightMode ? '#0B0C0E' : '#F2F2F6', padding: '4px 11px', borderRadius: 999, fontVariantNumeric: 'tabular-nums' }}>{list.length}</span>
            </div>
            <div style={{ fontSize: 13, color: TK.sub, marginTop: 8 }}>Galerie complète</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button onClick={onCycleSort} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 999,
              border: `1px solid ${TK.cardBorder}`, background: TK.card, color: TK.inkDim, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
              <RXIcon name="trend" size={13} sw={1.9} />Trier · {sortLabel}</button>
            <button onClick={onClose} style={{ width: 40, height: 40, borderRadius: 999, border: `1px solid ${TK.cardBorder}`, background: TK.card, color: TK.inkDim, cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 20, lineHeight: 1 }}>×</button>
          </div>
        </div>
      </div>
      {/* galerie scrollable */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 34px 34px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {list.map((m) => (
            <CatalogGalleryCard key={m.id} m={m} proposed={proposedSet.has(m.id)} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Stat d'enjeu ────────────────────────────────────────────────────────
function EnjeuStat({ icon, children, accent }: { icon: string; children: ReactNode; accent?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px 5px 10px', borderRadius: 999,
      background: TK.card, border: `1px solid ${TK.cardBorder}`, whiteSpace: 'nowrap' }}>
      <RXIcon name={icon} size={13} sw={1.9} color={accent || TK.inkDim} />
      <span style={{ fontSize: 12.5, fontWeight: 700, color: TK.inkDim }}>{children}</span>
    </span>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────
export function PageCatalogue() {
  const [filter, setFilter] = useState('tous')
  const [sortI, setSortI] = useState(0)
  const [sel, setSel] = useState<CatItem | null>(null)
  const [proposed, setProposed] = useState<Set<number>>(() => new Set())
  const [shown] = useState(true)
  const [showAll, setShowAll] = useState(false)

  const lightMode = TK.frameSolid === '#FFFFFF'

  // Matches réels de l'agence (score desc) → items de catalogue ; fallback démo
  // (seed) si aucun match ou session non authentifiée.
  const { matches, isLoading, sendMatch } = useMatching()
  // Matches déjà marqués « proposés » en base (évite un double envoi sur re-toggle).
  const sentRef = useRef<Set<string>>(new Set())

  // « Mettre dans le dossier » : toggle visuel + écriture réelle la 1re fois —
  // sendMatch marque le match `status='sent'` (proposé). AUCUN email n'est envoyé
  // (état CRM seulement). Item seed (pas de matchId) → toggle local uniquement.
  const togglePropose = (m: CatItem) => {
    const adding = !proposed.has(m.id)
    setProposed((prev) => { const n = new Set(prev); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n })
    if (adding && m.matchId && !sentRef.current.has(m.matchId)) {
      sentRef.current.add(m.matchId)
      sendMatch(m.matchId, 'email')
    }
  }
  const catalogue = useMemo<CatItem[]>(
    () => (!isLoading && matches.length > 0 ? matches.map(matchToCatItem) : SEED_CATA),
    [matches, isLoading],
  )

  const f = CATA_FILTERS.find((x) => x.key === filter) || CATA_FILTERS[0]
  const sort = CATA_SORTS[sortI]
  const list = catalogue.filter(f.test).slice().sort(sort.cmp)
  const featured = list[0]
  // mur fixe : 1 featured + 4 cases. Si >5, la dernière case devient « +N autres ».
  const restAll = list.slice(1)
  const overflow = restAll.length > 4
  const restTiles = overflow ? restAll.slice(0, 3) : restAll
  const overflowItems = (overflow ? restAll.slice(3) : []).map((m) => ({ ...m, proposed: proposed.has(m.id) }))

  return (
    <div style={{ width: '100%', height: '100%', background: TK.bg, color: TK.ink,
      fontFamily: 'Manrope, system-ui, sans-serif', padding: '36px 34px 22px', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <Orbs />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14, flexShrink: 0, gap: 20 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: '0', fontSize: 32, fontWeight: 800, letterSpacing: -1.2, lineHeight: 1, color: TK.ink }}>Catalogue de matchs</h1>
            {proposed.size > 0 && (
              <div style={{ display: 'flex', gap: 9, marginTop: 11, flexWrap: 'wrap' }}>
                <EnjeuStat icon="check" accent="#34C796">{proposed.size} proposé{proposed.size > 1 ? 's' : ''}</EnjeuStat>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button onClick={() => setSortI((i) => (i + 1) % CATA_SORTS.length)} title="Changer le tri"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 999, border: 0, cursor: 'pointer',
                boxShadow: `inset 0 0 0 1px ${TK.cardBorder}`, background: TK.card, color: TK.inkDim, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
              <RXIcon name="trend" size={13} sw={1.9} color={TK.inkDim} />Trier {sort.label}</button>
            <span style={{ width: 1, height: 22, background: TK.cardBorder, flexShrink: 0 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              {CATA_FILTERS.map((c) => {
                const on = c.key === filter
                const n = catalogue.filter(c.test).length
                return (
                  <button key={c.key} onClick={() => setFilter(c.key)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 999, border: 0, cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
                    background: on ? (lightMode ? '#0B0C0E' : '#F2F2F6') : TK.card, color: on ? (lightMode ? '#FFFFFF' : '#0A0A0F') : TK.inkDim,
                    boxShadow: on ? 'none' : `inset 0 0 0 1px ${TK.cardBorder}`, transition: 'background .18s, color .18s' }}>
                    {c.label}<span style={{ fontSize: 11, fontWeight: 800, color: on ? (lightMode ? 'rgba(255,255,255,.55)' : '#797D90') : TK.faint, fontVariantNumeric: 'tabular-nums' }}>{n}</span></button>
                )
              })}
            </div>
          </div>
        </div>

        {/* grille */}
        {list.length === 0 ? (
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: TK.sub, fontSize: 14 }}>Aucun match dans ce filtre.</div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: 'grid',
            gridTemplateColumns: '1.55fr 1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 15 }}>
            <div style={{ gridRow: '1 / span 2', minHeight: 0 }}>
              <CatalogTile m={featured} big onOpen={setSel} shown={shown} delay={0} proposed={proposed.has(featured.id)} />
            </div>
            {restTiles.map((m, i) => (
              <div key={m.id + '-' + filter + '-' + sort.key} style={{ minHeight: 0 }}>
                <CatalogTile m={m} onOpen={setSel} shown={shown} delay={80 + i * 60} proposed={proposed.has(m.id)} />
              </div>
            ))}
            {overflow && (
              <div key="more" style={{ minHeight: 0 }}>
                <CatalogMoreTile items={overflowItems} onOpen={() => setShowAll(true)} shown={shown} delay={80 + 3 * 60} />
              </div>
            )}
          </div>
        )}
      </div>

      {sel && <CatalogDetail m={sel} proposed={proposed.has(sel.id)} onPropose={togglePropose} onClose={() => setSel(null)} />}
      {showAll && <CatalogGalleryOverlay list={list} proposedSet={proposed} sortLabel={sort.label}
        onCycleSort={() => setSortI((i) => (i + 1) % CATA_SORTS.length)}
        onOpen={(m) => { setShowAll(false); setSel(m) }} onClose={() => setShowAll(false)} />}
    </div>
  )
}
