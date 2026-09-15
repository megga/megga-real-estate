// supabase/functions/_shared/calendar-events.ts
// Les ÉVÉNEMENTS du Calendrier (`calendar_events`, 20260915080300) lus par le SERVEUR : ceux
// d'une journée, séries comprises. PUR : aucun import runtime — tourne sous Vitest.
//
// ⛔ POURQUOI. Avant cette table, un rendez-vous saisi au Calendrier partait en `reminders` : le
// brief WhatsApp du matin, le briefing du copilote et `suggest_priorities_today` le voyaient.
// Ils ne lisaient que `reminders` — le rendez-vous chez le notaire sortait de la matinée de
// l'agent (revue du 15.09.2026).
//
// ⚠ Une SÉRIE est une seule ligne : ses occurrences se calculent comme au Calendrier
// (`calExpandEvents`) — même pas, même ancrage mensuel, mêmes clés `AAAA-M-J` pour les
// occurrences retirées (`sauf`) et leur statut (`etats`). Le Calendrier compte en heure locale
// de l'agent ; le serveur, en heure de Zurich.

const ZURICH = 'Europe/Zurich'
const JOUR = 86_400_000

/** Ce que le serveur lit d'un événement pour savoir s'il tombe dans la journée. */
export interface EvenementServeur {
  type: string
  starts_at: string
  status: string | null
  recurrence: unknown
}

interface Serie {
  freq: 'daily' | 'weekly' | 'biweekly' | 'monthly'
  until?: string | null
  sauf?: string[] | null
  etats?: Record<string, string> | null
}

function serie(r: unknown): Serie | null {
  if (!r || typeof r !== 'object') return null
  const freq = (r as { freq?: unknown }).freq
  return freq === 'daily' || freq === 'weekly' || freq === 'biweekly' || freq === 'monthly' ? r as Serie : null
}

/**
 * Le filtre PostgREST (`.or(…)`) des lignes qui PEUVENT avoir une occurrence dans [début, fin) :
 * les ponctuels qui y commencent, et les séries nées avant la fin.
 */
export function filtreEvenementsDuJour(debutIso: string, finIso: string): string {
  return `and(starts_at.gte.${debutIso},starts_at.lt.${finIso}),and(recurrence.not.is.null,starts_at.lt.${finIso})`
}

interface Parties { y: number; m: number; d: number; h: number; mi: number }

function partiesLocales(instant: Date): Parties {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZURICH, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant)
  const lire = (t: string) => Number(p.find((x) => x.type === t)?.value ?? '0')
  return { y: lire('year'), m: lire('month'), d: lire('day'), h: lire('hour'), mi: lire('minute') }
}

/** L'instant d'une heure MURALE de Zurich, décalage d'été compris. */
function instantLocal(j: Parties, h: number, mi: number): Date {
  const brut = Date.UTC(j.y, j.m - 1, j.d, h, mi)
  const lu = partiesLocales(new Date(brut))
  return new Date(brut - (Date.UTC(lu.y, lu.m - 1, lu.d, lu.h, lu.mi) - brut))
}

const jourUtc = (p: Parties) => Date.UTC(p.y, p.m - 1, p.d)

/**
 * Les occurrences de [début, fin) — une journée —, triées, chacune avec son instant de début
 * (`debut`). Un événement clos (fait, annulé), une occurrence retirée de sa série ou close à
 * elle seule n'y figurent pas.
 */
export function occurrencesDuJour<T extends EvenementServeur>(lignes: T[], debutIso: string, finIso: string): Array<T & { debut: string }> {
  const debut = new Date(debutIso).getTime()
  const fin = new Date(finIso).getTime()
  const dans = (t: number) => t >= debut && t < fin
  // Les jours LOCAUX que touche la fenêtre : un seul pour une journée de Zurich, deux pour une
  // journée UTC (celle du copilote).
  const jours = [partiesLocales(new Date(debut)), partiesLocales(new Date(fin - 1))]
    .filter((j, i, tous) => i === 0 || jourUtc(j) !== jourUtc(tous[0]))
  const out: Array<T & { debut: string }> = []
  for (const l of lignes) {
    if (l.status === 'done' || l.status === 'cancelled') continue
    const depart = new Date(l.starts_at)
    const rec = serie(l.recurrence)
    if (!rec) {
      if (dans(depart.getTime())) out.push({ ...l, debut: depart.toISOString() })
      continue
    }
    const s = partiesLocales(depart)
    const jusqua = rec.until ? new Date(rec.until).getTime() : Infinity
    for (const j of jours) {
      const ecart = (jourUtc(j) - jourUtc(s)) / JOUR
      if (ecart < 0) continue
      const tombe = rec.freq === 'daily' ? true
        : rec.freq === 'weekly' ? ecart % 7 === 0
          : rec.freq === 'biweekly' ? ecart % 14 === 0
            // Ancré sur le jour du mois de départ, borné au mois (31 janv. → 28 févr.).
            : j.d === Math.min(s.d, new Date(Date.UTC(j.y, j.m, 0)).getUTCDate())
      if (!tombe) continue
      const cle = `${j.y}-${j.m}-${j.d}`
      const etat = rec.etats?.[cle]
      if (rec.sauf?.includes(cle) || etat === 'done' || etat === 'cancelled') continue
      const occ = instantLocal(j, s.h, s.mi).getTime()
      if (dans(occ) && occ <= jusqua) out.push({ ...l, debut: new Date(occ).toISOString() })
    }
  }
  return out.sort((a, b) => a.debut.localeCompare(b.debut))
}
