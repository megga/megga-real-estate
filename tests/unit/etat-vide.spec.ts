/**
 * Garde-fou : l'ÉTAT VIDE du CRM — un idiome, trois registres, et la couleur du
 * titre comme seul porteur de sens.
 *
 * ── CE QUE CETTE GARDE TIENT ─────────────────────────────────────────────────
 * 1. Les trois encres passent l'AA sur la carte de LEUR thème. Une garde d'un
 *    seul thème serait passée au vert dans les deux sens : les teintes de la
 *    vitrine tiennent en sombre (6,4 à 12:1) et échouent TOUTES en clair (1,67 à
 *    3,11) — c'est précisément pourquoi ce composant ne les reprend pas.
 * 2. Ces encres sont les barreaux que le dépôt POSSÈDE, pas des valeurs
 *    inventées : la clause les DÉRIVE de `globals.css` au lieu de les recopier.
 *    ⚠ Elles y sont écrites en TRIPLETS RVB, pas en hexadécimal — une garde qui
 *    ne chercherait que `#rrggbb` n'y trouverait rien et passerait au vert sur
 *    une feuille entièrement fautive (leçon d'`admin-console.css`).
 * 3. Le composant ne porte ni ombre, ni fond, ni liseré. C'est la règle de
 *    `.mx-notice` (point 16 de `megga-x-additions.css`), citée dans son JSDoc :
 *    « la gravité passe par la couleur du titre et rien d'autre ».
 * 4. CLIQUET : les surfaces migrées passent par `EtatVide`. Une surface qui
 *    reviendrait à son propre bloc centré ferait rougir — c'est le seul moyen
 *    d'empêcher la troisième grammaire de renaître, puisqu'aucun balayage ne
 *    peut reconnaître « un état vide » dans du JSX quelconque.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { mxCrmPalette } from '@/components/megga-x-crm/tokens'
import { repoPath } from './helpers/fs-scan'

const COMPOSANT = 'src/components/crm/EtatVide.tsx'
const source = readFileSync(repoPath(COMPOSANT), 'utf-8')

/** Les encres, relues DANS le composant — jamais recopiées ici. */
function encres(): Record<string, { clair: string; sombre: string }> {
  const bloc = source.slice(source.indexOf('const ENCRE'), source.indexOf('export interface EtatVideProps'))
  const out: Record<string, { clair: string; sombre: string }> = {}
  for (const m of bloc.matchAll(/(\w+):\s*\{\s*clair:\s*'(#[0-9a-fA-F]{6})',\s*sombre:\s*([^}]+)\}/g)) {
    const brut = m[3]!.trim().replace(/,$/, '')
    const hex = /^'(#[0-9a-fA-F]{6})'$/.exec(brut)?.[1]
      // `MXC_SYSTEM.green400` — résolu, jamais sauté : une couleur qu'on ne sait
      // pas lire est REFUSÉE, sinon la clause passe au vert sur ce qu'elle ignore.
      ?? null
    expect(hex, `encre illisible pour « ${m[1]} » : ${brut}`).not.toBeNull()
    out[m[1]!] = { clair: m[2]!, sombre: hex! }
  }
  return out
}

