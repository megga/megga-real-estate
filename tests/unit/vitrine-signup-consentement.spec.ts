/**
 * Inscription sur la vitrine : UNE case par document, et chacune est exigée.
 *
 * `signup.html` portait une seule case pour deux engagements (« J'accepte les
 * conditions générales et la politique de confidentialité »). Depuis le
 * 16.09.2026, les conditions générales et la politique de confidentialité ont
 * chacune leur ligne : on coche deux fois.
 *
 * Ce qui se teste ici, c'est le script qui GARDE ces cases
 * (`sites/megga-vitrine/js/megga-auth.js`), exécuté tel quel sur la vraie page,
 * Supabase et Turnstile simulés — aucun appel ne part. Trois portes créent un
 * compte : le formulaire, « Continuer avec Google », « Continuer avec
 * Microsoft ». Le `required` du HTML ne garde que la première, et seulement si
 * la page servie le porte : le script double la vérification parce que page et
 * script se mettent en cache séparément. L'évènement `submit` est donc émis
 * DIRECTEMENT, sans validation native — c'est la garde du script qu'on éprouve.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { LANGUES } from '../../scripts/_shared/vitrine-i18n.mjs'

const VITRINE = resolve(__dirname, '../../sites/megga-vitrine')
const lire = (fichier: string) => readFileSync(resolve(VITRINE, fichier), 'utf8')
const SCRIPT_AUTH = lire('js/megga-auth.js')

type Inscription = { options: { captchaToken?: string; data: Record<string, unknown> } }
type ConnexionOAuth = { provider: string }

const doms: JSDOM[] = []
afterEach(() => {
  // Le script arme un délai de captcha de 20 s : fermer la fenêtre l'annule.
  for (const dom of doms.splice(0)) dom.window.close()
})

/** Laisse filer les promesses du script (SDK, captcha, appel Supabase). */
const laisserFiler = () => new Promise((fin) => setTimeout(fin, 0))

/** Monte une page de la vitrine et y exécute megga-auth.js sur un client Supabase simulé. */
async function monter(page: 'signup.html' | 'login.html') {
  const dom = new JSDOM(lire(page), { runScripts: 'outside-only', url: 'https://getmegga.com/' })
  doms.push(dom)
  const signUp = vi.fn(async (_inscription: Inscription) => ({
    data: { user: { identities: [{}] }, session: null },
    error: null,
  }))
  const signInWithOAuth = vi.fn(async (_connexion: ConnexionOAuth) => ({ data: {}, error: null }))
  let rendreJeton: ((jeton: string) => void) | undefined

  const fenetre = dom.window as unknown as Record<string, unknown> & { eval(code: string): unknown }
  fenetre.supabase = { createClient: () => ({ auth: { signUp, signInWithOAuth } }) }
  fenetre.turnstile = {
    render: (_hote: unknown, options: { callback: (jeton: string) => void }) => {
      rendreJeton = options.callback
      return 'widget'
    },
    execute: () => rendreJeton?.('jeton-captcha'),
    remove: () => undefined,
  }
  // `window.eval` de jsdom (`runScripts: 'outside-only'`) : exécute un fichier
  // DU DÉPÔT dans la fenêtre isolée de la page, jamais une entrée extérieure.
  fenetre.eval(SCRIPT_AUTH)
  await laisserFiler()

  const doc = dom.window.document
  const cases = Array.from(doc.querySelectorAll<HTMLInputElement>('.megga-signup__consent input[type="checkbox"]'))
  const formulaire = doc.getElementById('wf-form-Sign-Up-Form')

  return {
    doc,
    cases,
    signUp,
    signInWithOAuth,
    cocher(etats: boolean[]) {
      cases.forEach((c, i) => { c.checked = etats[i] })
    },
    remplir() {
      const saisir = (id: string, valeur: string) => {
        ;(doc.getElementById(id) as HTMLInputElement).value = valeur
      }
      saisir('Name', 'Camille Rochat')
      saisir('Email', 'camille@exemple.ch')
      saisir('Password', 'un-mot-de-passe-solide')
      saisir('Phone', 'Agence Rochat')
    },
    async soumettre() {
      formulaire!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
      await laisserFiler()
    },
    async cliquer(fournisseur: 'Google' | 'Microsoft') {
      const bouton = Array.from(doc.querySelectorAll<HTMLElement>('.secondary-button.app-button'))
        .find((b) => (b.textContent ?? '').includes(fournisseur))
      expect(bouton, `bouton « Continuer avec ${fournisseur} » introuvable`).toBeTruthy()
      bouton!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await laisserFiler()
    },
    /** Texte du bloc d'erreur s'il est affiché, sinon null. */
    erreur() {
      const bloc = doc.querySelector<HTMLElement>('.w-form-fail')
      return bloc && bloc.style.display === 'block' ? (bloc.textContent ?? '').trim() : null
    },
  }
}

