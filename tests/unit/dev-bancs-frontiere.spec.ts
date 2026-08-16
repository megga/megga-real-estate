/**
 * Garde-fou : la frontière entre un banc QUI PART EN PRODUCTION et un banc qui
 * n'y est pas — et elle ne se devine pas, elle se mesure dans `App.tsx`.
 *
 * ── CE QUI A MOTIVÉ CE FICHIER ───────────────────────────────────────────────
 * Le plan du chantier « 100 % » proposait d'exempter `src/pages/dev` en bloc, au
 * motif que ce sont des « bancs `import.meta.env.DEV`, jamais servis ». Mesuré
 * le 15 août 2026 dans le bundle construit : **HUIT des douze pages du dossier
 * ont un chunk dans `dist/assets/`**, les quatre autres zéro. Le motif était
 * faux pour les deux tiers du dossier.
 *
 * ⛔ ET UNE EXEMPTION AU MOTIF FAUX EST PIRE QU'UNE ABSENCE. Une absence se voit
 * et se questionne ; un motif écrit se lit, se croit, et fait passer douze
 * fichiers pour examinés alors que huit d'entre eux sont servis sur
 * `app.megga.ch`. C'est la vacuité n°6 retournée : là une garde muette prise
 * pour un verdict, ici un verdict écrit qui ne repose sur rien.
 *
 * ── OÙ PASSE LA FRONTIÈRE ────────────────────────────────────────────────────
 * `import.meta.env.DEV` est remplacé par `false` au build : un composant déclaré
 * derrière le ternaire voit sa branche d'import disparaître, donc Vite n'émet
 * aucun chunk pour lui. Un `lazy(() => import(…))` NU en émet toujours un.
 *
 * La frontière est donc syntaxique et vérifiable sans construire :
 *
 *  · banc derrière le ternaire  → absent du bundle → exempté du cliquet, et ce
 *    fichier porte le motif ;
 *  · banc en `lazy()` nu        → livré et routé   → c'est une surface, il entre
 *    au cliquet comme n'importe quelle autre.
 *
 * ── LA QUESTION DE PRODUIT A ÉTÉ TRANCHÉE (15 août 2026) ────────────────────
 * Ce fichier a d'abord CONSTATÉ que sept bancs étaient joignables sur
 * `app.megga.ch` — dont `/dev/sentry-test`, qui DÉCLENCHE des erreurs Sentry —
 * en disant que la décision ne lui appartenait pas. Julien a tranché : les sept
 * passent au ternaire. Un banc de développement livré n'est pas seulement du
 * poids mort, c'est une surface que personne ne teste, ouverte à qui connaît
 * l'URL.
 *
 * ⚠ IL N'Y A DONC PLUS DEUX POPULATIONS, et la clause qui l'exigeait a ROUGI
 * pour le dire. Elle est remplacée par plus fort : le dossier est ÉNUMÉRÉ depuis
 * l'arbre, et tout banc routé doit être gelé. Une liste n'aurait jamais vu
 * arriver un banc neuf ; l'arbre, si.
 *
 * ⚠ ÊTRE ABSENT DU BUNDLE REND UNE EXEMPTION POSSIBLE, PAS NÉCESSAIRE. Les sept
 * gelés RESTENT dans le cliquet de grammaire : ils y sont entrés propres, et une
 * zone propre y reste précisément pour qu'elle le demeure. Les quatre premiers,
 * eux, sont exemptés parce qu'ils SÈMENT un état (session, intercepteur de
 * fetch) — c'est ce qui les rend inexerçables, pas leur absence du bundle.
 */
import { describe, it, expect } from 'vitest'
import { emptyRoots, readFileSafely, rel, repoPath, scanRoots } from './helpers/fs-scan'

/**
 * Les quatre bancs exemptés, et la seule raison qui les exempte.
 *
 * ⚠ Écrite en dur plutôt que dérivée d'`App.tsx` : dériver l'ensemble de ce
 * qu'on surveille est exactement ce qui laisse une entrée disparaître en
 * silence (vacuité n°15). Un banc retiré du ternaire doit faire rougir ICI.
 */
/**
 * ⚠ LE CHEMIN COMPLET, PAS LE NOM DE BASE. Le cliquet de grammaire exige que la
 * garde d'une exemption NOMME ce qu'elle exempte, et il compare des chemins
 * repo-relatifs. Une garde qui n'écrirait que `CrmShowcasePage` laisserait
 * l'exemption sans support : elle a l'air de désigner le fichier, elle ne le
 * désigne pas. C'est le cliquet qui l'a signalé, pas une relecture.
 */
