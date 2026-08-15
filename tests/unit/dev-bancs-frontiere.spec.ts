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
 * ⚠ CE FICHIER NE JUGE PAS QU'UN BANC DOIVE PARTIR EN PRODUCTION. Il constate
 * lesquels y sont, pour que l'exemption ne couvre que ceux qui n'y sont pas. Le
 * fait que sept bancs — dont `/dev/sentry-test`, qui déclenche des erreurs
 * Sentry — soient joignables sur `app.megga.ch` est une question de PRODUIT,
 * posée à part et non tranchée ici.
 */
import { describe, it, expect } from 'vitest'
import { readFileSafely, repoPath } from './helpers/fs-scan'

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
   * ⛔ ET LE CONTRÔLE POSITIF QUI EMPÊCHE LA CLAUSE PRÉCÉDENTE D'ÊTRE VRAIE PAR
   * CONSTRUCTION. Si `App.tsx` cessait d'employer le ternaire NULLE PART, la
   * clause ci-dessus resterait verte sur une liste vide de fautifs seulement
   * parce que plus rien ne matcherait — non : on exige que le dossier contienne
   * AUSSI des bancs livrés, sans quoi la frontière ne sépare rien.
   */
  it('la frontière sépare vraiment deux populations', () => {
    const gardes = BANCS_HORS_BUNDLE.length
    // Les bancs livrés, lus depuis les routes déclarées — pas depuis une liste.
    const routesDev = [...source.matchAll(/path="(\/dev\/[a-z-]+|\/design-system\/megga-x)"/g)].map((m) => m[1]!)
    expect(routesDev.length, 'plus aucune route de banc — la frontière ne sépare rien').toBeGreaterThan(gardes)
  })
})
