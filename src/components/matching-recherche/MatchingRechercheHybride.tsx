// MEGGA CRM — Matching · Recherche hybride (page 1 du pager Matching).
//
// Recherche du marché connecté (RealAdvisor = vente + Flatfox = location, 26
// cantons). Port du proto handoff `crm-matching-recherche.jsx`, câblé LIVE :
//   - filtre DUR (transaction, canton, type, budget) poussé EN SQL (useMatchingSearch)
//   - texte libre + scoring + tri côté client sur le sous-ensemble borné
//   - omnibox à jetons (acheteur → score de match), Tout/Vente/Location, envoi multiple.
//
// ⚠️ Incrément B : grille + omnibox + scoring + envoi. La fiche « Voir l'annonce »
// (MrhExtDetail) et la vue Carte arrivent en incrément C (clic carte → portail
// pour l'instant). « Proches des critères » aussi.

import EtatVide from '@/components/crm/EtatVide'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { crmPalette } from '@/components/crm/tokens'
import { useToast } from '@/components/ui/Toast'
import { useAiPanel } from '@/hooks/useAiPanel'
import { useAuth } from '@/hooks/useAuth'
import { useSendReceptionSelection, type SendSelectionResult } from '@/hooks/useSendReceptionSelection'
import { formatCHF } from '@/lib/utils'
import RechIcon from './RechIcon'
import MrhGrid, { type MrhItem } from './MrhGrid'
import MrhExtDetail from './MrhExtDetail'
import MrhMapView from './MrhMapView'
import MrhSendSheet from './MrhSendSheet'
import { useMatchingSearch, useMatchingSearchTotal, useMatchingBuyers, useCitySuggest, type SearchTx } from '@/hooks/useMatchingRecherche'
import { typeLabelFr, type MrhBien, type MrhContact } from './types'
import type { MrhCtx, MrhScore, MrhSurf } from './mrhCtx'
import {
  MRH_DEMO_BIENS, MRH_DEMO_BUYERS, MRH_DEMO_CITIES, MRH_DEMO_DETAIL, MRH_DEMO_SEND,
  MRH_DEMO_TOTAL, type MrhDemoEtat,
} from './mrhDemo'
import { parseQuery, norm } from './omniParse'
import './mrh.css'

// millions / milliers (jetons budget) : 1'100'000 → « 1,1M » ; 3'000 → « 3k »
const mrhM = (n: number) => (n >= 1e6 ? String(Math.round(n / 1e5) / 10).replace('.', ',') + 'M' : Math.round(n / 1e3) + 'k')

type MrhToken =
  | { id: string; kind: 'crit' | 'filter'; label: string; field: 'canton'; value: string }
  | { id: string; kind: 'crit' | 'filter'; label: string; field: 'city'; value: string }
  | { id: string; kind: 'crit' | 'filter'; label: string; field: 'type'; value: string }
  | { id: string; kind: 'crit' | 'filter'; label: string; field: 'budgetMax'; value: number }
  | { id: string; kind: 'crit' | 'filter'; label: string; field: 'rooms'; value: number }
  | { id: string; kind: 'crit' | 'filter'; label: string; field: 'budgetMin'; value: number }
  | { id: string; kind: 'crit' | 'filter'; label: string; field: 'surface'; value: number }
  | { id: string; kind: 'crit' | 'filter'; label: string; field: 'text'; value: string }

// score heuristique (proto `mrhScore`) — contre les critères du contact.
function scoreBien(c: MrhContact, b: MrhBien): MrhScore {
  const cr = c.criteria
  let s = 50
  const rs: string[] = []
  if (b.transaction !== cr.transaction) s -= 30
  if (cr.types.length) { if (cr.types.includes(b.type)) { s += 15; rs.push('type') } else s -= 20 }
  const inZone = (b.canton && cr.cantons.includes(b.canton)) || cr.cities.some((ci) => `${b.city ?? ''} ${b.addr}`.toLowerCase().includes(ci.toLowerCase()))
  if (cr.cantons.length || cr.cities.length) { if (inZone) { s += 12; rs.push('zone') } else s -= 15 }
  const price = b.transaction === 'location' ? b.rent : b.price
  if (cr.budgetMax && price) {
    if (price <= cr.budgetMax && (!cr.budgetMin || price >= cr.budgetMin * 0.9)) { s += 15; rs.push('budget') } else s -= 18
  }
  if (cr.roomsMin && (b.rooms ?? 0) >= cr.roomsMin) { s += 8; rs.push('rooms') }
  if (cr.areaMin && (b.area ?? 0) >= cr.areaMin) { s += 6; rs.push('surface') }
  return { score: Math.max(12, Math.min(97, s)), reasons: rs.slice(0, 3) }
}

interface Props {
  dark: boolean
  /**
   * Banc d'essai (`/dev/matching-atelier`) : les cinq requêtes de cet écran sont
   * remplacées par les fixtures de `mrhDemo.ts`, et aucun geste n'écrit.
   *
   * ⚠ Ce composant est le SEUL du périmètre bureau qui porte ses propres hooks —
   * `AtelierStage` est présentationnel et se nourrit par ses props. Sans ce mode,
   * la moitié la plus lourde de l'écran Matching n'a aucun banc : toutes ses
   * requêtes sont gatées sur la session, donc sans session elle ne rend qu'un
   * état bloqué. Idiome repris de `MobileMatchingScreen demo`, pas inventé ici.
   *
   * La valeur choisit l'ÉTAT à montrer (`ok` · `vide` · `erreur` · `bloque`) —
   * les trois derniers ne s'atteignent pas par hasard en production.
   */
  demo?: MrhDemoEtat
}

