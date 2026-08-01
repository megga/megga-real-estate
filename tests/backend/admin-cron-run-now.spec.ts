// Backend integration spec (live CI) — le geste « relancer un cron maintenant »
// (migration 20260801420000, étape 28, spec §5.8).
//
// Ce que ce fichier cherche à faire échouer :
//
//   1. L'ENVOI NON VOULU. Relancer un cron exécute sa commande, et une poignée d'entre eux
//      envoient des e-mails ou des messages WhatsApp à de vraies personnes. La règle est
//      FERMÉE et fail-closed : tout job absent de la liste des inertes exige une
//      confirmation. Un job INCONNU doit donc être classé sensible, pas l'inverse.
//   2. LA CONFIRMATION QUI NE VIT QUE DANS L'ÉCRAN. Le mur doit être en BASE : appeler la
//      RPC directement, sans passer par la modale, ne doit pas suffire.
//   3. LA CLÉ D'IDEMPOTENCE BRÛLÉE PAR UN REFUS. `return admin_error` COMMITTE : si la clé
//      était réservée avant les contrôles, un refus métier la consommerait et le réessai
//      — même corrigé — rendrait un faux « already_done » sans rien faire. Défaut réel
//      trouvé au Lot 1 (#1049) ; ce test l'attaque de front.
//   4. LE GESTE QUI MENT. À la seconde du clic, le job n'a pas encore tourné : la réponse
//      doit dire « demandée », avec l'horodatage du passage, jamais « effectuée ».
//
// ⚠ Ce fichier ne suppose PAS que les 46 crons de production existent : la base de CI est
// fraîche et ne porte que ce que les migrations planifient. Il crée donc son propre job
// jetable, et éprouve la classification sur la fonction pure.
//
// ⚠ `execSql` tourne en `postgres`, qui n'est ni super-admin ni service_role : la garde de
// la RPC le refuserait. Les appels passent donc par `serviceRoleClient()`, sauf la
// préparation (planifier/retirer un cron), qui exige justement postgres.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI — lire le compte de tests, jamais le code de sortie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { serviceRoleClient, anonClient } from './helpers/supabase'
import { execSql } from './helpers/local-sql'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const DENIED = '42501'

type Row = Record<string, unknown>

/** Déballe l'enveloppe §10.1 : `{ ok, data }` ou `{ ok:false, code, message_fr }`. */
const env = (data: unknown): Row => (data ?? {}) as Row
const donnees = (data: unknown): Row => (env(data).data ?? {}) as Row

