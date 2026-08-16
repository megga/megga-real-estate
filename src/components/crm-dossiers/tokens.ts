// MEGGA CRM Sugar v3 — Design tokens (Sugar Pure direction)
// Port pixel-près de docs/handoff/sprint-1-kyc (README + MEGGA-DESIGN-SYSTEM.md).
//
// — Fond gris très clair avec radial gradient vers bleu pâle en bas
// — Cards blanches pures, ombres signature, coins 22-28px, AUCUNE bordure décorative
// — Accent unique = NOIR PUR #0B0C0E (pas de bleu, pas de violet, pas de gradient)
// — Typo Inter Tight avec tabular-nums sur tous les nombres
// — CHF avec apostrophes : CHF 1'250'000

import type { KycCheckCategory, KycDossierStatus } from '@/types/kyc'
import { crmVoileEncre } from '@/components/crm/tokens'
import { MXC_COLOR, MXC_SYSTEM, mxCrmPalette } from '@/components/megga-x-crm/tokens'
import { readCrmDark } from '@/lib/crmDark'
// i18n : les libellés des maps (contrôles/statuts/risque KYC + catégories audit)
// sont traduits au render via getter singleton (clés kyc:* / common:audit.category.*).
// Les tonalités/icônes restent fixes.
import i18n from '@/i18n'

/**
 * ⛔ CET OBJET ÉTAIT LE SEUL JEU DE JETONS DU CRM SANS BRANCHE DE THÈME, et il
 * peignait QUATRE routes agent (16 août 2026).
 *
 * `DossierTokens` était un `as const` statique. Ses lecteurs — Visites, Audit, Import
 * lead, wizard KYC, primitives partagées — rendaient donc en CLAIR quel que soit
 * le thème, pendant que la coquille qui les entoure, elle, bascule. Mesuré sur
 * `/dashboard/audit` : le rail et la barre supérieure passaient au sombre, le
 * corps de page restait blanc. La bascule était visible à l'écran, à moitié
 * faite.
 *
 * ⚠ LE DÉFAUT N'ÉTAIT PAS UN OUBLI DE VALEURS, c'était un défaut de FORME : un
 * objet statique ne peut pas avoir deux thèmes. D'où une FONCTION, l'idiome que
 * le dépôt emploie partout ailleurs (`mxCrmPalette`, `crmPalette`,
 * `ndPalette`).
 *
 * ── D'OÙ SORTENT LES VALEURS SOMBRES ─────────────────────────────────────────
 * Des RÔLES de `mxCrmPalette(true)`, jamais d'une teinte inventée — c'est la
 * correspondance que `CLAUDE.md` §3 fixe, et elle va par rôle et non par numéro :
 * MEGGA X CREUSE ses sous-surfaces là où l'ancienne échelle les montait. La
 * sous-carte est donc `cardSubBg` (#050505), plus SOMBRE que la carte (#090909),
 * quand en clair elle est plus grise que le blanc.
 *
 * ⚠ LES OMBRES PASSENT À `none` EN SOMBRE, et ce n'est pas une simplification :
 * la vitrine y sépare par la BORDURE. Garder les ombres « signature » de Sugar
 * sur un canvas #030303 ne produit rien de visible, seulement du coût de rendu.
 *
 * ⛔ ET LES ENCRES SÉMANTIQUES S'INVERSENT. `errDarker`/`warnDarker` sont les
 * variantes FONCÉES, faites pour écrire sur du blanc — #B91C1C rend 2,0:1 sur
 * #090909, donc illisible. En sombre c'est la variante CLAIRE qui écrit :
 * `MXC_SYSTEM.red400` (6,41:1) et `yellow400` (11,95:1). Même bascule pour
 * `okDark` → `green400` (10,62:1). Les teintes VIVES (`ok`/`warn`/`err`), elles,
 * ne bougent pas : elles servent d'APLAT et de pastille, où c'est l'encre posée
 * dessus qui porte le contraste.
 *
 * ⚠ `accent` NE BOUGE PAS NON PLUS — c'est le rôle APLAT, identique dans les deux
 * thèmes (`CLAUDE.md` §3). L'encre teintée sur sombre, elle, serait
 * `MXC_SYSTEM.blue300` ; cet objet n'en a pas l'emploi.
 */
