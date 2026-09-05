// supabase/functions/mail-imap-probe/index.ts
//
// SPIKE (messagerie, lot 3, T3.1) — CETTE FONCTION MESURE ET NE FAIT RIEN D'AUTRE.
// Elle ouvre un TLS sortant vers un hôte IMAP (993) et un hôte SMTP (465), lit la
// bannière, envoie une commande SANS IDENTIFIANT (CAPABILITY / EHLO), ferme.
// Aucun mot de passe, aucune boîte, aucune donnée : elle répond à UNE question,
// « le runtime edge peut-il parler IMAP et SMTP ? », et le lot 3 entier en dépend.
//
// ⛔ À RETIRER en T3.9. Le plan la déclare jetable : elle existe parce qu'un plan
// n'est pas une mesure. La documentation Supabase annonce le TCP sortant ; le lot 3
// ne s'écrit que si la sonde le CONFIRME depuis la production.
//
// ⚠ Gardée par `isServiceSecret` comme toute fonction interne : elle est déployée
// `--no-verify-jwt`, donc publique par défaut, et une sonde réseau ouverte à tous
// est un scanner de ports offert.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isServiceSecret } from '../_shared/require-service-secret.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

/**
 * Une mesure : ouvrir, lire la bannière, envoyer une commande anonyme, lire, fermer.
 *
 * ⚠ Le délai est BORNÉ à la main. Un port filtré ne refuse pas la connexion, il ne
 * répond simplement jamais — sans borne, la sonde consommerait le wall-clock entier
 * et rendrait un timeout de plateforme, indiscernable d'un plantage. Le témoin
 * négatif (587) est précisément ce cas-là : c'est LUI qui a besoin de la borne.
 */
async function probe(hostname: string, port: number, command: string, expect: RegExp): Promise<Record<string, unknown>> {
  const t0 = Date.now()
  const LIMITE_MS = 8000
  let conn: Deno.TlsConn | null = null
  try {
    conn = await Promise.race([
      Deno.connectTls({ hostname, port }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout_connect')), LIMITE_MS)),
    ])
    const lire = async (): Promise<string> => {
      const buf = new Uint8Array(4096)
      const n = await Promise.race([
        conn!.read(buf),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout_read')), LIMITE_MS)),
      ])
      return new TextDecoder().decode(buf.subarray(0, n ?? 0))
    }
    const banner = await lire()
    await conn.write(new TextEncoder().encode(command + '\r\n'))
    const reply = await lire()
    return {
      hostname, port, ok: expect.test(reply),
      banner: banner.slice(0, 120).trim(), reply: reply.slice(0, 200).trim(),
      ms: Date.now() - t0,
    }
  } catch (e) {
    return { hostname, port, ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e), ms: Date.now() - t0 }
  } finally {
    // ⚠ Fermer même quand la lecture a expiré : une connexion laissée ouverte tient
    // un descripteur pour toute la durée de l'isolat.
    try { conn?.close() } catch { /* déjà fermée */ }
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  if (!(await isServiceSecret(admin, req))) return json({ error: 'unauthorized' }, 401)

  // ⚠ En SÉRIE et non en parallèle : cinq handshakes TLS simultanés brouillent la
  // lecture des durées, et c'est la durée qui distingue « refusé » de « filtré ».
  const results = []
  for (const [host, port, cmd, attendu] of [
    ['mail.infomaniak.com', 993, 'a1 CAPABILITY', /^\* CAPABILITY/m],
    ['mail.infomaniak.com', 465, 'EHLO megga.ch', /^250/m],
    ['imap.bluewin.ch', 993, 'a1 CAPABILITY', /^\* CAPABILITY/m],
    ['smtpauths.bluewin.ch', 465, 'EHLO megga.ch', /^250/m],
    // Témoin négatif ATTENDU : la plateforme bloque 25 et 587. S'il passait, ce
    // serait la mesure qui serait fausse, pas la plateforme qui aurait changé.
    ['mail.infomaniak.com', 587, 'EHLO megga.ch', /^250/m],
  ] as [string, number, string, RegExp][]) {
    results.push(await probe(host, port, cmd, attendu))
  }
  return json({ mesure_le: new Date().toISOString(), results })
})
