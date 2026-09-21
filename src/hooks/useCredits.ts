/**
 * Les crédits de l'agence : le solde (RPC `credits_balance`, qui pose au passage la
 * dotation du mois), le grand livre (RLS agence), l'achat d'un pack (Stripe Checkout
 * via `credits-checkout`) et le réglage de la recharge automatique (RPC).
 *
 * ⚠ Sous un banc (`/dev/labs`, `/dev/crm`), le solde, le livre et le REÇU viennent des
 * fixtures du studio — aucun réseau, et « acheter » ne mène nulle part : le banc le DIT.
 *
 * ⚠ Le solde est rafraîchi après chaque génération (les edges rendent `credits.balance`,
 * `useLabsGenerate` le pose dans le cache) et au retour d'un Checkout, quand le reçu
 * rend `paid` — un solde qui n'a pas bougé APRÈS avoir payé est ce que l'agent retient
 * d'un produit.
 */
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import {
  creditBalanceFromJson, creditLedgerFromRow, creditRecuFromJson,
  type AutoTopupSeuil, type CreditBalance, type CreditLedgerEntry, type CreditPackId, type CreditRecu,
} from '@/lib/credits'
import { fxCreditBalance, fxCreditLedger, fxCreditRecu, fxSetAutoTopup, useLabsFixtures } from '@/components/crm/labs/fixtures'

export const CREDITS_KEY = ['credits'] as const
const LIVRE_LIMITE = 200
/** Combien de fois on redemande un paiement `processing` avant de rendre la main. */
const RECU_TOURS_MAX = 10

