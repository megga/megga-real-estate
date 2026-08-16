// MEGGA CRM — Atelier Matching · triptyque plein écran (handoff juin 2026).
//
// Remplace l'ancien écran Matching (MatchingSugarV2Page + /dashboard/matching/v2,
// retirés en Phase B après l'unification du geste de réaction sur cette route).
//
// Ce fichier est le CONTENEUR : données réelles (useAtelierMatching), gestes
// Supabase différés (undo 5 s avant toute écriture), deep-links et navigation.
// La présentation + machine d'état vivent dans AtelierStage (réutilisé par la
// démo /dev/matching-atelier avec les mocks du handoff).
//
// Deux sens, mêmes gestes (HANDOFF_MATCHING_COUTURES) :
//   - Par annonce  : 1 annonce pivot → N acheteurs scorés
//   - Par acheteur : 1 acheteur pivot → N biens scorés (lien « +N biens »)
// Deep-links : ?annonce=p:<uuid>|m:<uuid> (pivot) · ?contact=<uuid> (acheteur).
// Rendu plein écran par-dessus le shell (pattern OfferPage).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import {
  execDismiss,
  execReact,
  execRelance,
  execSendDossier,
  execSnooze,
  execWake,
  useAtelierMatching,
  type GesteContext,
} from '@/hooks/useAtelierMatching'
import { useAgencyProperties } from '@/hooks/useProperties'
import AtelierStage from '@/components/matching-atelier/AtelierStage'
import MatchingFirstRun from '@/components/matching-atelier/MatchingFirstRun'
import { useSugarDark } from '@/components/matching-atelier/useSugarDark'
import { PendingRegistry, type AtelierGestes } from '@/components/matching-atelier/pendingTriage'
import type { AtelierBuyer, AtelierListing } from '@/components/matching-atelier/types'
import { useToast } from '@/components/ui/Toast'
import '@/components/matching-atelier/atelier.css'

