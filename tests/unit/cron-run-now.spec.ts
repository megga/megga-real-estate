/**
 * Contrat CLIENT du geste « Relancer un cron » (étape 28, RPC `admin_cron_run_now`).
 *
 * Ce que ces tests protègent, et pourquoi ils sont écrits AVANT l'écran : le geste
 * distingue trois issues qui arrivent toutes dans la MÊME enveloppe §10.1, et deux
 * d'entre elles portent le même `code`. Une lecture qui trierait sur le code
 * ouvrirait la modale de confirmation sur « pg_cron n'est pas installé » et
 * afficherait « confirmez la relance » comme une erreur fatale.
 */
import { describe, it, expect } from 'vitest'
import { formatNextRun, readCronRunNow } from '@/lib/cronRunNow'

describe('readCronRunNow', () => {
  it('reconnaît la demande de confirmation par le DRAPEAU, pas par le code', () => {
    // `precondition_failed` sert aussi aux refus définitifs : seul `details.needs_confirm`
    // distingue « demande une confirmation » de « refuse ».
    expect(readCronRunNow({
      ok: false, code: 'precondition_failed',
      message_fr: 'Ce cron peut envoyer des messages à des clients ou des agents : confirmez la relance.',
      details: { needs_confirm: true, jobname: 'whatsapp-relances' },
    })).toEqual({
      kind: 'needs_confirm',
      messageFr: 'Ce cron peut envoyer des messages à des clients ou des agents : confirmez la relance.',
    })
  })

  it('rend une confirmation sans message plutôt que de la perdre', () => {
    // `admin_error` exige un `message_fr`, mais l'écran ne doit pas dépendre de cette
    // garantie : sans message il retombe sur sa propre phrase, il n'annule pas le mur.
    expect(readCronRunNow({ ok: false, code: 'precondition_failed', details: { needs_confirm: true } }))
      .toEqual({ kind: 'needs_confirm', messageFr: '' })
  })

  it('lève le message serveur sur un refus qui porte le MÊME code sans le drapeau', () => {
    expect(() => readCronRunNow({
      ok: false, code: 'precondition_failed',
      message_fr: "pg_cron n'est pas installé sur cette base : la relance n'est possible qu'en production.",
    })).toThrow("pg_cron n'est pas installé sur cette base : la relance n'est possible qu'en production.")
  })

  it('lève le message serveur sur un cron inconnu', () => {
    expect(() => readCronRunNow({ ok: false, code: 'not_found', message_fr: "Ce cron n'existe pas." }))
      .toThrow("Ce cron n'existe pas.")
  })

  it('ne prend pas `needs_confirm: false` pour une demande de confirmation', () => {
    expect(() => readCronRunNow({
      ok: false, code: 'precondition_failed', message_fr: 'Refusé.',
      details: { needs_confirm: false },
    })).toThrow('Refusé.')
  })

  it('rend `already_done` sur une clé d\'idempotence déjà consommée', () => {
    expect(readCronRunNow({ ok: true, data: { already_done: true } })).toEqual({ kind: 'already_done' })
  })

  it('rend la relance demandée avec son horodatage UTC', () => {
    expect(readCronRunNow({
      ok: true,
      data: { requested: true, scheduled_for: '2026-08-02T13:12:00Z', jobname: 'purge-chat-staging-daily' },
    })).toEqual({ kind: 'requested', scheduledForIso: '2026-08-02T13:12:00Z' })
  })

  it('refuse un succès sans horodatage plutôt que d\'annoncer une heure vide', () => {
    expect(() => readCronRunNow({ ok: true, data: { requested: true } })).toThrow()
  })

  it('refuse une réponse hors contrat', () => {
    expect(() => readCronRunNow(null)).toThrow()
    expect(() => readCronRunNow('ok')).toThrow()
    expect(() => readCronRunNow({})).toThrow()
  })
})

describe('formatNextRun', () => {
  // Fuseau explicite : la fonction rend l'heure du NAVIGATEUR en production, mais un
  // test qui s'en remettrait au fuseau de la machine serait vert à Genève et rouge sur
  // un runner en UTC. C'est l'idiome déjà posé par `cronStale(…, now)`.
  it("convertit l'UTC en heure suisse d'été", () => {
    expect(formatNextRun('2026-08-02T13:12:00Z', 'Europe/Zurich')).toBe('15:12')
  })

  it("convertit l'UTC en heure suisse d'hiver", () => {
    expect(formatNextRun('2026-01-15T13:12:00Z', 'Europe/Zurich')).toBe('14:12')
  })

  it('rend null sur un horodatage illisible, plutôt qu\'« Invalid Date »', () => {
    expect(formatNextRun('pas une date', 'Europe/Zurich')).toBeNull()
    expect(formatNextRun('', 'Europe/Zurich')).toBeNull()
  })
})
