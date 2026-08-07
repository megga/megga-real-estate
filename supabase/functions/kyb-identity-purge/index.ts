// supabase/functions/kyb-identity-purge/index.ts
//
// Purge des pièces d'identité KYB dont l'office est terminé. Déclenché par pg_cron.
//
// POURQUOI L'API STORAGE ET PAS UN `delete from storage.objects`. Le dépôt porte un
// précédent SQL (`20260706140000_purge_chat_staging_cron.sql`) qui supprime la métadonnée
// directement, et il est justifié pour son cas : une photo de chat dans un bucket PUBLIC,
// où retirer la métadonnée suffit à rendre l'URL 404 — la fin de l'EXPOSITION est le but.
// Ici le but est la fin de la CONSERVATION. Supprimer la ligne `storage.objects` laisse
// l'objet S3 orphelin : injoignable, mais toujours stocké. « Injoignable » ne vaut pas
// « effacé » face à une demande d'effacement portant sur un scan de passeport, d'où
// `.remove()`, qui passe par storage-api et retire réellement l'objet.
//
// POURQUOI UN BALAYAGE ET PAS UN APPEL DEPUIS LE VERDICT. `admin_resolve_agency_id_document`
// est une fonction SQL : elle ne peut pas appeler l'API Storage. Elle pourrait marquer une
// ligne « à purger », mais ce serait un second registre à tenir — exactement ce que la
// tâche 1 a refusé. `kyb_identity_files()` calcule déjà l'exigibilité à la lecture : le
// balayage lit l'état courant, donc il ne peut pas se tromper.
//
// DÉLAI ASSUMÉ : une pièce tranchée part au prochain passage, pas à la seconde. Un cycle
// quotidien reste très en deçà de tout délai d'effacement exigible.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isServiceSecret } from '../_shared/require-service-secret.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

/** Borne d'un passage. Au-delà, le reste part au tick suivant — un balayage ne doit pas
 *  pouvoir s'exécuter indéfiniment ni dépasser le timeout du cron. */
const BATCH_LIMIT = 200

interface InventoryRow {
  storage_path: string
  agency_id: string | null
  related_person_id: string | null
  uploaded_at: string | null
  latest_result: string | null
  purge_due: boolean
  purge_reason: string | null
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  if (!(await isServiceSecret(db, req))) {
    return json({ error: 'forbidden' }, 403)
  }

  const { data, error } = await db.rpc('kyb_identity_files')
  if (error) {
    console.error('[kyb-identity-purge] inventory failed', error.message)
    return json({ error: 'inventory_failed' }, 500)
  }

  // Un objet au chemin non conforme est invisible à l'inventaire, donc à la purge :
  // il resterait indéfiniment sans que rien ne le dise — la forme même du défaut F1.
  // On le COMPTE, on ne le supprime pas : détruire sur inférence est le seul geste
  // irréversible du dispositif. L'échec de cette lecture ne fait pas échouer le
  // balayage — un compteur muet ne doit pas empêcher une purge de s'exécuter.
  const { data: orphanRows, error: orphanError } = await db.rpc('kyb_identity_orphans')
  const orphans = orphanError ? null : (orphanRows ?? []).length
  if (orphanError) {
    console.error('[kyb-identity-purge] orphan scan failed', orphanError.message)
  } else if (orphans && orphans > 0) {
    console.warn(`[kyb-identity-purge] ${orphans} objet(s) hors inventaire — à rattacher a la main`)
  }

  const due = ((data ?? []) as InventoryRow[])
    .filter((row) => row.purge_due && row.purge_reason)
    .slice(0, BATCH_LIMIT)

  if (due.length === 0) return json({ scanned: (data ?? []).length, purged: 0, orphans })

  // Retrait D'ABORD, journal ENSUITE — et jamais l'inverse. Si le journal partait en
  // premier et que le retrait échouait, le registre affirmerait une destruction qui n'a
  // pas eu lieu : c'est le seul des deux échecs qu'on ne peut pas rattraper, parce qu'on
  // ne saurait plus qu'il faut y revenir. Dans l'autre sens, le fichier a bien disparu et
  // l'inventaire — dérivé de storage.objects — cesse simplement de le voir.
  const { error: removeError } = await db.storage
    .from('documents')
    .remove(due.map((row) => row.storage_path))
  if (removeError) {
    console.error('[kyb-identity-purge] remove failed', removeError.message)
    return json({ error: 'remove_failed' }, 500)
  }

  const { error: logError } = await db.from('agency_id_document_purges').insert(
    due.map((row) => ({
      storage_path: row.storage_path,
      agency_id: row.agency_id,
      related_person_id: row.related_person_id,
      purge_reason: row.purge_reason,
      uploaded_at: row.uploaded_at,
    })),
  )
  // Journal manquant = trace perdue, pas fichier survivant. On le crie sans faire échouer
  // le passage : réessayer relancerait un retrait sur des objets déjà partis.
  if (logError) {
    console.error('[kyb-identity-purge] purge log failed', logError.message)
  }

  return json({
    scanned: (data ?? []).length,
    purged: due.length,
    orphans,
    by_reason: due.reduce<Record<string, number>>((acc, row) => {
      const key = row.purge_reason ?? 'unknown'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {}),
    logged: !logError,
  })
})
