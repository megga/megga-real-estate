// supabase/functions/mail-logos/index.ts
// POST { account_id, domains: string[] } → { logos: { [domaine]: { mime, data, source } | null } }
//
// Résout, à la demande de la liste, les logos des expéditeurs qu'une boîte a reçus, et les
// range dans `mail_sender_logos` (lisibles ensuite en direct, sous la RLS des courriers).
// Le résolveur est `_shared/mail/logos.ts` : BIMI, puis les icônes du site de
// l'expéditeur — jamais un service tiers (voir son en-tête).
//
// ⛔ CE N'EST PAS UN LECTEUR D'URL À LA DEMANDE. Trois verrous, dans cet ordre :
//  1. un agent authentifié, qui VOIT la boîte (même règle que ses courriers) ;
//  2. seuls les domaines dont cette boîte a REÇU du courrier sont résolus — sans quoi
//     n'importe quel agent ferait visiter à notre serveur le site de son choix ;
//  3. chaque requête sortante passe par `safeFetchResponse` (https, IP publiques,
//     redirections revalidées, corps plafonné).
//
// ⛔ PAS DE RECOPIE D'UNE BOÎTE À L'AUTRE, et ce n'est pas un oubli d'optimisation. Un logo
// déjà trouvé ailleurs reviendrait en quelques millisecondes, une résolution en plusieurs
// centaines : chronométrer l'appel dirait à un agent si une AUTRE boîte MEGGA — d'une autre
// agence, ou la boîte personnelle d'un collègue — reçoit du courrier de ce domaine. Chaque
// boîte résout donc les siens ; le prix est une requête par boîte et par mois vers le site
// du correspondant.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { accountVisibleTo } from '../_shared/mail/guard.ts'
import { safeFetchResponse } from '../_shared/safe-fetch.ts'
import { DelaiDepasse, normaliserDomaine, resoudreLogo, type LogoResolu, type Reseau } from '../_shared/mail/logos.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

/** Une page de la liste compte douze fils : au-delà, la demande ne vient pas de l'écran. */
const DOMAINES_MAX = 16
/** Résolutions simultanées : assez pour une page, trop peu pour ressembler à un balayage. */
const EN_PARALLELE = 4
/** Échéance d'une résolution : un site lent ne retient pas la réponse des autres. */
const ECHEANCE_MS = 10_000
const JOUR = 86_400_000
/** Un logo trouvé se revérifie au bout d'un mois ; un « rien », au bout d'une semaine. */
const FRAICHEUR = { found: 30 * JOUR, none: 7 * JOUR } as const

interface Ligne { domain: string; status: 'found' | 'none'; source: string | null; mime: string | null; data: string | null; checked_at: string }
type Logo = { mime: string; data: string; source: string } | null

/** Plafond d'une recherche BIMI : un nom sans enregistrement ne doit pas manger l'échéance. */
const DNS_MS = 2_500

const reseau: Reseau = {
  lire: (url, opts) => safeFetchResponse(url, opts),
  // ⚠ NOM COMPLET, point final compris. Sans lui, le résolveur essaie aussi le nom suivi
  // de son domaine de recherche (`….home`, `….compute.internal`) chaque fois que le vrai
  // n'existe pas — ce qui est le cas de presque tous les domaines (BIMI est rare). Mesuré
  // le 14.09.2026 : 5 s par recherche sans le point, 25 ms avec.
  txt: (nom) => Deno.resolveDns(nom.endsWith('.') ? nom : `${nom}.`, 'TXT', { signal: AbortSignal.timeout(DNS_MS) }),
}

const frais = (l: Pick<Ligne, 'status' | 'checked_at'>) => Date.now() - Date.parse(l.checked_at) < FRAICHEUR[l.status]
const versLogo = (l: Pick<Ligne, 'status' | 'mime' | 'data' | 'source'>): Logo =>
  l.status === 'found' && l.mime && l.data && l.source ? { mime: l.mime, data: l.data, source: l.source } : null

/**
 * Les domaines demandés dont la boîte a réellement reçu du courrier (fils ou messages) HORS
 * spam.
 *
 * ⛔ UN DOMAINE VU SEULEMENT AU SPAM N'EST PAS RÉSOLU (15.09.2026). Le spam est importé
 * depuis le 14.09 : ouvrir le dossier faisait visiter par nos serveurs le DNS et le site de
 * chaque spammeur — qui, d'un sous-domaine unique par destinataire, apprenait que la boîte
 * est relevée et lue — et le vrai logo BIMI d'une banque se posait sur l'hameçonnage qui
 * usurpe son domaine. L'écran n'en demande plus pour le spam ; ce verrou ne le croit pas sur
 * parole.
 */
