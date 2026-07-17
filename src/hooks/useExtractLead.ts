import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Sprint 3 — Appel à l'Edge Function `extract-lead`.
 *
 * Envoie un texte libre (email, SMS, message WhatsApp transcrit) et reçoit
 * une extraction structurée. Côté serveur : redaction PII → Claude Sonnet
 * → double-pass verbatim → audit. Le rawText n'est PAS stocké côté Edge —
 * le caller (modal) décide quoi en faire.
 *
 * Spec : RED_TEAM_SPRINT_3.md §G.G6.
 */

export type LeadIntent = 'buyer' | 'seller' | 'tenant'
export type LeadUrgency = 'high' | 'medium' | 'normal'
export type LeadNextAction = 'call' | 'visit' | 'match' | 'kyc'

export interface ExtractedLead {
  firstName: string
  lastName: string
  email: string
  phone: string
  intent: LeadIntent
  budget: number | null
  rooms: number | null
  zone: string
  urgency: LeadUrgency
  nextAction: LeadNextAction
  /** 0..1 — non affiché en UI. Si < 0.5, on enclenche le mode édition. */
  confidence: number
}

export interface ExtractLeadResult {
  extracted: ExtractedLead
  /** Compact : "AVS×1, PASSWORD×1" — affiché côté UI si non-vide. */
  redactionSummary: string
  redactionCount: number
  /** True si l'input a dépassé 8 KB (tronqué côté Edge). */
  truncated: boolean
}

export type ExtractLeadErrorCode =
  | 'unauthorized'
  | 'text_too_short'
  | 'rate_limit_exceeded'
  | 'llm_unavailable'
  | 'parse_failed'
  | 'unknown'

/** Erreur typée portant un `code` machine (voir `ExtractLeadErrorCode`) en plus du message lisible. */
export class ExtractLeadError extends Error {
  readonly code: ExtractLeadErrorCode
  constructor(message: string, code: ExtractLeadErrorCode) {
    super(message)
    this.code = code
  }
}

/** Invoque l'edge `extract-lead` et remonte le `code` d'erreur métier depuis le body JSON. */
async function callExtractLead(text: string): Promise<ExtractLeadResult> {
  const { data, error } = await supabase.functions.invoke<ExtractLeadResult>('extract-lead', {
    body: { text },
  })
  if (error) {
    // L'Edge Function renvoie un statut HTTP + body JSON ; supabase-js encapsule.
    // On essaie de remonter le code depuis le body si présent.
    const ctx = (error as { context?: Response }).context
    let code: ExtractLeadError['code'] = 'unknown'
    let detail = error.message
    if (ctx) {
      try {
        const json = await ctx.clone().json()
        if (typeof json.error === 'string') {
          code = json.error as ExtractLeadError['code']
        }
        if (typeof json.detail === 'string') detail = json.detail
      } catch {
        // body non-JSON
      }
    }
    throw new ExtractLeadError(detail, code)
  }
  if (!data) {
    throw new ExtractLeadError('empty_response', 'unknown')
  }
  return data
}

/** Mutation React Query autour de `extract-lead` : texte libre → lead structuré. */
export function useExtractLead() {
  return useMutation<ExtractLeadResult, ExtractLeadError, { text: string }>({
    mutationFn: ({ text }) => callExtractLead(text),
  })
}
