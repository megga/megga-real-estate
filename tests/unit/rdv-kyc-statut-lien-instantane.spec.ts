/**
 * Prise de rendez-vous KYC — un lien RÉVOQUÉ ne réserve plus, et l'agenda externe de l'agent
 * n'est interrogé que sous bail (audit du 13.09.2026 ; migration 20260914090000).
 *
 * CE QUE CE FICHIER TIENT : le CÂBLAGE — les règles pures ont leurs tests
 * (`_shared/magic-link-limits.test.ts`, `_shared/booking-freebusy-cache.test.ts`), le
 * comportement de bout en bout le sien (`tests/backend/rdv-kyc-statut-lien-instantane.spec.ts`).
 * Ici : que les edge functions appliquent la liste AVANT de rien dire du lien, que le seul
 * appel au fournisseur passe par l'instantané, que l'instantané s'écrit sous le bail et se
 * jette après chaque geste — et que les copies SQL et TypeScript ne divergent pas.
 *
 * Chaque ancrage est d'abord éprouvé sur un extrait écrit comme le code d'AVANT : un détecteur
 * qui ne verrait rien serait vert pour de mauvaises raisons. Les ancrages portent sur l'USAGE
 * (`isMagicLinkBookable(link.status)`), jamais sur la première mention d'un nom — celle de
 * l'import, en tête de fichier, rendrait l'assertion toujours vraie.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { repoPath } from './helpers/fs-scan'
import { MAGIC_LINK_BOOKING_STATUSES } from '../../supabase/functions/_shared/magic-link-limits'
import {
  COLONNES_INSTANTANE,
  FREEBUSY_TTL_S,
  champsInstantane,
} from '../../supabase/functions/_shared/booking-freebusy-cache'

const lire = (chemin: string) => readFileSync(repoPath(chemin), 'utf-8').replace(/\r\n/g, '\n')
const sansCommentairesTs = (c: string): string =>
  c.replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, ' ')
const sansCommentairesSql = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')

/** Vrai si `a` et `b` sont tous deux trouvés, et `a` AVANT `b`. */
function avant(code: string, a: RegExp | string, b: RegExp | string): boolean {
  const pos = (m: RegExp | string) => (typeof m === 'string' ? code.indexOf(m) : code.search(m))
  const ia = pos(a)
  const ib = pos(b)
  return ia !== -1 && ib !== -1 && ia < ib
}

/**
 * Chaque chaîne d'appels qui commence à `.from('<table>')` : l'appel lui-même puis chaque
 * `.méthode(…)` enchaîné, parenthèses équilibrées — une requête supabase-js entière, quelle
 * que soit sa mise en page. Rend la chaîne et sa position.
 */
function chaines(code: string, table: string): Array<{ texte: string; debut: number }> {
  const depart = `.from('${table}')`
  const out: Array<{ texte: string; debut: number }> = []
  let i = code.indexOf(depart)
  while (i !== -1) {
    let j = i + depart.length
    for (;;) {
      let k = j
      while (k < code.length && /\s/.test(code[k])) k++
      if (code[k] !== '.') break
      k++
      const nom = /^[A-Za-z_$][\w$]*/.exec(code.slice(k))
      if (!nom) break
      k += nom[0].length
      while (k < code.length && /\s/.test(code[k])) k++
      if (code[k] === '(') {
        let profondeur = 0
        for (; k < code.length; k++) {
          if (code[k] === '(') profondeur++
          else if (code[k] === ')' && --profondeur === 0) { k++; break }
        }
      }
      j = k
    }
    out.push({ texte: code.slice(i, j), debut: i })
    i = code.indexOf(depart, j)
  }
  return out
}

// ─── Détecteurs ────────────────────────────────────────────────────────────

/** Le `select` du lien lit la colonne `status` — sans elle, la liste ne lirait qu'`undefined`. */
const statutLu = (code: string): boolean =>
  chaines(code, 'kyc_magic_links').some(({ texte }) => /\.select\(\s*'[^']*\bstatus\b[^']*'\s*\)/.test(texte))

