// MEGGA CRM Sugar v3 — Design tokens (Sugar Pure direction)
// Port pixel-près de docs/handoff/sprint-1-kyc (README + MEGGA-DESIGN-SYSTEM.md).
//
// — Fond gris très clair avec radial gradient vers bleu pâle en bas
// — Cards blanches pures, ombres signature, coins 22-28px, AUCUNE bordure décorative
// — Accent unique = NOIR PUR #0B0C0E (pas de bleu, pas de violet, pas de gradient)
// — Typo Inter Tight avec tabular-nums sur tous les nombres
// — CHF avec apostrophes : CHF 1'250'000

import type { KycCheckCategory, KycDossierStatus } from '@/types/kyc'
import { sgVoileEncre } from '@/components/crm-sugar/tokens'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'
// i18n : les libellés des maps (contrôles/statuts/risque KYC + catégories audit)
// sont traduits au render via getter singleton (clés kyc:* / common:audit.category.*).
// Les tonalités/icônes restent fixes.
import i18n from '@/i18n'

export const SugarV3 = {
  // Fond — radial doux du clair vers bleu-gris pâle
  bg: '#EDEFF3',
  bgGradient:
    'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',

  // Surfaces
  card: '#FFFFFF',
  cardSubtle: '#F7F8FA',

  // ⛔ ACCENT — la règle du 10 août 2026 : l'élément ACTIF porte `#424bfb`.
  // `black` appliquait l'ancienne règle de Sugar Pure (« l'accent EST l'encre »),
  // qui peint l'actif en non-couleur.
  //
  // ⚠ PAS de variante de survol, et c'est une MESURE, pas un oubli : la feuille
  // de la vitrine ne donne à `.primary-button:hover` qu'un `scale3d(1.04)` —
  // aucun changement de couleur. Le survol de l'accent est GÉOMÉTRIQUE. En
  // inventer une teinte aurait été ajouter un barreau que la direction n'a pas.
  accent: MXC_COLOR.accent,
  /*
   * ⛔ `black` et `blackHover` ONT ÉTÉ RETIRÉS le 16 août 2026 (lot 2 du chantier
   * KYC). Le sursis annonçait 13 lecteurs « dans des surfaces dont le lot n'est
   * pas encore passé » — mesuré à l'ouverture du lot, il en restait DOUZE, et
   * toutes leurs surfaces étaient déjà balayées par le cliquet. Le verrou était
   * périmé, et c'est le fichier de jetons qui restait dehors, pas ses lecteurs.
   *
   * Répartition appliquée, site par site, selon la règle que ce fichier énonçait
   * déjà — `accent` pour une affordance, `ink` pour ce qui ne fait qu'écrire :
   *
   *   · DIX affordances → `accent` : les quatre états sélectionnés de
   *     `MlkAgentModal`, les CTA « Signer » (`VdShared`), les deux CTA de
   *     `VisitModalSugarV3Page`, l'accent d'`AuditSugarPage`, le mode édition et
   *     le CTA de fermeture d'`ImportLeadSugarV3Page`.
   *   · DEUX qui ENCODENT → `ink`, et c'est le seul geste qui préserve leur
   *     sens : la teinte de la catégorie d'audit `auth` (huit catégories, huit
   *     teintes — la peindre en accent l'aurait rendue indiscernable du bleu
   *     `#1E5BC6` de `kyc`), et l'aplat d'avatar de l'acteur SYSTÈME, qui se
   *     distingue de l'acteur humain (`inkSoft`) précisément par sa teinte. Les
   *     repeindre en accent aurait fait MENTIR une marque de donnée.
   *
   * Changement d'ALPHABET, pas de sens : `#0B0C0E` → `MXC_COLOR.n100`. Même
   * geste que le pôle d'encre du Pipeline — ce n'est pas la teinte qui portait
   * l'information, c'est son point de fuite.
   */

  // Texte
  ink: MXC_COLOR.n100,
  inkSoft: '#3A3D44',
  /**
   * ⛔ `#7A8088` NE PASSAIT PAS L'AA, et c'est l'encre la plus employée de cet
   * objet : 3,98:1 sur sa propre carte blanche, sur **66 sites en `color:`**
   * répartis dans cinq surfaces (Visites, Audit, Import lead, wizard KYC,
   * primitives partagées). Le défaut était connu depuis six lots et laissé de
   * côté — le corriger depuis un lot KYC aurait repeint quatre écrans hors
   * périmètre, et rendu tout diff inattribuable.
   *
   * `n500` est le barreau que MEGGA X donne à l'encre secondaire claire :
   * 5,57:1 sur la carte, 5,24 sur la sous-carte. Gardé par
   * `sugar-v3-contraste.spec.ts`.
   */
  muted: MXC_COLOR.n500,
  /**
   * ⚠ REPOS, PAS ENCRE — 1,95:1, il ne peut pas porter de texte. Ses trois
   * emplois légitimes sont des APLATS (remplissage d'un contrôle désactivé) ;
   * le seul site qui s'en servait pour écrire est passé à `muted`.
   */
  ghost: '#B5BAC2',

  // Ombres signature Sugar
  shadowSm: `0 4px 16px ${sgVoileEncre(false, 0.04)}`,
  shadow: `0 12px 40px ${sgVoileEncre(false, 0.06)}, 0 2px 8px ${sgVoileEncre(false, 0.03)}`,
  shadowLg: `0 24px 60px ${sgVoileEncre(false, 0.08)}, 0 4px 16px ${sgVoileEncre(false, 0.04)}`,
  shadowHover: `0 32px 70px ${sgVoileEncre(false, 0.10)}, 0 6px 20px ${sgVoileEncre(false, 0.05)}`,

  // États (utilitaires uniquement, jamais décoratifs — micro-pastilles ≤7×7px)
  ok: '#10B981',
  warn: '#F59E0B',
  err: '#EF4444',
  okDark: '#0E9F6E', // utilisé pour le score risque faible dans CtKyc
  errDark: '#E53935',
  /**
   * Les variantes FONCÉES existent pour le TEXTE : une teinte sémantique reste
   * vive sur un aplat, mais une encre illisible n'encode plus rien. Mêmes valeurs
   * que `EtatVide` et le rapport PDF, qui les avaient déjà mesurées pour le clair
   * — `#B91C1C` rend 6,47:1, `#B45309` rend 5,02:1.
   */
  errDarker: '#B91C1C',
  warnDarker: '#B45309',

  // Backgrounds soft pour pastilles statut (jamais pour cards)
  okSoft: '#E5F4EC',
  warnSoft: '#FFF4E0',
  errSoft: 'rgba(239,68,68,0.10)',

  // Police
  font: '"Inter Tight", system-ui, sans-serif',
} as const
// ─── Animations keyframe (à injecter dans le DOM via <style>) ──────────
// Animation d'entrée signature Sugar : .5s cubic-bezier(.2,.8,.2,1) both
export const SUGAR_V3_KEYFRAMES = `
@keyframes sgFadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
`

