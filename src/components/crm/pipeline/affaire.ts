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
import { JOURS_SILENCE, joursJusqua, loyerCourt, montantCourt } from './phases'

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