const BANCS_HORS_BUNDLE = [
  { chemin: 'src/pages/dev/PublicShowcasePage.tsx', route: '/dev/public' },
  { chemin: 'src/pages/dev/OnboardingPreviewPage.tsx', route: '/dev/onboarding' },
  { chemin: 'src/pages/dev/AdminShowcasePage.tsx', route: '/dev/admin' },
  { chemin: 'src/pages/dev/CrmShowcasePage.tsx', route: '/dev/crm' },
  // ── Les sept derniers, gelés le 15 août 2026 ────────────────────────────
  // Ils étaient LIVRÉS : un chunk dans `dist/assets/` et une route déclarée.
  // La décision de les geler est de PRODUIT, pas de direction artistique —
  // ce fichier ne fait que la rendre vérifiable.
  { chemin: 'src/pages/dev/SentryTestPage.tsx', route: '/dev/sentry-test' },
  { chemin: 'src/pages/dev/MatchingShowcasePage.tsx', route: '/dev/matching-atelier' },
  { chemin: 'src/pages/dev/MobileShowcasePage.tsx', route: '/dev/mobile' },
  { chemin: 'src/pages/dev/BiensShowcasePage.tsx', route: '/dev/biens' },
  { chemin: 'src/pages/dev/ContactsShowcasePage.tsx', route: '/dev/contacts' },
  { chemin: 'src/pages/dev/PipelineShowcasePage.tsx', route: '/dev/pipeline' },
  { chemin: 'src/pages/dev/ModalesShowcasePage.tsx', route: '/dev/modales' },
].map((b) => ({ ...b, fichier: b.chemin.split('/').pop()!.replace('.tsx', '') }))

const app = readFileSafely(repoPath('src/App.tsx'))
const source = app.status === 'ok' ? app.value : ''

describe('Bancs /dev — la frontière bundle', () => {
  it('App.tsx est lisible', () => {
    // Sans ce plancher, un chemin cassé rendrait toutes les clauses vraies.
    expect(app.status, 'App.tsx illisible : les clauses ne mesurent rien').toBe('ok')
    expect(source.length).toBeGreaterThan(10_000)
  })

  /**
   * ⛔ LE TERNAIRE EST LE MOTIF, DONC C'EST LUI QU'ON MESURE. Le remplacer par un
   * `lazy()` nu ferait partir le banc en production sans rien changer d'autre —
   * et l'exemption du cliquet continuerait de le couvrir en silence.
   */
  it('chaque banc exempté est bien derrière `import.meta.env.DEV`', () => {
    const nus: string[] = []
    for (const { fichier, route } of BANCS_HORS_BUNDLE) {
      // La déclaration entière, du nom jusqu'au point-virgule logique : le
      // ternaire et son `lazy()` vivent sur plusieurs lignes.
      const bloc = new RegExp(`const ${fichier}\\s*=([\\s\\S]{0,400}?)\\n(?=const |// |/\\\\*|\\n)`)
      const m = source.match(bloc)
      if (!m) { nus.push(`${fichier} : déclaration introuvable dans App.tsx — motif invérifiable`); continue }
      if (!/import\.meta\.env\.DEV/.test(m[1]!)) {
        nus.push(`${fichier} (${route}) : plus de ternaire DEV — il PART en production, il ne peut plus être exempté du cliquet`)
      }
    }
    expect(nus, `banc exempté mais livré :\n  ${nus.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ LA FRONTIÈRE A CESSÉ DE SÉPARER DEUX POPULATIONS — parce qu'il n'en reste
   * qu'UNE, et c'est le but.
   *
   * La clause précédente exigeait qu'il existe AUSSI des bancs livrés, sans quoi
   * elle aurait pu être vraie par vacuité. Cette prémisse est tombée le 15 août
   * 2026 : les sept derniers bancs ont été gelés, tous les `/dev/*` passent
   * désormais par le ternaire. ⚠ La clause a rougi pour le dire, et c'est
   * exactement ce qu'on lui demande — desserrer son seuil aurait été le geste
   * facile et faux.
   *
   * Ce qui la remplace est PLUS FORT, et n'est plus une liste : on énumère
   * `src/pages/dev` DEPUIS L'ARBRE, et tout fichier qu'`App.tsx` référence doit
   * passer par le ternaire. Un banc neuf devra donc être gelé, ou justifier sa
   * sortie dans un DIFF — la liste, elle, ne l'aurait jamais vu arriver.
   *
   * ⚠ UNE SEULE EXCEPTION, ET CE N'EST PAS UN BANC. `MeggaXStyleGuidePage` sert
   * `/design-system/megga-x`, que CLAUDE.md §3 désigne comme la seule route de
   * design system survivante. Elle est livrée DÉLIBÉRÉMENT.
   */
  it('aucune page de src/pages/dev n’échappe au ternaire — le dossier est couvert', () => {
    const scan = scanRoots([{ root: 'src/pages/dev', keep: (n) => /Page\.tsx$/.test(n) }])
    expect(emptyRoots(scan), 'racine vide : chemin cassé').toEqual([])
    expect(scan.files.length, 'plus aucune page de banc — la clause ne mesure rien').toBeGreaterThan(8)

    const SERVIE_DELIBEREMENT = new Set(['MeggaXStyleGuidePage'])
    const nus: string[] = []
    for (const abs of scan.files) {
      const nom = rel(abs).split('/').pop()!.replace('.tsx', '')
      if (SERVIE_DELIBEREMENT.has(nom)) continue
      // Une page qu'`App.tsx` ne référence pas n'est pas routée : rien à geler.
      if (!source.includes(`pages/dev/${nom}`)) continue
      const bloc = new RegExp(`const ${nom}\\s*=([\\s\\S]{0,400}?)\\n(?=const |// |/\\*|\\n)`)
      const m = source.match(bloc)
      if (!m) { nus.push(`${nom} : déclaration introuvable dans App.tsx`); continue }
      if (!/import\.meta\.env\.DEV/.test(m[1]!)) nus.push(`${nom} : `.concat('pas de ternaire DEV — ce banc PART en production'))
    }
    expect(nus, `banc de développement livré :\n  ${nus.join('\n  ')}`).toEqual([])
  })
})