export function dossierPalette(dark: boolean) {
  const sp = mxCrmPalette(dark)
  return {
  // Fond — radial doux du clair vers bleu-gris pâle ; en sombre, un aplat : la
  // vitrine ne pose aucun dégradé de page sur son canvas.
  bg: dark ? sp.pageBg : '#EDEFF3',
  bgGradient: dark
    ? sp.pageBg
    : 'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',

  // Surfaces — ⚠ la sous-carte se CREUSE en sombre (#050505 sous #090909).
  card: dark ? sp.cardBg : '#FFFFFF',
  cardSubtle: dark ? sp.cardSubBg : '#F7F8FA',

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
   *     `VisitNewPage`, l'accent d'`AuditPage`, le mode édition et
   *     le CTA de fermeture d'`ImportLeadPage`.
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
  ink: dark ? sp.ink : MXC_COLOR.n100,
  inkSoft: dark ? sp.soft : '#3A3D44',
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
  muted: dark ? sp.sub : MXC_COLOR.n500,
  /**
   * ⚠ REPOS, PAS ENCRE — 1,95:1, il ne peut pas porter de texte. Ses trois
   * emplois légitimes sont des APLATS (remplissage d'un contrôle désactivé) ;
   * le seul site qui s'en servait pour écrire est passé à `muted`.
   */
  ghost: dark ? MXC_COLOR.n500 : '#B5BAC2',

  /**
   * ⛔ L'APLAT INVERSÉ ET SON ENCRE — une PAIRE, et elle est née d'un défaut que
   * le passage au thème aurait introduit.
   *
   * Six surfaces peignaient `background: ink` avec `color: '#fff'` en dur : la
   * pastille d'initiales de l'import, la tuile d'icône et le récap de la modale
   * de visite, la coche et le panneau de note vocale du rapport. En clair, un
   * aplat quasi noir sous encre blanche — l'idiome « pilule noire » de Sugar.
   *
   * ⚠ MAIS `ink` BASCULE, ET `'#fff'` NON. En sombre, `ink` devient l'encre
   * claire de MEGGA X (#ffffff) : les six seraient devenus des blocs BLANCS
   * portant du texte BLANC. Le port à lui seul aurait donc fabriqué six surfaces
   * illisibles — c'est le piège des jetons appariés, où thémer un côté sans
   * l'autre casse le couple.
   *
   * La paire l'exprime au lieu de le subir : l'aplat est ce qui CONTRASTE avec la
   * page, son encre est ce qui contraste avec lui. En clair, noir sous blanc ;
   * en sombre, blanc sous noir. L'inversion est conservée dans les deux sens,
   * et c'est bien la même intention de design.
   */
  invBg: dark ? sp.ink : MXC_COLOR.n100,
  invInk: dark ? MXC_COLOR.n100 : MXC_COLOR.n1000,
  /**
   * ⚠ ET CE QUI SE POSE *SUR* L'APLAT INVERSÉ S'INVERSE AVEC LUI. Le récap de la
   * modale de visite écrivait ses libellés secondaires en `rgba(255,255,255,.6)`
   * et le panneau de note vocale posait un voile `rgba(255,255,255,.12)` : deux
   * blancs translucides qui disparaissent dès que l'aplat devient blanc. Ils
   * suivent donc la même bascule que `invInk` — c'est le même couple, à une
   * opacité près.
   */
  invInkSoft: dark ? 'rgba(3,3,3,0.62)' : 'rgba(255,255,255,0.6)',
  invVeil: dark ? 'rgba(3,3,3,0.10)' : 'rgba(255,255,255,0.12)',
  /**
   * ⛔ LE SECOND APLAT INVERSÉ — il existe parce qu'une teinte ENCODE ici.
   *
   * Les lignes d'audit distinguent l'acteur HUMAIN de l'acteur SYSTÈME par la
   * seule teinte de leur pastille : `inkSoft` contre `ink`. Deux nuances de
   * sombre sous une encre blanche. Les fondre en un seul aplat inversé ferait
   * MENTIR une marque de donnée — c'est l'argument déjà écrit plus haut pour la
   * catégorie `auth`.
   *
   * ⚠ TROUVÉ AU RENDU, PAS À LA LECTURE. Le jeton passe par une propriété nommée
   * (`avatarBg`), pas par une déclaration `background:` — donc aucun des greps
   * qui ont attrapé les six autres aplats inversés ne pouvait le voir. Il a fallu
   * mesurer les fonds RÉELLEMENT rendus sur `/dev/crm` : cinq pastilles à
   * `#ededed` portant du texte blanc, soit **1,06:1**. Une garde qui lit la
   * source ne remplace pas un écran.
   */
  invBgSoft: dark ? MXC_COLOR.n700 : '#3A3D44',
  /**
   * L'encre POSÉE SUR L'APLAT D'ACCENT — blanche dans les deux thèmes, parce que
   * l'aplat, lui, ne bascule pas. Elle sort du littéral `'#fff'` pour porter un
   * NOM : à côté d'`invInk`, qui bascule, un blanc en dur ne se distingue pas
   * d'un oubli. Même valeur que `mxCrmPalette().accentInk`.
   */
  accentInk: sp.accentInk,

  // Ombres signature Sugar — ⛔ `none` en sombre : MEGGA X sépare par la BORDURE.
  shadowSm: dark ? 'none' : `0 4px 16px ${crmVoileEncre(false, 0.04)}`,
  shadow: dark ? 'none' : `0 12px 40px ${crmVoileEncre(false, 0.06)}, 0 2px 8px ${crmVoileEncre(false, 0.03)}`,
  shadowLg: dark ? 'none' : `0 24px 60px ${crmVoileEncre(false, 0.08)}, 0 4px 16px ${crmVoileEncre(false, 0.04)}`,
  shadowHover: dark ? 'none' : `0 32px 70px ${crmVoileEncre(false, 0.10)}, 0 6px 20px ${crmVoileEncre(false, 0.05)}`,

  // États (utilitaires uniquement, jamais décoratifs — micro-pastilles ≤7×7px)
  // ⚠ Les teintes VIVES ne bougent pas : elles servent d'APLAT, où c'est l'encre
  // posée dessus qui porte le contraste.
  ok: '#10B981',
  warn: '#F59E0B',
  err: '#EF4444',
  // ⚠ ENCRE, elle : `#0E9F6E` rend 3,4:1 sur #090909. En sombre, `green400`.
  okDark: dark ? MXC_SYSTEM.green400 : '#0E9F6E', // score risque faible dans CtKyc
  errDark: '#E53935',
  /**
   * Les variantes FONCÉES existent pour le TEXTE : une teinte sémantique reste
   * vive sur un aplat, mais une encre illisible n'encode plus rien. Mêmes valeurs
   * que `EtatVide` et le rapport PDF, qui les avaient déjà mesurées pour le clair
   * — `#B91C1C` rend 6,47:1, `#B45309` rend 5,02:1.
   */
  errDarker: dark ? MXC_SYSTEM.red400 : '#B91C1C',
  warnDarker: dark ? MXC_SYSTEM.yellow400 : '#B45309',

  // Backgrounds soft pour pastilles statut (jamais pour cards)
  // ⛔ Les deux premiers sont des remplissages PÂLES, réglés pour un canvas clair :
  // posés tels quels sur #090909 ils feraient des blocs laiteux, et l'encre
  // sémantique qui va dessus deviendrait illisible. En sombre, un VOILE de la
  // même teinte — la règle « un élément posé sur une surface teintée reste un
  // voile translucide, pas un palier opaque ». `errSoft` l'était déjà.
  okSoft: dark ? 'rgba(16,185,129,0.14)' : '#E5F4EC',
  warnSoft: dark ? 'rgba(245,158,11,0.14)' : '#FFF4E0',
  errSoft: 'rgba(239,68,68,0.10)',

  // Police — ⛔ le nom est un REPLI, pas la valeur. Écrit en dur, il ÉCRASAIT
  // `--crm-font` sur les dix surfaces agent qui lisent ce jeton (KYC, Visites,
  // Import lead, Audit) : la direction ne pouvait plus changer leur typographie.
  // Invisible sous MEGGA X, dont la police EST Inter Tight — le défaut ne se
  // voyait qu'en déplaçant le jeton. La clause qui l'a trouvé lit la clé
  // RACCOURCIE `font:`, que `fontFamily:` ne voit pas (lot 4 · B6).
  font: DOSSIER_FONT,
  } as const
}

