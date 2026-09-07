/**
 * La page d'accueil d'un onglet NEUF — les trois invariants qui pourriront.
 *
 * Ce n'est pas une suite de rendu : la page est une grille et un champ, et un
 * test qui compte des `<div>` mesure sa propre copie. Ce qui casse en silence,
 * ici, c'est autre chose :
 *
 *  1. Le CHEMIN doit rester hors des sections. `crmSidebarActiveFor` classe par
 *     spécificité et teste `/dashboard` en dernier — mais il le teste. Le jour où
 *     la sortie anticipée saute, un onglet neuf rallumera « Aujourd'hui » dans la
 *     barre latérale, et rien ne rougira : l'écran s'affiche parfaitement.
 *  2. Le chemin doit rester ÉLIGIBLE aux onglets. `HORS_ONGLETS` grandit ; l'y
 *     faire entrer par mégarde rendrait le « + » inopérant — il naviguerait sans
 *     jamais créer de puce.
 *  3. Chaque section de la barre doit avoir son SOUS-TITRE, dans les quatre
 *     langues. C'est le seul des trois qui se déclenche par un geste qui n'a rien
 *     à voir : ajouter une douzième destination à `CRM_SIDEBAR_GROUPS` — un
 *     fichier que personne ne relie à cette page — y poserait une carte au
 *     sous-titre VIDE. La grille se rend depuis la table de navigation, c'est sa
 *     qualité ; le prix est cette garde.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  CRM_BARRE_GROUPES, CRM_NEW_TAB_PATH, CRM_SIDEBAR_GROUPS, CRM_SIDEBAR_SECTIONS, crmSidebarActiveFor,
} from '@/components/crm/crmSidebarNav'
import { crmTabsEligible } from '@/hooks/useCrmTabs'

const LANGUES = ['fr', 'en', 'de', 'it'] as const

function common(lng: string): Record<string, unknown> {
  return JSON.parse(readFileSync(`src/i18n/locales/${lng}/common.json`, 'utf-8'))
}

describe('nouvel onglet — le chemin', () => {
  it("n'allume AUCUNE section de la barre latérale", () => {
    expect(crmSidebarActiveFor(CRM_NEW_TAB_PATH)).toBeNull()
  })

  it("reste distinct du cockpit, dont il porterait sinon la section", () => {
    // La démonstration de l'utilité de la sortie anticipée : sans elle, ce
    // chemin tomberait sur `today` par le simple préfixe.
    expect(CRM_NEW_TAB_PATH.startsWith('/dashboard/')).toBe(true)
    expect(crmSidebarActiveFor('/dashboard')).toBe('today')
  })

  it('est éligible aux onglets — sans quoi le « + » ne créerait aucune puce', () => {
    expect(crmTabsEligible(CRM_NEW_TAB_PATH)).toBe(true)
  })
})

describe('nouvel onglet — la SEULE voie vers huit destinations', () => {
  /**
   * ⛔ CE QUE CETTE SUITE GARDE, DEPUIS LE 7 SEPTEMBRE 2026. La barre latérale ne
   * rend plus qu'un groupe, « Mon jour » (décision Julien) : on n'atteint plus
   * une destination en la cliquant dans la barre, mais en ouvrant un onglet.
   * Cette page est donc devenue le seul chemin vers les huit autres.
   *
   * Le geste qui casserait ça n'est pas ici : c'est un « nettoyage » de
   * `crmSidebarNav.ts` par quelqu'un qui lit « la barre ne les affiche plus » et
   * en conclut que la table peut maigrir. La barre les filtre sur `barre: true` ;
   * la table, elle, doit rester ENTIÈRE.
   */
  it('la barre rend un sous-ensemble STRICT — la table garde tout', () => {
    expect(CRM_BARRE_GROUPES.length).toBeLessThan(CRM_SIDEBAR_GROUPS.length)
    for (const g of CRM_BARRE_GROUPES) expect(CRM_SIDEBAR_GROUPS).toContain(g)
    // Et le filtre est bien le drapeau, pas un rang ou un libellé.
    for (const g of CRM_SIDEBAR_GROUPS) {
      expect(CRM_BARRE_GROUPES.includes(g)).toBe(g.barre === true)
    }
  })

  it('⛔ toute destination ABSENTE de la barre reste dans la grille', () => {
    const dansLaBarre = new Set(CRM_BARRE_GROUPES.flatMap((g) => g.items).map((s) => s.id))
    const horsBarre = CRM_SIDEBAR_SECTIONS.filter((s) => !dansLaBarre.has(s.id))
    // Huit au 7 septembre 2026 — ce n'est pas le nombre qu'on fige, c'est le
    // fait qu'il y en ait, et qu'aucune ne soit tombée du modèle.
    expect(horsBarre.length).toBeGreaterThan(0)
    const rendues = new Set(CRM_SIDEBAR_GROUPS.flatMap((g) => g.items).map((s) => s.id))
    for (const s of horsBarre) expect(rendues.has(s.id)).toBe(true)
  })
})

describe('nouvel onglet — les sous-titres', () => {
  it('chaque section de la barre a son sous-titre, dans les quatre langues', () => {
    const manquants: string[] = []
    for (const lng of LANGUES) {
      const newTab = common(lng).newTab as { hints?: Record<string, string> } | undefined
      const hints = newTab?.hints ?? {}
      for (const s of CRM_SIDEBAR_SECTIONS) {
        const v = hints[s.id]
        if (typeof v !== 'string' || v.trim() === '') manquants.push(`${lng}:newTab.hints.${s.id}`)
      }
    }
    expect(manquants).toEqual([])
  })

  it("n'a pas de sous-titre ORPHELIN — une section retirée emporte le sien", () => {
    const connus = new Set(CRM_SIDEBAR_SECTIONS.map((s) => s.id))
    const orphelins: string[] = []
    for (const lng of LANGUES) {
      const newTab = common(lng).newTab as { hints?: Record<string, string> } | undefined
      for (const id of Object.keys(newTab?.hints ?? {})) {
        if (!connus.has(id as never)) orphelins.push(`${lng}:newTab.hints.${id}`)
      }
    }
    expect(orphelins).toEqual([])
  })

  it("le champ a son texte d'invite dans les quatre langues", () => {
    for (const lng of LANGUES) {
      const newTab = common(lng).newTab as { searchPlaceholder?: string } | undefined
      expect(newTab?.searchPlaceholder, lng).toBeTruthy()
    }
  })
})
