/**
 * Deux routes ne peuvent pas se partager un chemin — et rien, sans ce fichier, ne le dit.
 *
 * React Router classe les routes par spécificité et ne garde que la MEILLEURE. À score
 * égal, il garde la PREMIÈRE déclarée et la seconde devient injoignable : pas d'erreur,
 * pas d'avertissement, pas de page blanche. Le symptôme apparaît très loin de la cause,
 * chez un utilisateur qui suit un lien reçu par courriel et lit « lien invalide ».
 *
 * C'est arrivé : `/rendez-vous/:token` a été déclaré deux fois, pour le RDV de
 * vérification KYC puis pour l'appel d'accueil. La page d'accueil n'a jamais été servie,
 * et les liens de `onboarding-call-book|-manage|-reminder` tombaient sur la page KYC, qui
 * attend un jeton signé `k='appt'` et refusait leur UUID.
 *
 * Le test lit `src/App.tsx` comme TEXTE, à la manière de `token-routes.spec.ts` avec
 * `index.html` : ces routes ne s'importent pas sans monter tout l'arbre React.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { matchRoutes } from 'react-router'

const SOURCE = readFileSync(resolve(__dirname, '../../src/App.tsx'), 'utf8')

/**
 * Nombre de lignes qui SONT exactement la balise donnée.
 *
 * `App.tsx` parle de `<Routes>` sept fois : une balise et six mentions en JSDoc ou en
 * commentaire JSX. Compter les occurrences du texte en dirait donc sept. Dépouiller les
 * commentaires d'abord ne marche pas non plus — les chemins joker (`path="/help/*"`)
 * contiennent `/*` et ouvrent un faux commentaire qui avale la vraie balise. La ligne
 * entière, elle, ne ment pas : une mention en prose n'occupe jamais sa ligne seule.
 */
function lignesExactement(balise: string): number {
  return SOURCE.split('\n').filter((l) => l.trim() === balise).length
}

/**
 * Chemins ABSOLUS et leur composant, dans l'ordre de déclaration.
 *
 * Les chemins relatifs (enfants de `/dashboard`) sont hors périmètre : leur unicité se
 * juge par parent, ce que ce fichier ne reconstruit pas. Les absolus, eux, vivent tous
 * dans le `<Routes>` unique de ce fichier — la première assertion le vérifie, sans quoi
 * les suivantes ne prouveraient rien.
 */
function routesDeclarees(): Array<{ path: string; element: string }> {
  const out: Array<{ path: string; element: string }> = []
  const re = /<Route\s+path="(\/[^"]*)"\s+element=\{<(\w+)/gs
  for (const m of SOURCE.matchAll(re)) out.push({ path: m[1], element: m[2] })
  return out
}

/** Chemin concret navigable : les params prennent une valeur qui ne ressemble à rien. */
function chemininstancie(path: string): string {
  return path.replace(/:[^/]+/g, '__param__').replace(/\*$/, '__reste__')
}

describe('collisions de routes (src/App.tsx)', () => {
  const routes = routesDeclarees()

  it('un seul <Routes> porte les chemins absolus — prémisse des assertions suivantes', () => {
    // Sans cette prémisse, l'unicité vérifiée plus bas ne prouverait rien : deux blocs
    // frères peuvent légitimement porter le même chemin.
    expect(lignesExactement('<Routes>')).toBe(1)
    expect(lignesExactement('</Routes>')).toBe(1)
    expect(routes.length).toBeGreaterThan(50)
  })

  it('aucun chemin absolu déclaré deux fois', () => {
    const vus = new Map<string, string[]>()
    for (const r of routes) vus.set(r.path, [...(vus.get(r.path) ?? []), r.element])
    const doublons = [...vus.entries()].filter(([, els]) => els.length > 1)

    expect(
      doublons.map(([p, els]) => `${p} → ${els.join(' puis ')} (seul le premier est servi)`),
    ).toEqual([])
  })

  it('chaque route déclarée est bien celle que le routeur sert pour son propre chemin', () => {
    // Plus fort que l'unicité littérale : attrape aussi une route masquée par un motif
    // plus spécifique déclaré ailleurs, que la comparaison de texte ne verrait pas.
    const table = routes.map((r, i) => ({ path: r.path, id: `${i}:${r.element}` }))

    const masquees = routes.flatMap((r, i) => {
      const gagnant = matchRoutes(table, chemininstancie(r.path))?.[0]?.route.id
      return gagnant === `${i}:${r.element}` ? [] : [`${r.path} (${r.element}) masquée par ${gagnant ?? 'aucune'}`]
    })

    expect(masquees).toEqual([])
  })

  it("le lien d'accueil et le lien de RDV KYC ne partagent pas d'adresse", () => {
    // Régression nommée : les deux jetons ne sont pas de même nature (UUID brut contre
    // jeton signé), donc les deux adresses doivent rester distinctes.
    const accueil = routes.find((r) => r.element === 'OnboardingCallManagePage')
    const kyc = routes.find((r) => r.element === 'AppointmentManagePage')

    expect(accueil?.path).toBe('/rendez-vous-accueil/:token')
    expect(kyc?.path).toBe('/rendez-vous/:token')
  })
})
