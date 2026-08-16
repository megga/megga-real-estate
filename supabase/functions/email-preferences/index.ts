// supabase/functions/email-preferences/index.ts
// Le dos de la page « Vos préférences d'e-mail » (`/desinscription` dans l'app).
//
// ⛔ POURQUOI CETTE FONCTION EXISTE À CÔTÉ DE `email-unsubscribe`, ET NE LA REMPLACE PAS.
// Le POST d'`email-unsubscribe` est le « one-click » RFC 8058 : c'est Gmail et Outlook qui
// l'appellent quand ils affichent leur propre bouton, et son absence pèse sur la
// délivrabilité de tout le domaine. Y greffer un second protocole (lire/écrire des
// préférences) reviendrait à faire cohabiter deux contrats sur la méthode que la norme
// définit — pour économiser un fichier. Le chemin légalement exigé reste donc intact.
//
// AUCUNE AUTHENTIFICATION DE COMPTE, même raison que sa voisine : la personne n'a pas de
// compte et n'en aura jamais. Le jeton signé (`k:'unsub'`) porte l'adresse ; c'est la nature
// du geste qui autorise, pas une session.
//
// ⚠ ET IL PORTE PLUS QUE L'ADRESSE, ICI. Lire des préférences est un ORACLE : la réponse dit
// si une adresse est dans notre fichier. C'est pourquoi les deux RPC sont accordées à
// `service_role` SEUL et que la lecture exige un jeton authentique — un jeton EXPIRÉ est
// accepté en écriture (voir plus bas) mais un jeton faux ne l'est jamais.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyMagicLinkToken } from '../_shared/magic-link-token.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }

/** Les natures qu'une personne peut refuser. Le transactionnel n'en fait pas partie. */
const NATURES = ['relance', 'bien', 'rappel'] as const

const rendu = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: JSON_HEADERS })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'GET' && req.method !== 'POST') {
    return rendu({ error: 'method_not_allowed' }, 405)
  }

  const url = new URL(req.url)
  const token = url.searchParams.get('t') ?? ''
  const v = await verifyMagicLinkToken(token)

  // ⚠ UN JETON EXPIRÉ RESTE VALABLE ICI, comme dans `email-unsubscribe` : ce lien vit dans un
  // e-mail qu'on relit des mois plus tard, et répondre « lien expiré » à quelqu'un qui vient
  // demander qu'on le laisse tranquille est un refus déguisé. Seule l'INAUTHENTICITÉ rejette.
  const authentique = v.payload?.k === 'unsub' && !!v.payload?.e
  const acceptable = (v.valid || v.reason === 'expired') && authentique
  if (!acceptable) return rendu({ error: 'invalid_token' }, 400)

  const email = String(v.payload?.e ?? '').trim().toLowerCase()
  const contactId = v.payload?.id && v.payload.id !== '-' ? v.payload.id : null

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  if (req.method === 'GET') {
    const { data, error } = await admin.rpc('email_preferences_get', { p_email: email })
    if (error) {
      console.error('email-preferences get:', error.message.slice(0, 120))
      return rendu({ error: 'read_failed' }, 500)
    }

    // ⚠ LA LANGUE VIENT DU CONTACT, pas du navigateur. C'est la même règle que partout dans
    // ce chantier : `contacts.language` est la langue de correspondance, et quelqu'un à qui
    // l'on écrit en allemand doit trouver une page allemande. Le navigateur ne sert que de
    // repli, et le français en dernier ressort.
    //
    // ⚠ Best-effort : une langue introuvable ne doit JAMAIS empêcher quelqu'un de se
    // désinscrire — la page se rendra en français, ce qui est gênant, pas bloquant.
    let locale: string | null = null
    if (contactId) {
      const { data: c } = await admin
        .from('contacts').select('language').eq('id', contactId).maybeSingle()
      locale = (c?.language as string | null) ?? null
    }
    if (!locale) {
      const { data: c } = await admin
        .from('contacts').select('language').ilike('email', email).limit(1).maybeSingle()
      locale = (c?.language as string | null) ?? null
    }

    const row = Array.isArray(data) ? data[0] : data
    return rendu({
      locale,
      // ⚠ L'adresse est RENVOYÉE : la page doit pouvoir dire de quelle adresse il s'agit,
      // sinon quelqu'un qui en a plusieurs ne sait pas laquelle il règle. Elle ne fuite pas —
      // elle était déjà dans le jeton que le porteur détient.
      email,
      allBlocked: !!row?.all_blocked,
      blocked: Array.isArray(row?.blocked_purposes) ? row.blocked_purposes : [],
      natures: NATURES,
    })
  }

  // ── POST : écriture ────────────────────────────────────────────────────────
  let corps: { all?: unknown; blocked?: unknown }
  try {
    corps = await req.json()
  } catch {
    return rendu({ error: 'invalid_body' }, 400)
  }

  const all = corps.all === true
  // Filtré contre la liste connue : une nature inventée ferait échouer le CHECK de la
  // contrainte, donc l'écriture entière — un caractère de trop dans l'URL ne doit pas
  // empêcher quelqu'un de se désinscrire.
  const blocked = Array.isArray(corps.blocked)
    ? corps.blocked.filter((x): x is string => typeof x === 'string' && (NATURES as readonly string[]).includes(x))
    : []

  const { error } = await admin.rpc('email_preferences_set', {
    p_email: email,
    p_all: all,
    p_blocked: blocked,
    p_contact_id: contactId,
    p_source_ref: 'preference_center',
  })
  if (error) {
    console.error('email-preferences set:', error.message.slice(0, 120))
    return rendu({ error: 'write_failed' }, 500)
  }

  return rendu({ ok: true, allBlocked: all, blocked })
})
