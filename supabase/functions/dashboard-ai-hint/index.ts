// supabase/functions/dashboard-ai-hint/index.ts
// MEGGA AI — Dashboard Cockpit hint (Sprint C Dashboard).
//
// Reçoit un snapshot CockpitDataset (KPI + decomp + vitals) et retourne UNE
// suggestion actionnable contextualisée pour l'agent. Compliance-enabling :
// l'agent décide, pas l'IA.
//
// Caching côté client (staleTime 1h) — pas de spam Claude API.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { meggaProse } from '../_shared/megga-prose.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SnapshotInput {
  period: 'month' | 'quarter' | 'year' | 'ytd'
  scope: 'me' | 'team' | 'all'
  label: string                    // "Mai 2026"
  periodWord: string               // "mois"
  projected: number                // CHF projeté pondéré
  target: number                   // CHF objectif
  daysLeft: number
  deltaPct: number                 // (projected - target) / target × 100
  decomp: { signed: number; compromis: number; offres: number; pipeline: number }
  contributors: Array<{ name: string; stage: string; amount: number }>
  vitals: {
    deals: number
    conversion: string             // "34 %"
    velocity: number               // jours
    kycRisk: number
    kycUrgent: number
    deltaDeals: number
    deltaConv: number
    deltaVel: number
    deltaKyc: number
  }
}

interface HintOutput {
  label: string
  title: string
  desc: string
  cta: string
  ctaUrl?: string
}

const SYSTEM_PROMPT = `Tu es le coach business d'un agent immobilier suisse romand, expert du marché Genève/Vaud.
Tu analyses son snapshot de pipeline et retournes UNE seule suggestion actionnable pour la semaine.

Règles strictes :
1. UNE action concrète, factuelle, prioritaire. Pas de généralités.
2. Tu cites un chiffre concret (CHF, jours, %) tiré du snapshot.
3. Tu identifies le levier #1 entre : (a) deals en KYC bloquants, (b) deals en compromis stagnants (vélocité élevée), (c) deals proches du target manquant pour atteindre l'objectif, (d) taux de conversion en baisse.
4. Ton tutoiement, professionnel, direct (style coach). Maximum 1 phrase pour title, 1 phrase pour desc.
5. CTA : verbe d'action concret ("Programmer", "Relancer", "Compléter", "Boucler").
6. Tu réponds STRICTEMENT en JSON valide, format : {"label":"...","title":"...","desc":"...","cta":"...","ctaUrl":"..."}
7. ctaUrl optionnel parmi : /dashboard/pipeline, /dashboard/kyc, /dashboard/matching, /dashboard/contacts.

Compliance-enabling : tu suggères, l'agent décide. Pas de promesses, pas de pourcentages inventés.`

function fallbackHint(s: SnapshotInput): HintOutput {
  // Heuristique de secours si Claude API échoue
  if (s.vitals.kycRisk > 0) {
    return {
      label: 'Action prioritaire',
      title: `Active les ${s.vitals.kycRisk} dossier${s.vitals.kycRisk > 1 ? 's' : ''} KYC à risque`,
      desc: `${s.vitals.kycUrgent > 0 ? `${s.vitals.kycUrgent} expirent sous 7j. ` : ''}Sans validation KYC, les compromis sont bloqués.`,
      cta: 'Compléter les KYC',
      ctaUrl: '/dashboard/kyc',
    }
  }
  if (s.target > 0 && s.projected < s.target) {
    const gap = s.target - s.projected
    return {
      label: `Cap ${s.periodWord}`,
      title: `Il manque CHF ${(gap / 1000).toFixed(0)}'000 pour atteindre l'objectif`,
      desc: `${s.daysLeft} j restants — concentre-toi sur les ${s.decomp.offres > 0 ? 'offres en cours' : 'visites planifiées'}.`,
      cta: 'Voir le pipeline',
      ctaUrl: '/dashboard/pipeline',
    }
  }
  return {
    label: 'Action prioritaire',
    title: `${s.vitals.deals} deals actifs · ${s.daysLeft} j restants`,
    desc: 'Continue d\'alimenter le top du funnel et de boucler les offres en cours.',
    cta: 'Voir le pipeline',
    ctaUrl: '/dashboard/pipeline',
  }
}