export default function MatchingAtelierPage(
  { embedded = false, dark: darkOverride, onOpenRecherche }: {
    embedded?: boolean
    dark?: boolean
    /** glisse le pager vers la page Recherche — fourni par MatchingPage seul */
    onOpenRecherche?: () => void
  } = {},
) {
  const { t } = useTranslation('matching')
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // Embarqué dans le pager, le thème vient du parent (même onglet — le toggle du
  // rail n'émet pas d'event `storage` local) ; sinon on suit le thème global.
  const darkAuto = useSugarDark()
  const dark = darkOverride ?? darkAuto
  const { user, profile } = useAuth()
  const { isLoading, isError, pivots, pivotByKey, defaultPivotKey, poolFor, buyerFor, refresh } = useAtelierMatching()

  // ── « compte neuf » vs « rien à trier » ────────────────────────────────
  // Deux écrans DISTINCTS dans le handoff : la couverture explique la boucle de
  // match à une agence qui n'a encore aucun mandat (le scan ne peut rien
  // produire), l'état vide du triptyque s'adresse à une agence équipée dont le
  // moteur n'a simplement rien proposé. Le flag `window.__matchingFresh` du
  // prototype est remplacé par le signal réel : zéro bien ET zéro match.
  const { data: properties = [], isLoading: biensLoading, isError: biensError } = useAgencyProperties()
  const fresh =
    !isLoading && !isError && !biensLoading && !biensError &&
    pivots.length === 0 && properties.length === 0

  // ── pivots (annonce ?annonce= · acheteur ?contact=) ─────────────────────
  const annonceParam = searchParams.get('annonce')
  const pivotKey = annonceParam && pivotByKey.has(annonceParam) ? annonceParam : defaultPivotKey
  const pivot = pivotKey ? pivotByKey.get(pivotKey) ?? null : null
  const contactParam = searchParams.get('contact')
  const pivotBuyer = contactParam ? buyerFor(contactParam) : null

  // ── écritures différées (flush au démontage — l'agent n'a pas annulé) ───
  const registryRef = useRef<PendingRegistry | null>(null)
  if (!registryRef.current) registryRef.current = new PendingRegistry()
  const registry = registryRef.current
  useEffect(() => () => registry.flushAll(), [registry])

  const ctx: GesteContext | null = useMemo(() => {
    if (!profile?.agency_id) return null
    return {
      agencyId: profile.agency_id,
      userId: profile.id ?? user?.id ?? '',
      agentName: profile.full_name ?? t('atelier.defaultAgentName'),
      agentPhone: profile.phone ?? null,
    }
  }, [profile, user, t])

  // matchId → (acheteur, annonce) — couvre les deux modes (les pivots
  // regroupent TOUS les matches actifs de l'agence)
  const matchIndex = useMemo(() => {
    const map = new Map<string, { buyer: AtelierBuyer; listing: AtelierListing }>()
    for (const g of pivots) for (const b of g.buyers) map.set(b.matchId, { buyer: b, listing: g.listing })
    return map
  }, [pivots])

  const [errorKey, setErrorKey] = useState(0)
  const showError = useCallback(() => setErrorKey(k => k + 1), [])

  const gestes: AtelierGestes = useMemo(() => ({
    send: (matchId, channel) => registry.defer(async () => {
      const e = matchIndex.get(matchId)
      if (!e || !ctx) return null
      return execSendDossier(ctx, e.buyer, e.listing, channel)
    }, { onSettled: refresh, onError: showError }),
    relance: matchId => registry.defer(async () => {
      const e = matchIndex.get(matchId)
      if (!e || !ctx) return null
      return execRelance(ctx, e.buyer, e.listing)
    }, { onSettled: refresh, onError: showError }),
    snooze: matchId => registry.defer(async () => {
      const e = matchIndex.get(matchId)
      if (!e || !ctx) return null
      await execSnooze(ctx, e.buyer)
      return null
    }, { onSettled: refresh, onError: showError }),
    dismiss: matchId => registry.defer(async () => {
      const e = matchIndex.get(matchId)
      if (!e) return null
      await execDismiss(e.buyer)
      return null
    }, { onSettled: refresh, onError: showError }),
    react: (matchId, reaction) => registry.defer(async () => {
      const e = matchIndex.get(matchId)
      if (!e) return null
      await execReact(e.buyer, reaction)
      return null
    }, { onSettled: refresh, onError: showError }),
    wake: matchId => { void execWake(matchId).then(refresh).catch(showError) },
    visit: matchId => {
      const e = matchIndex.get(matchId)
      if (!e || e.listing.kind !== 'property') return
      registry.flushAll()
      navigate(`/dashboard/visits/new?bienId=${e.listing.id}&contactId=${e.buyer.id}`)
    },
  }), [registry, matchIndex, ctx, refresh, showError, navigate])

  // ── navigation ──────────────────────────────────────────────────────────
  const close = useCallback(() => {
    registry.flushAll()
    if (window.history.length > 1) navigate(-1)
    else navigate('/dashboard')
  }, [navigate, registry])

  const openDeal = useCallback((dealId: string | null) => {
    registry.flushAll()
    if (dealId) navigate(`/dashboard/transactions/${dealId}`)
    else navigate('/dashboard/pipeline')
  }, [navigate, registry])

  const openBuyerPivot = useCallback((contactId: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('contact', contactId)
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  // Bascule d'annonce depuis le cockpit — même canal que le deep-link `?annonce=`,
  // pour qu'un partage d'URL rejoue exactement la file affichée.
  const pickPivot = useCallback((key: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('annonce', key)
    next.delete('contact')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const closeBuyerPivot = useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.delete('contact')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  // ── scan manuel (état vide — relance le moteur, fonctionnalité existante)
  const [scanning, setScanning] = useState(false)
  const runScan = useCallback(async () => {
    if (!ctx || scanning) return
    setScanning(true)
    try {
      // `invoke` ne THROW pas sur une erreur de la fonction : il renvoie { error }.
      // Avant, on l'ignorait et on rafraîchissait quand même → un scan en échec
      // laissait l'agent sur l'état vide « aucun match » au lieu d'une vraie erreur.
      const { error } = await supabase.functions.invoke('matching-engine', {
        body: { mode: 'scan-all', agency_id: ctx.agencyId },
      })
      if (error) throw error
      refresh()
    } catch {
      toast.error(t('atelier.empty.scanError'))
    } finally {
      setScanning(false)
    }
  }, [ctx, scanning, refresh, toast, t])

  const pool = pivotBuyer ? poolFor(pivotBuyer.id, pivotKey) : []

  // Couverture premier lancement — remplace la page 0 du pager (le reste du
  // pager, dont la Recherche, demeure accessible).
  if (fresh) {
    return <MatchingFirstRun onCreateListing={() => navigate('/dashboard/listings/new')} />
  }

  return (
    <AtelierStage
      key={errorKey /* une erreur post-flush rafraîchit l'étage (rows réelles) */}
      embedded={embedded}
      dark={dark}
      isLoading={isLoading}
      isError={isError}
      onRetry={refresh}
      pivot={pivot}
      pivots={pivots}
      onPickPivot={pickPivot}
      onOpenRecherche={onOpenRecherche}
      pivotBuyer={pivotBuyer}
      pool={pool}
      poolCountFor={contactId => poolFor(contactId, pivotKey).length}
      gestes={gestes}
      onClose={close}
      onOpenDeal={openDeal}
      onOpenBuyerPivot={openBuyerPivot}
      onCloseBuyerPivot={closeBuyerPivot}
      onStartKyc={contactId => navigate(`/dashboard/kyc?openContactId=${contactId}`)}
      onOpenContacts={() => navigate('/dashboard/contacts')}
      emptyAction={{ label: t('atelier.empty.scanCta'), busy: scanning, run: () => void runScan() }}
    />
  )
}
