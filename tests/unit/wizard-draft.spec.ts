/**
 * Garde-fou : le wizard « Créer un bien » n'affirme que ce qu'il fait.
 *
 * ⛔ CE QUI A MOTIVÉ CE FICHIER. Le pied du wizard affichait « Enregistrement
 * automatique » et faisait clignoter « Enregistré » à CHAQUE frappe, alors que
 * `createProperty` n'était appelé que dans `handlePublish` : aucune ligne en
 * base, aucun `localStorage`. Un agent qui fermait l'onglet à l'étape 6 perdait
 * tout son parcours, après avoir vu « Enregistré » cinquante fois.
 *
 * Un test de rendu n'aurait rien vu — le témoin s'affichait, simplement il
 * mentait. Ce qui se vérifie mécaniquement, c'est le LIEN entre le témoin et
 * une écriture réelle : si le composant peut dire « enregistré » sans qu'aucun
 * chemin d'écriture n'existe, le défaut est de retour.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { wizardPayload, wizardTitre } from '@/components/crm-sugar-wizard/useWizardDraft'
import { EMPTY_WIZARD, type WizardData } from '@/components/crm-sugar-wizard/tokens'

const SRC = 'src/components/crm-sugar-wizard'
const lire = (f: string) => readFileSync(`${SRC}/${f}`, 'utf-8')

/**
 * Retire commentaires de ligne et de bloc. Sans ça, la JSDoc de `_draftId` —
 * qui EXPLIQUE le retrait de `publishMode` — fait rougir la garde qui interdit
 * `publishMode`. Le garde-fou trébuche sur sa propre documentation ; défaut
 * déjà rencontré sur `t.primary` et sur `megga-x-grammar.spec.ts`.
 */
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

/** Un bien plausible, tel que le wizard l'aurait à l'étape Publication. */
const PLEIN: WizardData = {
  ...EMPTY_WIZARD,
  addr: 'Rue du Rhône 42', city: 'Genève', postCode: '1204',
  canton: 'Genève', cantonShort: 'GE',
  type: 'villa', transaction: 'vente', price: 1850000,
  area: 132, rooms: 4.5, bedrooms: 3, bathrooms: 2, year: 2019, energy: 'B',
  features: ['terrace'], description: 'Attique traversant.',
}

describe('Wizard — le brouillon automatique existe vraiment', () => {
  /**
   * Le témoin ne peut pas prétendre enregistrer sans chemin d'écriture. On
   * vérifie que le module du brouillon parle bien aux mutations Supabase —
   * c'est ce lien, et non l'affichage, qui manquait.
   */
  it('le brouillon écrit réellement en base', () => {
    const src = lire('useWizardDraft.ts')
    expect(src).toMatch(/useCreateProperty/)
    expect(src).toMatch(/useUpdateProperty/)
    expect(src).toMatch(/mutateAsync/)
  })

  /**
   * ⚠ Le verrou optimiste n'est pas un raffinement : le brouillon écrit en
   * boucle pendant que l'agent saisit, et la même fiche peut être ouverte dans
   * `/:id/edit`. Sans `expected_updated_at`, la sauvegarde écraserait
   * silencieusement l'autre édition.
   */
  it('les mises à jour passent le verrou optimiste', () => {
    expect(lire('useWizardDraft.ts')).toMatch(/expected_updated_at/)
  })

  /**
   * ⛔ UNE FRAPPE ARRIVÉE PENDANT UNE ÉCRITURE NE DOIT PAS ÊTRE PERDUE.
   *
   * La première version sortait sur `if (enVol.current) return` sans rien
   * reprogrammer : la passe était perdue définitivement, et comme le témoin
   * gardait l'état `enregistre` de l'écriture précédente, il affichait
   * « Enregistré » sur des données jamais écrites. Un témoin qui dit vrai la
   * plupart du temps est plus trompeur qu'un témoin qui ment toujours.
   *
   * On vérifie ici que le garde-fou de concurrence MÉMORISE au lieu d'abandonner
   * et qu'il relance après coup — pas seulement qu'il existe.
   */
  it('le brouillon ne perd pas une frappe survenue pendant une écriture', () => {
    const src = sansCommentaires(lire('useWizardDraft.ts'))
    expect(src, 'la passe concurrente est abandonnée sans être mémorisée')
      .not.toMatch(/if\s*\(\s*enVol\.current\s*\)\s*return/)
    expect(src).toMatch(/enAttente\.current\s*=\s*true/)
    // …et le `finally` doit relancer, sinon la mémorisation ne sert à rien.
    expect(src).toMatch(/finally[\s\S]{0,240}enAttente\.current[\s\S]{0,80}ecrireImpl\(\)/)
  })

  /**
   * ⛔ La charge utile est PARTAGÉE entre le brouillon et la publication. Deux
   * constructions parallèles divergeraient au premier champ ajouté, et l'agent
   * publierait alors autre chose que ce qu'il a vu enregistré. C'est déjà
   * arrivé sur la carte des types : `villa` valait `'villa'` dans la coquille
   * et `'house'` dans une copie — d'où l'unique `TYPE_TO_ENUM` ci-dessous.
   */
  it('la coquille publie la charge utile du brouillon, pas une copie', () => {
    const shell = lire('WizardShell.tsx')
    expect(shell).toMatch(/wizardPayload\(data, 'active'\)/)
    expect(shell).not.toMatch(/TYPE_TO_ENUM/)
  })

  it('la publication met à jour le brouillon au lieu d’en créer un second', () => {
    const shell = lire('WizardShell.tsx')
    expect(shell).toMatch(/data\._draftId[\s\S]{0,120}updateProperty\.mutateAsync/)
  })

  /**
   * Le mode de publication est retiré : deux de ses trois valeurs écrivaient le
   * MÊME `status: 'draft'`, et « Programmer » promettait une mise en ligne
   * différée qu'aucun cron n'assure. Le laisser revenir, c'est réintroduire la
   * promesse.
   */
  it('aucun mode de publication ne revient', () => {
    for (const f of ['tokens.ts', 'WizardShell.tsx', 'steps/Step7Publish.tsx', 'steps/Step8Success.tsx']) {
      expect(sansCommentaires(lire(f)), `${f} reparle de publishMode`).not.toMatch(/publishMode|scheduledAt/)
    }
  })

  it('le titre synthétisé n’est jamais vide — la colonne est NOT NULL', () => {
    expect(wizardTitre(EMPTY_WIZARD).trim().length).toBeGreaterThan(0)
    expect(wizardTitre(PLEIN)).toContain('Genève')
  })

  /**
   * Le brouillon écrit `draft`, la publication `active` — c'est tout ce qui
   * distingue les deux appels. Le reste de la charge est identique.
   */
  it('seul le statut sépare le brouillon de la publication', () => {
    const brouillon = wizardPayload(PLEIN, 'draft')
    const publie = wizardPayload(PLEIN, 'active')
    expect(brouillon.status).toBe('draft')
    expect(publie.status).toBe('active')
    expect({ ...brouillon, status: null }).toEqual({ ...publie, status: null })
  })

  it('la villa reste une villa', () => {
    // La divergence réelle trouvée entre les deux copies de la carte des types.
    expect(wizardPayload(PLEIN, 'draft').type).toBe('villa')
  })
})
