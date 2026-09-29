/**
 * « Pendant ton absence » (lot D1, conception `2026-09-23-matching-lot-d1-surfaces-design.md` §5.3) — la traduction
 * d'une ligne de `today_absence()` en signal (`versSignalAbsence`, `src/components/crm/today/absenceSignaux.ts`).
 *
 * ⛔ Ce que cette spec tient : une relance de PROPOSITION porte `retoursDe`, et c'est lui qui interdit à « Reprendre »
 * d'écrire (les deux écrans et `resumeReminder` le lisent). Tout autre rappel — et une base d'avant la migration du
 * lot, dont les lignes n'ont pas les clés — garde l'ancien rappel. Un motif de refus s'affiche LIBELLÉ, jamais en code
 * brut.
 *
 * Le faux `t` rend la clé et ses valeurs : on éprouve le CHOIX de la phrase, pas sa rédaction, que gardent la parité
 * et la couverture i18n.
 */
import { describe, expect, it } from 'vitest'
import { absenceDuBureau, versSignalAbsence, type AbsenceRow, type OutilsSignalAbsence } from '@/components/crm/today/absenceSignaux'

/** La clé — préfixée de son espace de noms s'il en porte un —, puis ses valeurs en JSON. */
const t = (cle: string, valeurs?: Record<string, unknown>): string => {
  const { ns, ...reste } = valeurs ?? {}
  const base = typeof ns === 'string' ? `${ns}:${cle}` : cle
  return Object.keys(reste).length ? `${base} ${JSON.stringify(reste)}` : base
}

/** Lu deux heures après les faits : la méta est l'heure seule (moins de 24 h), en UTC pour ne dépendre de rien. */
const LU_LE = Date.parse('2026-09-23T12:00:00.000Z')
const SURVENU = '2026-09-23T10:00:00.000Z'
const outils: OutilsSignalAbsence = {
  t,
  relative: new Intl.RelativeTimeFormat('fr', { numeric: 'auto' }),
  timeOnly: new Intl.DateTimeFormat('fr', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
  dayAndTime: new Intl.DateTimeFormat('fr', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
  dataUpdatedAt: LU_LE,
}
const HEURE = outils.timeOnly.format(new Date(SURVENU))

/** Un rappel tel que la migration du lot le rend : `reminder_type` et `nb_biens` présents, `null` hors relance. */
const ligne = (surcharge: Partial<AbsenceRow>): AbsenceRow => ({
  id: 'reminder:r1', kind: 'reminder', contact_id: 'c7', first_name: 'Emma', last_name: 'Schneider',
  subject: null, motif: null, occurred_at: SURVENU, late: true, ref_id: 'r1',
  reminder_type: null, nb_biens: null,
  ...surcharge,
})

/** Un rappel sans bien : la phrase courte, jamais « dossier un bien à reprendre ». */
const RAPPEL_ANCIEN = 'today.h.absence.reminderDue'

describe('versSignalAbsence — une relance de proposition se consigne, elle ne se reprend pas', () => {
  it('une relance de PROPOSITION désigne son acheteur et compte ses biens sans réponse', () => {
    const s = versSignalAbsence(ligne({ reminder_type: 'follow_up_sent_property', nb_biens: 2 }), outils)
    expect(s.retoursDe).toBe('c7')
    expect(s.text).toBe('today.h.absence.retourAttendu {"count":2}')
    expect(s.type).toBe('rappel')
    // Le mobile ouvre la fiche du contact, sans rien écrire : sa cible doit rester celle-là.
    expect([s.route, s.navRef]).toEqual(['contact-detail', 'c7'])
  })

  it.each<[string, Partial<AbsenceRow>]>([
    ['plus aucun bien sans réponse', { reminder_type: 'follow_up_sent_property', nb_biens: 0 }],
    ['sans contact', { reminder_type: 'follow_up_sent_property', nb_biens: 2, contact_id: null }],
    ['un rappel d’un autre type', { reminder_type: 'custom', nb_biens: null }],
  ])('%s : l’ancien rappel, sans `retoursDe`', (_, surcharge) => {
    const s = versSignalAbsence(ligne(surcharge), outils)
    expect(s.retoursDe).toBeNull()
    expect(s.text).toBe(RAPPEL_ANCIEN)
  })

  it('un rappel qui porte un bien le nomme', () => {
    const s = versSignalAbsence(ligne({ reminder_type: 'custom', subject: 'Villa · Cologny' }), outils)
    expect(s.text).toBe('today.h.absence.reminderDueSubject {"subject":"Villa · Cologny"}')
  })

  it('au bureau, la relance de proposition sort de « Pendant ton absence » : le segment Matching la porte', () => {
    const relance = versSignalAbsence(ligne({ reminder_type: 'follow_up_sent_property', nb_biens: 2 }), outils)
    const rappel = versSignalAbsence(ligne({ id: 'reminder:r2', reminder_type: 'custom', ref_id: 'r2' }), outils)
    expect(absenceDuBureau([relance, rappel]).map((s) => s.id)).toEqual(['reminder:r2'])
  })

  it('une base d’avant la migration (clés absentes) retombe sur l’ancien rappel', () => {
    const avantLeLot: AbsenceRow = {
      id: 'reminder:r1', kind: 'reminder', contact_id: 'c7', first_name: 'Emma', last_name: 'Schneider',
      subject: null, motif: null, occurred_at: SURVENU, late: true, ref_id: 'r1',
    }
    expect('reminder_type' in avantLeLot || 'nb_biens' in avantLeLot).toBe(false)
    const s = versSignalAbsence(avantLeLot, outils)
    expect(s.retoursDe).toBeNull()
    expect(s.text).toBe(RAPPEL_ANCIEN)
  })
})

describe('versSignalAbsence — le vocabulaire d’un retour consigné', () => {
  const refus = (motif: string | null): AbsenceRow =>
    ligne({ id: 'match:m1', kind: 'skip', motif, subject: 'Villa · Cologny', late: false, ref_id: 'm1' })

  it('un refus porte le LIBELLÉ de son motif (`fil.motifs.prix`), jamais le code', () => {
    const s = versSignalAbsence(refus('prix'), outils)
    expect(s.meta).toBe(`${HEURE} · matching:fil.motifs.prix`)
    expect(s.text).toBe('today.h.absence.pasInteresse {"subject":"Villa · Cologny"}')
    expect(s.retoursDe).toBeNull()
  })

  it.each(['recherche_ajustee', 'inconnu', null])('motif %s : aucun motif ajouté', (motif) => {
    expect(versSignalAbsence(refus(motif), outils).meta).toBe(HEURE)
  })

  it('un intérêt se dit `interesse`, plus « a aimé »', () => {
    const s = versSignalAbsence(
      ligne({ id: 'match:m2', kind: 'like', subject: 'Attique · Oerlikon', late: false, ref_id: 'm2' }), outils,
    )
    expect(s.type).toBe('like')
    expect(s.text).toBe('today.h.absence.interesse {"subject":"Attique · Oerlikon"}')
    expect(s.retoursDe).toBeNull()
  })
})
