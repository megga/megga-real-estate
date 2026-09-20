/**
 * Les crédits de l'agence : le solde (RPC `credits_balance`, qui pose au passage la
 * dotation du mois), le grand livre (RLS agence), l'achat d'un pack (Stripe Checkout
 * via `credits-checkout`) et le réglage de la recharge automatique (RPC).
 *
 * ⚠ Sous un banc (`/dev/labs`, `/dev/crm`), le solde et le livre viennent des fixtures
 * du studio — aucun réseau, et « acheter » ne mène nulle part : le banc le DIT.
 *
 * ⚠ Le solde est rafraîchi après chaque génération (les edges rendent `credits.balance`,
 * `useLabsGenerate` le pose dans le cache) et au retour d'un Checkout (`?success=true`) :
 * le webhook peut arriver quelques secondes après la redirection, d'où un second
 * rafraîchissement différé — un solde qui n'a pas bougé APRÈS avoir payé est ce que
 * l'agent retient d'un produit.
 */
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import {
  creditBalanceFromJson, creditLedgerFromRow, type AutoTopupSeuil, type CreditBalance, type CreditLedgerEntry, type CreditPackId,
} from '@/lib/credits'
import { fxCreditBalance, fxCreditLedger, fxSetAutoTopup, useLabsFixtures } from '@/components/crm/labs/fixtures'

export const CREDITS_KEY = ['credits'] as const
const LIVRE_LIMITE = 200

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
 * Au retour d'un Checkout (`?success=true`), rafraîchir tout de suite ET quelques
 * secondes plus tard : le webhook qui crédite peut arriver APRÈS la redirection.
 */
export function useCreditsApresCheckout(success: boolean): void {
  const qc = useQueryClient()
  useEffect(() => {
    if (!success) return
    void qc.invalidateQueries({ queryKey: CREDITS_KEY })
    const t1 = setTimeout(() => { void qc.invalidateQueries({ queryKey: CREDITS_KEY }) }, 4000)
    const t2 = setTimeout(() => { void qc.invalidateQueries({ queryKey: CREDITS_KEY }) }, 12000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [success, qc])
}
