/**
 * Ce qu'une affaire DIT, hors de tout composant — l'icône de son action, le lieu de son bien, la
 * ligne 2, le montant, le jour d'une échéance. Partagé par la carte du Kanban et la ligne de
 * l'agenda : une même affaire doit se lire pareil dans les deux vues (proposition du 27.09.2026).
 *
 * ⚠ Module sans composant : un fichier qui exporte un composant ET des fonctions casse le
 * rafraîchissement à chaud (`react-refresh/only-export-components`).
 */
import type { MEIconName } from '@/components/propertyx/MEIcon'
import type { CrmBien, CrmContact, CrmDeal } from '../mockData'
import type { VisitSlot } from './CardQuickActions'
import { JOURS_SILENCE, joursJusqua, loyerCourt, montantCourt } from './phases'

/** Un jour qu'offrent les menus « Replanifier » / « Planifier ». */
export type ChoixJour = 'aujourdhui' | 'demain' | 'apresDemain' | 'lundi' | 'semaine'

/**
 * Les jours d'une (re)planification : des gestes, pas un calendrier — la pastille de la Timeline,
 * la fiche et le menu du clic droit proposent les mêmes. ⚠ Un même jour ne s'offre qu'une fois :
 * un dimanche, « Lundi » EST « Demain ». « Aujourd'hui » seulement pour une première action.
 */
export function joursProposes(avecAujourdhui: boolean): { cle: ChoixJour; jours: number }[] {
  const tous: { cle: ChoixJour; jours: number }[] = [
    { cle: 'aujourdhui', jours: 0 },
    { cle: 'demain', jours: 1 },
    { cle: 'apresDemain', jours: 2 },
    { cle: 'lundi', jours: ((8 - new Date().getDay()) % 7) || 7 },
    { cle: 'semaine', jours: 7 },
  ]
  return tous
    .filter((c) => avecAujourdhui || c.cle !== 'aujourdhui')
    .filter((c, i, liste) => liste.findIndex((x) => x.jours === c.jours) === i)
}

/** L'échéance replanifiée dans N jours : l'heure de l'échéance d'avant gardée, 10 h pour une première. */
export function echeanceDans(jours: number, avant: string | null): Date {
  const d = new Date()
  d.setDate(d.getDate() + jours)
  if (avant) { const h = new Date(avant); d.setHours(h.getHours(), h.getMinutes(), 0, 0) } else d.setHours(10, 0, 0, 0)
  return d
}

/** Les quatre créneaux de « Planifier une visite » : J+1 10 h et 14 h, J+2 11 h, J+3 16 h. */
export function creneauxDeVisite(langue: string, demain: string): VisitSlot[] {
  const weekday = new Intl.DateTimeFormat(langue, { weekday: 'long' })
  const fmt = (d: Date) => `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}`
  const mk = (addDays: number, time: string): VisitSlot => {
    const d = new Date()
    d.setDate(d.getDate() + addDays)
    const [h, m] = time.split(':').map(Number)
    d.setHours(h, m, 0, 0)
    const raw = weekday.format(d)
    const dayName = addDays === 1 ? demain : raw.charAt(0).toUpperCase() + raw.slice(1)
    return { label: `${addDays}-${time}`, day: `${dayName} ${fmt(d)}`, time, at: d }
  }
  return [mk(1, '10:00'), mk(1, '14:00'), mk(2, '11:00'), mk(3, '16:00')]
}

/** L'icône d'une prochaine action, par `reminders.kind` — les six valeurs que la base accepte. */
export function iconeAction(kind: string): MEIconName {
  if (kind === 'call') return 'phone'
  if (kind === 'visit') return 'home'
  if (kind === 'kyc') return 'shield'
  if (kind === 'match') return 'sparkle'
  if (kind === 'offer') return 'banknote'
  return 'flag'
}

/** Le lieu d'un bien, ce qui le distingue en quatre lettres : ce qui suit « · » dans le titre. */
function localite(bien: CrmBien): string {
  const i = bien.title.lastIndexOf(' · ')
  return i >= 0 ? bien.title.slice(i + 3) : bien.city || bien.addr
}

/**
 * Ce que dit la ligne 2 d'une carte quand le stade n'y figure pas (phase à stade unique) — UNE
 * information : le lieu du bien ; sans bien, le silence d'une affaire qui dort ; sinon le budget
 * recherché, sans sa ville (Julien, 28.09.2026 : une seule information).
 */
export function contexteAffaire(
  deal: CrmDeal, contact: CrmContact, bien: CrmBien | null, langue: string, silence: (jours: number) => string,
): string | null {
  if (bien) return localite(bien)
  const jours = -joursJusqua(deal.updatedAt)
  if (jours >= JOURS_SILENCE) return silence(jours)
  const c = contact.criteria
  if (!c?.budgetMax) return null
  return `≤ ${montantCourt(c.budgetMax, langue)}`
}

/** Le montant de la carte, loyer compris — une location ne s'additionne pas aux ventes. */
export function montantDeCarte(deal: CrmDeal, bien: CrmBien | null, langue: string, parMois: string): string | null {
  if (!deal.value) return null
  if (bien?.transaction === 'location') return `${loyerCourt(deal.value)} ${parMois}`
  return montantCourt(deal.value, langue)
}

/** Le jour d'une échéance lointaine, écrit comme le reste du CRM : « Mar. 29 ». */
export function jourCourt(iso: string, langue: string): string {
  const d = new Date(iso)
  const j = new Intl.DateTimeFormat(langue, { weekday: 'short' }).format(d)
  return `${j.charAt(0).toUpperCase()}${j.slice(1)} ${d.getDate()}`
}

/**
 * L'arrivée d'une affaire née de « Nouveau deal » : `attente` tant que la modale est là (invisible,
 * sa place déjà prise), `atterrit` quand elle se retire. Absente pour toutes les autres.
 */
export type Arrivee = 'attente' | 'atterrit'

/** Hauteur réservée au toast du bas (`CapsuleToast`) : ce qui y tombe est caché par lui. */
const SOUS_LE_TOAST = 120

/**
 * Amène à l'écran un élément qui vient de naître — une carte, une ligne d'agenda — s'il en sort
 * ou tombe sous le toast qui annonce sa création. Déjà bien visible, il ne bouge pas : un
 * défilement que rien ne justifie désoriente plus qu'il ne montre.
 */
export function amenerALaVue(el: HTMLElement | null): void {
  if (!el) return
  const r = el.getBoundingClientRect()
  const cachee = r.top < 0 || r.bottom > window.innerHeight - SOUS_LE_TOAST || r.left < 0 || r.right > window.innerWidth
  if (cachee) el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
}
