/**
 * Garde-fou : la GRAMMAIRE MEGGA X — casse, graisse, interlettrage, échelle de
 * texte — sur les surfaces déjà portées.
 *
 * Pourquoi ce fichier existe. Les Réglages (#1197) et le Calendrier (#1199) ont
 * porté cette grammaire écran par écran sans jamais la figer : rien n'empêchait
 * une micro-capitale de revenir par copier-coller depuis une surface non encore
 * migrée. `megga-x-crm-tokens.spec.ts` verrouille les COULEURS et l'échelle CSS,
 * `calendar-palette.spec.ts` et `wizard-palette.spec.ts` les palettes d'écran —
 * personne ne gardait la composition.
 *
 * ── CLIQUET ──────────────────────────────────────────────────────────────────
 * `ZONES` ne liste que ce qui est PORTÉ. Chaque lot y ajoute sa surface en même
 * temps qu'il la nettoie ; une zone absente n'est pas déclarée propre, elle est
 * déclarée non traitée. « Mes biens » est couvert en entier depuis le lot 4.
 *
 * ⚠ Le MOBILE de « Mes biens » vit dans TROIS dossiers — `biens` (la liste),
 * `bien` (la fiche) et `wizard` (la création) —, quand le plan n'en nommait
 * qu'un. Troisième occurrence du même piège après le calendrier et la fiche
 * bureau : le nom d'une surface ne dit pas où elle est rangée.
 *
 * ⚠ CE QUE LA VITRINE FAIT, ELLE, DE LA CAPITALE — mesuré le 11.08.2026, et
 * gardé ici parce que la règle du projet s'en écarte SCIEMMENT. Sa feuille
 * uppercase à 5 endroits, tous des BADGES (`.utp---badge`,
 * `.badge-bg-secondary.v2`) ou l'utilitaire d'opt-in `.text-uppercase`
 * (`.06em`) — jamais un libellé, un sur-titre ni un titre. Les Réglages, le
 * Calendrier et les lots 2-3 sont allés à ZÉRO, badges compris. Réintroduire
 * l'idiome de badge serait donc un geste sur QUATRE surfaces migrées, pas une
 * exception locale : il se décide, il ne se glisse pas dans un lot.
 *
 * ── CE QUE LA RÈGLE DIT, ET D'OÙ ELLE SORT ───────────────────────────────────
 * Mesuré sur `src/styles/megga-x.generated.css`, la feuille de la vitrine :
 *
 * - **Aucune graisse au-dessus de 600.** Répartition réelle de la vitrine :
 *   500 (×31), 600 (×11), 400 (×7), 200 (×2), 300 (×1), 700 (×1). L'unique 700
 *   est `.megga-x strong` — de l'emphase en ligne dans de la prose, pas un
 *   titre. Les classes `.display-*` (14 → 72 px) ne posent AUCUNE graisse par
 *   défaut : elles héritent, et leurs deux modificateurs plafonnent à
 *   `.medium` (500) et `.semi-bold` (600). C'est donc la couleur d'encre qui
 *   porte la hiérarchie, pas la graisse.
 * - **Aucune micro-capitale**, et l'interlettrage POSITIF qui l'accompagne part
 *   avec elle : sur un mot en casse normale, un `letterSpacing` ≥ 0,4 le
 *   disloque. Le seuil laisse passer les valeurs NÉGATIVES — resserrer un titre
 *   d'affichage est un geste de la direction, pas une survivance.
 * - **Les tailles passent par `var(--crm-text-*)`**, jamais par un littéral
 *   (`CLAUDE.md` §3 : ~4 200 valeurs en variables sur 161 fichiers).
 */
import { describe, it, expect } from 'vitest'
import { emptyRoots, readFileSafely, rel, scanRoots } from './helpers/fs-scan'

