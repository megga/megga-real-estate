/**
 * Affichage du fil de matchs, hors composants : les teintes qui ENCODENT (le palier d'un score, un critère
 * tenu, un écart), l'encre d'une action en texte, l'écriture d'un montant et d'une date, le style d'une
 * ligne, le signal « prix baissé » (lot B) et les signaux « pourquoi maintenant » (lot C).
 *
 * ⚠ Jamais d'aplat teinté sous du texte : la couleur est portée par une pastille ou une icône, le
 * chiffre et les libellés restent à l'encre. Les couleurs de système de la vitrine sont PÂLES,
 * réglées pour le noir ; en clair l'encre passe par `STATUT_CLAIR` (CLAUDE.md §3, point 4 de
 * « Sombre — échelle MEGGA X »).
 */
import type { CSSProperties, MouseEvent } from 'react'
import type { TFunction } from 'i18next'
import { format } from 'date-fns'
import type { CrmPalette } from '@/components/crm/tokens'
import { MXC_SYSTEM } from '@/components/megga-x-crm/tokens'
import { STATUT_CLAIR } from '@/components/megga-x-crm/statut'
import { formatCHF } from '@/lib/utils'
import type { FilBien, FilMatch, PalierScore } from './filModele'
import { signalPrix } from './filBoucle'
import { signalBien, type SignalBien } from './filSignaux'

/** Pastille du palier : vert, bleu de marque, ou la sourdine. */
export function teinteScore(palier: PalierScore, sp: CrmPalette): string {
  if (palier === 'fort') return sp.isDark ? MXC_SYSTEM.green400 : STATUT_CLAIR.okInk
  if (palier === 'bon') return sp.isDark ? MXC_SYSTEM.blue300 : sp.accent
  return sp.sub
}

/** Un critère tenu, un KYC vérifié. */
export const teinteTenu = (sp: CrmPalette): string => (sp.isDark ? MXC_SYSTEM.green400 : STATUT_CLAIR.okInk)

/** Un écart signalé par le moteur. */
export const teinteEcart = (sp: CrmPalette): string => (sp.isDark ? MXC_SYSTEM.yellow400 : STATUT_CLAIR.warnInk)

/**
 * Encre d'une action en TEXTE, et filet d'un élément ACTIF : sur sombre, l'accent ne passe ni l'AA en
 * texte ni le seuil de 3:1 d'un filet (3,07:1 sur une carte).
 */
export const encreAccent = (sp: CrmPalette): string => (sp.isDark ? MXC_SYSTEM.blue300 : sp.accent)

/** Un montant du bien : « CHF 1'450'000 », ou « CHF 2'950 / mois » pour une location. */
export function montant(location: boolean, valeur: number, t: TFunction): string {
  return location ? t('fil.valeurs.parMois', { valeur: formatCHF(valeur) }) : formatCHF(valeur)
}

/** Le prix d'un bien ; « Non renseigné » sans prix. */
export function prixBien(bien: FilBien, t: TFunction): string {
  return bien.prix == null ? t('fil.valeurs.inconnu') : montant(bien.location, bien.prix, t)
}

/** « 21.09 » : une date du fil — proposition, réponse, relance, retour. */
export const dateCourte = (iso: string): string => format(new Date(iso), 'dd.MM')

/**
 * Le signal « prix baissé » d'un bien (conception de la boucle, §4.6), ou `null` sans baisse mesurée sur
 * `prix_propose`. Long dans un panneau — « Refusé par Antoine à CHF 3'450'000 · baissé de CHF 250'000
 * depuis », ou « Prix baissé de … depuis que vous l'avez proposé » sur un bien sans réponse —, court sur une
 * ligne (« Prix baissé de CHF 250'000 »).
 *
 * ⚠ Aucune tournure « de {{prenom}} » : le français élide devant une voyelle (« d'Antoine », « d'Emma »), et
 * une interpolation ne le sait pas.
 */
