/**
 * Garde-fou : le multilingue de la vitrine repose sur trois fichiers qui doivent
 * rester d'accord entre eux, sans qu'aucun outil ne le vérifie autrement.
 *
 * Pourquoi un test. Le 31 juillet 2026, un audit a trouvé 57 URL mortes en
 * production : le sélecteur de langue calculait `/de/` + chemin courant sans
 * savoir quelles pages existent en allemand. Rien ne l'avait signalé — les
 * suites e2e ne visitent pas la vitrine, et `npm run build` réussit très bien
 * en produisant des liens vers des fichiers absents.
 *
 * Trois invariants sont gardés ici :
 *
 * 1. Les slugs du GATE (`sites/megga-vitrine/_worker.js`) sont le miroir de ceux
 *    du GÉNÉRATEUR (`scripts/_shared/vitrine-i18n.mjs`). S'ils divergent, une
 *    page traduite publique répond 401 — la connexion allemande, par exemple.
 * 2. Les URL annoncées (canonical, hreflang) n'ont pas d'extension `.html` :
 *    Cloudflare Pages redirige `/preise.html` en 308 vers `/preise`, et désigner
 *    une redirection à Google gaspille le signal.
 * 3. Les pages hors palier 1 — blog, légales, carrières — ne sont jamais
 *    préfixées : `/de/blog` n'existe pas, le lien doit rester français.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PAGES, LANGUES, urlLocalisee, pageExiste, fichierLocalise } from '../../scripts/_shared/vitrine-i18n.mjs'

const RACINE = resolve(__dirname, '../..')
const worker = readFileSync(resolve(RACINE, 'sites/megga-vitrine/_worker.js'), 'utf8')

/** Extrait `SLUGS_PAR_LANGUE` du worker sans l'exécuter (il exporte un handler Cloudflare). */
function slugsDuWorker(): Record<string, Record<string, string>> {
  const bloc = worker.match(/const SLUGS_PAR_LANGUE = (\{[\s\S]*?\n\});/)
  expect(bloc, 'SLUGS_PAR_LANGUE introuvable dans _worker.js').toBeTruthy()
  // eslint-disable-next-line no-new-func -- littéral d'objet du dépôt, pas une entrée utilisateur
  return new Function(`return ${bloc![1]}`)()
}

describe('vitrine i18n — le gate et le générateur parlent des mêmes URLs', () => {
  it('chaque slug traduit du générateur est connu du gate', () => {
    const duWorker = slugsDuWorker()
    const manquants: string[] = []

    for (const [fichier, slugs] of Object.entries(PAGES)) {
      const page = '/' + fichier.replace(/\.html$/, '')
      if (page === '/index' || page === '/404') continue
      for (const langue of LANGUES) {
        const slug = '/' + (slugs as Record<string, string>)[langue]
        if (slug === page) continue // slug identique au français : rien à mapper
        if (duWorker[langue]?.[page] !== slug) manquants.push(`${langue}: ${page} → ${slug}`)
      }
    }

    expect(manquants, `slugs absents du gate (une page publique répondrait 401) :\n${manquants.join('\n')}`).toEqual([])
  })

  it('le gate n\'invente pas de slug que le générateur n\'écrit pas', () => {
    const duWorker = slugsDuWorker()
    const inconnus: string[] = []

    for (const [langue, table] of Object.entries(duWorker)) {
      for (const [page, slug] of Object.entries(table)) {
        const fichier = page.replace(/^\//, '') + '.html'
        const attendu = (PAGES as Record<string, Record<string, string>>)[fichier]?.[langue]
        if (!attendu || '/' + attendu !== slug) inconnus.push(`${langue}: ${page} → ${slug}`)
      }
    }

    expect(inconnus, `slugs du gate sans contrepartie générée :\n${inconnus.join('\n')}`).toEqual([])
  })
})

describe('vitrine i18n — les URL annoncées sont celles réellement servies', () => {
  it('aucune URL localisée ne porte l\'extension .html', () => {
    const avecExtension = Object.keys(PAGES).flatMap((fichier) =>
      ['fr', ...LANGUES]
        .map((langue) => urlLocalisee('/' + fichier, langue))
        .filter((url) => url.endsWith('.html'))
    )
    expect(avecExtension, 'Cloudflare redirige ces formes en 308').toEqual([])
  })

  it('la racine de chaque langue est bien un dossier', () => {
    expect(urlLocalisee('/index.html', 'fr')).toBe('/')
    for (const langue of LANGUES) expect(urlLocalisee('/index.html', langue)).toBe(`/${langue}/`)
  })

  it('le fichier écrit sur le disque porte le slug de sa langue', () => {
    expect(fichierLocalise('pricing.html', 'fr')).toBe('pricing.html')
    expect(fichierLocalise('pricing.html', 'de')).toBe('preise.html')
    expect(fichierLocalise('pricing.html', 'it')).toBe('prezzi.html')
    expect(fichierLocalise('login.html', 'de')).toBe('anmelden.html')
  })
})

describe('vitrine i18n — les pages hors périmètre restent françaises', () => {
  const horsPerimetre = ['/blog.html', '/legal.html', '/privacy.html', '/terms.html', '/careers.html', '/changelog.html']

  it('ne sont jamais préfixées par une langue', () => {
    for (const page of horsPerimetre) {
      for (const langue of LANGUES) {
        expect(pageExiste(page, langue), `${page} n'est pas traduite`).toBe(false)
        expect(urlLocalisee(page, langue), `${page} en ${langue} doit rester français`).not.toMatch(
          new RegExp(`^/${langue}/`)
        )
      }
    }
  })

  it('un article de blog reste français dans toutes les langues', () => {
    for (const langue of LANGUES) {
      expect(urlLocalisee('/blog-posts/lba-2026-courtier-romand.html', langue)).toBe(
        '/blog-posts/lba-2026-courtier-romand'
      )
    }
  })
})
