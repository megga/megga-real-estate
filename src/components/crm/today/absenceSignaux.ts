/**
 * « Pendant ton absence » — la traduction PURE d'une ligne de `today_absence()` en signal affichable : ni React, ni
 * Supabase. Le SQL rend des données, l'i18n rend des phrases ; le hook (`useAbsenceSignals`) lit, écarte et groupe.
 *
 * Sortie telle quelle du `useMemo` du hook (lot D1) pour être éprouvée seule (`tests/unit/absence-signaux.spec.ts`) :
 * c'est ici qu'une relance de PROPOSITION se reconnaît, et `retoursDe` décide si « Reprendre » peut écrire.
 */
import { cleMotif } from '@/components/matching-fil/filBoucle'
import type { HlSignalData } from './dataH'

/** Palette d'avatars du prototype — déterministe sur l'identifiant du contact. */
const AV_PALETTE = ['#5b6cff', '#9b7cf0', '#39B7C9', '#E08A45', '#34C796', '#8B5CF6', '#2370ff', '#c0566b']

function avatarColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return AV_PALETTE[Math.abs(h) % AV_PALETTE.length]
}

function initialsOf(first: string | null, last: string | null): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '??'
}

/** Une ligne de `today_absence()`. */
export interface AbsenceRow {
  id: string
  kind: 'like' | 'skip' | 'reminder'
  contact_id: string | null
  first_name: string | null
  last_name: string | null
  subject: string | null
  motif: string | null
  occurred_at: string
  late: boolean
  ref_id: string
  /**
   * Le type du rappel (`today_absence`, lot D1) ; `null` pour une réaction. La clé n'est ABSENTE que sur une base
   * d'avant la migration du lot : le signal retombe alors sur l'ancien rappel, et « Reprendre » rejoue l'ancienne
   * clôture — la migration doit être posée avant la fusion.
   */
  reminder_type?: string | null
  /** Les biens encore sans réponse d'une relance de proposition. */
  nb_biens?: number | null
}

export interface AbsenceSignal extends HlSignalData {
  /** Cible de deep-link du CTA, et sa référence réelle. */
  route: string
  navRef?: string
  /** Identifiant de la LIGNE d'origine (rappel ou match) — cible du geste. */
  refId: string
  /**
   * L'acheteur d'une relance de PROPOSITION (lot D1) : elle ne se « reprend » pas, elle se consigne — « Retours de … »
   * dans le fil. `null` pour tout autre signal.
   */
  retoursDe: string | null
}

/** Une clé et ses valeurs (`ns` compris) rendent une phrase : le `t` du hook, ou le faux `t` de la spec. */
type Traduire = (cle: string, valeurs?: Record<string, unknown>) => string

/** Ce que la traduction d'une ligne emprunte au hook : `t`, ses formats de date, et l'instant de la lecture. */
export interface OutilsSignalAbsence {
  t: Traduire
  relative: Intl.RelativeTimeFormat
  timeOnly: Intl.DateTimeFormat
  dayAndTime: Intl.DateTimeFormat
  /** L'instant du FETCH (`dataUpdatedAt` de la requête), jamais l'horloge lue au rendu. */
  dataUpdatedAt: number
}

/** Une ligne de `today_absence()` → son signal : la phrase, l'horodatage, le geste et sa cible. */
export function versSignalAbsence(
  r: AbsenceRow, { t, relative, timeOnly, dayAndTime, dataUpdatedAt }: OutilsSignalAbsence,
): AbsenceSignal {
  const first = r.first_name?.trim() || ''
  const who = [first, r.last_name?.trim() || ''].filter(Boolean).join(' ') || t('today.h.absence.unknownContact')
  const subject = r.subject?.trim() || t('today.h.absence.unknownProperty')
  const when = new Date(r.occurred_at)
  // Référence de temps = l'instant du FETCH, pas l'horloge lue au rendu :
  // lire l'heure pendant le rendu est impur (deux rendus, deux résultats).
  // `dataUpdatedAt` est stable entre deux refetch et décrit exactement ce
  // que le libellé prétend décrire : la donnée telle qu'elle a été reçue.
  const daysAgo = Math.round((when.getTime() - dataUpdatedAt) / 86_400_000)

  // Moins de 24 h → l'heure ; hier → « hier 21:47 » ; au-delà → jour + heure.
  const meta = daysAgo === 0
    ? timeOnly.format(when)
    : daysAgo === -1
      ? `${relative.format(-1, 'day')} ${timeOnly.format(when)}`
      : dayAndTime.format(when)

  const cle = cleMotif(r.motif)
  const motifLibelle = cle ? t(cle, { ns: 'matching' }) : null
  if (r.kind === 'like') {
    return {
      id: r.id, type: 'like' as const, who, initials: initialsOf(r.first_name, r.last_name),
      av: avatarColor(r.contact_id || r.id),
      text: t('today.h.absence.interesse', { subject }),
      meta, late: false,
      cta: t('today.h.absence.ctaProposeVisit'),
      route: 'contact-detail', navRef: r.contact_id ?? undefined, refId: r.ref_id,
      retoursDe: null,
    }
  }
  if (r.kind === 'skip') {
    return {
      id: r.id, type: 'skip' as const, who, initials: initialsOf(r.first_name, r.last_name),
      av: avatarColor(r.contact_id || r.id),
      text: t('today.h.absence.pasInteresse', { subject }),
      // Le motif du refus est la donnée la plus utile du signal : il dit POURQUOI recalibrer. LIBELLÉ (lot D1) —
      // il s'affichait en code brut (« prix »).
      meta: motifLibelle ? `${meta} · ${motifLibelle}` : meta,
      late: false,
      cta: t('today.h.absence.ctaRecalibrate'),
      route: 'contact-detail', navRef: r.contact_id ?? undefined, refId: r.ref_id,
      retoursDe: null,
    }
  }
  // Une relance de PROPOSITION dit ses biens sans réponse, et « Reprendre » ouvre « Retours de … » (lot D1).
  const proposition = r.reminder_type === 'follow_up_sent_property' && !!r.contact_id && (r.nb_biens ?? 0) > 0
  return {
    id: r.id, type: 'rappel' as const, who, initials: initialsOf(r.first_name, r.last_name),
    av: avatarColor(r.contact_id || r.id),
    text: proposition ? t('today.h.absence.retourAttendu', { count: r.nb_biens ?? 0 }) : t('today.h.absence.reminderDue', { subject }),
    meta, late: r.late,
    cta: t('today.h.absence.ctaResume'),
    route: 'contact-detail', navRef: r.contact_id ?? undefined, refId: r.ref_id,
    retoursDe: proposition ? r.contact_id : null,
  }
}
