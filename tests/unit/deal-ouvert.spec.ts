/**
 * Le deal OUVERT d'un acheteur (lot E1, conception §5.8) : une règle, lue par les gestes du matching (`rattacherDeal`),
 * par la fiche d'un mandat (`visiteurs.ts`) et par le copilote WhatsApp (`wa_matching_consigner`, `wa_matching_visite`),
 * confrontée ici entre ses deux écritures — le module TypeScript et le SQL de la migration du lot D2, LUE (ses specs de
 * base, `tests/backend/matching-whatsapp.spec.ts`, ne tournent que contre une base locale).
 *
 * Ce que cette spec refuse :
 *   · un deal perdu tenu pour ouvert : « perdu » est l'étape `lost`, son statut reste `active` ;
 *   · un deal archivé tenu pour ouvert : le Pipeline le range hors de sa vue, un geste neuf ne s'y rattache pas ;
 *   · une fonction du copilote qui lirait le deal de l'acheteur autrement que `dealOuvert` — un statut de plus ou de
 *     moins, l'étape oubliée, une autre étape exclue ;
 *   · une seconde définition : les gestes et la fiche lisent le module, sans en garder de copie ;
 *   · une étape devenue nulle dans le schéma : la règle ne la prévoit pas, et le `neq` de PostgREST comme le `<>` du SQL
 *     l'excluraient sans bruit.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Constants } from '@/types/database'
import { dealOuvert, ETAPE_DEAL_PERDU, STATUTS_DEAL_OUVERT } from '@/lib/dealOuvert'

const R = process.cwd()
const lire = (f: string) => readFileSync(join(R, f), 'utf8')

/** La migration du copilote WhatsApp (lot D2), par son suffixe : elle se redate le jour de la fusion. */
function migrationWhatsapp(): string {
  const noms = readdirSync(join(R, 'supabase/migrations')).filter((n) => n.endsWith('_matching_whatsapp.sql'))
  expect(noms).toHaveLength(1)
  return lire(`supabase/migrations/${noms[0]}`)
}

/** Le corps d'une fonction, sans commentaires ni blancs superflus : ce qu'elle exécute. */
function corps(sql: string, nom: string): string {
  const i = sql.indexOf(`create or replace function public.${nom}(`)
  expect(i, `${nom} introuvable`).toBeGreaterThanOrEqual(0)
  const debut = sql.indexOf('as $$', i) + 5
  return sql.slice(debut, sql.indexOf('$$;', debut)).replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim()
}

describe('un deal ouvert', () => {
  it('statut par statut : `active` et `on_hold` sont ouverts ; `completed` (gagné) et `cancelled` (annulé) ne le sont pas', () => {
    for (const status of Constants.public.Enums.transaction_status) {
      expect(dealOuvert({ status, stage: 'offer', archived_at: null }), status).toBe(status === 'active' || status === 'on_hold')
    }
  })

  it('un deal perdu n’en est pas un : « perdu » est l’étape `lost`, son statut reste ouvert', () => {
    for (const stage of Constants.public.Enums.transaction_stage) {
      expect(dealOuvert({ status: 'active', stage, archived_at: null }), stage).toBe(stage !== 'lost')
      expect(dealOuvert({ status: 'on_hold', stage, archived_at: null }), stage).toBe(stage !== 'lost')
    }
  })

  it('un deal archivé n’en est pas un, quels que soient son statut et son étape : le Pipeline le range hors de sa vue', () => {
    for (const status of Constants.public.Enums.transaction_status) {
      for (const stage of Constants.public.Enums.transaction_stage) {
        expect(dealOuvert({ status, stage, archived_at: '2026-09-01T08:00:00Z' }), `${status} / ${stage}`).toBe(false)
      }
    }
  })

  it('l’étape n’est jamais nulle (`NOT NULL`) : la règle n’a pas à le prévoir, et `neq` comme `<>` n’excluent aucun deal', () => {
    // Les types générés disent le schéma : une étape devenue nulle y ferait paraître `| null`, et la règle serait à
    // revoir des trois côtés — TypeScript, PostgREST, SQL.
    const types = lire('src/types/database.ts')
    const table = types.slice(types.indexOf('      transactions: {'))
    const ligne = table.slice(table.indexOf('Row: {'), table.indexOf('Insert: {'))
    expect(ligne).toMatch(/\n\s+stage: Database\["public"\]\["Enums"\]\["transaction_stage"\]\n/)
    expect(ligne).toMatch(/\n\s+status: Database\["public"\]\["Enums"\]\["transaction_status"\]\n/)
  })
})