/**
 * Surfaces PORTÉES. Un lot qui nettoie une zone l'ajoute ici, pas avant.
 *
 * ⚠ `crm-sugar-v3/vitrine` est la palette ET le kit de la FICHE bien, dont
 * `BienDetailSugarV4Page` est l'unique consommateur. Le plan de refonte ne la
 * listait pas — il rangeait la fiche avec la liste, sur la foi d'un grep qui ne
 * voyait que le fichier de page. Une surface n'est pas un dossier.
 *
 * ⚠ Les PAGES passent par leur dossier parent avec un filtre de nom :
 * `scanRoots` parcourt des répertoires, et une racine qui désigne un fichier
 * rendrait zéro — donc une zone verte par vacuité. `emptyRoots` l'attraperait,
 * mais mieux vaut ne pas poser le piège.
 */
const PAGES = new Set([
  'BienDetailSugarV4Page.tsx', 'BiensSugarV2Page.tsx',
  'ContactDetailSugarV3Page.tsx', 'ContactsSugarV2Page.tsx',
  // Le pager Matching et son conteneur d'atelier — les deux dernières surfaces
  // du périmètre bureau. `MatchingAtelierPage` était déjà propre (0 marqueur) ;
  // l'entrer quand même est ce qui empêche qu'il cesse de l'être.
  'MatchingPagerPage.tsx', 'MatchingAtelierPage.tsx',
  // Les trois pages du Pipeline (lot 3, 13 août 2026). `OfferModalSugarV3Page`
  // était déjà propre — 44 lignes qui ne font que monter la modale ; l'entrer
  // quand même est ce qui empêche qu'il cesse de l'être.
  'PipelineSugarV2Page.tsx', 'DealDetailSugarV4Page.tsx', 'OfferModalSugarV3Page.tsx',
])

/**
 * ⛔ LE CLIQUET NE COUVRAIT PAS `PAGES`, et un contrôle négatif l'a montré.
 *
 * « le cliquet ne recule pas » vérifiait les racines de `ZONES`, puis affirmait
 * que chaque entrée de `PAGES` est bien BALAYÉE — en itérant `PAGES` elle-même.
 * Retirer une page de l'ensemble faisait donc disparaître à la fois la surface
 * ET son assertion : tout restait vert. Une page pouvait quitter le cliquet en
 * silence, ce qui est exactement le mode d'échec que le cliquet existe pour
 * empêcher côté dossiers.
 *
 * Cette liste est écrite À PART, en dur : elle ne peut pas rétrécir avec
 * `PAGES`. Même idiome que la liste des racines acquises.
 */
const PAGES_ACQUISES = [
  'BienDetailSugarV4Page.tsx', 'BiensSugarV2Page.tsx',
  'ContactDetailSugarV3Page.tsx', 'ContactsSugarV2Page.tsx',
  'MatchingPagerPage.tsx', 'MatchingAtelierPage.tsx',
  'PipelineSugarV2Page.tsx', 'DealDetailSugarV4Page.tsx', 'OfferModalSugarV3Page.tsx',
]

/**
 * « Contacts » est couvert EN ENTIER depuis le lot 4 (12 août 2026) : le
 * dossier a été porté fichier par fichier — les deux pagers au lot 2, la modale
 * de création au lot 3, la modale WhatsApp, l'écran de premier lancement et les
 * glyphes au lot 4 — et le filtre nommé qui servait de compteur pendant le
 * chantier a disparu avec le dernier fichier.
 *
 * ⚠ `ContactsFirstRun` est mono-thème PAR DÉCISION (fond sombre permanent,
 * textes blancs en dur quel que soit le thème, comme `BiensFirstRun` et la
 * couverture Pipeline). L'exception couvre ses COULEURS, pas sa grammaire : ses
 * graisses sont descendues comme partout ailleurs, et son fond a seulement
 * changé d'ALPHABET — `#0A0B0D` → `MXC_COLOR.n100`, le geste exact de
 * `BiensFirstRun`. Il reste fixe ; il ne suit toujours pas le thème.
 */