export function useCredits() {
  const { profile } = useAuth()
  const fx = useLabsFixtures()
  const qc = useQueryClient()
  const agencyId = profile?.agency_id ?? null
  const cle = [...CREDITS_KEY, 'balance', fx ? `fx-${fx}` : agencyId]
  const cleLivre = [...CREDITS_KEY, 'ledger', fx ? `fx-${fx}` : agencyId]

  const balance = useQuery({
    queryKey: cle,
    enabled: !!fx || !!agencyId,
    queryFn: async (): Promise<CreditBalance> => {
      if (fx) return fxCreditBalance(fx)
      const { data, error } = await supabase.rpc('credits_balance')
      if (error) throw error
      return creditBalanceFromJson(data)
    },
    staleTime: 15_000,
  })

  const ledger = useQuery({
    queryKey: cleLivre,
    enabled: !!fx || !!agencyId,
    queryFn: async (): Promise<CreditLedgerEntry[]> => {
      if (fx) return fxCreditLedger(fx)
      const { data, error } = await supabase
        .from('credit_ledger')
        .select('id, kind, amount, bucket, included_after, purchased_after, ref_type, ref_id, amount_chf, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(LIVRE_LIMITE)
      if (error) throw error
      return (data ?? []).map(creditLedgerFromRow)
    },
  })

  const rafraichir = () => {
    void qc.invalidateQueries({ queryKey: CREDITS_KEY })
  }

  /** Pose le solde rendu par une edge sans attendre la RPC. */
  const poserSolde = (total: number) => {
    qc.setQueryData<CreditBalance>(cle, (prev) => (prev ? { ...prev, total, purchased: Math.max(0, total - prev.included) } : prev))
    void qc.invalidateQueries({ queryKey: cleLivre })
  }

  const acheter = useMutation({
    mutationFn: async (pack: CreditPackId): Promise<{ url: string | null; error: string | null }> => {
      if (fx) return { url: null, error: 'banc' }
      const { data, error } = await supabase.functions.invoke<{ url?: string }>('credits-checkout', { body: { pack } })
      if (error) {
        if (error instanceof FunctionsHttpError) {
          const j = await error.context.json().catch(() => ({})) as { error?: string }
          return { url: null, error: j.error ?? `http_${error.context?.status ?? 500}` }
        }
        return { url: null, error: 'network' }
      }
      return { url: data?.url ?? null, error: data?.url ? null : 'checkout_failed' }
    },
    onSuccess: (r) => {
      // La redirection est la SUITE du geste, pas un effet de bord : Stripe prend la main.
      if (r.url) window.location.href = r.url
    },
  })

  const reglerAutoRecharge = useMutation({
    mutationFn: async (p: { enabled: boolean; threshold: AutoTopupSeuil; pack: CreditPackId }): Promise<{ ok: boolean; error: string | null }> => {
      if (fx) { fxSetAutoTopup(p); return { ok: true, error: null } }
      const { data, error } = await supabase.rpc('credits_set_auto_topup', { p_enabled: p.enabled, p_threshold: p.threshold, p_pack: p.pack })
      if (error) return { ok: false, error: 'rpc_failed' }
      const r = (data ?? {}) as { ok?: boolean; error?: string }
      return { ok: !!r.ok, error: r.ok ? null : (r.error ?? 'unknown') }
    },
    onSettled: rafraichir,
  })

  return {
    balance: balance.data ?? null,
    isLoading: balance.isPending,
    isError: balance.isError,
    ledger: ledger.data ?? [],
    ledgerLoading: ledger.isPending,
    rafraichir,
    poserSolde,
    acheter,
    reglerAutoRecharge,
    enBanc: !!fx,
  }
}

/**
 * LE REÇU du retour de Stripe : l'état d'une session de Checkout (`?session_id=`), lu
 * chez Stripe par `credits-checkout-status`, qui crédite au passage si le webhook n'est
 * pas encore passé.
 *
 * ⛔ Le solde ne se déduit PAS du pack acheté : c'est la RPC qui le rend, et lui seul
 * dit la vérité (une dotation mensuelle a pu tomber entre-temps, un débit aussi).
 *
 * ⚠ `processing` est relancé toutes les 2 s, **au plus dix fois** : TWINT met quelques
 * secondes, et un paiement qui traîne plus de 20 s ne s'obtiendra pas en martelant. Au
 * bout, l'écran le dit et invite à rouvrir la page — ce qui redémarre le décompte.
 *
 * ⚠ Au banc, c'est le `?session_id=` qui décide de l'issue (`fxCreditRecu`) : sans ça la
 * modale de confirmation n'aurait aucun état regardable, et « c'est câblé » aurait tenu
 * lieu de preuve.
 */
export function useCreditRecu(sessionId: string | null): {
  recu: CreditRecu | null
  enCours: boolean
  echec: boolean
  aAbandonne: boolean
} {
  const qc = useQueryClient()
  const fx = useLabsFixtures()
  const [tours, setTours] = useState(0)
  const actif = !!sessionId

  const q = useQuery({
    queryKey: [...CREDITS_KEY, 'recu', fx ? `fx-${fx}` : '', sessionId],
    enabled: actif,
    retry: 1,
    staleTime: Infinity,
    queryFn: async (): Promise<CreditRecu> => {
      // Au banc, l'état vient du `?session_id=` : il n'y a rien à lire chez Stripe, et
      // les quatre issues doivent pourtant pouvoir être REGARDÉES.
      if (fx) return fxCreditRecu(fx, sessionId ?? '')
      const { data, error } = await supabase.functions.invoke<unknown>('credits-checkout-status', { body: { sessionId } })
      if (error) throw error
      return creditRecuFromJson(data)
    },
    refetchInterval: (query) => (query.state.data?.statut === 'processing' && tours < RECU_TOURS_MAX ? 2000 : false),
  })

  // Le compte des tours vit ici, pas dans `refetchInterval` : la fonction d'intervalle
  // est appelée à chaque rendu, l'incrémenter dedans emballerait le décompte.
  const statut = q.data?.statut ?? null
  useEffect(() => {
    if (statut !== 'processing') return
    const t = setTimeout(() => setTours((n) => n + 1), 2000)
    return () => clearTimeout(t)
  }, [statut, q.dataUpdatedAt])

  // Crédité : le solde et le livre ont bougé côté serveur, le cache doit suivre.
  useEffect(() => {
    if (statut === 'paid') void qc.invalidateQueries({ queryKey: CREDITS_KEY })
  }, [statut, qc])

  return {
    recu: q.data ?? null,
    enCours: actif && (q.isPending || statut === 'processing'),
    echec: q.isError,
    aAbandonne: statut === 'processing' && tours >= RECU_TOURS_MAX,
  }
}