describe('la même règle en base : le copilote WhatsApp (migration du lot D2, lue)', () => {
  const sql = migrationWhatsapp()
  // La règle telle que le SQL l'écrit : statuts et étape tirés du module ; l'archivage n'a pas de valeur à en tirer, et
  // la confrontation plus bas le rapporte à `dealOuvert`.
  const regle = `t.status in (${STATUTS_DEAL_OUVERT.map((s) => `'${s}'`).join(', ')}) and t.stage <> '${ETAPE_DEAL_PERDU}' and t.archived_at is null`

  it('`wa_matching_consigner` (« proposé ») prend le deal ouvert de l’acheteur, le plus récent : la lecture entière', () => {
    expect(corps(sql, 'wa_matching_consigner')).toContain(
      `select t.id into v_deal from public.transactions t where t.agency_id = p_agency and t.contact_buyer_id = v_match.contact_id and ${regle} order by t.created_at desc limit 1;`,
    )
  })

  it('`wa_matching_visite` (la visite d’un intéressé) aussi, sous verrou', () => {
    expect(corps(sql, 'wa_matching_visite')).toContain(
      `select t.id, t.stage::text into v_deal, v_etape from public.transactions t where t.agency_id = p_agency and t.contact_buyer_id = p_contact and ${regle} order by t.created_at desc limit 1 for update;`,
    )
  })

  it('lue dans le SQL, la règle rend ce que rend `dealOuvert`, statut par statut et étape par étape — et le deal ne se lit qu’une fois', () => {
    for (const nom of ['wa_matching_consigner', 'wa_matching_visite']) {
      const c = corps(sql, nom)
      // Toute lecture de la table, quels qu'en soient l'alias, la casse ou la forme (`from`, `join`) : une seconde, de
      // repli (`from public.transactions tx …`), contournerait la règle.
      expect(c.match(/(?:from|join)\s+(?:public\.)?transactions\b/gi), nom).toHaveLength(1)
      const m = c.match(/t\.status in \(([^)]*)\) and t\.stage <> '([a-z_]+)' and t\.archived_at is null/)
      expect(m, `${nom} : la règle du deal ouvert est introuvable`).not.toBeNull()
      const statuts = m![1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''))
      for (const status of Constants.public.Enums.transaction_status) {
        for (const stage of Constants.public.Enums.transaction_stage) {
          for (const archived_at of [null, '2026-09-01T08:00:00Z']) {
            expect(statuts.includes(status) && stage !== m![2] && archived_at == null, `${nom} : ${status} / ${stage} / ${archived_at}`)
              .toBe(dealOuvert({ status, stage, archived_at }))
          }
        }
      }
    }
  })
})

describe('une seule définition : les gestes et la fiche la lisent (lecture du code)', () => {
  it('`rattacherDeal` filtre sur les statuts, l’étape et l’archivage du module, jamais sur le statut seul', () => {
    const module = lire('src/lib/matchingGestes.ts')
    const debut = module.indexOf('async function rattacherDeal(')
    expect(debut).toBeGreaterThanOrEqual(0)
    const code = module.slice(debut, module.indexOf('\n}\n', debut))
    expect(code).toContain(".in('status', STATUTS_DEAL_OUVERT)")
    expect(code).toContain(".neq('stage', ETAPE_DEAL_PERDU)")
    expect(code).toContain(".is('archived_at', null)")
    expect(module).not.toMatch(/\.eq\('status', 'active'\)/)
  })

  it('les règles de la fiche d’un mandat lisent `dealOuvert`, sans en garder de copie', () => {
    const code = lire('src/components/crm/biens/fiche/visiteurs.ts')
    expect(code).toContain("import { dealOuvert } from '@/lib/dealOuvert'")
    expect(code).not.toMatch(/'on_hold'|'lost'/)
  })
})