// ─── Formatters ─────────────────────────────────────────────────────────

/** Formate une date en `12 avr. 2026`. */
export function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-CH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Formate une date + heure : `12 avr · 14:30`. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-CH', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Labels canoniques (handoff §Modèle de données) ─────────────────────

/** Les 5 contrôles LBA art. 3-7. */
export const KYC_CHECK_LABELS: Record<
  KycCheckCategory,
  { title: string; sub: string }
> = {
  id: {
    get title() { return i18n.t('kyc:check.id.title') },
    get sub() { return i18n.t('kyc:check.id.sub') },
  },
  address: {
    get title() { return i18n.t('kyc:check.address.title') },
    get sub() { return i18n.t('kyc:check.address.sub') },
  },
  pep: {
    get title() { return i18n.t('kyc:check.pep.title') },
    get sub() { return i18n.t('kyc:check.pep.sub') },
  },
  sanctions: {
    get title() { return i18n.t('kyc:check.sanctions.title') },
    get sub() { return i18n.t('kyc:check.sanctions.sub') },
  },
  funds: {
    get title() { return i18n.t('kyc:check.funds.title') },
    get sub() { return i18n.t('kyc:check.funds.sub') },
  },
}

/** Labels + pastilles colorées pour les 5 statuts dossier (handoff). */
export const KYC_STATUS_LABELS: Record<
  KycDossierStatus,
  { label: string; tone: string }
> = {
  none: { get label() { return i18n.t('kyc:dossierStatus.none') }, tone: SugarV3.muted },
  pending: { get label() { return i18n.t('kyc:dossierStatus.pending') }, tone: SugarV3.warn },
  verified: { get label() { return i18n.t('kyc:dossierStatus.verified') }, tone: SugarV3.ok },
  failed: { get label() { return i18n.t('kyc:dossierStatus.failed') }, tone: SugarV3.err },
  stale: { get label() { return i18n.t('kyc:dossierStatus.stale') }, tone: SugarV3.warn },
}

/** Labels risque 3 niveaux (handoff). */
export const KYC_RISK_LABELS: Record<
  'low' | 'medium' | 'high' | 'unassessed',
  { label: string; tone: string }
> = {
  low: { get label() { return i18n.t('kyc:riskBadge.low') }, tone: SugarV3.ok },
  medium: { get label() { return i18n.t('kyc:riskBadge.medium') }, tone: SugarV3.warn },
  high: { get label() { return i18n.t('kyc:riskBadge.high') }, tone: SugarV3.err },
  unassessed: { get label() { return i18n.t('kyc:riskBadge.unassessed') }, tone: SugarV3.muted },
}

/** Catégories audit nLPD — 8 valeurs (KYC_ENRICHISSEMENTS §7). */
export const AUDIT_CATEGORIES: Record<
  string,
  { label: string; tone: string }
> = {
  kyc: { get label() { return i18n.t('common:audit.category.kyc') }, tone: '#1E5BC6' },
  deal: { get label() { return i18n.t('common:audit.category.deal') }, tone: '#0891B2' },
  contact: { get label() { return i18n.t('common:audit.category.contact') }, tone: SugarV3.muted },
  bien: { get label() { return i18n.t('common:audit.category.bien') }, tone: '#C45A00' },
  doc: { get label() { return i18n.t('common:audit.category.doc') }, tone: SugarV3.okDark },
  auth: { get label() { return i18n.t('common:audit.category.auth') }, tone: SugarV3.ink },
  settings: { get label() { return i18n.t('common:audit.category.settings') }, tone: SugarV3.muted },
  ai: { get label() { return i18n.t('common:audit.category.ai') }, tone: '#7A4FD8' },
}

/** Icônes audit par catégorie. */
export const AUDIT_CAT_ICONS: Record<string, string> = {
  kyc: 'shield',
  deal: 'pipeline',
  contact: 'contact',
  bien: 'home',
  doc: 'file',
  auth: 'lock',
  settings: 'cog',
  ai: 'sparkle',
}