async function callClaude(snapshot: SnapshotInput, apiKey: string): Promise<HintOutput | null> {
  const userPrompt = `Snapshot ${snapshot.label} (${snapshot.scope === 'me' ? 'agent' : 'équipe'}) :
- Projeté : CHF ${snapshot.projected.toLocaleString('fr-CH')} / objectif CHF ${snapshot.target.toLocaleString('fr-CH')} (${snapshot.deltaPct >= 0 ? '+' : ''}${snapshot.deltaPct} %)
- ${snapshot.daysLeft} j restants
- Décomposition : signé ${(snapshot.decomp.signed / 1000).toFixed(0)}k · compromis ${(snapshot.decomp.compromis / 1000).toFixed(0)}k · offres ${(snapshot.decomp.offres / 1000).toFixed(0)}k · pipeline ${(snapshot.decomp.pipeline / 1000).toFixed(0)}k
- Vitals : ${snapshot.vitals.deals} deals, conv ${snapshot.vitals.conversion}, vélocité ${snapshot.vitals.velocity}j (Δ${snapshot.vitals.deltaVel >= 0 ? '+' : ''}${snapshot.vitals.deltaVel}j), KYC risque ${snapshot.vitals.kycRisk} (${snapshot.vitals.kycUrgent} urgents)
- Top contributeurs : ${snapshot.contributors.slice(0, 3).map(c => `${c.name} (${c.stage}, CHF ${(c.amount / 1000).toFixed(0)}k)`).join(', ') || 'aucun'}

Quelle est l'action prioritaire de la semaine ?`

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })
  if (!resp.ok) return null
  const json = await resp.json() as { content?: Array<{ text?: string }> }
  const text = json.content?.[0]?.text ?? ''
  // Extract JSON object — Claude peut envelopper en markdown ```json ... ```
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0]) as Partial<HintOutput>
    if (!parsed.title || !parsed.desc || !parsed.cta) return null
    return {
      label: meggaProse(parsed.label ?? 'Action prioritaire'),
      title: meggaProse(parsed.title),
      desc: meggaProse(parsed.desc),
      cta: meggaProse(parsed.cta),
      ctaUrl: parsed.ctaUrl,
    }
  } catch {
    return null
  }
}

async function logHint(agencyId: string | null, snapshot: SnapshotInput, hint: HintOutput, success: boolean) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey || !agencyId) return
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    await supabase.from('activity_events').insert({
      agency_id: agencyId,
      actor_id: null,
      actor_kind: 'ai',
      action: 'MEGGA AI — dashboard hint',
      entity_type: 'dashboard',
      entity_id: agencyId,
      metadata: {
        period: snapshot.period,
        scope: snapshot.scope,
        title: hint.title,
        cta_url: hint.ctaUrl,
        success,
      },
    })
  } catch {
    /* silently fail — log ne doit pas bloquer la réponse */
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json() as { snapshot: SnapshotInput; agency_id?: string }
    const snapshot = body.snapshot
    if (!snapshot) {
      return new Response(JSON.stringify({ error: 'Missing snapshot' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    let hint: HintOutput
    let usedClaude = false
    if (apiKey) {
      const claudeHint = await callClaude(snapshot, apiKey)
      if (claudeHint) {
        hint = claudeHint
        usedClaude = true
      } else {
        hint = fallbackHint(snapshot)
      }
    } else {
      hint = fallbackHint(snapshot)
    }

    // Log async (n'attend pas la fin)
    void logHint(body.agency_id ?? null, snapshot, hint, usedClaude)

    return new Response(JSON.stringify(hint), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