const luminance = (hex: string): number => {
  const c = hex.replace('#', '')
  const v = (s: string) => {
    const x = parseInt(s, 16) / 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * v(c.slice(0, 2)) + 0.7152 * v(c.slice(2, 4)) + 0.0722 * v(c.slice(4, 6))
}
const ratio = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

/** `--nom: R G B;` → `#rrggbb`, la notation réelle de `globals.css`. */
function tripletsDe(bloc: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of bloc.matchAll(/--color-([a-z-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) {
    out[m[1]!] = '#' + [m[2], m[3], m[4]].map((v) => Number(v).toString(16).padStart(2, '0')).join('')
  }
  return out
}

describe('État vide — un idiome, trois registres', () => {
  it('la garde voit le composant et ses trois registres', () => {
    expect(source.length, 'composant introuvable ou vide').toBeGreaterThan(500)
    const e = encres()
    expect(Object.keys(e).sort()).toEqual(['aFaire', 'aJour', 'erreur', 'neutre'])
  })

  /**
   * ⛔ LES DEUX THÈMES, JAMAIS UN SEUL. Une encre réglée pour le sombre tombe
   * sous le seuil en clair, et l'inverse — c'est le pendant statique de « les
   * captures avaient été prises en SOMBRE ».
   */
  it('chaque registre passe l’AA sur la carte de son thème', () => {
    const carte = { clair: mxCrmPalette(false).cardBg, sombre: mxCrmPalette(true).cardBg }
    const faibles: string[] = []
    for (const [registre, v] of Object.entries(encres())) {
      for (const theme of ['clair', 'sombre'] as const) {
        const r = ratio(v[theme], carte[theme])
        if (r < 4.5) faibles.push(`${registre} ${theme} : ${v[theme]} sur ${carte[theme]} = ${r.toFixed(2)}:1`)
      }
    }
    expect(faibles, `encre sous l'AA :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  /**
   * Les encres DESCENDENT de ce que le dépôt possède — la clause le vérifie au
   * lieu de le supposer. Sans elle, un lot pourrait poser une valeur voisine et
   * plausible qui n'appartiendrait à aucune échelle.
   */
  it('les encres sont des barreaux que globals.css possède déjà', () => {
    const css = readFileSync(repoPath('src/styles/globals.css'), 'utf-8')
    // Deux blocs : le `:root` (clair) puis la surcharge sombre. On les sépare
    // sur la PREMIÈRE redéfinition de `--color-success-dark`.
    const coupure = css.indexOf('--color-success-dark', css.indexOf('--color-success-dark') + 1)
    expect(coupure, 'globals.css ne définit pas deux fois les tons sombres').toBeGreaterThan(0)
    const clair = tripletsDe(css.slice(0, coupure))
    const sombre = tripletsDe(css.slice(coupure - 200))
    expect(clair['success-dark'], 'le ton clair a disparu de globals.css').toBeTruthy()

    const e = encres()
    expect(e.aJour!.clair.toLowerCase()).toBe(clair['success-dark']!.toLowerCase())
    expect(e.aFaire!.clair.toLowerCase()).toBe(clair['warning-dark']!.toLowerCase())
    expect(e.aJour!.sombre.toLowerCase()).toBe(sombre['success-dark']!.toLowerCase())
    expect(e.aFaire!.sombre.toLowerCase()).toBe(sombre['warning-dark']!.toLowerCase())
    expect(e.erreur!.clair.toLowerCase()).toBe(clair['danger-dark']!.toLowerCase())
    expect(e.erreur!.sombre.toLowerCase()).toBe(sombre['danger-dark']!.toLowerCase())
  })

  /**
   * ⛔ NI OMBRE, NI FOND, NI LISERÉ. Le vide n'est pas un objet posé sur la
   * surface : c'est la surface qui n'a rien à montrer. Lui donner une carte —
   * ce que le Pipeline faisait — en fait un CONTENU qui dit qu'il n'y a pas de
   * contenu. Et c'est la règle explicite de `.mx-notice`.
   */
  it('le composant ne porte ni ombre, ni fond, ni liseré', () => {
    const sansCom = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    // ⛔ ON CAPTURE LA VALEUR, ON NE LA NIE PAS. La première version écrivait
    // `/\bborder\s*:\s*(?!0)/` — et elle attrapait `border: 0`. Un `\s*` peut
    // matcher ZÉRO caractère : le moteur revient en arrière, la lookahead voit
    // alors l'espace au lieu du chiffre, et la négation ne nie plus rien. Une
    // garde défaite par son propre retour arrière, muette et du bon côté du
    // verdict — famille de la n°14.
    const valeurs = (prop: RegExp): string[] =>
      [...sansCom.matchAll(prop)].map((m) => (m[1] ?? '').trim())
    const interdits: string[] = []
    if (/boxShadow\s*:/.test(sansCom)) interdits.push('une ombre')
    const fonds = valeurs(/\bbackground\s*:\s*([^,}\n]+)/g).filter((v) => !v.includes('sp.accent'))
    if (fonds.length) interdits.push(`un fond (${fonds.join(', ')})`)
    const filets = valeurs(/\bborder\s*:\s*([^,}\n]+)/g).filter((v) => v !== '0')
    if (filets.length) interdits.push(`un liseré (${filets.join(', ')})`)
    expect(interdits, `l'état vide s'est donné ${interdits.join(', ')}`).toEqual([])
  })

  /**
   * CLIQUET. Aucun balayage ne sait reconnaître « un état vide » dans du JSX
   * quelconque : la seule chose vérifiable est que les surfaces migrées passent
   * TOUJOURS par le composant. Une surface qui reviendrait à son propre bloc
   * centré ferait rougir ici — c'est ce qui empêche la troisième grammaire de
   * renaître.
   *
   * ⚠ Liste écrite à part, en dur, comme `PAGES_ACQUISES` : itérer ce qu'on
   * surveille le ferait rétrécir avec lui.
   *
   * ⚠ CE QUI N'Y EST PAS, ET POURQUOI — deux surfaces ont un vide qui n'est pas
   * un état vide, et les y forcer aurait perdu de l'information :
   *  · `RelanceSession` pose un cadre en TIRETS avec un appel à l'action. Le
   *    tireté dit « quelque chose vient ici » — c'est une invitation, pas un
   *    constat d'absence.
   *  · `AtlEmptyState` (atelier) est un ÉCRAN vide dessiné : quatorze libellés,
   *    une file, une annonce et un panneau « pourquoi ». Le réduire à un titre
   *    et une phrase supprimerait ce qu'il explique.
   * Les couvertures de premier lancement (`*FirstRun`) sont hors sujet : elles
   * se voient une fois, à l'ouverture d'un compte.
   */
  it('les surfaces migrées passent par EtatVide', () => {
    const ACQUISES = [
      'src/components/crm/today/PageAujourdhuiH.tsx',
      'src/components/crm/today/PageCatalogue.tsx',
      'src/components/crm/pipeline/PipelineTimeline.tsx',
      'src/pages/agent/PipelinePage.tsx',
      'src/components/crm/contacts-pager/ContactsPager.tsx',
      'src/components/crm/contacts-pager/ContactDetailPager.tsx',
      'src/components/crm/notifications/CrmNotificationsPopover.tsx',
      'src/components/crm/biens/pager/BpTopGallery.tsx',
      'src/components/crm/settings/SecuritySection.tsx',
      'src/components/crm-dossiers/kyc-wizard/KwStepContact.tsx',
      // Lot 4 du chantier KYC (16 août 2026). Les deux surfaces du pager
      // écrivaient leur vide à la main — une ligne alignée à gauche dans la
      // table, un bloc centré dans chaque colonne de la Vigie — soit deux
      // grammaires de plus dans le même écran.
      //
      // ⚠ ELLES N'ÉTAIENT PAS REGARDABLES avant ce lot, et pas parce qu'on n'y
      // pensait pas : l'état « Vide » du banc vidait AUSSI `profiles` et
      // `agencies`, donc le KYC tombait sur le mur d'identité et montrait
      // « Vérifiez l'identité de votre agence ». On croyait regarder une
      // surface, on regardait une garde. Le banc garde désormais un SOCLE.
      'src/components/crm-dossiers/kyc-pager/KycListPage.tsx',
      'src/components/crm-dossiers/kyc-pager/KycVigiePage.tsx',
      'src/components/crm/analytics/AxDashboard.tsx',
      'src/components/matching-recherche/MatchingRechercheHybride.tsx',
    ]
    // ⛔ ON CHERCHE L'USAGE, PAS LE NOM. La première version testait
    // `.includes('EtatVide')` — et elle restait VERTE quand une surface
    // remplaçait son rendu par un `<div>` : la ligne `import EtatVide …`
    // survivait au retrait, et le témoin la trouvait. Une garde qui se
    // satisfait d'un import valide une déclaration, pas un écran. Montré par
    // contrôle négatif, pas par relecture.
    const sans = ACQUISES.filter((f) => !/<EtatVide[\s/>]/.test(readFileSync(repoPath(f), 'utf-8')))
    expect(sans, `surface revenue à son propre état vide :\n  ${sans.join('\n  ')}`).toEqual([])
  })
})
