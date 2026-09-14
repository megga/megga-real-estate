/**
 * Garde-fou : le centre d'aide généré depuis Intercom (`getmegga.com/aide`).
 *
 * Quatre défauts SILENCIEUX sont possibles ici, et aucun ne se voit sur une page
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
 * 4. Le périmètre. Le centre d'aide Intercom est partagé avec Shield : sans filtre,
 *    un article Shield paraîtrait ici ; avec un filtre muet, une collection CRM
 *    oubliée dans la liste disparaîtrait de la page sans que rien ne le dise.
 *
 * Les fonctions pures sont éprouvées sur une charge utile de fixture — écrite
 * ici, jamais lue du dépôt : un test qui consomme le vrai corpus deviendrait le
 * second corpus que tout ce chantier cherche à éviter.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, globSync } from 'node:fs'
import { segment, grouper, contenuLocalise, normaliserRecherche, doitEchouerSur, restreindreAuxCollections } from '../../scripts/vitrine-aide.mjs'

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
  // Sans collection du tout, ni `parent_id` ni `parent_ids`. ⚠ Ce n'est PAS le cas
  // des sept articles que l'audit du 17.08.2026 croyait sans collection : leur
  // `parent_ids` les range (voir « range sous sa collection… » plus bas).
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

  it("range sous sa collection un article que seul `parent_ids` rattache", () => {
    // La forme des sept articles de la production : `parent_id: null`, la collection
    // dans `parent_ids`. Lu sur `parent_id` seul, le sommaire les rangeait sous
    // « Autres articles », et Intégrations comme Facturation n'y paraissaient jamais.
    const septieme = { ...ARTICLES[1], id: '15424993', parent_id: null, parent_ids: [19659047] }
    const groupes = grouper([ARTICLES[0], septieme], COLLECTIONS, 'fr')
    expect(groupes.map(g => [g.nom, g.articles.map(a => a.article.id)])).toEqual([['Démarrer', ['15424904', '15424993']]])

    // Rangé à deux endroits, il ne paraît qu'une fois : compteur et recherche le doubleraient.
    const deux = [...COLLECTIONS, { id: 19659048, name: 'Général' }]
    const double = { ...septieme, parent_ids: [19659048, 19659047] }
    expect(grouper([double], deux, 'fr').flatMap(g => g.articles.map(a => a.article.id))).toEqual(['15424993'])
  })
})

/**
 * Le centre d'aide Intercom est PLAT et PARTAGÉ : les collections du CRM côte à côte
 * avec « MEGGA Shield ». Types de l'API 2.11 : identifiants de collection en CHAÎNE,
 * parents d'article en ENTIER — le filtre doit rapprocher les deux.
 */
const CRM = ['19659046', '19659047', '19659048', '19659049']
const COLLECTIONS_PARTAGEES = [
  { id: '19659046', name: 'Intégrations', parent_id: null },
  { id: '19659047', name: 'Démarrer', parent_id: null },
  { id: '19659048', name: 'Général', parent_id: null },
  { id: '19659049', name: 'Facturation', parent_id: null },
  { id: '30000011', name: 'Rapports', parent_id: '19659048' },
  { id: '19749855', name: 'MEGGA Shield', parent_id: null },
  { id: '30000021', name: 'Shield — preuves', parent_id: '19749855' },
]
const article = (id: string, parents: { parent_id: number | null; parent_ids?: number[] }) =>
  ({ id, title: `Article ${id}`, description: '', body: '<p>…</p>', ...parents })
const CORPUS_PARTAGE = [
  article('1', { parent_id: 19659047, parent_ids: [19659047] }),
  article('2', { parent_id: 30000011, parent_ids: [30000011] }), // sous une collection du CRM
  article('3', { parent_id: null, parent_ids: [19659046] }), // la forme des sept articles réels
  article('4', { parent_id: 19659049, parent_ids: [] }), // l'exemple de la référence 2.11
  article('5', { parent_id: 19749855, parent_ids: [19749855] }),
  article('6', { parent_id: null, parent_ids: [30000021] }),
  article('7', { parent_id: 19659048, parent_ids: [19749855] }), // parent_ids fait foi
  article('8', { parent_id: null, parent_ids: [] }), // sans collection : n'appartient à aucun produit
]
const SHIELD = ['5', '6', '7']