describe.skipIf(!HAS_KEYS)('relancer un cron maintenant (étape 28)', () => {
  const stamp = Date.now().toString(36)
  const jobTemoin = `spec-cron-${stamp}`

  beforeAll(() => {
    // Un job jetable, volontairement ABSENT de la liste des inertes : c'est le cas qui
    // exige une confirmation, donc celui qui éprouve le mur.
    execSql(`select cron.schedule('${jobTemoin}', '0 0 1 1 *', $c$ select 1; $c$);`)
  })

  afterAll(() => {
    // Retirer le témoin ET tout ponctuel qu'il aurait engendré : un job oublié se
    // rejouerait dans un an sur une base de recette, sans que personne ne sache pourquoi.
    execSql(`
      do $$
      declare j record;
      begin
        for j in select jobname from cron.job
                  where jobname = '${jobTemoin}' or jobname like 'adhoc-%${stamp}%'
        loop perform cron.unschedule(j.jobname); end loop;
      end $$;`)
  })

  // ── La classification, éprouvée sur la fonction pure ──────────────────────────

  it('classe inerte un job qui n\'envoie rien, et sensible tout le reste', async () => {
    const svc = serviceRoleClient()
    const est = async (nom: string) => {
      const { data, error } = await svc.rpc('admin_cron_job_is_inert', { p_jobname: nom })
      if (error) throw new Error(`is_inert(${nom}): ${error.message}`)
      return data as boolean
    }

    expect(await est('purge-stale-matches'), 'une purge n\'envoie rien').toBe(true)
    expect(await est('cantonal-medians-refresh'), 'un rafraîchissement n\'envoie rien').toBe(true)

    // Ceux-ci envoient : e-mails de rappel de visite, brief WhatsApp aux agents.
    expect(await est('visit-reminder-hourly')).toBe(false)
    expect(await est('whatsapp-morning-brief-0530utc')).toBe(false)
    expect(await est('weekly-digest-friday')).toBe(false)

    // FAIL-CLOSED : c'est la propriété qui rend la liste nommée sûre. Un job ajouté
    // demain est sensible sans que personne ait à y penser.
    expect(await est(`job-qui-nexiste-pas-${stamp}`), 'inconnu ⇒ sensible').toBe(false)
  })

  // ── La garde ─────────────────────────────────────────────────────────────────

  it('refuse un appelant sans identité', async () => {
    const { error } = await anonClient().rpc('admin_cron_run_now', {
      p_jobname: jobTemoin, p_idempotency_key: `anon-${stamp}`, p_confirm: true,
    })
    expect(error, 'anon doit être refusé').not.toBeNull()
    expect(error?.code).toBe(DENIED)
  })

  // ── Les refus métier ─────────────────────────────────────────────────────────

  it('refuse un cron inexistant, sans le confondre avec un refus de droits', async () => {
    const { data, error } = await serviceRoleClient().rpc('admin_cron_run_now', {
      p_jobname: `absent-${stamp}`, p_idempotency_key: `nf-${stamp}`, p_confirm: true,
    })
    expect(error).toBeNull()
    expect(env(data).ok).toBe(false)
    expect(env(data).code).toBe('not_found')
  })

  it('exige une confirmation pour un cron qui peut envoyer — et le mur est en BASE', async () => {
    const { data, error } = await serviceRoleClient().rpc('admin_cron_run_now', {
      p_jobname: jobTemoin, p_idempotency_key: `noconfirm-${stamp}`,
      // p_confirm omis : c'est exactement l'appel direct qui contournerait la modale.
    })
    expect(error).toBeNull()
    expect(env(data).ok).toBe(false)
    expect(env(data).code).toBe('precondition_failed')
    expect((env(data).details as Row)?.needs_confirm, 'l\'écran doit savoir quoi demander').toBe(true)
  })

  // ── Le chemin nominal ────────────────────────────────────────────────────────

  it('programme un passage ponctuel et annonce l\'heure, sans prétendre l\'avoir fait', async () => {
    const { data, error } = await serviceRoleClient().rpc('admin_cron_run_now', {
      p_jobname: jobTemoin, p_idempotency_key: `ok-${stamp}`, p_confirm: true,
    })
    expect(error).toBeNull()
    expect(env(data).ok, JSON.stringify(data)).toBe(true)

    const d = donnees(data)
    expect(d.requested, 'demandée, jamais effectuée').toBe(true)
    expect(d.jobname).toBe(jobTemoin)
    expect(typeof d.scheduled_for, 'l\'écran affiche cette heure').toBe('string')

    // Le ponctuel existe VRAIMENT : sans cette lecture, le test se contenterait de la
    // parole de la fonction.
    expect(() => execSql(`
      do $$
      begin
        if (select count(*) from cron.job where jobname like 'adhoc-%${jobTemoin}') <> 1 then
          raise exception 'le passage ponctuel n''a pas été programmé';
        end if;
      end $$;`), 'un ponctuel doit exister en base').not.toThrow()
  })

  it('journalise au registre MEGGA, famille ops', () => {
    expect(() => execSql(`
      do $$
      begin
        if not exists (select 1 from public.admin_log
                        where action = 'cron_run_now' and family = 'ops'
                          and entity_label = '${jobTemoin}') then
          raise exception 'le geste n''a rien écrit au registre';
        end if;
      end $$;`), 'admin_log doit porter la relance').not.toThrow()
  })

  // ── L'idempotence, et le piège de la clé brûlée ──────────────────────────────

  it('rejoue la même clé sans reprogrammer', async () => {
    const cle = `dup-${stamp}`
    const un = await serviceRoleClient().rpc('admin_cron_run_now', {
      p_jobname: jobTemoin, p_idempotency_key: cle, p_confirm: true,
    })
    expect(env(un.data).ok).toBe(true)

    const deux = await serviceRoleClient().rpc('admin_cron_run_now', {
      p_jobname: jobTemoin, p_idempotency_key: cle, p_confirm: true,
    })
    expect(env(deux.data).ok).toBe(true)
    expect(donnees(deux.data).already_done, 'le second appel ne reprogramme pas').toBe(true)
  })

  it('NE BRÛLE PAS la clé sur un refus métier — le réessai doit vraiment agir', async () => {
    const cle = `pasbrulee-${stamp}`

    // 1. Un refus métier consomme la transaction (`return` COMMITTE).
    const refus = await serviceRoleClient().rpc('admin_cron_run_now', {
      p_jobname: `absent-${stamp}`, p_idempotency_key: cle, p_confirm: true,
    })
    expect(env(refus.data).ok).toBe(false)
    expect(env(refus.data).code).toBe('not_found')

    // 2. Le même appelant corrige sa saisie et réessaie AVEC LA MÊME CLÉ. Si les contrôles
    //    avaient suivi la réservation, il recevrait un faux « already_done » et rien ne
    //    serait programmé — l'écran afficherait un succès pour une relance fantôme.
    const rattrapage = await serviceRoleClient().rpc('admin_cron_run_now', {
      p_jobname: jobTemoin, p_idempotency_key: cle, p_confirm: true,
    })
    expect(env(rattrapage.data).ok).toBe(true)
    expect(donnees(rattrapage.data).already_done, 'la clé ne doit pas avoir été consommée').toBeUndefined()
    expect(donnees(rattrapage.data).requested).toBe(true)
  })

  // ── Le balayeur ──────────────────────────────────────────────────────────────

  it('retire les passages ponctuels consommés, et laisse les autres crons tranquilles', () => {
    // Un ponctuel daté d'il y a une heure : le balayeur doit le retirer.
    const vieux = `adhoc-${Math.floor(Date.now() / 1000) - 3600}-${jobTemoin}`
    execSql(`select cron.schedule('${vieux}', '0 0 1 1 *', $c$ select 1; $c$);`)

    expect(() => execSql(`
      do $$
      declare n integer;
      begin
        select public.admin_cron_adhoc_sweep() into n;
        if n < 1 then raise exception 'le balayeur n''a rien retiré'; end if;
        if exists (select 1 from cron.job where jobname = '${vieux}') then
          raise exception 'le ponctuel périmé est toujours planifié';
        end if;
        if not exists (select 1 from cron.job where jobname = '${jobTemoin}') then
          raise exception 'le balayeur a emporté un cron qui n''est pas un ponctuel';
        end if;
      end $$;`), 'balayage').not.toThrow()
  })
})