async function domainesRecus(admin: SupabaseClient, accountId: string, domaines: string[]): Promise<Set<string>> {
  // Les domaines sont validés par `normaliserDomaine` ([a-z0-9.-]) : ni virgule, ni
  // parenthèse, ni joker ne peut sortir du motif (même forme que la recherche de contacts
  // de `_shared/whatsapp-actions.ts`, qui tourne en production).
  const filtre = domaines.map((d) => `from_email.ilike.%@${d}`).join(',')
  const [fils, messages] = await Promise.all([
    admin.from('mail_threads').select('from_email').eq('account_id', accountId).eq('is_spam', false).or(filtre).limit(200),
    admin.from('mail_messages').select('from_email').eq('account_id', accountId).eq('is_spam', false).or(filtre).limit(200),
  ])
  const vus = new Set<string>()
  for (const r of [...(fils.data ?? []), ...(messages.data ?? [])]) {
    const d = normaliserDomaine(String(r.from_email ?? ''))
    if (d) vus.add(d)
  }
  return vus
}

/** `f` sur chaque élément, `n` à la fois. */
async function parPaquets<T, R>(items: T[], n: number, f: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await f(items[k]) }
  }))
  return out
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { user, profile, supabase: admin } = auth
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const accountId = String(body.account_id ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(accountId)) return json({ error: 'invalid_account' }, 400)
  const demandes = [...new Set((Array.isArray(body.domains) ? body.domains : [])
    .map((d) => normaliserDomaine(String(d ?? '')))
    .filter((d): d is string => !!d))].slice(0, DOMAINES_MAX)
  if (demandes.length === 0) return json({ logos: {} })

  const { data: account } = await admin.from('mail_accounts').select('id, agency_id, owner_id, visibility').eq('id', accountId).maybeSingle()
  if (!account || !accountVisibleTo(account, { userId: user.id, agencyId: profile.agency_id })) return json({ error: 'not_found' }, 404)

  const recus = [...await domainesRecus(admin, accountId, demandes)].filter((d) => demandes.includes(d))
  if (recus.length === 0) return json({ logos: {} })

  const logos: Record<string, Logo> = {}
  const { data: dejaLa } = await admin.from('mail_sender_logos')
    .select('domain, status, source, mime, data, checked_at').eq('account_id', accountId).in('domain', recus)
  for (const l of (dejaLa ?? []) as Ligne[]) if (frais(l)) logos[l.domain] = versLogo(l)

  const aFaire = recus.filter((d) => !(d in logos))
  const lignes: Omit<Ligne, 'checked_at'>[] = []

  const resolus = await parPaquets(aFaire, EN_PARALLELE, async (d): Promise<[string, LogoResolu | null]> => {
    try {
      return [d, await resoudreLogo(d, reseau, Date.now() + ECHEANCE_MS)]
    } catch (e) {
      // Échéance dépassée : rien n'est conclu, rien n'est rangé — la prochaine liste réessaiera.
      if (!(e instanceof DelaiDepasse)) console.error(`[mail-logos] ${d} :`, e instanceof Error ? e.message : String(e))
      return [d, null]
    }
  })
  for (const [d, r] of resolus) {
    if (!r) continue
    if (r.status === 'found') {
      logos[d] = { mime: r.mime, data: r.data, source: r.source }
      lignes.push({ domain: d, status: 'found', source: r.source, mime: r.mime, data: r.data })
    } else {
      logos[d] = null
      lignes.push({ domain: d, status: 'none', source: null, mime: null, data: null })
    }
  }

  if (lignes.length) {
    const checked_at = new Date().toISOString()
    const { error } = await admin.from('mail_sender_logos')
      .upsert(lignes.map((l) => ({ ...l, account_id: accountId, checked_at })), { onConflict: 'account_id,domain' })
    // Un rangement raté ne retire rien à l'écran : les logos partent quand même. Il se
    // DIT, pour qu'une contrainte violée ne se lise pas comme « aucun logo en cache ».
    if (error) console.error(`[mail-logos] rangement de ${lignes.length} logo(s) refusé :`, error.message)
  }
  return json({ logos })
})
