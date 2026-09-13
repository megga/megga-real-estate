/**
 * Les compteurs « e-mails » de la console ne comptent pas le courrier des boîtes (13.09.2026).
 *
 * ⛔ emails_sent_today, emails.sent_24h / sent_7d (carte « Emails (Resend) ») et la métrique
 * email_count_today lisaient l'action `email_sent`. Aucun envoi Resend ne l'a jamais écrite :
 * ses seuls écrivains sont la Messagerie (synchro des Envoyés, 90 jours d'un coup à la
 * connexion d'une boîte ; mail-send). La console aurait compté du courrier d'agent sous
 * l'étiquette « Resend » — hors télémétrie plateforme (D14).
 *
 * Statique, et relié au backend : les actions du courrier sont LUES dans `MailAuditAction`,
 * et les définitions SQL sont les DERNIÈRES de `supabase/migrations/`.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { repoPath } from './helpers/fs-scan'

const lire = (f: string) => readFileSync(repoPath(f), 'utf8')
const sansCommentairesSql = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')
const sansCommentairesTs = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

function actionsDuCourrier(): string[] {
  const decl = lire('supabase/functions/_shared/mail/ingest.ts').match(/export type MailAuditAction = ([^\n]+)/)?.[1] ?? ''
  return [...decl.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()
}

/** Le corps de la DERNIÈRE définition de `fn` dans les migrations horodatées. */
function derniereDefinition(fn: string): { fichier: string; corps: string } | null {
  const fichiers = readdirSync(repoPath('supabase/migrations')).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort()
  const motif = new RegExp(String.raw`create\s+(?:or\s+replace\s+)?function\s+(?:"?public"?\.)?"?${fn}"?\s*\(`, 'i')
  let trouve: { fichier: string; corps: string } | null = null
  for (const f of fichiers) {
    const sql = sansCommentairesSql(lire(`supabase/migrations/${f}`))
    const m = motif.exec(sql)
    if (!m) continue
    const apres = sql.slice(m.index)
    const tag = apres.match(/\$[A-Za-z_]*\$/)
    if (!tag) continue
    const debut = apres.indexOf(tag[0]) + tag[0].length
    const fin = apres.indexOf(tag[0], debut)
    trouve = { fichier: f, corps: apres.slice(debut, fin) }
  }
  return trouve
}

describe('Console — les compteurs « e-mails » hors du courrier des boîtes', () => {
  it('les actions du courrier sont lues dans le backend', () => {
    expect(actionsDuCourrier(), 'MailAuditAction introuvable — la garde ne mesure rien').toEqual(['email_received', 'email_sent'])
  })

  for (const fn of ['get_admin_monitoring_health', 'get_admin_integrations_health']) {
    it(`${fn} : sa dernière définition ne compte aucune action du courrier`, () => {
      const def = derniereDefinition(fn)
      expect(def, `${fn} introuvable dans les migrations`).not.toBeNull()
      // Témoin : la fonction lit bien le journal — sinon l'absence prouverait rien.
      expect(def!.corps).toContain('activity_events')
      for (const a of actionsDuCourrier()) expect(def!.corps, `${fn} (${def!.fichier}) compte « ${a} »`).not.toContain(`'${a}'`)
    })
  }

  it('la carte Resend lit les incidents de remise (email_delivery_events), comme la règle 13 des alertes', () => {
    const corps = derniereDefinition('get_admin_integrations_health')!.corps
    expect(corps).toContain('email_delivery_events')
    // resend-webhook y range aussi plaintes (courrier REMIS) et retards (qui peut encore
    // arriver) : un compteur « non remis » mentirait sur ce qu'il compte.
    expect(corps).toContain("'delivery_incidents_7d'")
    expect(corps).not.toMatch(/undelivered/)
  })

  it('l’edge admin-monitoring ne compte plus le courrier', () => {
    const code = sansCommentairesTs(lire('supabase/functions/admin-monitoring/index.ts'))
    expect(code, 'témoin : l’edge lit toujours le journal').toContain("from('activity_events')")
    for (const a of actionsDuCourrier()) expect(code).not.toContain(`'${a}'`)
    expect(code).not.toContain('email_count_today')
  })

  it('le front ne lit plus de « envoyés » Resend', () => {
    for (const f of ['src/components/admin/IntegrationsHealthPanel.tsx', 'src/hooks/useAdminIntegrationsHealth.ts']) {
      expect(sansCommentairesTs(lire(f)), f).not.toMatch(/sent_(24h|7d)/)
    }
    // Non mesuré s'affiche comme tel : jamais un 0 qui dirait « aucun envoi ».
    expect(lire('src/pages/admin/AdminMonitoringPage.tsx')).toContain("health.emailsSentToday ?? '—'")
  })
})