export type DossierPalette = ReturnType<typeof dossierPalette>

/**
 * La police, INDÉPENDANTE du thème — et c'est pour ça qu'elle sort de la palette.
 *
 * Trois surfaces ne lisaient de `DossierTokens` que ce champ. Les forcer à construire
 * une palette pour l'atteindre leur ferait choisir un thème dont elles n'ont pas
 * besoin, et un `dossierPalette(false)` posé là ressemblerait à une surface
 * mono-thème alors qu'il ne s'agit que d'un nom de police.
 *
 * ⛔ Le nom est un REPLI, pas la valeur : écrit en dur il ÉCRASERAIT `--crm-font`
 * sur les surfaces qui le lisent, et la direction ne pourrait plus changer leur
 * typographie.
 */
export const DOSSIER_FONT = 'var(--crm-font, "Inter Tight"), system-ui, sans-serif'

/**
 * ⚠ LA PALETTE CLAIRE, POUR LES SEULS EMPLOIS QUI NE PEUVENT PAS ÊTRE THÉMÉS :
 * les maps de libellés ci-dessous vivent au niveau MODULE et ne peuvent donc pas
 * appeler de hook. Leurs tons dépendants du thème passent par un GETTER (voir
 * `SV3_TON`), à l'image des libellés i18n juste à côté.
 *
 * ⛔ NE PAS L'IMPORTER DANS UN COMPOSANT. Un composant a accès au thème :
 * `dossierPalette(useCrmDark())`. S'en servir là serait recréer exactement le
 * défaut que cette fonction corrige, et la garde `sugar-v3-contraste.spec.ts`
 * le refuse nommément.
 */