const CASES_INCOMPLETES: Array<[string, boolean[]]> = [
  ['aucune case cochée', [false, false]],
  ['conditions générales seules', [true, false]],
  ['politique de confidentialité seule', [false, true]],
]

describe('signup.html — une case par document', () => {
  it('porte deux cases obligatoires : conditions générales, puis politique de confidentialité', async () => {
    const { cases } = await monter('signup.html')

    expect(cases).toHaveLength(2)
    const liens = cases.map((c) => {
      expect(c.required, `la case #${c.id} doit être obligatoire`).toBe(true)
      return Array.from(c.closest('label')!.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    })
    // Un lien par ligne : une ligne qui nommerait les deux documents ferait
    // de nouveau accepter les deux d'un seul geste.
    expect(liens).toEqual([['/terms.html'], ['/privacy.html']])
  })
})

describe('megga-auth.js — le formulaire exige les deux cases', () => {
  it.each(CASES_INCOMPLETES)('%s : aucune inscription, le message nomme les deux documents', async (_cas, etats) => {
    const page = await monter('signup.html')
    page.remplir()
    page.cocher(etats)

    await page.soumettre()

    expect(page.signUp).not.toHaveBeenCalled()
    expect(page.erreur()).toContain('conditions générales')
    expect(page.erreur()).toContain('politique de confidentialité')
  })

  it("les deux cases cochées : l'inscription part, avec la preuve de consentement", async () => {
    const page = await monter('signup.html')
    page.remplir()
    page.cocher([true, true])

    await page.soumettre()

    expect(page.erreur()).toBeNull()
    expect(page.signUp).toHaveBeenCalledTimes(1)
    const [inscription] = page.signUp.mock.calls[0]
    expect(inscription.options.captchaToken).toBe('jeton-captcha')
    expect(inscription.options.data.legal_consent).toBe(true)
  })
})

describe('megga-auth.js — Google et Microsoft exigent aussi les deux cases', () => {
  it.each([
    ['Google', 'google'],
    ['Microsoft', 'azure'],
  ] as const)('%s : bloqué tant qu’une case manque, lancé quand les deux sont cochées', async (fournisseur, provider) => {
    const page = await monter('signup.html')

    for (const [, etats] of CASES_INCOMPLETES) {
      page.cocher(etats)
      await page.cliquer(fournisseur)
      expect(page.signInWithOAuth).not.toHaveBeenCalled()
      expect(page.erreur()).toContain('politique de confidentialité')
    }

    page.cocher([true, true])
    await page.cliquer(fournisseur)
    expect(page.signInWithOAuth).toHaveBeenCalledTimes(1)
    expect(page.signInWithOAuth.mock.calls[0][0].provider).toBe(provider)
  })

  it("login.html n'a aucune case : « Continuer avec Google » n'y est pas bloqué", async () => {
    // Le piège des ids Webflow : `checkbox-3` y est « Rester connecté ». Une
    // garde qui la prendrait pour un consentement bloquerait la connexion.
    const page = await monter('login.html')
    expect(page.cases).toHaveLength(0)

    await page.cliquer('Google')

    expect(page.signInWithOAuth).toHaveBeenCalledTimes(1)
  })
})

describe('traductions — chaque ligne de consentement est traduite', () => {
  /** Même normalisation que le générateur (scripts/vitrine-i18n.mjs). */
  const normaliser = (s: string) => s.replace(/\u00a0/g, ' ').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim()

  const { document } = new JSDOM(lire('signup.html')).window
  const bloc = document.querySelector('.megga-signup__consent')!
  const textes: string[] = []
  const marcheur = document.createTreeWalker(bloc, 4 /* NodeFilter.SHOW_TEXT */)
  for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
    if (n.nodeValue?.trim()) textes.push(normaliser(n.nodeValue))
  }

  it.each(LANGUES)('%s', (langue) => {
    const dictionnaire = JSON.parse(lire(`i18n/${langue}.json`)) as Record<string, string>
    const index = new Map(Object.entries(dictionnaire).map(([cle, valeur]) => [normaliser(cle), valeur]))

    expect(textes.length).toBeGreaterThan(0)
    // Une chaîne sans traduction reste en français sur la page traduite, sans
    // que rien ne le signale : la génération n'échoue pas.
    expect(textes.filter((t) => !index.get(t))).toEqual([])
  })
})