export default function MatchingRechercheHybride({ dark, demo }: Props) {
  const { t } = useTranslation('matching')
  const navigate = useNavigate()
  const toast = useToast()
  const { profile } = useAuth()
  const sendSel = useSendReceptionSelection()
  const ai = useAiPanel()
  const sp = crmPalette(dark)
  const surf: MrhSurf = {
    card: dark ? sp.cardBg : '#FFFFFF',
    // `cardSub` = fond des vignettes photo (et leur repli) → palier « sous-card ».
    cardSub: dark ? sp.cardSubBg : '#F4F6F9',
    hairline: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(3,3,3,0.05)',
    shadow: sp.shadow,
    shadowHov: dark ? '0 1px 2px rgba(0,0,0,.5), 0 18px 44px -14px rgba(0,0,0,.7)' : '0 1px 2px rgba(3,3,3,.06), 0 22px 48px -16px rgba(3,3,3,.2)',
  }
  // Accent de l'écran : il valait l'ENCRE inversée (règle Sugar Pure), donc
  // une non-couleur. Segments actifs, jetons de recherche et CTA le portent.
  const ACC = sp.accent
  const ONACC = sp.accentInk
  const line = dark ? 'rgba(255,255,255,.09)' : 'rgba(3,3,3,.06)'
  const chipBg = dark ? 'rgba(255,255,255,.06)' : '#F4F6F9'
  const popBg = dark ? sp.solidBg : surf.card

  // ── état ──
  const [buyer, setBuyer] = useState<MrhContact | null>(null)
  const [trans, setTrans] = useState<'all' | 'vente' | 'location'>('all')
  const [tokens, setTokens] = useState<MrhToken[]>([])
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'pertinence' | 'recent' | 'price-asc' | 'price-desc'>('recent')
  const [sel, setSel] = useState<string[]>([])
  const [sentLink, setSentLink] = useState<SendSelectionResult | null>(null)
  const [dd, setDd] = useState(false)
  const [sugIdx, setSugIdx] = useState(0)
  const [extBien, setExtBien] = useState<MrhBien | null>(null)
  const [view, setView] = useState<'grid' | 'map'>(() => {
    try { return (localStorage.getItem('megga-rech-view') as 'grid' | 'map') || 'grid' } catch { return 'grid' }
  })
  useEffect(() => { try { localStorage.setItem('megga-rech-view', view) } catch { /* ignore */ } }, [view])
  const inputRef = useRef<HTMLInputElement>(null)

  // ⚠ Les hooks restent appelés INCONDITIONNELLEMENT — le mode démo substitue
  // leur RÉSULTAT, il ne saute pas l'appel. Sans session ils sont de toute façon
  // désactivés et aucune requête ne part.
  const { data: liveBuyers = [] } = useMatchingBuyers()
  const buyers = demo ? MRH_DEMO_BUYERS : liveBuyers

  // ── params serveur (filtre DUR) dérivés des jetons + transaction + acheteur ──
  const serverParams = useMemo(() => {
    const effTx: SearchTx = trans === 'vente' ? 'buy' : trans === 'location' ? 'rent' : null
    const cantons = tokens.filter((tk) => tk.field === 'canton').map((tk) => tk.value as string)
    const types = tokens.filter((tk) => tk.field === 'type').map((tk) => tk.value as string)
    const budgetTok = tokens.filter((tk) => tk.field === 'budgetMax').map((tk) => tk.value as number)
    const budgetMax = budgetTok.length ? Math.min(...budgetTok) : buyer?.criteria.budgetMax ?? null
    const budgetMinTok = tokens.filter((tk) => tk.field === 'budgetMin').map((tk) => tk.value as number)
    const budgetMin = budgetMinTok.length ? Math.max(...budgetMinTok) : buyer?.criteria.budgetMin ?? null
    // Une seule ville à la fois (la plus récente) → filtre p_city exact en SQL.
    const cityTok = tokens.filter((tk) => tk.field === 'city')
    const city = cityTok.length ? (cityTok[cityTok.length - 1].value as string) : null
    // Pas de `limitPerTx` ici : le plafond appartient au hook (MAX_PER_TX), qui
    // sait aussi entrelacer vente/location avant de borner.
    return { transaction: effTx, cantons, types, budgetMax, budgetMin, city }
  }, [trans, tokens, buyer])

  // TROIS états, pas deux. `isLoading` seul faisait afficher « aucune annonce du
  // marché » alors qu'aucune requête n'était partie (affirmation sur la base sans
  // l'avoir interrogée) ; `isPending` seul faisait tourner un spinner ÉTERNEL dans
  // le même cas, puisqu'une query désactivée reste `pending` avec `fetchStatus`
  // à `idle`. On lit donc `status` ET `fetchStatus` :
  //   (a) bloquée  — n'a pas pu partir : le dire, et proposer de réessayer
  //   (b) en vol   — chargement légitime
  //   (c) résolue  — seul cas où l'on a le droit d'affirmer « aucune annonce »
  const live = useMatchingSearch(serverParams)
  const biens: MrhBien[] = demo ? (demo === 'ok' ? MRH_DEMO_BIENS : []) : live.data ?? []
  const refetch = demo ? () => {} : live.refetch
  const isFetchingFirst = demo ? false : live.status === 'pending' && live.fetchStatus === 'fetching'
  // `blocked` (gate faux) OU `pending` sans requête en vol (query en pause).
  const isBlocked = demo ? demo === 'bloque' : live.blocked || (live.status === 'pending' && !isFetchingFirst)
  const isError = demo ? demo === 'erreur' : live.isError
  const isSettled = demo ? demo === 'ok' || demo === 'vide' : live.status === 'success'

  // Chien de garde : au-delà de 15 s, une requête « en cours » n'est plus un
  // chargement, c'est un incident. On le dit plutôt que de faire tourner le
  // spinner à l'infini — c'est exactement ce qui a rendu ce bug indiagnosticable.
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!isFetchingFirst) { setSlow(false); return }
    const id = setTimeout(() => setSlow(true), 15_000)
    return () => clearTimeout(id)
  }, [isFetchingFirst])
  // Total RÉEL du marché filtré — sert à ne jamais présenter la taille de la
  // tranche chargée comme un nombre de marché.
  const { data: liveTotal } = useMatchingSearchTotal(serverParams)
  const marketTotal = demo ? (demo === 'ok' ? MRH_DEMO_TOTAL : 0) : liveTotal

  // ── filtres client (texte libre + jetons pièces/quartier) + scoring ──
  const clientTokens = useMemo(() => tokens.filter((tk) => tk.field === 'rooms' || tk.field === 'text' || tk.field === 'surface'), [tokens])
  // Meule de recherche texte : titre + adresse + ville + features + réf, normalisée
  // (sans accents/casse) — le texte matche aussi les FEATURES structurées (garage, balcon…).
  const bienHay = useCallback((b: MrhBien) => norm(`${b.title} ${b.addr} ${b.city ?? ''} ${(b.features ?? []).join(' ')} ${b.ref ?? ''}`), [])
  const strictPass = useCallback((b: MrhBien) => {
    const hay = bienHay(b)
    for (const tk of clientTokens) {
      if (tk.field === 'rooms' && (b.rooms ?? 0) < tk.value) return false
      if (tk.field === 'surface' && (b.area ?? 0) < tk.value) return false
      if (tk.field === 'text' && !hay.includes(norm(String(tk.value)))) return false
    }
    if (q.trim() && !hay.includes(norm(q))) return false
    return true
  }, [clientTokens, q, bienHay])

  const strict: MrhItem[] = useMemo(() => {
    const list: MrhItem[] = biens.filter(strictPass).map((b) => ({ b, m: buyer ? scoreBien(buyer, b) : null }))
    if (sort === 'pertinence' && buyer) list.sort((a, z) => (z.m?.score ?? 0) - (a.m?.score ?? 0))
    else if (sort === 'price-asc') list.sort((a, z) => (a.b.price ?? a.b.rent ?? 0) - (z.b.price ?? z.b.rent ?? 0))
    else if (sort === 'price-desc') list.sort((a, z) => (z.b.price ?? z.b.rent ?? 0) - (a.b.price ?? a.b.rent ?? 0))
    else list.sort((a, z) => a.b.postedRank - z.b.postedRank)
    return list
  }, [biens, strictPass, buyer, sort])

  const reasonFor = useCallback((it: MrhItem): string | null => {
    if (!buyer || !it.m || !it.m.reasons.length) return null
    return it.m.reasons.map((k) => t(`recherche.reason.${k}`)).join(', ')
  }, [buyer, t])

  // « Proches des critères » : biens du set serveur qui ne passent PAS un filtre
  // client (texte / pièces) mais scorent bien (≥55). Nécessite un acheteur (score).
  // La transaction, elle, reste une frontière DURE : sur le segment « Tout » le set
  // serveur mélange vente et location, et la pénalité de score (−30) ne suffit pas
  // à écarter une location d'un acheteur qui achète (plafond 76 > seuil 55).
  const near: MrhItem[] = useMemo(() => {
    if (!buyer) return []
    return biens
      .filter((b) => b.transaction === buyer.criteria.transaction)
      .filter((b) => !strictPass(b))
      .map((b) => ({ b, m: scoreBien(buyer, b) }))
      .filter((x) => (x.m?.score ?? 0) >= 55)
      .sort((a, z) => (z.m?.score ?? 0) - (a.m?.score ?? 0))
      .slice(0, 3)
  }, [biens, strictPass, buyer])
  const missNote = useCallback((b: MrhBien): string => {
    const hay = bienHay(b)
    for (const tk of clientTokens) {
      if (tk.field === 'rooms' && (b.rooms ?? 0) < tk.value) return tk.label
      if (tk.field === 'surface' && (b.area ?? 0) < tk.value) return tk.label
      if (tk.field === 'text' && !hay.includes(norm(String(tk.value)))) return tk.label
    }
    if (q.trim()) return q.trim()
    return t('recherche.near.note')
  }, [clientTokens, q, t, bienHay])
  const reasonForNear = useCallback((it: MrhItem): string | null => missNote(it.b), [missNote])

  // ── actions ──
  const critTokensFor = (c: MrhContact): MrhToken[] => {
    const ts: MrhToken[] = []
    c.criteria.types.forEach((ty) => ts.push({ id: 'type-' + ty, kind: 'crit', label: typeLabelFr(ty), field: 'type', value: ty }))
    c.criteria.cantons.forEach((cn) => ts.push({ id: 'canton-' + cn, kind: 'crit', label: cn, field: 'canton', value: cn }))
    if (c.criteria.roomsMin) ts.push({ id: 'rooms', kind: 'crit', label: c.criteria.roomsMin + '+', field: 'rooms', value: c.criteria.roomsMin })
    if (c.criteria.budgetMax) {
      const isRent = c.criteria.transaction === 'location'
      ts.push({ id: 'bmax', kind: 'crit', label: isRent ? '≤ ' + formatCHF(c.criteria.budgetMax) : '≤ ' + mrhM(c.criteria.budgetMax), field: 'budgetMax', value: c.criteria.budgetMax })
    }
    return ts
  }
  const applyBuyer = (c: MrhContact) => {
    setBuyer(c); setTokens(critTokensFor(c)); setTrans(c.criteria.transaction); setSort('pertinence'); setSel([]); setQ(''); setDd(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }
  const clearBuyer = () => { setBuyer(null); setTokens((ts) => ts.filter((tk) => tk.kind !== 'crit')); setSort('recent') }
  const removeTok = (tok: MrhToken) => setTokens((ts) => {
    const next = ts.filter((tk) => tk !== tok)
    if (tok.kind === 'crit' && !next.some((tk) => tk.kind === 'crit')) setBuyer(null)
    return next
  })
  // Parse la saisie libre en jetons TYPÉS (canton/type/budget → SQL ; pièces/surface/texte
  // → client) et les ajoute. Remplace l'ancien « tout devient un jeton texte ».
  const applyQuery = (raw: string) => {
    const parsed = parseQuery(raw)
    if (!parsed.length) { setDd(false); return }
    setTokens((ts) => {
      let next = [...ts]
      for (const p of parsed) {
        if (p.field === 'city') next = next.filter((tk) => tk.field !== 'city') // une seule ville
        if (next.some((tk) => tk.field === p.field && String(tk.value) === String(p.value))) continue
        next.push({ id: p.field + ':' + p.value, kind: 'filter', label: p.label, field: p.field, value: p.value } as MrhToken)
      }
      return next
    })
    setQ(''); setDd(false)
  }
  // Jeton VILLE depuis l'autocomplétion search_cities (une seule ville active).
  const addCityToken = (city: string) => {
    setTokens((ts) => [...ts.filter((tk) => tk.field !== 'city'), { id: 'city:' + norm(city), kind: 'filter' as const, label: city, field: 'city' as const, value: city }])
    setQ(''); setDd(false)
  }
  const clearAll = () => { setBuyer(null); setTokens([]); setQ(''); setSort('recent'); setSel([]); setTrans('all') }
  const toggleSel = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  // Envoi de la sélection à l'acheteur : crée les matches marché (RPC idempotente)
  // + mint le lien de réception, puis ouvre la feuille de partage (WhatsApp / copier).
  const onSendSelection = () => {
    if (!buyer || !sel.length) return
    // La feuille d'envoi ne s'ouvre QUE par ce geste : sans branche de démo elle
    // resterait invisible au banc, faute d'`agency_id`. Une modale qu'aucun banc
    // n'atteint n'est pas une modale vérifiée.
    if (demo) {
      setSentLink({ ...MRH_DEMO_SEND, firstName: buyer.firstName, count: sel.length })
      setSel([])
      return
    }
    if (!profile?.agency_id || sendSel.isPending) return
    const items = sel
      .map((id) => biens.find((b) => b.id === id))
      .filter((b): b is MrhBien => !!b)
      .map((b) => { const m = scoreBien(buyer, b); return { marketListingId: b.id, score: m.score, reasons: m.reasons } })
    if (!items.length) return
    sendSel.mutate(
      { contactId: buyer.id, agencyId: profile.agency_id, clientSearchId: buyer.searchId, items },
      { onSuccess: (res) => { setSentLink(res); setSel([]) }, onError: () => toast.error(t('sendSheet.error')) },
    )
  }

  // Ouvre la fiche annonce marché (« Voir l'annonce ») — plein bento.
  const openBien = (b: MrhBien) => setExtBien(b)
  const onAskAi = (b: MrhBien, score: number | null) => {
    const question = buyer && score != null
      ? t('recherche.card.aiMatchQ', { title: b.title, name: buyer.firstName, score })
      : t('recherche.card.aiAnalyzeQ', { title: b.title, addr: b.addr })
    ai.askAi(question)
  }

  // ── suggestions typées ── villes via search_cities (TOUTES les villes) + acheteurs + annonces locales
  const searchTx: SearchTx = trans === 'vente' ? 'buy' : trans === 'location' ? 'rent' : null
  // ⚠ `useCitySuggest` est le seul des cinq à ne PAS être gaté sur la session :
  // sans substitution il partirait vraiment interroger `search_cities` depuis le
  // banc. On le court-circuite donc, au lieu de compter sur son échec.
  const { data: liveCityHits = [] } = useCitySuggest(demo ? '' : q, searchTx)
  const rawCityHits = demo
    ? MRH_DEMO_CITIES.filter((c) => norm(c.city).startsWith(norm(q.trim())))
    : liveCityHits
  const navSugg = useRef(false)
  const sugg = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2) return { buyerHits: [] as MrhContact[], bienHits: [] as MrhBien[] }
    const buyerHits = buyers.filter((c) => `${c.firstName} ${c.lastName} ${c.label}`.toLowerCase().includes(s)).slice(0, 3)
    const bienHits = biens.filter((b) => `${b.title} ${b.addr} ${b.ref ?? ''}`.toLowerCase().includes(s)).slice(0, 3)
    return { buyerHits, bienHits }
  }, [q, biens, buyers])
  const cityHits = q.trim().length >= 2 ? rawCityHits.slice(0, 4) : []
  const suggAny = cityHits.length + sugg.buyerHits.length + sugg.bienHits.length > 0
  const suggFlat = useMemo(() => {
    if (!suggAny) return [] as Array<() => void>
    return [
      ...cityHits.map((c) => () => addCityToken(c.city)),
      ...sugg.buyerHits.map((c) => () => applyBuyer(c)),
      ...sugg.bienHits.map((b) => () => { setDd(false); openBien(b) }),
    ]
  }, [sugg, cityHits, suggAny]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSugIdx(0); navSugg.current = false }, [q])

  const onInputKey = (e: ReactKeyboardEvent) => {
    if (q.trim() && suggFlat.length > 0 && dd) {
      if (e.key === 'ArrowDown') { e.preventDefault(); navSugg.current = true; setSugIdx((i) => (i + 1) % suggFlat.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); navSugg.current = true; setSugIdx((i) => (i - 1 + suggFlat.length) % suggFlat.length); return }
    }
    if (e.key === 'Enter' && q.trim()) {
      e.preventDefault()
      // suggestion explicitement surlignée (flèches) = sélection directe ; sinon on PARSE toute la saisie
      if (navSugg.current && dd && suggFlat[sugIdx]) suggFlat[sugIdx]()
      else applyQuery(q)
      return
    }
    if (e.key === 'Backspace' && q === '' && tokens.length > 0) { e.preventDefault(); removeTok(tokens[tokens.length - 1]) }
    if (e.key === 'Escape') setDd(false)
  }

  // Raccourci « / » — focus omnibox depuis n'importe où (sauf en pleine saisie).
  useEffect(() => {
    const isTyping = (el: EventTarget | null) => {
      const n = el as HTMLElement | null
      return !!n && (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.isContentEditable)
    }
    const onSlash = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      if (isTyping(e.target) || isTyping(document.activeElement)) return
      e.preventDefault(); setDd(true); inputRef.current?.focus()
    }
    window.addEventListener('keydown', onSlash)
    return () => window.removeEventListener('keydown', onSlash)
  }, [])

  // ── rescue (état vide) : quel jeton CLIENT retirer débloque des résultats ──
  const rescue = useMemo(() => {
    if (strict.length > 0 || !biens.length) return null
    let best: { tok: MrhToken; n: number } | null = null
    clientTokens.forEach((tok) => {
      const n = biens.filter((b) => {
        const hay = bienHay(b)
        for (const tk of clientTokens) { if (tk === tok) continue; if (tk.field === 'rooms' && (b.rooms ?? 0) < tk.value) return false; if (tk.field === 'surface' && (b.area ?? 0) < tk.value) return false; if (tk.field === 'text' && !hay.includes(norm(String(tk.value)))) return false }
        if (q.trim() && !hay.includes(norm(q))) return false
        return true
      }).length
      if (n > 0 && (!best || n > best.n)) best = { tok, n }
    })
    return best as { tok: MrhToken; n: number } | null
  }, [strict.length, biens, clientTokens, q])

  const sortOpts = buyer
    ? [{ id: 'pertinence' as const, l: t('recherche.sort.relevance') }, { id: 'recent' as const, l: t('recherche.sort.recent') }, { id: 'price-asc' as const, l: t('recherche.sort.priceAsc') }]
    : [{ id: 'recent' as const, l: t('recherche.sort.recent') }, { id: 'price-asc' as const, l: t('recherche.sort.priceAsc') }, { id: 'price-desc' as const, l: t('recherche.sort.priceDesc') }]

  const ctx: MrhCtx = { sp, surf, dark, ACC, ONACC, line, chipBg, cardSolid: popBg, sel, buyer, toggleSel, onOpen: openBien, onAskAi, animate: isSettled }

  const txLabel = trans === 'vente' ? t('recherche.txSale') : trans === 'location' ? t('recherche.txRent') : ''
  const countText = buyer
    ? t('recherche.countBuyer', { count: strict.length, tx: txLabel, name: buyer.firstName })
    : t('recherche.countMarket', { count: strict.length, tx: txLabel })

  // Le marché filtré dépasse-t-il ce qui est chargé ? Si oui l'écran doit le DIRE :
  // sans ça, `strict.length` (une tranche) se lit comme une taille de marché.
  const truncated = marketTotal != null && marketTotal > biens.length
  // Un filtre client actif ne porte que sur la tranche chargée — le signaler tant
  // que ce filtrage n'est pas poussé en SQL, sinon « aucun résultat » est un
  // mensonge sur le marché plutôt qu'un fait sur les données chargées.
  const clientFilterActive = !!q.trim() || clientTokens.length > 0

  // ── atomes locaux ──
  const Avatar = ({ name, size = 28 }: { name: string; size?: number }) => {
    const ini = name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
    return <span style={{ width: size, height: size, borderRadius: 999, flexShrink: 0, display: 'grid', placeItems: 'center', background: ACC, color: ONACC, fontSize: size * 0.36, fontWeight: 600 }}>{ini}</span>
  }
  const Chip = ({ active, onClick, children, pressed, aria }: { active?: boolean; onClick: () => void; children: ReactNode; pressed?: boolean; aria?: string }) => (
    <button onClick={onClick} aria-pressed={pressed} aria-label={aria} style={{ height: 32, padding: '0 14px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: active ? 600 : 600, whiteSpace: 'nowrap', background: active ? ACC : chipBg, color: active ? ONACC : sp.soft, boxShadow: active ? 'none' : 'inset 0 0 0 1px ' + line, transition: 'background .15s, color .15s' }}>{children}</button>
  )
  const Token = ({ children, onX, icon }: { children: ReactNode; onX: () => void; icon?: 'user' }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 32, padding: '0 6px 0 13px', borderRadius: 999, background: ACC, color: ONACC, fontSize: 'var(--crm-text-sm)', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
      {icon && <RechIcon name={icon} size={12} stroke={ONACC} />}
      {children}
      <button onClick={(e) => { e.stopPropagation(); onX() }} title={t('recherche.omni.removeToken')} style={{ width: 20, height: 20, borderRadius: 999, border: 0, cursor: 'pointer', display: 'grid', placeItems: 'center', background: dark ? 'rgba(0,0,0,.22)' : 'rgba(255,255,255,.20)', padding: 0 }}>
        <RechIcon name="close" size={9} stroke={ONACC} />
      </button>
    </span>
  )
  const DdRow = ({ avatar, icon, title, sub, onClick, active }: { avatar?: string; icon?: 'search' | 'home'; title: string; sub?: string; onClick: () => void; active?: boolean }) => {
    const [h, setH] = useState(false)
    return (
      <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '9px 12px', borderRadius: 14, border: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', background: (h || active) ? (dark ? 'rgba(255,255,255,.05)' : '#F1F4F8') : 'transparent', transition: 'background .12s' }}>
        {avatar ? <Avatar name={avatar} size={30} /> : <span style={{ width: 30, height: 30, borderRadius: 999, background: dark ? 'rgba(255,255,255,.06)' : '#F1F4F8', display: 'grid', placeItems: 'center', flexShrink: 0 }}><RechIcon name={icon ?? 'search'} size={14} stroke={sp.sub} /></span>}
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
          {sub && <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>}
        </span>
        <RechIcon name="arrowR" size={13} stroke={(h || active) ? sp.ink : sp.sub} />
      </button>
    )
  }
  const Lab = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.soft, ...style }}>{children}</div>

  const rootVars = { '--mrh-line': line, '--mrh-soft': sp.soft, '--mrh-focus': dark ? '#8DA4FF' : '#0041D9' } as CSSProperties

  return (
    <div className="mrh-root" onMouseDown={() => setDd(false)}
      style={{ position: 'absolute', inset: 0, background: sp.pageBg, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'var(--crm-font, "Inter Tight"), system-ui, sans-serif', color: sp.ink, fontVariantNumeric: 'tabular-nums', ...rootVars }}>

      {/* En-tête */}
      <div style={{ flexShrink: 0, padding: '22px 30px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 'var(--crm-text-6xl)', fontWeight: 600, letterSpacing: -1, color: sp.ink, lineHeight: 1 }}>{t('recherche.title')}</h1>
            <div style={{ fontSize: 'var(--crm-text-md)', color: sp.soft, fontWeight: 500, marginTop: 7 }} role="status" aria-live="polite">
              {countText}
              {truncated && (
                <span style={{ color: sp.sub }}> · {t('recherche.countTotal', { total: marketTotal })}</span>
              )}
            </div>
            {truncated && clientFilterActive && (
              <div style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub, fontWeight: 500, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <RechIcon name="spark" size={11} stroke={sp.sub} />
                {t('recherche.clientFilterScope', { count: biens.length })}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <div role="group" aria-label={t('recherche.trans.group')} style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 999, background: chipBg, boxShadow: 'inset 0 0 0 1px ' + line }}>
              {([{ id: 'all', label: t('recherche.trans.all') }, { id: 'vente', label: t('recherche.trans.sale') }, { id: 'location', label: t('recherche.trans.rent') }] as const).map((v) => (
                <button key={v.id} onClick={() => setTrans(v.id)} aria-pressed={trans === v.id} aria-label={t('recherche.trans.aria', { label: v.label })}
                  style={{ height: 30, padding: '0 13px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: trans === v.id ? 600 : 600, whiteSpace: 'nowrap', background: trans === v.id ? ACC : 'transparent', color: trans === v.id ? ONACC : sp.soft, transition: 'background .15s, color .15s' }}>{v.label}</button>
              ))}
            </div>
            <div role="group" aria-label={t('recherche.view.group')} style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 999, background: chipBg, boxShadow: 'inset 0 0 0 1px ' + line }}>
              {([{ id: 'grid', label: t('recherche.view.grid') }, { id: 'map', label: t('recherche.view.map') }] as const).map((v) => (
                <button key={v.id} onClick={() => setView(v.id)} aria-pressed={view === v.id} aria-label={t('recherche.view.aria', { label: v.label })}
                  style={{ height: 30, padding: '0 13px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: view === v.id ? 600 : 600, whiteSpace: 'nowrap', background: view === v.id ? ACC : 'transparent', color: view === v.id ? ONACC : sp.soft, transition: 'background .15s, color .15s' }}>{v.label}</button>
              ))}
            </div>
            <div role="group" aria-label={t('recherche.sort.group')} style={{ display: 'flex', gap: 6 }}>
              {sortOpts.map((o) => <Chip key={o.id} active={sort === o.id} onClick={() => setSort(o.id)} pressed={sort === o.id} aria={t('recherche.sort.aria', { label: o.l })}>{o.l}</Chip>)}
            </div>
          </div>
        </div>

        {/* Omnibox */}
        <div style={{ position: 'relative', marginTop: 16, zIndex: 50, maxWidth: 560 }} onMouseDown={(e) => e.stopPropagation()}>
          <div onClick={() => { setDd(true); inputRef.current?.focus() }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 54, padding: '7px 12px 7px 18px', background: surf.card, borderRadius: 26, boxShadow: dd ? surf.shadowHov : surf.shadow, border: surf.hairline, cursor: 'text', flexWrap: 'wrap', transition: 'box-shadow .2s' }}>
            <RechIcon name="search" size={17} stroke={sp.sub} />
            {buyer && <Token icon="user" onX={clearBuyer}>{buyer.firstName} {buyer.lastName}</Token>}
            {tokens.map((tk) => <Token key={tk.id} onX={() => removeTok(tk)}>{tk.label}</Token>)}
            <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setDd(true)} onKeyDown={onInputKey}
              aria-label={t('recherche.omni.aria')} role="combobox" aria-expanded={dd} aria-autocomplete="list"
              placeholder={buyer ? t('recherche.omni.placeholderBuyer', { name: buyer.firstName }) : (tokens.length ? t('recherche.omni.placeholderRefine') : t('recherche.omni.placeholder'))}
              style={{ flex: 1, minWidth: 150, border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', color: sp.ink, padding: '6px 4px' }} />
            <span style={{ padding: '3px 8px', borderRadius: 6, background: chipBg, fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>/</span>
          </div>

          {dd && !q.trim() && (
            <div style={{ position: 'absolute', top: 'calc(100% + 12px)', left: 0, right: 0, zIndex: 60, background: popBg, borderRadius: 22, boxShadow: sp.solidShadow, border: '1px solid ' + sp.solidBorder, padding: 14, animation: 'sgFadeUp .28s cubic-bezier(.2,.8,.2,1) both' }}>
              <Lab style={{ padding: '4px 12px 8px' }}>{buyer ? t('recherche.omni.ddChange') : t('recherche.omni.ddPick')}</Lab>
              {buyers.length === 0 ? (
                <div style={{ padding: '2px 12px 12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, lineHeight: 1.55, color: sp.soft }}>{t('recherche.omni.noBuyers')}</div>
                  {/* ⚠ Inerte au banc : la cible est une surface protégée, donc
                      `ProtectedRoute` rebondirait sur la PRODUCTION — le piège
                      même que ce banc existe pour éviter. */}
                  <button onClick={() => { if (!demo) navigate('/dashboard/contacts') }} style={{ height: 40, padding: '0 18px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, background: ACC, color: ONACC, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <RechIcon name="plus" size={13} stroke={ONACC} /> {t('recherche.omni.addFirst')}
                  </button>
                </div>
              ) : buyers.map((c) => <DdRow key={c.searchId} avatar={`${c.firstName} ${c.lastName}`} title={`${c.firstName} ${c.lastName}`} sub={c.label} onClick={() => applyBuyer(c)} />)}
            </div>
          )}

          {dd && q.trim() && suggAny && (
            <div style={{ position: 'absolute', top: 'calc(100% + 12px)', left: 0, right: 0, zIndex: 60, background: popBg, borderRadius: 22, boxShadow: sp.solidShadow, border: '1px solid ' + sp.solidBorder, padding: 14, animation: 'sgFadeUp .28s cubic-bezier(.2,.8,.2,1) both' }}>
              {cityHits.length > 0 && (
                <>
                  <Lab style={{ padding: '4px 12px 8px' }}>{t('recherche.omni.groupPlaces')}</Lab>
                  {cityHits.map((c, i) => <DdRow key={c.city + c.canton} icon="search" title={c.city} sub={`${c.canton} · ${c.n}`} active={sugIdx === i} onClick={() => addCityToken(c.city)} />)}
                </>
              )}
              {sugg.buyerHits.length > 0 && (
                <>
                  {cityHits.length > 0 && <div style={{ height: 1, background: line, margin: '10px 12px' }} />}
                  <Lab style={{ padding: '4px 12px 8px' }}>{t('recherche.omni.groupContacts')}</Lab>
                  {sugg.buyerHits.map((c, i) => <DdRow key={c.searchId} avatar={`${c.firstName} ${c.lastName}`} title={`${c.firstName} ${c.lastName}`} sub={c.label} active={sugIdx === cityHits.length + i} onClick={() => applyBuyer(c)} />)}
                </>
              )}
              {sugg.bienHits.length > 0 && (
                <>
                  {(cityHits.length > 0 || sugg.buyerHits.length > 0) && <div style={{ height: 1, background: line, margin: '10px 12px' }} />}
                  <Lab style={{ padding: '4px 12px 8px' }}>{t('recherche.omni.groupListings')}</Lab>
                  {sugg.bienHits.map((b, i) => {
                    const bp = b.transaction === 'location' ? b.rent : b.price
                    return <DdRow key={b.id} icon="home" title={b.title} sub={b.addr + (bp ? ' · ' + formatCHF(bp) : '')} active={sugIdx === cityHits.length + sugg.buyerHits.length + i} onClick={() => { setDd(false); openBien(b) }} />
                  })}
                </>
              )}
            </div>
          )}
        </div>

        {/* Méta sous la barre */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, minHeight: 22 }}>
          {buyer && buyer.criteria.mustHave.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--crm-text-sm)', color: sp.sub, fontWeight: 600 }}>
              <RechIcon name="spark" size={12} stroke={sp.sub} /> {t('recherche.alsoWants', { name: buyer.firstName, list: buyer.criteria.mustHave.join(', ') })}
            </span>
          )}
          <div style={{ flex: 1 }} />
          {(buyer || tokens.length > 0 || q) && (
            <button onClick={clearAll} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub, padding: '6px 8px', borderRadius: 8 }}>{t('recherche.clearAll')}</button>
          )}
        </div>
      </div>

      {/* Résultats — grille OU vue carte (split liste ↔ carte à pins) */}
      {view === 'map' && isSettled && !isError && (strict.length + near.length) > 0 ? (
        <MrhMapView strict={strict} near={near} ctx={ctx} />
      ) : (
        <div className="mrh-scroll"
          // `backwards` et non `both` : `both` laisserait `translateY(0)` appliqué
          // en permanence, et un transform non nul fait de ce conteneur le bloc
          // englobant de tout descendant en `position: fixed`.
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 30px 34px', animation: 'mrhViewIn .28s cubic-bezier(.2,.8,.2,1) backwards' }}>
          {isFetchingFirst ? (
            <div style={{ display: 'grid', placeItems: 'center', minHeight: 240, gap: 14, color: sp.sub, fontSize: 'var(--crm-text-lg)', fontWeight: 600, textAlign: 'center' }}>
              <span>{slow ? t('recherche.slow') : t('recherche.loading')}</span>
              {slow && (
                <button onClick={() => refetch()} style={{ height: 40, padding: '0 20px', borderRadius: 999, border: 0, cursor: 'pointer', background: ACC, color: ONACC, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{t('recherche.retry')}</button>
              )}
            </div>
          ) : isError ? (
            <div style={{ background: surf.card, borderRadius: 20, boxShadow: surf.shadow, border: surf.hairline, padding: '48px 24px', textAlign: 'center', maxWidth: 540, margin: '12px auto 0' }}>
              <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink }}>{t('recherche.error')}</div>
              <button onClick={() => refetch()} style={{ marginTop: 16, height: 40, padding: '0 20px', borderRadius: 999, border: 0, cursor: 'pointer', background: ACC, color: ONACC, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{t('recherche.retry')}</button>
            </div>
          ) : isBlocked ? (
            // La query n'a pas pu partir. On n'affirme RIEN sur la base ici — c'est
            // précisément la confusion entre ce cas et « résolue vide » qui a produit
            // le faux « aucune annonce du marché » pendant des semaines.
            <div style={{ background: surf.card, borderRadius: 20, boxShadow: surf.shadow, border: surf.hairline, padding: '48px 24px', textAlign: 'center', maxWidth: 540, margin: '12px auto 0' }}>
              <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink }}>{t('recherche.blocked')}</div>
              <button onClick={() => refetch()} style={{ marginTop: 16, height: 40, padding: '0 20px', borderRadius: 999, border: 0, cursor: 'pointer', background: ACC, color: ONACC, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{t('recherche.retry')}</button>
            </div>
          ) : strict.length === 0 ? (
            <EtatVide
              dark={dark}
              titre={biens.length ? t('recherche.empty.title') : t('recherche.empty.noMarket')}
              corps={rescue ? t('recherche.empty.rescue') : undefined}
              action={rescue ? { libelle: t('recherche.empty.rescueCta'), onClick: () => removeTok(rescue.tok) } : undefined}
            />
          ) : (
            <>
              <MrhGrid items={strict} reasonFor={reasonFor} ctx={ctx} />
              {near.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '22px 0 14px' }}>
                    <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.soft }}>{t('recherche.near.title')}</span>
                    <span style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub, fontWeight: 600, opacity: 0.8 }}>{t('recherche.near.note')}</span>
                  </div>
                  <MrhGrid items={near} offset={strict.length} useMiss reasonFor={reasonForNear} ctx={ctx} />
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Barre d'envoi */}
      {buyer && sel.length > 0 && (
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 40 }}>
          <button onClick={onSendSelection} disabled={sendSel.isPending}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10, height: 48, padding: '0 22px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', background: ACC, color: ONACC, fontSize: 'var(--crm-text-md)', fontWeight: 600, whiteSpace: 'nowrap', boxShadow: dark ? '0 16px 44px rgba(0,0,0,.5)' : '0 16px 40px rgba(3,3,3,.28), 0 4px 12px rgba(3,3,3,.14)', animation: 'sgFadeUp .4s cubic-bezier(.2,.8,.2,1) both' }}>
            <RechIcon name="send" size={15} stroke={ONACC} /> {t('recherche.send', { count: sel.length, name: buyer.firstName })}
          </button>
        </div>
      )}

      {/* Feuille d'envoi de la sélection (lien de réception créé) */}
      {sentLink && (
        <MrhSendSheet
          result={sentLink}
          buyerName={buyer ? `${buyer.firstName} ${buyer.lastName}`.trim() : sentLink.firstName || ''}
          ctx={ctx}
          onClose={() => setSentLink(null)}
        />
      )}

      {/* Fiche annonce marché (« Voir l'annonce ») */}
      {extBien && (
        <MrhExtDetail
          bien={extBien}
          sp={sp} surf={surf} dark={dark} line={line} chipBg={chipBg} ACC={ACC} ONACC={ONACC}
          buyer={buyer} on={sel.includes(extBien.id)}
          onToggle={() => toggleSel(extBien.id)}
          onClose={() => setExtBien(null)}
          detailDemo={demo ? MRH_DEMO_DETAIL : undefined}
        />
      )}
    </div>
  )
}