const ZONES: { root: string; keep: (n: string) => boolean }[] = [
  { root: 'src/components/crm-sugar-wizard', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/crm-sugar/biens', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/crm-sugar-v3/vitrine', keep: (n) => /\.tsx?$/.test(n) },
  // Le CRM mobile ENTIER depuis le 12 août 2026 — seize dossiers d'écrans, plus
  // la coquille et les primitives. Les trois dossiers de « Mes biens » y étaient
  // entrés seuls au lot 4 ; le reste portait encore 29 capitales, 295 graisses
  // ≥ 700, 22 interlettrages et 3 balises à graisse héritée.
  { root: 'src/components/crm-mobile', keep: (n) => /\.tsx?$/.test(n) },
  // ⚠ CHROME PARTAGÉ, pas une surface de « Mes biens ». `SugarShell` porte la
  // barre supérieure et le rail de TOUTE l'app agent — 30 fichiers le montent,
  // de Today aux Réglages. Il entre dans le cliquet parce qu'il est rendu EN
  // PERMANENCE sur les écrans portés, et qu'il est mesuré propre : 0 capitale,
  // 0 graisse ≥ 700, 0 interlettrage, 0 taille en dur, 0 noir Sugar. Son seul
  // hex hors échelle est `#e53935`, le compteur de notifications — sémantique,
  // même famille que `err`.
  { root: 'src/components/crm-sugar', keep: (n) => n === 'SugarShell.tsx' },
  // « Contacts » EN ENTIER depuis le lot 4 — voir la note au-dessus de `PAGES`.
  { root: 'src/components/crm-sugar/contacts-pager', keep: (n) => /\.tsx?$/.test(n) },
  // Le Pipeline EN ENTIER depuis le lot 4 du chantier MEGGA X (13 août 2026).
  // ⚠ Sa dette était l'INVERSE de celle des pages : 62 graisses ≥ 700 et ZÉRO
  // taille littérale, quand les deux pages portaient 51 tailles. Un lot qui
  // recopierait l'ordre du chantier précédent chercherait la mauvaise chose.
  { root: 'src/components/crm-sugar/pipeline', keep: (n) => /\.tsx?$/.test(n) },
  // La modale d'offre et les jetons de la fiche deal — la part de `crm-sugar-v3`
  // que la chaîne Pipeline REND réellement.
  //
  // ⛔ ET SEULEMENT ELLE. `crm-sugar-v3` hors `vitrine` porte 199 marqueurs, dont
  // 176 dans `kyc-wizard`, `kyc-pager`, `visite-detail`, `audit` et
  // `primitives` : des écrans que ce chantier n'a jamais ouverts, qui n'ont
  // aucun banc, et que la décision de périmètre (§3.1 du plan, 13 août 2026) a
  // explicitement laissés dehors. Les entrer ici les déclarerait portés sans
  // que personne les ait regardés — l'inverse de ce à quoi sert un cliquet :
  // une zone absente n'est pas déclarée propre, elle est déclarée NON TRAITÉE.
  //
  // ⚠ `tokens.ts` (`SugarV3`) reste dehors pour la même raison, et c'est une
  // décision, pas un oubli : il porte deux noirs Sugar, mais il alimente onze
  // pages hors périmètre. Le reciblage de la chaîne Pipeline est passé par ses
  // palettes LOCALES, pas par lui — la mesure d'ouverture a montré que la fiche
  // ne lui prend qu'un formateur de date.
  {
    root: 'src/components/crm-sugar-v3',
    keep: (n) => ['icons.tsx', 'dealStepper.ts', 'dealTokens.ts'].includes(n),
  },
  { root: 'src/components/crm-sugar-v3/offer-modal', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/pages/agent', keep: (n) => PAGES.has(n) },
  // ⛔ « Matching · Recherche » entre SANS `MrhMapView.tsx`. La carte est GELÉE
  // par décision (13 août 2026) : le jeton Mapbox est absent du build, donc la
  // branche qui rend réellement est la carte SCHÉMATIQUE — fond dessiné,
  // pastilles de prix positionnées depuis les bornes, survol avec aperçu. Ce
  // n'est pas un carré gris, c'est la surface que l'agent utilise, avec ses
  // couleurs propres (#0F131A / #E9EDF2, eau et parcs en rgba) qui ne sortent
  // d'aucun système de jetons. L'exclure ici est ce qui rend le gel VÉRIFIABLE :
  // une exemption écrite, pas un oubli qu'on relèverait à la relecture.
  { root: 'src/components/matching-recherche', keep: (n) => /\.tsx?$/.test(n) && n !== 'MrhMapView.tsx' },
  { root: 'src/components/matching-atelier', keep: (n) => /\.tsx?$/.test(n) },
  // Les 19 pages de la console super-admin (lot 3 du chantier MEGGA X,
  // 14 août 2026). Le dossier ENTIER, pas une liste de noms : les 19 fichiers
  // ont été traités, et un vingtième qui arriverait doit l'être aussi.
  //
  // ⚠ Leur dette était l'inverse de celle du dossier de composants du Pipeline,
  // et c'est la deuxième fois que la mesure contredit l'ordre attendu : 208
  // tailles littérales ici contre ZÉRO côté composants admin, qui portent eux
  // 45 graisses. Recopier l'ordre du chantier précédent aurait fait chercher la
  // mauvaise chose.
  //
  // ⛔ ET LE CLIQUET NE VOYAIT PAS `AdminKybReviewPage`. Elle rendait 0 marqueur
  // sur 1 502 lignes — non pas parce qu'elle était propre, mais parce qu'elle
  // était peinte en CLASSES (154 `className`, 0 `style={{`) et que cet
  // instrument ne lit que les styles EN LIGNE. Un silence n'est pas un verdict.
  // Elle est passée au style en ligne au même lot, ce qui la rend VISIBLE ici.
  { root: 'src/pages/admin', keep: (n) => /\.tsx?$/.test(n) },
  // Le chrome et les atomes de la console (lot 4, 14 août 2026). Deux racines
  // parce que `kit/` est un sous-dossier et que `scanRoots` ne descend pas.
  //
  // ⚠ Leur dette est celle des composants du Pipeline, pas celle des pages
  // d'à côté : 58 graisses ≥ 700 et DEUX tailles littérales seulement. La même
  // console porte donc les deux dettes opposées, chacune de son côté de la
  // frontière page/composant.
  { root: 'src/components/admin', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/components/admin/kit', keep: (n) => /\.tsx?$/.test(n) },
]

/** La preuve que le scan voit encore l'arbre — sinon tout passe par vacuité. */
const TEMOIN = 'src/components/crm-sugar-wizard/steps/Step7Publish.tsx'

/**
 * Littéraux de taille assumés, EXPRESSION PAR EXPRESSION — pas par fichier.
 *
 * ⚠ Exempter un FICHIER est trop grossier : `primitives.tsx` porte à la fois une
 * taille calculée légitime et un `14.5 : 13` qui, lui, doit descendre sur
 * l'échelle. Une garde qui les couvre des deux d'un coup laisse passer ce
 * qu'elle prétend surveiller.
 *
 * Deux familles seulement, et rien d'autre :
 *
 * 1. **Au-dessus de l'échelle.** `--crm-text-*` s'arrête à 38 px (`9xl`). Ceux-ci
 *    sont des chiffres d'affichage — le prix, la saisie chiffrée, le titre de
 *    confirmation. La vitrine, elle, monte à 72 px sur ses `.display-*` : il y a
 *    donc une VRAIE question d'échelle derrière (faut-il prolonger `--crm-text-*`
 *    au-delà de 38 ?). Elle se décide, elle ne se règle pas au passage d'un lot
 *    de composition. `32 : 40` reste d'un bloc : 32 a bien un barreau (`7xl`),
 *    mais éclater les deux états d'un même titre entre un jeton et un littéral
 *    est pire que de les assumer ensemble.
 * 2. **Calculées.** Une taille qui suit son conteneur ne peut, par construction,
 *    pas être un barreau.
 */
/**
 * Interlettrages positifs assumés, EXPRESSION PAR EXPRESSION.
 *
 * La règle vise l'interlettrage qui accompagnait la micro-capitale : sur un mot
 * en casse normale, il le disloque. Mais DISLOQUER est parfois précisément ce
 * qu'on veut — un code qu'on lit caractère par caractère pour le recopier n'est
 * pas un mot, et le resserrer le rendrait plus dur à transcrire.
 *
 * ⚠ Cette liste ne doit accueillir que des suites de CARACTÈRES INDÉPENDANTS
 * (codes, empreintes). Un libellé, un sur-titre ou un titre n'y a rien à faire :
 * pour eux, l'interlettrage était la survivance, et il part.
 */
const INTERLETTRAGES_ASSUMES: { motif: RegExp; raison: string }[] = [
  {
    motif: /letterSpacing: 6, fontVariantNumeric: 'tabular-nums'/,
    raison: 'le code d’appairage WhatsApp, lu et recopié caractère par caractère',
  },
]

const TAILLES_ASSUMEES: { motif: RegExp; raison: string }[] = [
  {
    // ⚠ UNE seule entrée pour toute la famille. Plusieurs coefficients existent
    // (0,26 · 0,34 · 0,36 · 0,42) parce que les pastilles ont plusieurs
    // diamètres ; les lister un par un ferait grossir la liste sans rien
    // décider de plus.
    //
    // ⚠ Le motif ancrait sur le NOM `size`, et ratait donc `S * 0.34` —
    // l'avatar de `NewContactModal`, dont la prop s'appelle `S`. Une exemption
    // qui dépend du nom d'une variable locale n'exempte pas une famille, elle
    // exempte un fichier par accident. C'est la FORME qui définit la famille :
    // une taille qui suit son conteneur ne peut pas être un barreau.
    //
    // ⚠ ET IL ANCRAIT AUSSI SUR L'ENVELOPPE. Il connaissait `Math.max(…)` mais
    // pas `Math.round(…)` — l'avatar du kit admin, dont le calcul est le MÊME à
    // l'arrondi près. Même défaut d'un cran plus haut : le nom de la fonction
    // enveloppante n'est pas plus la famille que le nom de la variable. Toute
    // enveloppe `Math.*` est donc admise ; ce qui définit la famille reste
    // « une taille PROPORTIONNELLE à autre chose ».
    motif: /fontSize:\s*(?:Math\.\w+\([^)]*?)?\w+ \* 0\.\d+/,
    raison: 'calculée : une initiale suit le diamètre de sa pastille',
  },
  { motif: /fontSize:\s*104\b/, raison: '104 px — le prix en grand, au-dessus du dernier barreau' },
  { motif: /fontSize:\s*72\b/, raison: '72 px — la saisie chiffrée en grand, au-dessus du barreau' },
  { motif: /fontSize:\s*q === 6 \? 32 : 40\b/, raison: '32/40 px — un même titre à deux densités' },
  {
    // ⚠ RAISON RÉÉCRITE LE 14 AOÛT 2026, et c'est une correction de garde, pas
    // de code. Elle disait « le titre de confirmation » — un site — alors que
    // le motif est ancré sur une VALEUR et couvre donc une famille : trois
    // sites dans les zones du cliquet (le titre de l'étape 8 du wizard, le
    // compteur du premier lancement de « Mes biens », le MRR du poste de
    // plans). Une exemption dont la raison nomme un site pendant que son motif
    // en couvre trois exempte les deux autres PAR ACCIDENT — quatrième forme de
    // `megga/gardes-vacuites`, ici dans sa variante « raison périmée ».
    motif: /fontSize:\s*44\b/,
    raison: '44 px — les chiffres et titres d’affichage au-dessus du dernier barreau (3 sites)',
  },
  { motif: /fontSize:\s*40\b/, raison: '40 px — le titre du premier lancement, au-dessus du barreau' },
]

/**
 * Retire commentaires de ligne et de bloc AVANT analyse. Sans ça, la note qui
 * explique un retrait fait rougir la garde : le garde-fou trébuche sur sa
 * propre documentation. Défaut déjà rencontré sur `t.primary`
 * (`megga-x-crm-tokens.spec.ts`).
 */
function sansCommentaires(code: string): string {
  return code
    // ⚠ Un bloc `/* … */` de N lignes doit rendre N sauts de ligne, pas une
    // espace : sinon tout ce qui suit REMONTE, et chaque `fichier:ligne` que ce
    // spec rapporte désigne la mauvaise ligne. Une garde qui envoie au mauvais
    // endroit coûte plus de temps qu'elle n'en fait gagner.
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => '\n'.repeat((bloc.match(/\n/g) ?? []).length))
    .replace(/\/\/[^\n]*/g, ' ')
}

const scan = scanRoots(ZONES)
const sources = scan.files.map((abs) => {
  const lu = readFileSafely(abs)
  return { chemin: rel(abs), code: lu.status === 'ok' ? sansCommentaires(lu.value) : '' }
})

/** `fichier:ligne` de chaque ligne qui satisfait le prédicat. */
function sites(predicat: (ligne: string) => boolean): string[] {
  const trouves: string[] = []
  for (const { chemin, code } of sources) {
    code.split('\n').forEach((ligne, i) => {
      if (predicat(ligne)) trouves.push(`${chemin}:${i + 1}`)
    })
  }
  return trouves
}

describe('Grammaire MEGGA X — casse, graisse, interlettrage, échelle', () => {
  it('le balayage voit l’arbre', () => {
    expect(emptyRoots(scan), 'racine vide : chemin cassé, pas surface propre').toEqual([])
    expect(scan.unreadable).toEqual([])
    expect(scan.files.length).toBeGreaterThan(10)
    expect(sources.map((s) => s.chemin)).toContain(TEMOIN)
    // Une source vidée par un échec de lecture rendrait tous les tests vrais.
    expect(sources.every((s) => s.code.length > 0)).toBe(true)
  })

  /**
   * Les micro-capitales ne sont pas un détail de goût : elles étaient la marque
   * de fabrique de Sugar pour les sur-titres, et MEGGA X n'en a aucun idiome.
   * Les Réglages en ont retiré 10, le Calendrier 12.
   */
  it('aucune micro-capitale', () => {
    const fautifs = sites((l) => /textTransform:\s*'uppercase'/.test(l))
    expect(fautifs, `micro-capitales restantes :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * ⚠ Le motif lit l'EXPRESSION entière, pas la valeur qui suit `fontWeight:`.
   * Une première version ancrée sur `fontWeight:\s*[789]00` laissait passer
   * quatre `fontWeight: sel ? 700 : 600` — la graisse y disait l'état
   * sélectionné, en TROISIÈME signal après le fond accentué et l'encre inversée.
   * C'est précisément la forme qu'une garde doit attraper : celle où la valeur
   * proscrite se cache derrière une condition.
   */
  it('aucune graisse au-dessus de 600', () => {
    const fautifs = sites((l) => /fontWeight:[^,}\n]*\b[789]00\b/.test(l))
    expect(fautifs, `graisses ≥ 700 restantes :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ L'ANGLE MORT DE LA GARDE PRÉCÉDENTE : une graisse que la SOURCE ne
   * déclare pas.
   *
   * `<strong>` et `<b>` héritent du preflight Tailwind — `b, strong
   * { font-weight: bolder }` — qui, sur un parent réglé à 500, résout à **700**
   * au rendu. Aucun `fontWeight:` n'apparaît alors dans le code : le test
   * ci-dessus est vert, et l'écran est faux. Trouvé en mesurant l'étape 8 dans
   * le navigateur, pas en lisant le fichier.
   *
   * On interdit donc la BALISE dans les zones portées. Pour de l'emphase, poser
   * un `<span>` avec sa graisse explicite — la seule façon d'être sûr de ce qui
   * sera rendu.
   */
  it('aucune balise qui hérite d’une graisse du preflight', () => {
    const fautifs = sites((l) => /<(strong|b)[\s>]/.test(l))
    expect(fautifs, `balises à graisse héritée :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * Seul l'interlettrage POSITIF est visé, et à partir de 0,4. En dessous il ne
   * se voit pas ; au-dessus de zéro il n'existe que pour aérer des capitales, et
   * appliqué à de la casse normale il disloque le mot. Le négatif est laissé :
   * c'est le resserrement des titres d'affichage, que la vitrine pratique.
   */
  it('aucun interlettrage de micro-capitale', () => {
    const fautifs = sites((l) => {
      if (INTERLETTRAGES_ASSUMES.some(({ motif }) => motif.test(l))) return false
      for (const m of l.matchAll(/letterSpacing:\s*'?(-?\.?[\d.]+)(em)?'?/g)) {
        const v = Number(m[1])
        if (Number.isNaN(v)) continue
        if (m[2] === 'em' ? v >= 0.04 : v >= 0.4) return true
      }
      return false
    })
    expect(fautifs, `interlettrage positif ≥ 0,4 :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * Une exemption qui ne correspond plus à rien laisse croire qu'un écart est
   * surveillé alors que la ligne a disparu. Même idiome que les tailles.
   */
  it('chaque exemption d’interlettrage correspond encore à du code', () => {
    const tout = sources.map((s) => s.code).join('\n')
    const mortes = INTERLETTRAGES_ASSUMES.filter(({ motif }) => !motif.test(tout)).map((e) => e.raison)
    expect(mortes, `exemptions sans code :\n  ${mortes.join('\n  ')}`).toEqual([])
  })

  /**
   * Une taille écrite en dur échappe à l'échelle : elle ne bougera pas si
   * l'échelle bouge, et rien ne signale qu'elle en est sortie. Les exceptions
   * sont NOMMÉES par fichier (`TAILLES_ASSUMEES`) — figer l'écart plutôt que
   * l'interdire, même idiome que les palettes.
   */
  /**
   * ⚠ On efface d'abord les jetons `var(--crm-…)`, PUIS on cherche un chiffre.
   * Ancrer sur « `var(` suit immédiatement `fontSize:` » ne marche que pour la
   * forme la plus simple : un ternaire de deux jetons
   * (`big ? 'var(--crm-text-3xl)' : 'var(--crm-text-lg)'`) est parfaitement
   * tokenisé et se faisait pourtant rejeter. Une garde qui refuse du code
   * correct se fait désarmer, pas corriger.
   */
  it('les tailles de texte sortent de l’échelle', () => {
    const fautifs = sites((ligne) => {
      const sansJetons = ligne.replace(/var\(--crm-[a-z0-9-]*\)/g, "''")
      if (!/fontSize:[^,}\n]*\d/.test(sansJetons)) return false
      return !TAILLES_ASSUMEES.some(({ motif }) => motif.test(ligne))
    })
    expect(fautifs, `tailles hors échelle :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * Une exemption qui ne correspond plus à rien est un mensonge silencieux : elle
   * laisse croire qu'un écart est surveillé alors que la ligne a disparu.
   */
  it('chaque exemption de taille correspond encore à du code', () => {
    const tout = sources.map((s) => s.code).join('\n')
    const mortes = TAILLES_ASSUMEES.filter(({ motif }) => !motif.test(tout)).map((e) => e.raison)
    expect(mortes, `exemptions sans code :\n  ${mortes.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ UN ÉLÉMENT CLIQUABLE NE SE PEINT PAS EN ENCRE.
   *
   * C'est la survivance la plus discrète de Sugar Pure, et AUCUN scan de
   * couleur ne peut l'attraper : le jeton employé est parfaitement légitime
   * (`sp.ink` descend bien de `mxCrmPalette`), c'est son RÔLE qui est faux. La
   * règle du 10 août 2026 dit que l'élément actif porte l'accent `#424bfb` ;
   * peindre un bouton primaire en encre, c'est appliquer l'ancienne règle
   * « l'accent EST l'encre » avec les jetons de la nouvelle.
   *
   * Trouvé à l'écran, pas par un test : sur « Mes biens », le CTA « Créer un
   * bien » sortait en `#030303` quand la pastille de filtre juste à côté sortait
   * en `#424bfb` — deux affordances primaires, deux couleurs, sur la même barre.
   * Défaut identique à celui des Réglages, où `PfSwitch` était noir pendant que
   * `PxfSwitch` était déjà bleu.
   *
   * ⚠ Heuristique textuelle assumée : on regarde si un `background: …ink` a un
   * `<button` ou un `cursor: 'pointer'` dans son voisinage immédiat. Un COMPTEUR
   * en encre reste donc permis — il informe, il ne s'actionne pas.
   */
  it('aucun élément cliquable peint en encre', () => {
    const fautifs: string[] = []
    for (const { chemin, code } of sources) {
      const lignes = code.split('\n')
      lignes.forEach((ligne, i) => {
        if (!/background:\s*\w+\.ink\b/.test(ligne)) return
        const voisinage = lignes.slice(Math.max(0, i - 6), i + 7).join(' ')
        if (/<button|cursor:\s*'pointer'/.test(voisinage)) fautifs.push(`${chemin}:${i + 1}`)
      })
    }
    expect(fautifs, `encre en fond d'un élément actionnable :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ LE NOIR DE SUGAR, SOUS SES DEUX ALPHABETS.
   *
   * Les gardes de palette (`wizard-palette`, `bien-palette`) n'inspectent que
   * les OBJETS de jetons. Aucune n'ouvre un fichier de composant — et c'est là
   * que `#0B0C0E` avait survécu 37 fois : le marqueur de carte de l'étape
   * Adresse, la pastille « vendu », les voiles posés sur les photos, les
   * confettis de l'écran de confirmation.
   *
   * ⚠ Le motif lit `#rrggbb` ET `rgba(r,g,b,…)`. Onze de ces occurrences
   * étaient en décimal — `rgba(11,12,14,…)`, exactement la même couleur sous un
   * autre alphabet. Un garde-fou de couleur qui ne connaît qu'une notation ne
   * garde rien, et c'est ainsi que le voile de `sgVeil()` a passé la relecture.
   *
   * Les teintes SÉMANTIQUES restent permises et sont nommées : elles encodent
   * une information que l'échelle ne sait pas porter (statut d'annonce, teinte
   * d'avatar, hue de groupe). Comme partout ici, on fige l'écart au lieu de
   * l'interdire.
   */
  it('aucun noir Sugar ne subsiste dans les composants', () => {
    const NOIRS = /#0B0C0E\b|#0A0A0F\b|#0A0B0D\b|rgba?\(\s*11\s*,\s*12\s*,\s*14\b/gi
    const fautifs = sites((l) => NOIRS.test(l))
    expect(fautifs, `noir Sugar vivant :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ UN ALIAS SUFFIT À CONTOURNER LA GARDE PRÉCÉDENTE.
   *
   * `BpRenewModal.tsx` faisait `const accent = sp.ink`, puis peignait son
   * bouton de validation, ses trois pastilles de durée et deux « Terminé » avec
   * `background: accent`. La garde cherchait `background: …ink` : elle était
   * VERTE dans un fichier qu'elle balayait. Nommer une variable ne change pas
   * ce qu'elle contient.
   */
  it('aucun alias ne renomme l’encre en accent', () => {
    const fautifs = sites((l) => /\b(?:const|let)\s+\w*[Aa]ccent\w*\s*=\s*\w+\.ink\b/.test(l))
    expect(fautifs, `l'encre déguisée en accent :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * Le cliquet doit RESTER un cliquet : une zone retirée de `ZONES` désarmerait
   * les tests ci-dessus en silence, et le fichier resterait vert.
   */
  it('le cliquet ne recule pas', () => {
    const racines = ZONES.map((z) => z.root)
    for (const acquise of [
      'src/components/crm-sugar-wizard',
      'src/components/crm-sugar/biens',
      'src/components/crm-sugar-v3/vitrine',
      'src/components/crm-mobile',
      'src/components/crm-sugar',
      'src/components/crm-sugar/contacts-pager',
      'src/components/crm-sugar/pipeline',
      'src/components/crm-sugar-v3/offer-modal',
      'src/pages/agent',
      'src/components/matching-recherche',
      'src/components/matching-atelier',
      'src/pages/admin',
      'src/components/admin',
      'src/components/admin/kit',
    ]) expect(racines, `zone retirée du cliquet : ${acquise}`).toContain(acquise)
    // Les pages sont bien VUES — un filtre de nom qui ne matche rien laisserait
    // la racine non vide (le dossier en contient d'autres) tout en ne gardant
    // aucune d'elles.
    //
    // ⚠ On itère `PAGES_ACQUISES`, PAS `PAGES` : itérer l'ensemble qu'on
    // surveille le fait rétrécir avec lui. C'est ce que le contrôle négatif a
    // montré — retirer une page passait au vert.
    const vues = sources.map((s) => s.chemin.split('/').pop())
    for (const p of PAGES_ACQUISES) {
      expect(PAGES, `page retirée du cliquet : ${p}`).toContain(p)
      expect(vues, `page non balayée : ${p}`).toContain(p)
    }
  })
})
