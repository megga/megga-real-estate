/**
 * Le journal d'audit agent en fonctions pures : les jours, les rafales, ce qu'une ligne
 * dit (sujet, acteur, heure) et ce que la recherche lit.
 *
 * Sorties de la page pour être éprouvées sans monter la coquille du CRM
 * (`audit-journal-lignes.spec.ts`).
 *
 * ⚠ Le TITRE et le SUJET sont ceux de la cloche (`auditActionLabel`, `detailFor`) : le
 * journal est l'historique complet de ces mêmes événements — « Voir tout l'historique »
 * y mène —, et un événement doit s'y reconnaître au premier coup d'œil.
 */
import { format } from 'date-fns'
import i18n from '@/i18n'
import { detailFor } from '@/hooks/useAgentNotifications'
import { acteurDetacheProuve, auditActeur } from '@/lib/auditActor'
import { auditActionLabel } from '@/lib/auditActionLabel'
import { dfLocale, majusculeInitiale } from '@/lib/utils'
import { AUDIT_CATEGORIES } from '../tokens'
import type { AuditEvent } from '@/types/kyc'

/** Un jour du journal : sa clé (date locale `yyyy-MM-dd`), son libellé, ses événements. */
export interface JourJournal {
  cle: string
  libelle: string
  events: AuditEvent[]
}

/** Une ligne affichée : un événement, ou une RAFALE (≥ 2) résumée par sa tête. */
export interface LigneJournal {
  tete: AuditEvent
  events: AuditEvent[]
}

const cleDuJour = (d: Date) => format(d, 'yyyy-MM-dd')

/**
 * Range les événements par jour LOCAL, du plus récent au plus ancien. « Aujourd'hui » et
 * « Hier » par leur nom ; au-delà, le jour en toutes lettres — l'année seulement quand ce
 * n'est pas celle en cours.
 */
export function grouperParJour(
  events: readonly AuditEvent[],
  noms: { today: string; yesterday: string },
  maintenant: Date = new Date(),
): JourJournal[] {
  const aujourdhui = cleDuJour(maintenant)
  const hier = cleDuJour(new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() - 1))
  const jours = new Map<string, JourJournal>()
  for (const e of events) {
    const d = new Date(e.created_at)
    const cle = cleDuJour(d)
    let jour = jours.get(cle)
    if (!jour) {
      const libelle = cle === aujourdhui ? noms.today
        : cle === hier ? noms.yesterday
          : majusculeInitiale(format(d, d.getFullYear() === maintenant.getFullYear() ? 'EEEE d MMMM' : 'EEEE d MMMM yyyy', { locale: dfLocale() }))
      jour = { cle, libelle, events: [] }
      jours.set(cle, jour)
    }
    jour.events.push(e)
  }
  const tries = [...jours.values()].sort((a, b) => b.cle.localeCompare(a.cle))
  for (const j of tries) j.events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return tries
}

/**
 * Regroupe les RAFALES d'un même jour : des événements consécutifs de la même action,
 * du même acteur et de la même sévérité, SANS sujet. Mesuré en production :
 * `match_suggested` arrive par lots d'une passe du moteur, à la même seconde, et le
 * relais du copilote WhatsApp par dizaines — trente lignes identiques qui ne disent rien
 * de plus qu'une seule « ×30 », dépliable.
 *
 * ⛔ Plus strict que la cloche (`regrouper`), et c'est voulu : un journal dit QUI a agi.
 * Deux acteurs différents ne se fondent jamais en une ligne, et un événement qui a un
 * sujet reste seul — le regrouper effacerait l'information qu'il porte.
 */
export function rafales(events: readonly AuditEvent[]): LigneJournal[] {
  const lignes: LigneJournal[] = []
  for (const e of events) {
    const p = lignes[lignes.length - 1]?.tete
    const meme = p && !e.object_label && !p.object_label && p.action === e.action
      && p.actor_kind === e.actor_kind && p.actor_id === e.actor_id && p.severity === e.severity
    if (meme) lignes[lignes.length - 1].events.push(e)
    else lignes.push({ tete: e, events: [e] })
  }
  return lignes
}

/**
 * Le libellé TRADUIT de la catégorie — jamais sa valeur brute : `messaging` s'affichait
 * tel quel avant que le front ne connaisse les dix catégories du CHECK.
 */
export function libelleCategorie(e: Pick<AuditEvent, 'category'>): string {
  return (e.category && AUDIT_CATEGORIES[e.category]?.label) || '—'
}

/**
 * Le nom de qui a agi : le collègue quand la page le connaît (`noms`, id → nom), sinon
 * le rôle. « Compte supprimé » sur PREUVE seulement (`actor_detached_from`) — sans elle,
 * l'émetteur a juste omis `actor_kind` (src/lib/auditActor.ts).
 */
export function libelleActeur(
  e: Pick<AuditEvent, 'actor_id' | 'actor_kind' | 'metadata'>,
  noms?: ReadonlyMap<string, string>,
): string {
  const acteur = auditActeur(e)
  if (acteur === 'ai') return i18n.t('common:audit.actor.ai')
  if (acteur === 'system') return i18n.t('common:audit.actor.system')
  if (acteur === 'agent') return (e.actor_id && noms?.get(e.actor_id)) || i18n.t('common:audit.actor.agent')
  return i18n.t(acteurDetacheProuve(e) ? 'common:audit.actor.agentDetached' : 'common:audit.actor.agentUnknown')
}

/** L'heure d'une ligne (« 14:32 ») — le jour est dans l'en-tête de son groupe. */
export const heureDe = (iso: string) => format(new Date(iso), 'HH:mm')

/** L'horodatage complet du détail, à la seconde (« Lundi 14 septembre 2026 · 14:32:07 »). */
export const horodatage = (iso: string) =>
  majusculeInitiale(format(new Date(iso), "EEEE d MMMM yyyy '·' HH:mm:ss", { locale: dfLocale() }))

/** Casse et accents pliés : « cree » trouve « Contact créé ». */
const plier = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * La recherche du journal — sur ce que l'agent VOIT : le titre traduit, le sujet, le nom
 * de l'acteur, la catégorie ; plus le code de l'action, l'IP et les métadonnées. Chaque
 * mot doit s'y trouver (« camille visite »).
 *
 * ⚠ Elle ne lisait que le code brut : « Contact créé », le texte même de la ligne, ne
 * trouvait rien — il fallait taper `contact_created`.
 */
export function correspondRecherche(e: AuditEvent, recherche: string, nomActeur = ''): boolean {
  const mots = plier(recherche).split(/\s+/).filter(Boolean)
  if (mots.length === 0) return true
  const texte = plier([
    auditActionLabel(e.action), e.action, detailFor(e), e.object_label ?? '', nomActeur,
    libelleCategorie(e), e.ip_address ?? '', JSON.stringify(e.metadata ?? {}),
  ].join(' '))
  return mots.every((m) => texte.includes(m))
}
