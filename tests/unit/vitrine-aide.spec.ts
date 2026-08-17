/**
 * Garde-fou : le centre d'aide généré depuis Intercom (`megga.ch/aide`).
 *
 * Trois défauts SILENCIEUX sont possibles ici, et aucun ne se voit sur une page
 * qui s'affiche :
 *
 * 1. Le gate. `sites/megga-vitrine/_worker.js` mure toute la vitrine derrière un
 *    mot de passe ; il est ouvert depuis le 16 août 2026, « à refermer sur le mot
 *    de Julien ». Le jour où il se referme, un centre d'aide non exempté répond
 *    401 — et exempter l'INDEX sans ses ARTICLES ne donne qu'une table des
 *    matières dont chaque lien est muré. C'est le défaut décrit dans
 *    `project_edge_gate_breaks_session_handover` : exempter une page ≠ exempter
 *    ses liens sortants.
 * 2. Le lien de nav. Il vit dans 31 fichiers HTML ; s'il repointait ailleurs
 *    pendant que le gate exempte `/aide`, personne ne le verrait avant la prod.
 * 3. Le chaînage. Le générateur tourne dans le `postbuild` ; retiré, la vitrine
 *    se déploierait avec un lien « Aide » qui rend 404, et le build resterait vert.
 *
 * Les fonctions pures sont éprouvées sur une charge utile de fixture — écrite
 * ici, jamais lue du dépôt : un test qui consomme le vrai corpus deviendrait le
 * second corpus que tout ce chantier cherche à éviter.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, globSync } from 'node:fs'
import { segment, grouper, contenuLocalise, normaliserRecherche } from '../../scripts/vitrine-aide.mjs'

/** Forme réelle de l'API Intercom 2.11, réduite à ce que le générateur lit. */
const ARTICLES = [
  {
    id: '15424904',
    title: 'Démarrer avec MEGGA',
    description: 'Les premiers pas.',
    body: '<p>Bonjour</p>',
    parent_id: 19659047,
    translated_content: {
      fr: { title: 'Démarrer avec MEGGA', description: 'Les premiers pas.', body: '<p>Bonjour</p>' },
      en: { title: 'Getting started with MEGGA', description: 'First steps.', body: '<p>Hello</p>' },
    },
  },
  // Sans collection : le cas que la production porte réellement — l'audit du
  // 17.08.2026 relève sept articles publiés sans collection sur dix-huit.
  {
    id: '15424962',
    title: 'Gérer ses contacts',
    description: '',
    body: '<p>Contacts</p>',
    parent_id: null,
    translated_content: { fr: { title: 'Gérer ses contacts', body: '<p>Contacts</p>' } },
  },
]
const COLLECTIONS = [{ id: 19659047, name: 'Démarrer', translated_content: { en: { name: 'Getting started' } } }]

describe("centre d'aide généré — fonctions pures", () => {
  it("nomme l'URL dans la langue servie, en gardant l'identifiant en tête", () => {
    // L'identifiant porte la stabilité (un titre corrigé ne casse aucun lien) ;
    // le titre porte le référencement, et il doit être celui de la LANGUE.
    expect(segment(ARTICLES[0], 'fr')).toBe('15424904-demarrer-avec-megga')
    expect(segment(ARTICLES[0], 'en')).toBe('15424904-getting-started-with-megga')
  })

  it('retombe sur la locale par défaut quand la traduction manque', () => {
    // Sans ce repli, un article non traduit rendrait une page VIDE en anglais —
    // publiée, indexable, et sans rien dedans.
    const en = contenuLocalise(ARTICLES[1], 'en')
    expect(en.title).toBe('Gérer ses contacts')
    expect(en.body).toBe('<p>Contacts</p>')
  })

  it("range les articles sans collection au lieu de les perdre", () => {
    const groupes = grouper(ARTICLES, COLLECTIONS, 'fr')
    const total = groupes.reduce((n, g) => n + g.articles.length, 0)
    expect(total, 'aucun article ne doit disparaître du sommaire').toBe(ARTICLES.length)
    expect(groupes.map(g => g.nom)).toEqual(['Démarrer', 'Autres articles'])
  })

  it('traduit le nom des collections', () => {
    expect(grouper(ARTICLES, COLLECTIONS, 'en')[0].nom).toBe('Getting started')
  })
})

