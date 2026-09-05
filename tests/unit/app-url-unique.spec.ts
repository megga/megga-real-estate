/**
 * Garde-fou — l'adresse de l'app se construit à UN seul endroit.
 *
 * ⛔ CE FICHIER EXISTE PARCE QUE LA RÈGLE ÉTAIT ÉCRITE ET N'A JAMAIS TENU.
 *
 * `_shared/app-url.ts` prescrit dans son propre en-tête qu'« un nouveau parcours
 * ajoute un constructeur ici plutôt que d'emprunter la base », et raconte avoir
 * déjà fermé ce défaut une fois — sur `onboarding-call-reminder`, qualifié alors
 * de « QUATRIÈME copie de la même adresse ». Mesuré le 16 août 2026 : il y en
 * avait SEPT de plus, dont trois dans des fichiers créés le jour même.
 *
 * Une règle que seule la prose défend se réécrit à chaque fichier neuf. Celle-ci
 * est particulièrement facile à enfreindre sans le voir : `https://app.megga.ch`
 * est la valeur JUSTE aujourd'hui, donc rien ne casse en la figeant — le prix ne
 * se paie qu'au changement de domaine, en une panne muette et dispersée.
 *
 * ── CE QUI EST INTERDIT, ET CE QUI NE L'EST PAS ──────────────────────────────
 * Interdit : le littéral dans du CODE de `supabase/functions/`.
 * Autorisé, et volontairement :
 *  · les COMMENTAIRES — l'en-tête d'`app-url.ts` cite l'adresse pour expliquer
 *    pourquoi elle ne doit pas être recopiée, et une garde qui interdirait d'en
 *    parler rendrait sa propre documentation impossible ;
 *  · `app-url.ts` lui-même, qui PORTE le repli : c'est la source unique ;
 *  · les exemptions nommées ci-dessous, chacune avec sa raison écrite.
 */
import { describe, expect, it } from 'vitest'
import { readFileSafely, rel, repoPath, scanRoots } from './helpers/fs-scan'
import { sansCommentaires } from '../../scripts/_shared/wa-outbound-purpose.mjs'

const LITTERAL = 'https://app.megga.ch'

/** La source unique : elle porte le repli, tout le reste passe par ses constructeurs. */
const SOURCE = 'supabase/functions/_shared/app-url.ts'

/**
 * Exemptions, chacune avec sa raison — même discipline que `A_MIGRER` dans
 * `check-email-shell.mjs` : une liste sans motif devient le tapis sous lequel on
 * glisse les oublis.
 */
const EXEMPTES: Record<string, string> = {
  'supabase/functions/appointment-book/index.ts':
    "Seule fonction à garder sa propre lecture, et c'est écrit dans le CLAUDE.md : elle "
    + "accepte en plus un repli `APP_URL` et fige la valeur dans une const de module. La "
    + 'ramener ici changerait son comportement, pas seulement sa provenance.',
  'supabase/functions/_shared/mail/guard.ts':
    "`MAIL_OAUTH_ORIGINS` n'est pas une adresse CONSTRUITE, c'est une liste blanche "
    + "d'origines ACCEPTÉES : `redirectUriFor` bâtit son URI sur l'origine de l'APPELANT, "
    + "une fois celle-ci trouvée dans la liste. La faire dériver d'`appBaseUrl()` la rendrait "
    + 'pilotable par `MEGGA_APP_URL` — or cette URI de redirection doit correspondre CARACTÈRE '
    + "POUR CARACTÈRE à celle enregistrée chez Google et chez Microsoft : poser le réglage "
    + "casserait la connexion des boîtes pour tout le monde (`redirect_uri_mismatch`). La "
    + "panne que cette garde redoute n'existe pas ici — une origine absente de la liste refuse "
    + "la pop-up sur-le-champ et à l'écran, au lieu d'envoyer un lien mort.",
  'supabase/functions/idx-feed/index.ts':
    "`IDX_LISTING_BASE_URL` est un AUTRE réglage — la base des annonces telle que le portail "
    + "doit la publier, pas l'adresse de l'app. L'occurrence est un exemple en commentaire de "
    + 'fin de ligne, que le retrait des commentaires ne voit pas.',
}

describe("l'adresse de l'app", () => {
  const scan = scanRoots([
    {
      root: 'supabase/functions',
      keep: (n) => n.endsWith('.ts'),
      keepPath: (p) => !/\.(test|spec)\.ts$/.test(p),
    },
  ])

  // Contrôle positif : un scan vide rendrait la clause verte pour la pire des raisons.
  it('a bien balayé les edge functions', () => {
    expect(scan.files.length, 'scan vide : racine cassée ou cwd inattendu').toBeGreaterThan(60)
    expect(scan.unreadable, 'fichiers illisibles').toEqual([])
  })

  it("ne se construit nulle part ailleurs que dans app-url.ts", () => {
    const coupables: string[] = []
    for (const abs of scan.files) {
      const chemin = rel(abs)
      if (chemin === SOURCE || chemin in EXEMPTES) continue
      const lu = readFileSafely(abs)
      if (lu.status !== 'ok') continue
      // Le retrait des commentaires est conscient des chaînes : un blanchiment naïf
      // de `//` détruirait le guillemet fermant de la moindre URL — donc de CELLE-CI.
      const code = sansCommentaires(lu.value) as string
      if (code.includes(LITTERAL)) {
        const ligne = code.slice(0, code.indexOf(LITTERAL)).split('\n').length
        coupables.push(`${chemin}:${ligne}`)
      }
    }
    expect(
      coupables,
      `L'adresse de l'app est figée hors de \`${SOURCE}\`. Elle est JUSTE aujourd'hui, donc `
        + "rien ne cassera avant le changement de domaine — et ce jour-là, la panne sera muette "
        + "et dispersée.\n   Ajouter un constructeur dans app-url.ts (appDashboardUrl, "
        + "emailAssetsUrl, kycMagicLinkUrl…) et l'appeler ici.\n   Si le cas est légitime, "
        + `l'inscrire dans EXEMPTES AVEC sa raison.\n${coupables.map((c) => `     ${c}`).join('\n')}`,
    ).toEqual([])
  })

  /**
   * ⚠ Une exemption qui ne vise plus rien ment autant qu'un glob mort : elle donne à
   * lire une dérogation vivante là où il n'y a plus de site. Même clause que la liste
   * `A_MIGRER` de `check-email-shell.mjs`, qui rougit sur un fichier déjà migré.
   */
  it('aucune exemption périmée', () => {
    const perimees = Object.keys(EXEMPTES).filter((chemin) => {
      const lu = readFileSafely(repoPath(chemin))
      return lu.status !== 'ok' || !lu.value.includes(LITTERAL)
    })
    expect(
      perimees,
      "Ces fichiers sont exemptés mais ne portent plus l'adresse : retirer l'entrée.",
    ).toEqual([])
  })
})