const SV3_CLAIR = dossierPalette(false)

/**
 * Les deux tons THÉMÉS dont les maps de libellés ont besoin, lus au RENDU.
 *
 * `readCrmDark()` est la lecture partagée (`lib/sugarDark.ts`) — celle qui
 * porte le repli `prefers-color-scheme`, contrairement aux lectures en dur
 * `=== '1'` recopiées dans le dépôt. Un getter suffit : ces maps sont lues
 * pendant le rendu, et une bascule de thème déclenche un rendu.
 */
const SV3_TON = {
  get muted() { return dossierPalette(readCrmDark()).muted },
  get ink() { return dossierPalette(readCrmDark()).ink },
}

// ─── Animations keyframe (à injecter dans le DOM via <style>) ──────────
// Animation d'entrée signature Sugar : .5s cubic-bezier(.2,.8,.2,1) both
export const DOSSIER_KEYFRAMES = `
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
  none: { get label() { return i18n.t('kyc:dossierStatus.none') }, tone: SV3_TON.muted },
  pending: { get label() { return i18n.t('kyc:dossierStatus.pending') }, tone: SV3_CLAIR.warn },
  verified: { get label() { return i18n.t('kyc:dossierStatus.verified') }, tone: SV3_CLAIR.ok },
  failed: { get label() { return i18n.t('kyc:dossierStatus.failed') }, tone: SV3_CLAIR.err },
  stale: { get label() { return i18n.t('kyc:dossierStatus.stale') }, tone: SV3_CLAIR.warn },
}

/** Labels risque 3 niveaux (handoff). */
export const KYC_RISK_LABELS: Record<
  'low' | 'medium' | 'high' | 'unassessed',
  { label: string; tone: string }
> = {
  low: { get label() { return i18n.t('kyc:riskBadge.low') }, tone: SV3_CLAIR.ok },
  medium: { get label() { return i18n.t('kyc:riskBadge.medium') }, tone: SV3_CLAIR.warn },
  high: { get label() { return i18n.t('kyc:riskBadge.high') }, tone: SV3_CLAIR.err },
  unassessed: { get label() { return i18n.t('kyc:riskBadge.unassessed') }, tone: SV3_TON.muted },
}

/** Catégories audit nLPD — 8 valeurs (KYC_ENRICHISSEMENTS §7). */
export const AUDIT_CATEGORIES: Record<
  string,
  { label: string; tone: string }
> = {
  kyc: { get label() { return i18n.t('common:audit.category.kyc') }, tone: '#1E5BC6' },
  deal: { get label() { return i18n.t('common:audit.category.deal') }, tone: '#0891B2' },
  contact: { get label() { return i18n.t('common:audit.category.contact') }, tone: SV3_TON.muted },
  bien: { get label() { return i18n.t('common:audit.category.bien') }, tone: '#C45A00' },
  doc: { get label() { return i18n.t('common:audit.category.doc') }, tone: SV3_CLAIR.okDark },
  auth: { get label() { return i18n.t('common:audit.category.auth') }, tone: SV3_TON.ink },
  settings: { get label() { return i18n.t('common:audit.category.settings') }, tone: SV3_TON.muted },
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