describe("centre d'aide généré — plomberie", () => {
  it('passe le gate — index ET articles, dans les deux langues, sans ouvrir le reste', async () => {
    // ⛔ MESURE, pas lecture de fichier. On appelle le VRAI worker avec le gate
    // à son défaut (fermé depuis le 17.08.2026) : c'est le seul oracle qui
    // distingue « la constante contient /aide » de « la requête passe ».
    //
    // Exempter l'index sans ses articles donnerait une table des matières dont
    // chaque lien répond 401 — le défaut décrit dans
    // `project_edge_gate_breaks_session_handover`. Et les articles anglais
    // vivent sous `/en/help/…`, que seul un test HORS LANGUE attrape.
    const { default: worker } = await import('../../sites/megga-vitrine/_worker.js')
    const env = { ASSETS: { fetch: async () => new Response('ok', { status: 200 }) } }
    const statut = async (chemin: string) =>
      (await worker.fetch(new Request('https://megga.ch' + chemin), env)).status

    for (const chemin of ['/aide', '/aide/15424977-un-article', '/en/help', '/en/help/15424977-an-article']) {
      expect(await statut(chemin), `${chemin} doit passer le gate`).toBe(200)
    }
    // ⚠ Les témoins portent autant que les cas : sans eux, un gate accidentellement
    // grand ouvert ferait passer le test au vert.
    expect(await statut('/pricing'), 'le gate doit rester fermé ailleurs').toBe(401)
    expect(await statut('/legal'), 'les pages publiques préexistantes le restent').toBe(200)
  })

  it('est branché dans la chaîne de build', () => {
    const postbuild = readFileSync('scripts/overlay-storefront.mjs', 'utf-8')
    expect(postbuild, 'le générateur doit tourner au postbuild').toContain('scripts/vitrine-aide.mjs')
    // Après les langues : il prélève le chrome anglais sur dist/en/index.html.
    expect(postbuild.indexOf('vitrine-aide.mjs')).toBeGreaterThan(postbuild.indexOf('vitrine-i18n.mjs'))
  })

  it("refuse de publier un centre d'aide vide", () => {
    const src = readFileSync('scripts/vitrine-aide.mjs', 'utf-8')
    // Deux refus distincts : corpus vide rendu par l'API, et jeton absent en CI.
    expect(src).toMatch(/if \(!articles\.length\)[\s\S]{0,200}process\.exit\(1\)/)
    expect(src).toMatch(/process\.env\.CI[\s\S]{0,300}process\.exit\(1\)/)
  })

  it('porte le même lien « Aide » dans les 31 blocs de nav', () => {
    const fichiers = [
      ...globSync('sites/megga-vitrine/*.html'),
      ...globSync('sites/megga-vitrine/blog-posts/*.html'),
      ...globSync('sites/megga-vitrine-ds/components/*.html'),
    ]
    const avecNav = fichiers.filter(f => readFileSync(f, 'utf-8').includes('list-nav-menu'))
    const versAide = avecNav.filter(f => readFileSync(f, 'utf-8').includes('href="/aide"'))
    expect(avecNav.length, 'le relevé doit voir les blocs de nav').toBeGreaterThan(25)
    expect(versAide.length, `${avecNav.length - versAide.length} bloc(s) de nav sans lien /aide`).toBe(avecNav.length)
    // L'ancienne cible ne doit plus traîner : elle contournerait la page générée.
    const restes = avecNav.filter(f => /nav-link[^>]*intercom\.help/.test(readFileSync(f, 'utf-8')))
    expect(restes, 'nav pointant encore sur intercom.help').toEqual([])
  })

  it('cherche sans se soucier des accents, de la casse ni de la ponctuation', () => {
    // ⚠ Le texte est normalisé au BUILD, la requête à la FRAPPE. Les deux
    // passent par la même source (`SOURCE_NORMALISE`, injectée telle quelle dans
    // la page) — si elles divergeaient d'un accent, la recherche échouerait en
    // SILENCE : un article indexé « conformite » cesserait de répondre à
    // « conformité », sans erreur ni indice à l'écran.
    expect(normaliserRecherche('Conformité')).toBe(normaliserRecherche('CONFORMITE'))
    expect(normaliserRecherche('KYC, LBA…')).toBe('kyc lba')
    expect(normaliserRecherche(null)).toBe('')
  })

  it("embarque l'index de recherche sur la carte, pas dans une structure parallèle", () => {
    const src = readFileSync('scripts/vitrine-aide.mjs', 'utf-8')
    // Le texte cherchable est porté par la carte elle-même et couvre le CORPS :
    // limité aux titres, la recherche ne servirait presque à rien sur 18 fiches.
    expect(src).toMatch(/data-aide-texte="\$\{echapper\(normaliserRecherche\(/)
    expect(src).toMatch(/texteBrut\(contenuLocalise\(/)
    // La page reçoit la MÊME source de normalisation que celle utilisée ici.
    expect(src).toMatch(/var normalise = \$\{SOURCE_NORMALISE\}/)
  })
})