/** Le refus : liste blanche sur `link.status`, 410, motif `expired` et rien d'autre. */
const REFUS_STATUT =
  /if\s*\(\s*!isMagicLinkBookable\(\s*link\.status\s*\)[^{]*\{\s*return\s+json\(\s*\{\s*error:\s*'Link expired',\s*reason:\s*'expired'\s*\}\s*,\s*410\s*\)/

/**
 * Le seul appel au fournisseur est la dépendance `interroger` des E/S de l'instantané
 * (`DependancesInstantane`), et ces E/S sont bien remises à `occupationsExternes`.
 */
const fournisseurSousInstantane = (code: string): boolean =>
  (code.match(/\bexternalBusyRanges\(/g) ?? []).length === 1 &&
  /:\s*DependancesInstantane\s*=\s*\{[\s\S]*?\binterroger:\s*\([^)]*\)\s*=>\s*externalBusyRanges\(/.test(code) &&
  avant(code, 'externalBusyRanges(', 'occupationsExternes(')

/** Les écritures de l'instantané qui ne sont PAS gardées par le bail. */
const ecrituresHorsBail = (code: string): string[] =>
  chaines(code, 'kyc_booking_freebusy_cache')
    .map(({ texte }) => texte)
    .filter((t) => t.includes('.update(') || t.includes('.upsert(') || t.includes('.insert('))
    .filter((t) => !/\.eq\(\s*'lease_id'\s*,/.test(t) || t.includes('.upsert(') || t.includes('.insert('))

/** Position de l'invalidation (`delete` de la ligne de l'agent), ou -1. */
function invalidation(code: string, agent: string): number {
  const c = chaines(code, 'kyc_booking_freebusy_cache')
    .find(({ texte }) => texte.includes('.delete()') && texte.includes(`.eq('agent_id', ${agent})`))
  return c ? c.debut : -1
}

// ─── Extraits écrits comme le code d'AVANT le correctif ────────────────────

const AVANT_SLOTS = `
    const { data: link } = await db
      .from('kyc_magic_links')
      .select('id, token, agency_id, contact_id, expires_at, created_by')
      .eq('id', verified.payload.id)
      .maybeSingle()
    if (link.token !== token) return json({ error: 'Token superseded', reason: 'regenerated' }, 410)
    if (new Date(link.expires_at) < new Date()) return json({ error: 'Link expired' }, 410)
    const { data: existing } = await db.from('appointments').select('id').eq('magic_link_id', link.id)
  const external = await externalBusyRanges(readTokens, agentId, fromIso, toIso)
`
/** Un cache « naïf » : servi s'il est frais, réécrit par n'importe qui — pas de bail. */
const CACHE_NAIF = `
  const instantane = await occupationsExternes({
    interroger: (from, to) => externalBusyRanges(readTokens, agentId, from, to),
    ecrire: async (bail, champs) => {
      await db.from('kyc_booking_freebusy_cache').upsert({ agent_id: agentId, ...champs })
      await db.from('kyc_booking_freebusy_cache').update(champs).eq('agent_id', agentId)
    },
  }, settings)
`
const AVANT_BOOK = `
  if (new Date(link.expires_at) < new Date()) return json({ error: 'Link expired' }, 410)
  const { data: appointmentId, error: rpcError } = await db.rpc('book_kyc_appointment', {})
    const written = await createBookingEvent(readTokens, link.created_by, {})
      await sendBookingEmail({})
`

describe('détecteurs — éprouvés sur le code d’avant le correctif', () => {
  it('le statut n’était ni lu ni refusé', () => {
    expect(statutLu(AVANT_SLOTS)).toBe(false)
    expect(REFUS_STATUT.test(AVANT_SLOTS)).toBe(false)
  })

  it('l’appel direct au fournisseur est vu comme HORS instantané', () => {
    expect(fournisseurSousInstantane(AVANT_SLOTS)).toBe(false)
  })

  it('une écriture de l’instantané sans bail est vue, upsert compris', () => {
    expect(ecrituresHorsBail(CACHE_NAIF)).toHaveLength(2)
    expect(ecrituresHorsBail(".from('kyc_booking_freebusy_cache').update(champs).eq('agent_id', a).eq('lease_id', bail)")).toEqual([])
  })

  it('l’absence d’invalidation est vue', () => {
    expect(invalidation(AVANT_BOOK, 'link.created_by')).toBe(-1)
    expect(invalidation(".from('kyc_booking_freebusy_cache').delete().eq('agent_id', link.created_by)", 'link.created_by')).toBe(0)
  })
})

describe('appointment-slots — la liste blanche avant tout, le fournisseur sous bail', () => {
  const code = sansCommentairesTs(lire('supabase/functions/appointment-slots/index.ts'))

  it('le select du lien lit `status`, et un statut hors liste répond 410 `expired`', () => {
    expect(statutLu(code)).toBe(true)
    expect(code).toMatch(REFUS_STATUT)
  })

  it('le refus précède TOUT ce que le lien dirait encore : son rendez-vous, les réglages, l’agenda', () => {
    const refus = 'isMagicLinkBookable(link.status)'
    expect(avant(code, refus, ".eq('magic_link_id', link.id)")).toBe(true)
    expect(avant(code, refus, "rpc('get_kyc_appointment_public'")).toBe(true)
    expect(avant(code, refus, ".from('agent_booking_settings')")).toBe(true)
    expect(avant(code, refus, 'occupationsExternes(')).toBe(true)
  })

  it('le seul appel au fournisseur passe par l’instantané', () => {
    expect(fournisseurSousInstantane(code)).toBe(true)
  })

  it('le bail est demandé à la base avec la durée du module, et l’instantané ne s’écrit que sous lui', () => {
    expect(code).toMatch(/rpc\(\s*'kyc_booking_freebusy_claim'\s*,\s*\{[^}]*p_ttl_seconds:\s*FREEBUSY_TTL_S/)
    expect(chaines(code, 'kyc_booking_freebusy_cache').some(({ texte }) => texte.includes('.update('))).toBe(true)
    expect(ecrituresHorsBail(code)).toEqual([])
  })

  it('les créneaux sont rognés à ce que l’agenda externe a couvert', () => {
    expect(code).toMatch(/borneALaCouverture\(\s*computeSlots\(/)
  })
})

describe('appointment-book — liste blanche avant la RPC, instantané jeté après l’écho', () => {
  const code = sansCommentairesTs(lire('supabase/functions/appointment-book/index.ts'))

  it('statut lu, refusé en 410 `expired`, AVANT la réservation', () => {
    expect(statutLu(code)).toBe(true)
    expect(code).toMatch(REFUS_STATUT)
    expect(avant(code, 'isMagicLinkBookable(link.status)', "rpc('book_kyc_appointment'")).toBe(true)
  })

  it('le refus de la RPC (`link_expired`) se traduit lui aussi en 410', () => {
    expect(code).toMatch(/link_expired:\s*410/)
  })

  it('l’instantané de l’agent est jeté APRÈS l’écho dans son agenda, avant le courriel', () => {
    const i = invalidation(code, 'link.created_by')
    expect(i).toBeGreaterThan(-1)
    expect(i).toBeGreaterThan(code.indexOf('createBookingEvent('))
    expect(i).toBeLessThan(code.indexOf('sendBookingEmail('))
  })
})

describe('appointment-manage — annuler ou reporter jette l’instantané', () => {
  const code = sansCommentairesTs(lire('supabase/functions/appointment-manage/index.ts'))

  it('après l’écho (suppression OU déplacement), dans le chemin des mutations, avant le courriel', () => {
    const i = invalidation(code, 'row.agent_id')
    expect(i).toBeGreaterThan(-1)
    expect(i).toBeGreaterThan(code.indexOf("if (req.method === 'GET')"))
    expect(i).toBeGreaterThan(code.indexOf('deleteBookingEvent('))
    expect(i).toBeGreaterThan(code.indexOf('updateBookingEvent('))
    expect(i).toBeLessThan(code.indexOf('sendBookingEmail('))
  })

  it('la fonction ne lit pas le lien magique : le jeton `appt` est une capacité distincte', () => {
    expect(code).not.toContain(".from('kyc_magic_links')")
  })
})

describe('migration 20260914090000 — la copie en base, les droits, le bail', () => {
  const fichiers = readdirSync(repoPath('supabase/migrations')).filter((f) => f.endsWith('_rdv_kyc_statut_lien_instantane_freebusy.sql'))
  const sql = fichiers.length === 1 ? sansCommentairesSql(lire(`supabase/migrations/${fichiers[0]}`)) : ''

  it('existe, une seule fois, datée du jour du merge attendu', () => {
    expect(fichiers).toEqual(['20260914090000_rdv_kyc_statut_lien_instantane_freebusy.sql'])
  })

  it('la liste blanche SQL est EXACTEMENT celle des edge functions', () => {
    const m = /p_status\s+in\s*\(([^)]*)\)/i.exec(sql)
    expect(m, 'liste de kyc_magic_link_bookable introuvable').not.toBeNull()
    const valeurs = [...m![1].matchAll(/'([^']*)'/g)].map((x) => x[1]).sort()
    expect(valeurs).toEqual([...MAGIC_LINK_BOOKING_STATUSES].sort())
  })

  it('l’enum ne porte que les statuts de la liste, plus `expired` — un statut ajouté doit être tranché ICI', () => {
    const baseline = lire('supabase/migrations/00000000000000_baseline_remote_schema.sql')
    const enumSql = /TYPE\s+"public"\."kyc_magic_link_status"\s+AS\s+ENUM\s*\(([^)]*)\)/.exec(baseline)
    expect(enumSql, 'enum kyc_magic_link_status introuvable dans la baseline').not.toBeNull()
    const valeurs = [...enumSql![1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort()
    expect(valeurs).toEqual([...MAGIC_LINK_BOOKING_STATUSES, 'expired'].sort())
    const ajouts = readdirSync(repoPath('supabase/migrations'))
      .filter((f) => f.endsWith('.sql'))
      .filter((f) => /alter\s+type\s+(public\.)?"?kyc_magic_link_status"?\s+add\s+value/i.test(lire(`supabase/migrations/${f}`)))
    expect(ajouts, 'une valeur a été ajoutée à kyc_magic_link_status : décider si elle réserve').toEqual([])
  })

  it('book_kyc_appointment consulte la liste et lève `link_expired` — réécrite depuis sa définition VIVANTE', () => {
    expect(sql).toMatch(/IF\s+NOT\s+public\.kyc_magic_link_bookable\(\s*l\.status::text\s*\)\s+THEN\s+RAISE\s+EXCEPTION\s+'link_expired'/)
    expect(sql).toMatch(/pg_get_functiondef\(\s*v_fn\s*\)/)
    expect(sql).toMatch(/regexp_count\(\s*v_def\s*,\s*v_ancre/)
  })

  it('table et bail réservés au service : RLS sans policy, droits retirés à anon et authenticated', () => {
    expect(sql).toMatch(/alter\s+table\s+public\.kyc_booking_freebusy_cache\s+enable\s+row\s+level\s+security/i)
    expect(sql).toMatch(/revoke\s+all\s+on\s+table\s+public\.kyc_booking_freebusy_cache\s+from\s+public\s*,\s*anon\s*,\s*authenticated/i)
    expect(sql).toMatch(/revoke\s+all\s+on\s+function\s+public\.kyc_booking_freebusy_claim\(uuid,\s*integer\)\s+from\s+public\s*,\s*anon\s*,\s*authenticated/i)
    expect(sql).not.toMatch(/create\s+policy[^;]*kyc_booking_freebusy_cache/i)
  })

  it('le bail n’est repris qu’après une durée de vie, et la durée du module est dans les bornes de la base', () => {
    expect(sql).toMatch(/where\s+c\.claimed_at\s*<=\s*now\(\)\s*-\s*make_interval\(\s*secs\s*=>\s*p_ttl_seconds\s*\)/i)
    const bornes = /p_ttl_seconds\s*<\s*(\d+)\s+or\s+p_ttl_seconds\s*>\s*(\d+)/i.exec(sql)
    expect(bornes, 'bornes de p_ttl_seconds introuvables').not.toBeNull()
    expect(FREEBUSY_TTL_S).toBeGreaterThanOrEqual(Number(bornes![1]))
    expect(FREEBUSY_TTL_S).toBeLessThanOrEqual(Number(bornes![2]))
  })

  it('chaque colonne que l’edge lit ou écrit existe dans la table — une faute rendrait l’instantané illisible pour tous', () => {
    const creation = /create\s+table\s+if\s+not\s+exists\s+public\.kyc_booking_freebusy_cache\s*\(([\s\S]*?)\n\);/i.exec(sql)
    expect(creation, 'création de kyc_booking_freebusy_cache introuvable').not.toBeNull()
    const colonnes = new Set([...creation![1].matchAll(/^\s{2}([a-z_]+)\s+(uuid|timestamptz|boolean|text|jsonb)\b/gm)].map((x) => x[1]))
    expect(colonnes.has('agent_id') && colonnes.has('lease_id') && colonnes.has('busy'), 'lecture de la table ratée').toBe(true)
    for (const c of COLONNES_INSTANTANE.split(',').map((x) => x.trim())) expect(colonnes, `lue : ${c}`).toContain(c)
    const ecrites = Object.keys(champsInstantane({ ok: true, busy: [], providers: [] }, { fromMs: 0, toMs: 1 }, 0))
    for (const c of ecrites) expect(colonnes, `écrite : ${c}`).toContain(c)
  })
})

describe('la page publique lit bien le refus', () => {
  it('useAppointmentSlots traduit le 410 en « lien expiré »', () => {
    const hook = sansCommentairesTs(lire('src/hooks/useAppointmentBooking.ts'))
    expect(hook).toMatch(/res\.status\s*===\s*410\)\s*return\s*\{\s*\.\.\.EMPTY,\s*unavailable:\s*'link_expired'\s*\}/)
  })
})
