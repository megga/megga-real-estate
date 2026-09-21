/**
 * Le compteur WhatsApp — ce qu'il compte, et ce qu'il ne montre JAMAIS à une agence.
 *
 * ── POURQUOI ─────────────────────────────────────────────────────────────────
 * Depuis le 01.10.2026, Meta facture aussi les réponses envoyées dans les 24 h d'un
 * message de l'agent — le gros du trafic du copilote. `20260921120000_whatsapp_usage.sql`
 * compte donc les sortants par mois, et note ce que Meta en facture.
 *
 * ── CE QUI EST GARDÉ ─────────────────────────────────────────────────────────
 *  1. Les lectures pures des deux RPC (`src/lib/whatsappUsage.ts`) : une valeur illisible
 *     vaut zéro, jamais un NaN à l'écran ; l'ordre des catégories est stable.
 *  2. ⛔ La RPC d'AGENCE ne lit aucune colonne `meta_*` : ce que Meta facture est la
 *     structure de coût de MEGGA, réservée à la console — même règle que les crédits.
 *  3. La RPC de CONSOLE porte la garde super-admin, et aucune des deux n'est ouverte à `anon`.
 *  4. Les libellés existent dans les quatre langues.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  adminWhatsAppUsageFromRow, categoriesParVolume, totauxParMois, whatsappUsageFromJson,
} from '@/lib/whatsappUsage'

const MIGRATION = readFileSync('supabase/migrations/20260921120000_whatsapp_usage.sql', 'utf8')
const LANGS = ['fr', 'de', 'en', 'it'] as const

/** Le corps d'une fonction de la migration, du `create` au `end $$;`. */
function corps(nom: string): string {
  const m = MIGRATION.match(new RegExp(`create or replace function public\\.${nom}\\([\\s\\S]*?end \\$\\$;`))
  if (!m) throw new Error(`fonction ${nom} absente de la migration`)
  return m[0]
}

describe('whatsapp — les lectures du compteur', () => {
  it('whatsappUsageFromJson : une valeur illisible vaut zéro, jamais NaN', () => {
    expect(whatsappUsageFromJson({ month: '2026-09', agent: 229, client: 23, unclassified: 0 }))
      .toEqual({ month: '2026-09', agent: 229, client: 23, unclassified: 0 })
    expect(whatsappUsageFromJson({ agent: 'x', client: -4, unclassified: null }))
      .toEqual({ month: '', agent: 0, client: 0, unclassified: 0 })
    expect(whatsappUsageFromJson(null)).toEqual({ month: '', agent: 0, client: 0, unclassified: 0 })
  })

  it('adminWhatsAppUsageFromRow : les catégories à zéro ou illisibles disparaissent', () => {
    const r = adminWhatsAppUsageFromRow({
      month: '2026-09', agency_id: null, agency_name: null,
      agent_messages: 40, client_messages: 6, delivered: 44, billable: 12,
      by_category: { service: 30, marketing: 6, utility: 0, bizarre: 'n/a' },
    })
    expect(r.byCategory).toEqual({ service: 30, marketing: 6 })
    expect(r.agencyId).toBeNull()
    // Une forme inattendue ne casse pas la ligne.
    expect(adminWhatsAppUsageFromRow({ ...r, month: '2026-09', agency_id: 'a', agency_name: 'A', agent_messages: 1, client_messages: 0, delivered: 1, billable: 0, by_category: [1, 2] }).byCategory).toEqual({})
  })

  it('categoriesParVolume : du plus gros au plus petit, alphabétique à égalité', () => {
    expect(categoriesParVolume({ utility: 4, marketing: 9, service: 4 }))
      .toEqual([['marketing', 9], ['service', 4], ['utility', 4]])
  })

  it('totauxParMois : additionne les agences, mois le plus récent d’abord', () => {
    const ligne = (month: string, agent: number, client: number, billable: number) => adminWhatsAppUsageFromRow({
      month, agency_id: null, agency_name: null, agent_messages: agent, client_messages: client, delivered: 0, billable, by_category: {},
    })
    expect(totauxParMois([ligne('2026-08', 5, 1, 1), ligne('2026-09', 10, 2, 3), ligne('2026-09', 4, 0, 1)]))
      .toEqual([{ month: '2026-09', sent: 16, billable: 4 }, { month: '2026-08', sent: 6, billable: 1 }])
  })
})

describe('whatsapp — l’agence ne voit que des volumes', () => {
  it('⛔ la RPC d’agence ne lit AUCUNE colonne de facturation Meta', () => {
    const agence = corps('whatsapp_usage_month')
    // Le CODE seul, commentaires blanchis : expliquer dans un commentaire pourquoi la
    // colonne est absente n'est pas la lire, et ne doit pas faire rougir la garde.
    const code = agence.replace(/--[^\n]*/g, '')
    expect(code).not.toMatch(/meta_(billable|category|pricing_type)/)
    expect(code).toMatch(/public\.get_my_agency_id\(\)/)
  })

  it('la RPC de console porte la garde super-admin', () => {
    expect(corps('get_admin_whatsapp_usage')).toMatch(/if not \(public\.is_super_admin\(\) or public\.is_service_role\(\)\) then\s+raise exception/)
  })

  it('aucune des deux n’est ouverte à `anon`', () => {
    expect(MIGRATION).toMatch(/revoke all on function public\.whatsapp_usage_month\(text\) from public, anon;/)
    expect(MIGRATION).toMatch(/revoke all on function public\.get_admin_whatsapp_usage\(integer\) from public, anon;/)
    expect(MIGRATION).not.toMatch(/grant execute on function public\.(whatsapp_usage_month|get_admin_whatsapp_usage)\([^)]*\) to [^;]*\banon\b/)
  })
})

describe('whatsapp — les libellés, dans les quatre langues', () => {
  const lire = (lng: string, ns: string) => JSON.parse(readFileSync(`src/i18n/locales/${lng}/${ns}.json`, 'utf8')) as Record<string, unknown>
  const chemin = (o: Record<string, unknown>, p: string): unknown =>
    p.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), o)

  it('écran Consommation (imbriqué) et console (plat)', () => {
    for (const lng of LANGS) {
      const s = lire(lng, 'settings')
      for (const k of ['title', 'body', 'agent', 'client', 'unclassified', 'error']) {
        const v = chemin(s, `credits.whatsapp.${k}`)
        expect(typeof v === 'string' && v.trim().length > 0, `${lng}: settings.credits.whatsapp.${k}`).toBe(true)
      }
      const a = lire(lng, 'admin')
      for (const k of ['title', 'subtitle', 'error', 'empty', 'monthValue', 'noAgency',
        'table.month', 'table.agency', 'table.agent', 'table.client', 'table.delivered', 'table.billable', 'table.categories']) {
        const v = a[`toolUsage.whatsapp.${k}`]
        expect(typeof v === 'string' && v.trim().length > 0, `${lng}: admin toolUsage.whatsapp.${k}`).toBe(true)
      }
    }
  })
})
