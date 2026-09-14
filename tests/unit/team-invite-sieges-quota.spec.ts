/**
 * Invitations d'équipe — ce que la migration 20260914090100 et l'edge `send-team-invite`
 * doivent continuer de dire ENSEMBLE.
 *
 * ⛔ LE DÉFAUT D'ORIGINE (13.09.2026). L'edge plafonnait les sièges par une RPC absente de
 * la production (`get_agency_member_count`), ignorait l'erreur, et comptait donc 0 : la limite
 * ne bloquait jamais. Aucun quota ne bornait l'envoi. Rien ne le voyait, parce que rien ne
 * confrontait l'edge à la base : c'est l'objet de ce fichier.
 *
 * Quatre propriétés, chacune avec son témoin :
 *   1. le plafond tenu en base est le MIROIR de `PLAN_LIMITS[plan].features.maxAgents` ;
 *   2. la règle de sièges ne s'applique que si `plan_limits_enforced` vaut EXACTEMENT 'true',
 *      et aucun rejeu ne l'allume à la place d'un humain (décision du 13.09.2026) ;
 *   3. le quota d'envoi naît à 20, n'est jamais réécrit, et se prend sous le verrou du quota
 *      commun des e-mails de l'agence ;
 *   4. l'edge lit les deux verdicts AVANT d'écrire et avant tout envoi, sur les deux chemins
 *      (invitation et renvoi), et ne retombe plus sur la grille en dur ni sur `agencies.plan`.
 *
 * Le COMPORTEMENT (403, 429, trigger) est éprouvé contre une vraie base par
 * tests/backend/team-invite-seats-quota.spec.ts.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PLAN_LIMITS } from '@/lib/plans'
import { SEAT_LIMIT_EXCEPTION } from '../../supabase/functions/_shared/team-invite-guard'
import { sansCommentaires } from '../../scripts/_shared/wa-outbound-purpose.mjs'

const SQL = readFileSync('supabase/migrations/20260914090100_team_invite_seats_and_quota.sql', 'utf8')
// Le corps exécutable, sans les commentaires (l'en-tête cite la commande d'activation).
// Aucune chaîne du fichier ne contient `--` : couper à la fin de ligne est sûr.
const CODE_SQL = SQL.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')

const EDGE = sansCommentaires(readFileSync('supabase/functions/send-team-invite/index.ts', 'utf8'))

describe('sièges — miroir de PLAN_LIMITS.features.maxAgents', () => {
  const cas = CODE_SQL.match(/case effectif\.plan((?:\s+when '\w+' then \d+)+)\s+else (\d+) end/)

  it('chaque plan du catalogue a, en base, le plafond de PLAN_LIMITS — ni plus, ni moins', () => {
    expect(cas, 'CASE du plafond de sièges introuvable dans la migration').not.toBeNull()
    const enBase = Object.fromEntries([...cas![1].matchAll(/when '(\w+)' then (\d+)/g)].map((m) => [m[1], Number(m[2])]))
    const catalogue = Object.fromEntries(
      Object.entries(PLAN_LIMITS).map(([plan, limites]) => [plan, limites.features.maxAgents]),
    )
    expect(enBase).toEqual(catalogue)
  })

  it('un plan inconnu retombe sur le plafond Starter — fermé par défaut', () => {
    expect(Number(cas![2])).toBe(PLAN_LIMITS.starter.features.maxAgents)
  })

  it('le plan se lit dans l’abonnement, comme le quota de biens — jamais dans agencies.plan', () => {
    expect(CODE_SQL).toMatch(
      /from public\.subscriptions s\s+where s\.agency_id = p_agency_id\s+and s\.status in \('active', 'trialing', 'past_due'\)/,
    )
    expect(CODE_SQL).toMatch(/'starter'\) as plan/)
    // Témoin : la lecture est bien CELLE du quota de biens, pas une variante.
    const biens = readFileSync('supabase/migrations/20260913170100_plan_property_quota_guard.sql', 'utf8')
    expect(biens).toContain("s.status in ('active', 'trialing', 'past_due')")
    expect(CODE_SQL).not.toMatch(/public\.agencies\b/)
  })

  it('un siège = un membre non supprimé OU une invitation encore réclamable', () => {
    expect(CODE_SQL).toMatch(/from public\.profiles p\s+where p\.agency_id = p_agency_id\s+and p\.deleted_at is null/)
    expect(CODE_SQL).toMatch(/where i\.agency_id = p_agency_id\s+and i\.status = 'pending'\s+and i\.expires_at > now\(\)/)
  })
})

describe('sièges — l’interrupteur des limites de plan', () => {
  it('la clé naît à false et aucun rejeu ne l’allume', () => {
    expect(CODE_SQL).toMatch(/values \('plan_limits_enforced', 'false'\)\s*on conflict \(key\) do nothing/)
    // Contrôle positif : la migration ne contient AUCUNE écriture qui l'allumerait.
    expect(CODE_SQL).not.toMatch(/plan_limits_enforced'[^;]*'true'\)/)
    expect(CODE_SQL).not.toMatch(/do update set/)
    expect(CODE_SQL).not.toMatch(/update public\.app_config/)
  })

  it('la règle ne s’applique que si la clé vaut exactement true — à la lecture ET dans le trigger', () => {
    expect(CODE_SQL).toMatch(/where c\.key = 'plan_limits_enforced'\), 'false'\) = 'true',/)
    expect(CODE_SQL).toMatch(/where c\.key = 'plan_limits_enforced'\), 'false'\) <> 'true' then\s*return new;/)
  })

  it('le trigger juge l’insertion ET la mise à jour qui ranimerait un siège', () => {
    expect(CODE_SQL).toMatch(
      /before insert or update of status, expires_at, agency_id on public\.team_invitations\s+for each row execute function public\.enforce_plan_seat_quota\(\)/,
    )
  })

  it('le trigger lève le code que l’edge sait lire', () => {
    expect(CODE_SQL).toContain(`raise exception '${SEAT_LIMIT_EXCEPTION}'`)
  })
})

describe('quota d’envoi — actif, réglable, jamais réécrit', () => {
  it('la clé naît à 20 sans écraser un réglage posé, et le défaut de la fonction est le même', () => {
    const cle = CODE_SQL.match(/values \('team_invite_daily_cap', '(\d+)'\)\s*on conflict \(key\) do nothing/)
    const defaut = CODE_SQL.match(/greatest\(coalesce\(v_cap, (\d+)\), 1\)/)
    expect(cle, 'clé team_invite_daily_cap introuvable').not.toBeNull()
    expect(defaut, 'défaut du plafond introuvable').not.toBeNull()
    // Clé absente ou clé créée : le même plafond.
    expect(Number(defaut![1])).toBe(Number(cle![1]))
    expect(Number(cle![1])).toBe(20)
  })

  it('compte les envois de l’agence sur 24 h, sous le verrou du quota commun, puis passe par lui', () => {
    const verrou = "pg_advisory_xact_lock(hashtext('email_send_quota:' || p_agency_id::text))"
    const comptage = CODE_SQL.search(/l\.sender = 'send-team-invite'\s+and l\.created_at > now\(\) - interval '24 hours'/)
    const commun = CODE_SQL.indexOf(
      "public.email_send_quota_take(p_agency_id, p_actor_id, p_recipient, 'transactional', 'send-team-invite')",
    )
    expect(CODE_SQL.indexOf(verrou)).toBeGreaterThan(-1)
    expect(comptage).toBeGreaterThan(CODE_SQL.indexOf(verrou))
    expect(commun).toBeGreaterThan(comptage)
    // Témoin : c'est bien le verrou que prend le quota commun — sinon une invitation et un
    // autre envoi simultanés de la même agence se croiseraient.
    const quotaCommun = readFileSync('supabase/migrations/20260913120000_email_send_scope_and_quota.sql', 'utf8')
    expect(quotaCommun).toContain(verrou)
  })

  it('les RPC de l’edge sont réservées au service, le trigger à personne', () => {
    for (const sig of ['public.team_seat_status(uuid)', 'public.team_invite_quota_take(uuid, uuid, text)']) {
      expect(CODE_SQL).toContain(`revoke all on function ${sig} from public, anon, authenticated;`)
      expect(CODE_SQL).toContain(`grant execute on function ${sig} to service_role;`)
    }
    expect(CODE_SQL).toContain('revoke all on function public.enforce_plan_seat_quota() from public, anon, authenticated;')
    expect(CODE_SQL).not.toMatch(/grant execute on function [^;]* to (?:[^;]*\b)?(anon|authenticated)\b/)
  })
})

describe('send-team-invite — le compte réparé, les verrous avant tout envoi', () => {
  /** La section d'un chemin : de son premier marqueur au suivant. */
  const debutRenvoi = EDGE.indexOf("if (action === 'resend')")
  const debutInvitation = EDGE.indexOf('if (!body.email || !body.role)')
  const renvoi = EDGE.slice(debutRenvoi, debutInvitation)
  const invitation = EDGE.slice(debutInvitation)

  it('n’appelle plus la RPC fantôme, ni la grille en dur, ni agencies.plan', () => {
    expect(EDGE).not.toContain('get_agency_member_count')
    expect(EDGE).not.toContain('PLAN_LIMITS')
    expect(EDGE).not.toMatch(/agency\.plan\b/)
    expect(EDGE).toContain(".select('id, name')")
    // Témoin : le compte existe toujours — il passe par la base.
    expect(EDGE).toContain('readSeatStatus(supabaseAdmin, profile.agency_id)')
  })

  it('invitation : sièges → quota → écriture → Resend, et chaque refus rend la main', () => {
    expect(debutRenvoi).toBeGreaterThan(-1)
    expect(debutInvitation).toBeGreaterThan(debutRenvoi)
    const sieges = invitation.indexOf('readSeatStatus(')
    const quota = invitation.indexOf('takeTeamInviteQuota(')
    const ecriture = invitation.indexOf('.insert({')
    const envoi = invitation.indexOf('api.resend.com')
    expect([sieges, quota, ecriture, envoi].every((i) => i > -1)).toBe(true)
    expect(sieges).toBeLessThan(quota)
    expect(quota).toBeLessThan(ecriture)
    expect(ecriture).toBeLessThan(envoi)
    expect(invitation).toMatch(/const sieges = seatRefusal\(await readSeatStatus\(supabaseAdmin, profile\.agency_id\)\)\s*if \(sieges\) return reponse\(sieges\)/)
    expect(invitation).toMatch(/const quota = quotaRefusal\([\s\S]{0,200}?\)\s*if \(quota\) return reponse\(quota\)/)
  })

  it('renvoi : l’invitation d’abord, puis le quota, puis la rotation du jeton et Resend', () => {
    const lecture = renvoi.indexOf('.maybeSingle()')
    const quota = renvoi.indexOf('takeTeamInviteQuota(')
    const rotation = renvoi.indexOf('.update({')
    const envoi = renvoi.indexOf('api.resend.com')
    expect([lecture, quota, rotation, envoi].every((i) => i > -1)).toBe(true)
    expect(lecture).toBeLessThan(quota)
    expect(quota).toBeLessThan(rotation)
    expect(rotation).toBeLessThan(envoi)
    expect(renvoi).toMatch(/if \(quotaRenvoi\) return reponse\(quotaRenvoi\)/)
  })

  it('le quota est pris pour l’agence du PROFIL et l’appelant authentifié, jamais un identifiant du corps', () => {
    const appels = [...EDGE.matchAll(/takeTeamInviteQuota\(supabaseAdmin, \{ agencyId: ([\w.]+), actorId: ([\w.]+) \}/g)]
    expect(appels).toHaveLength(2)
    for (const m of appels) {
      expect(m[1]).toBe('profile.agency_id')
      expect(m[2]).toBe('user.id')
    }
    expect([...EDGE.matchAll(/takeTeamInviteQuota\(/g)]).toHaveLength(2)
  })

  it('le refus du trigger à l’écriture est lu, pas renvoyé en 500', () => {
    expect(invitation).toContain('if (isSeatLimitError(insertError)) return reponse(seatLimitRefusal())')
    expect(renvoi).toContain('if (isSeatLimitError(error)) return reponse(seatLimitRefusal())')
  })

  it('aucune erreur Postgres ne sort en clair du gestionnaire', () => {
    expect(EDGE).toContain("JSON.stringify({ error: 'internal_error' })")
    expect(EDGE).not.toMatch(/error instanceof Error \? error\.message/)
    expect(EDGE).toContain('redactedErrorMessage(error)')
  })
})