describe("centre d'aide généré — les collections du CRM, nommées une à une", () => {
  it('ne garde que les collections du CRM et leurs descendantes : aucun article Shield ne survit', () => {
    // Le jour où un article Shield est publié dans le centre commun, il ne doit
    // paraître que sur megga.dev — jamais sur getmegga.com/aide.
    const { articles, collections } = restreindreAuxCollections(CORPUS_PARTAGE, COLLECTIONS_PARTAGEES, CRM)
    expect(articles.map(a => a.id)).toEqual(['1', '2', '3', '4'])
    expect(collections.map(c => c.name)).toEqual(['Intégrations', 'Démarrer', 'Général', 'Facturation', 'Rapports'])

    const groupes = grouper(articles, collections, 'fr')
    const rendus = groupes.flatMap(g => g.articles.map(x => x.article.id))
    expect(rendus.filter(id => SHIELD.includes(id)), 'article Shield sur le site du CRM').toEqual([])
    // Filtre et sommaire lisent l'article de la même façon : rien de ce qui est
    // gardé ne retombe sous « Autres articles ».
    expect(groupes.map(g => g.nom)).toEqual(['Intégrations', 'Démarrer', 'Facturation', 'Rapports'])
  })

  it('nomme chaque article écarté avec sa collection', () => {
    // Écarter est le cas normal pour Shield. C'est aussi le sort d'une collection CRM
    // oubliée dans la liste — et ce relevé, imprimé au build, est ce qui la montre.
    const { ecartes } = restreindreAuxCollections(CORPUS_PARTAGE, COLLECTIONS_PARTAGEES, CRM)
    expect(ecartes.map(e => [e.id, e.titre, e.collections])).toEqual([
      ['5', 'Article 5', ['MEGGA Shield']],
      ['6', 'Article 6', ['Shield — preuves']],
      ['7', 'Article 7', ['MEGGA Shield']],
      ['8', 'Article 8', []],
    ])
    const oubli = restreindreAuxCollections(CORPUS_PARTAGE, COLLECTIONS_PARTAGEES, CRM.filter(id => id !== '19659049'))
    expect(oubli.ecartes.find(e => e.id === '4')?.collections, 'collection CRM oubliée').toEqual(['Facturation'])
  })

  it("signale un identifiant de la liste qu'Intercom ne connaît pas", () => {
    // Le générateur s'arrête alors : une collection supprimée ou mal recopiée ferait
    // disparaître ses articles de la page sans un mot.
    expect(restreindreAuxCollections(CORPUS_PARTAGE, COLLECTIONS_PARTAGEES, [...CRM, '19659050']).inconnues).toEqual(['19659050'])
    expect(restreindreAuxCollections(CORPUS_PARTAGE, COLLECTIONS_PARTAGEES, CRM).inconnues).toEqual([])
  })

  it('accepte un identifiant en nombre dans la liste', () => {
    // Recopié depuis Intercom, il peut arriver sous l'une ou l'autre forme.
    expect(restreindreAuxCollections(CORPUS_PARTAGE, COLLECTIONS_PARTAGEES, CRM.map(Number)))
      .toEqual(restreindreAuxCollections(CORPUS_PARTAGE, COLLECTIONS_PARTAGEES, CRM))
  })

  it("le générateur filtre avant les GET, s'arrête sur une collection inconnue et nomme les écartés", () => {
    const src = readFileSync('scripts/vitrine-aide.mjs', 'utf-8')
    // Calculé puis ignoré, le filtre laisserait passer le corpus entier sans rougir.
    expect(src).toMatch(/restreindreAuxCollections\(publies, collections, COLLECTIONS_CRM\)/)
    expect(src).toMatch(/if \(perimetre\.inconnues\.length\)[\s\S]{0,600}process\.exit\(1\)/)
    expect(src).toMatch(/for \(const e of perimetre\.ecartes\)/)
    expect(src).toMatch(/for \(const a of perimetre\.articles\)/)
    expect(src).toMatch(/grouper\(articles, perimetre\.collections, langue\)/)
  })
})