export function texteSignal(m: FilMatch, t: TFunction, court = false): string | null {
  const s = signalPrix(m)
  const propose = m.suivi?.prixPropose
  if (!s || propose == null) return null
  const baisse = montant(m.bien.location, s.baisse, t)
  if (court) return t('fil.signal.court', { montant: baisse })
  return s.depuis === 'refus'
    ? t('fil.signal.baisseRefus', { prenom: m.acheteur.prenom, prix: montant(m.bien.location, propose, t), montant: baisse })
    : t('fil.signal.baissePropose', { montant: baisse })
}

/**
 * Le signal « pourquoi maintenant » d'un bien (lot C), écrit : court sur une ligne (« Nouveau sur le marché »),
 * daté dans un panneau (« Prix baissé de CHF 250'000 le 18.09 »).
 */
export function texteSignalBien(s: SignalBien, bien: FilBien, t: TFunction, court = false): string {
  switch (s.genre) {
    case 'baisse': {
      const baisse = montant(bien.location, s.montant, t)
      return court ? t('fil.signal.court', { montant: baisse }) : t('fil.signal.baisseMarche', { montant: baisse, date: dateCourte(s.le) })
    }
    case 'nouveau':
      return court ? t('fil.signal.nouveauCourt') : t('fil.signal.nouveau', { date: dateCourte(s.le) })
    case 'mandat':
      return court ? t('fil.signal.mandatCourt') : t('fil.signal.mandat', { date: dateCourte(s.le) })
  }
}

/** Le signal d'un match, écrit : le sien d'abord (lot B — il parle de CET acheteur), sinon celui de son bien. */
export function texteSignalMatch(m: FilMatch, t: TFunction, maintenant: number, court = false): string | null {
  const propre = texteSignal(m, t, court)
  if (propre) return propre
  const s = signalBien(m.bien, maintenant)
  return s ? texteSignalBien(s, m.bien, t, court) : null
}

/**
 * Marge droite des panneaux du fil : les points de page du pager (`MatchingPage`) flottent au bord
 * droit, et recouvraient le grand score et le bouton principal.
 */
export const MARGE_POINTS = 'calc(var(--crm-space-7xl) + var(--crm-space-lg))'

/** Une ligne du fil — match, sélection, correction, acheteur en attente — choisie ou non. */
export function styleLigne(sp: CrmPalette, active: boolean): CSSProperties {
  return {
    width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', textAlign: 'left',
    padding: 'var(--crm-space-sm) var(--crm-space-lg)', border: 0, borderRadius: 'var(--crm-radius-md)',
    cursor: 'pointer', fontFamily: 'inherit', color: sp.ink,
    background: active ? sp.focusSurface : 'transparent',
    // Le fond RÉEL de la ligne (transparente, elle montre celui de la colonne) : la règle `:hover` le
    // reprend, et l'anneau des vignettes empilées le lit.
    ['--fil-fond' as string]: active ? sp.focusSurface : sp.frameBg,
    // L'élément ACTIF porte l'accent (CLAUDE.md §3), en filet : sur sombre l'accent brut tombe sous 3:1.
    boxShadow: active ? `inset 0 0 0 1px ${encreAccent(sp)}` : 'none',
  }
}

/**
 * LA garde anti-double-clic du fil, la seule : lignes, boutons de geste, puces de motif, barre d'annulation,
 * sélection du marché.
 *
 * ⛔ Le second clic d'un double clic tombe sur ce que le premier a fait apparaître ou déplacer sous le
 * curseur (une ligne qui glisse, un bouton qui la remplace, la ligne découverte quand la barre d'annulation
 * se retire) : `detail` compte les clics du même geste, 2 au second, quel que soit l'élément qui les reçoit.
 * L'activation clavier, elle, porte `detail: 0` et n'est jamais concernée.
 */
export const secondClic = (e: { detail: number }): boolean => e.detail > 1

/**
 * Un clic gardé par `secondClic`. ⚠ Un gestionnaire qui lit une ref (`FilSelection`) teste `secondClic` lui-même :
 * passé à une fonction pendant le rendu, il ferait croire au compilateur React une lecture de ref au rendu.
 */
export const unSeulClic = (faire: () => void) => (e: MouseEvent): void => { if (secondClic(e)) return; faire() }
