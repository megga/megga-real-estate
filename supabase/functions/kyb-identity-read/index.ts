// supabase/functions/kyb-identity-read/index.ts
//
// Lecture assistée de la pièce d'identité déposée à l'étape 3 du wizard KYB.
// Appelée par le navigateur du DIRIGEANT, juste après que l'étape est complète.
//
// Ce qu'elle fait, dans l'ordre : authentifie l'appelant comme administrateur de
// l'agence à laquelle la personne appartient, télécharge les faces déposées (service
// role, le bucket est privé), les fait lire par Gemini (_shared/vision.ts, décision
// du 2 juin 2026 : vision = Gemini, jamais DeepSeek qui n'en a pas), compare le
// résultat à la personne DÉCLARÉE, puis écrit deux colonnes et rend le verdict.
//
// ── Ce qu'elle NE fait PAS ──────────────────────────────────────────────────────────
//
// Elle ne décide de rien. Aucun check n'est écrit, aucun score n'est recalculé, aucun
// véto n'est levé ni posé : `verification_check_types` n'a pas bougé, le seul check de
// la pièce reste `id_document` / `pending_manual_review` posé par
// submit_agency_identity() et tranché par un humain (admin_resolve_agency_id_document).
// Un `mismatch` ici ne bloque pas la soumission -- il dit au dirigeant de vérifier
// qu'il a déposé la bonne pièce, et au relecteur où porter les yeux.
//
// Elle ne renvoie et ne stocke AUCUNE donnée lue : ni nom, ni prénom, ni date de
// naissance, ni numéro (le prompt interdit ce dernier). Seulement des verdicts de
// comparaison -- voir l'en-tête de _shared/kyb-id-read.ts. C'est aussi pourquoi rien
// n'est journalisé au-delà d'un compteur : les journaux d'edge functions ne sont pas
// l'endroit où une pièce d'identité se retrouve en clair.
//
// ── Pourquoi elle est idempotente et sans effet de bord ─────────────────────────────
//
// Un rappel (l'agent remplace une face, revient sur l'étape) relit et réécrit les deux
// mêmes colonnes. Aucun compteur, aucune insertion, aucune ligne d'historique : rejouer
// est sans conséquence, ce qui évite d'avoir à porter une clé d'idempotence pour un
// geste que l'utilisateur peut légitimement déclencher plusieurs fois.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { readDocument } from '../_shared/vision.ts'
import {
  KYB_ID_PROMPT,
  KYB_ID_READ_MODEL,
  buildReadRecord,
  mergeExtractions,
  parseKybIdExtraction,
  type KybIdExtraction,
} from '../_shared/kyb-id-read.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Les deux faces, dans l'ordre de fusion : le recto d'abord (il porte l'identité). */
const SIDES = ['recto', 'verso'] as const

/** Même dérivation que le client (identityDocumentFolder, useAgencyIdentity.ts). */
function identityFolder(agencyId: string, relatedPersonId: string): string {
  return `${agencyId}/kyb-identity/${relatedPersonId}`
}

/** Date UTC du jour, 'YYYY-MM-DD' — passée à buildReadRecord, qui n'a pas d'horloge. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { profile } = auth

  const geminiKey = Deno.env.get('GEMINI_API_KEY') || ''
  if (!geminiKey) {
    // Échec FERMÉ et explicite : sans clé, aucune lecture n'est possible, et rendre un
    // verdict « illisible » ferait passer une panne de configuration pour un constat
    // sur le document de l'utilisateur.
    return json({ error: 'vision_unavailable' }, 503)
  }

  let body: { related_person_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }
  const relatedPersonId = typeof body.related_person_id === 'string' ? body.related_person_id : ''
  if (!relatedPersonId) return json({ error: 'related_person_id required' }, 400)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  )

  // La personne est lue en service role, puis son agence est confrontée à celle du
  // PROFIL de l'appelant. Jamais l'inverse : un agency_id qui viendrait du corps de la
  // requête laisserait lire la pièce d'une autre agence. Même garde que
  // submit_agency_identity (« related person not in caller agency »).
  const { data: person, error: personError } = await supabase
    .from('agency_related_persons')
    .select('id, agency_id, first_name, last_name, date_of_birth, id_document_type')
    .eq('id', relatedPersonId)
    .maybeSingle()
  if (personError) return json({ error: 'lookup_failed' }, 500)
  if (!person || person.agency_id !== profile.agency_id) {
    // Même réponse pour « n'existe pas » et « pas votre agence » : distinguer les deux
    // dirait à un appelant si un id de personne existe ailleurs.
    return json({ error: 'forbidden' }, 403)
  }
  // MÊME définition d'administrateur d'agence que la base : is_agency_admin() vaut
  // `role in ('admin','manager')` (vérifié en production), et c'est elle qui garde les
  // policies du préfixe kyb-identity. Écrire ici une liste différente ferait de cette
  // fonction une porte plus large que celle qu'elle est censée doubler.
  if (profile.role !== 'admin' && profile.role !== 'manager') {
    return json({ error: 'forbidden' }, 403)
  }

  // Les faces réellement présentes, pas celles attendues : la nature déclarée dit
  // combien on en DEMANDE, mais la lecture prend ce qui est là. Un verso résiduel se
  // lit sans dommage, une face absente n'est pas une erreur.
  const folder = identityFolder(person.agency_id, relatedPersonId)
  const { data: files, error: listError } = await supabase.storage.from('documents').list(folder)
  if (listError) return json({ error: 'storage_unavailable' }, 502)

  const extractions: Array<KybIdExtraction | null> = []
  for (const side of SIDES) {
    const match = (files ?? []).find((f) => f.name.startsWith(`${side}.`))
    if (!match) continue
    const { data: blob, error: downloadError } = await supabase.storage
      .from('documents')
      .download(`${folder}/${match.name}`)
    if (downloadError || !blob) continue

    const bytes = new Uint8Array(await blob.arrayBuffer())
    const read = await readDocument(bytes, blob.type, geminiKey, {
      model: KYB_ID_READ_MODEL,
      prompt: KYB_ID_PROMPT,
      json: true,
    })
    // readDocument ne lève jamais : un échec (mime non géré, HTTP, réseau) devient une
    // face non lue, et la fusion continue avec l'autre. C'est ce qui fait qu'un PDF
    // exotique dégrade le verdict en « illisible » au lieu de faire échouer l'appel.
    extractions.push(read.ok ? parseKybIdExtraction(read.text) : null)
  }

  const record = buildReadRecord(
    mergeExtractions(extractions),
    {
      firstName: person.first_name as string,
      lastName: person.last_name as string,
      dateOfBirth: (person.date_of_birth as string | null) ?? null,
    },
    (person.id_document_type as string | null) ?? null,
    todayIso(),
  )

  // Écriture en service role : le trigger enforce_agency_person_id_read_writer
  // (20260803150000) refuse ces deux colonnes à tout autre rôle, y compris au
  // dirigeant lui-même — un constat de conformité ne se signe pas par son sujet.
  const { error: writeError } = await supabase
    .from('agency_related_persons')
    .update({ id_document_read: record, id_document_expires_on: record.expiresOn })
    .eq('id', relatedPersonId)
  if (writeError) return json({ error: 'write_failed' }, 500)

  return json({ read: record })
})