describe("centre d'aide généré — plomberie", () => {
  it('passe le gate — index ET articles, dans les deux langues, sans ouvrir le reste', async () => {
    // ⛔ MESURE, pas lecture de fichier : on appelle le VRAI worker. C'est le
    // seul oracle qui distingue « la constante contient /aide » de « la requête
    // passe ».
    //
    // ⚠ ET LE GATE EST FORCÉ FERMÉ (`VITRINE_GATE: 'on'`), pas laissé à son
    // défaut. Ce test a été écrit le 17.08.2026, quand le défaut était FERMÉ ;
    // il a rougi le lendemain — non pas parce que l'exemption avait cassé, mais
    // parce que getmegga.com était repassée en accès libre (#1259) et que le témoin
    // `/pricing` répondait 200. Un test qui suit l'humeur de la production ne
    // mesure pas ce qu'il prétend : l'exemption doit tenir CHAQUE FOIS que le
    // gate est fermé, quel que soit son réglage du jour.
    //
    // Exempter l'index sans ses articles donnerait une table des matières dont
    // chaque lien répond 401 — le défaut décrit dans
    // `project_edge_gate_breaks_session_handover`. Et les articles anglais
    // vivent sous `/en/help/…`, que seul un test HORS LANGUE attrape.
    const { default: worker } = await import('../../sites/megga-vitrine/_worker.js')
    const env = { VITRINE_GATE: 'on', ASSETS: { fetch: async () => new Response('ok', { status: 200 }) } }
    const statut = async (chemin: string) =>
      (await worker.fetch(new Request('https://getmegga.com' + chemin), env)).status

    for (const chemin of ['/aide', '/aide/15424977-un-article', '/en/help', '/en/help/15424977-an-article']) {
      expect(await statut(chemin), `${chemin} doit passer le gate`).toBe(200)
    }
    // ⚠ Les témoins portent autant que les cas : sans eux, un gate accidentellement
    // grand ouvert ferait passer le test au vert.
    expect(await statut('/pricing'), 'le gate fermé doit rester fermé ailleurs').toBe(401)
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
    // Un corpus vide rendu par l'API ne doit jamais devenir une page publiée.
    expect(src).toMatch(/if \(!articles\.length\)[\s\S]{0,200}process\.exit\(1\)/)
  })

  it('ne casse que les builds qui peuvent atteindre le public', () => {
    // ⛔ LA RÈGLE N'EST PAS « SUIS-JE EN CI ». Elle l'a été, et ça se payait :
    // le build de PRÉVISUALISATION de Cloudflare — qui ne sert personne — faisait
    // rougir la PR pour un secret d'infrastructure absent de SON environnement,
    // pendant que GitHub Actions, lui, construisait la vraie page sans broncher.
    // Un rouge qui ne désigne rien d'actionnable dans le code finit par ne plus
    // être lu, et c'est le prochain rouge, celui qui compte, qu'on rate.
    //
    // Ce qui doit casser, c'est ce qui peut PUBLIER : Actions, et Cloudflare sur
    // la branche de production. Le reste dégrade vers la page d'attente, qui dit
    // elle-même ce qu'elle est.
    expect(doitEchouerSur({ CI: 'true' }), 'GitHub Actions publie').toBe(true)
    expect(
      doitEchouerSur({ CI: 'true', CF_PAGES: '1', CF_PAGES_BRANCH: 'main' }),
      'Cloudflare sur main publie aussi',
    ).toBe(true)
    expect(
      doitEchouerSur({ CI: 'true', CF_PAGES: '1', CF_PAGES_BRANCH: 'une-branche' }),
      'une prévisualisation ne sert personne',
    ).toBe(false)
    expect(doitEchouerSur({}), 'un poste local ne publie rien').toBe(false)
    // ⚠ `CF_PAGES` seul ne suffit pas à se dire prévisualisation : sans lui, une
    // variable de branche traînant dans un autre CI ouvrirait une échappatoire.
    expect(
      doitEchouerSur({ CI: 'true', CF_PAGES_BRANCH: 'une-branche' }),
      'hors Cloudflare, la branche ne veut rien dire',
    ).toBe(true)
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
