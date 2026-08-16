/**
 * LOT 0 du chantier « la garde visuelle » — MESURER son aveuglement avant de la
 * changer. Ce fichier ne garde presque rien : il produit les nombres qui
 * décident du reste, et il échoue si la mesure n'a pas pu se faire.
 *
 * ── ⛔ CE QU'IL A TROUVÉ, ET QUI A ANNULÉ DEUX LOTS ─────────────────────────
 * Relevé le 15 août 2026 (macOS, 1280 × 720) :
 *
 *   écran·thème      signal    plancher
 *   vide·clair        11,55 %   0,000 %
 *   vide·sombre       11,55 %   0,000 %
 *   peuple·clair      12,77 %   0,000 %
 *   peuple·sombre     12,61 %   0,000 %
 *
 * · **Peupler l'écran n'achète rien : ×1,1.** La prémisse du chantier — « la
 *   garde est aveugle parce qu'elle photographie un écran VIDE » — est FAUSSE.
 *   Après coup c'est évident : un changement de composition déplace des BORDS de
 *   colonnes, et les colonnes existent dans les deux états. Les cartes qu'on
 *   ajoute dedans ne bougent aucun bord. Les lots « écran peuplé » et
 *   « étendue » tombent.
 * · **Le plancher de bruit est NUL** — deux chargements de la même page rendent
 *   des images identiques au pixel près. C'est le nombre qui manquait à
 *   l'en-tête de `visual-regression.spec.ts` (« je n'ai pas de mesure du
 *   plancher réel »), et il dit qu'un seuil peut descendre très bas sans risquer
 *   le faux rouge. ⚠ Mesuré ICI : sur le runner Linux, polices et rendu
 *   diffèrent — à reconfirmer avant de poser le seuil.
 * · **Le levier est donc la MÉTRIQUE, pas le sujet.** Le même changement vaut
 *   11,55 % ici et 1,09 % sur la CI : un facteur dix, qui vient du seuil PAR
 *   PIXEL de Playwright (0,2, perceptuel), jamais du cadrage.
 *
 * ── POURQUOI ────────────────────────────────────────────────────────────────
 * `visual-regression.spec.ts` est la SEULE capture gardée du dépôt. Elle va sur
 * `/dashboard/pipeline` SANS session : la référence montre donc le pipeline dans
 * son état ERREUR + VIDE — quatre colonnes de teinte plate, aucune carte.
 *
 * Le 15 août 2026, le passage du kanban en feuille continue (rainures de 14 px
 * supprimées, rayons à 0, board qui bleede jusqu'aux quatre filets) a déplacé
 * cette capture de **10 067 pixels sur 921 600, soit 1,09 %**, contre un seuil
 * de 1 %. Un redesign complet, à un cheveu de la barre : le commit suivant est
 * repassé au VERT contre la même référence périmée.
 *
 * ⛔ Le mode d'échec est donc « VERTE ET FAUSSE » — la capture gardée décrit un
 * écran qui n'existe plus, et la porte l'accepte. Voir `megga/gardes-vacuites`
 * n° 44.
 *
 * ── CE QUE CE FICHIER MESURE, ET COMMENT ────────────────────────────────────
 * Pour chaque écran candidat et chaque thème : on photographie l'état ACTUEL,
 * puis on injecte le CSS qui restaure la composition d'AVANT, et on
 * rephotographie. L'écart entre les deux images est donc le vrai écart entre les
 * deux designs — pas une mutation inventée pour l'occasion.
 *
 * ⚠ LA COMPARAISON N'EST PAS CELLE DE PLAYWRIGHT. Elle se fait dans la page, au
 * canvas, faute de comparateur d'images installé — et sur une distance RGB, là
 * où Playwright emploie une métrique perceptuelle (YIQ, seuil 0,2). Les valeurs
 * ABSOLUES d'ici ne se comparent donc PAS au `maxDiffPixelRatio` de 1 %.
 * Ce qui se compare, et qui est robuste au choix de métrique, c'est le RAPPORT
 * entre les deux écrans — combien de sensibilité on gagne en photographiant
 * l'écran peuplé. Le seuil absolu, lui, se lira sur une exécution CI (lot 2).
 *
 * ⚠ Et les chiffres dépendent de la PLATEFORME : anti-aliasing et rendu de
 * police diffèrent entre macOS et le runner Linux. Le rapport survit, l'absolu
 * non.
 */
import { test, expect, type Page } from '@playwright/test'

/** La composition d'AVANT le 15 août — rainures, rayons, marges du cadre. */
const CSS_AVANT = `
  .sgPipeBoard > div { gap: 14px !important; padding-bottom: 8px !important; }
  .sgPipeBoard > div > * { border-radius: 20px !important; border-left: none !important; }
  .sgPipeBoard { margin-left: 0 !important; margin-right: 0 !important; margin-bottom: 0 !important; }
`

const ECRANS = [
  {
    id: 'vide',
    chemin: '/dashboard/pipeline',
    quoi: 'ce que la garde photographie AUJOURD’HUI — erreur + vide, sans session',
  },
  {
    id: 'peuple',
    chemin: '/dev/pipeline',
    quoi: 'l’écran PEUPLÉ proposé — le banc, 12 deals sur 8 colonnes, déterministe',
  },
] as const

const THEMES = [
  { id: 'clair', sombre: false },
  { id: 'sombre', sombre: true },
] as const

/** Photographie la page en base64, sans écrire de fichier. */
async function cliche(page: Page): Promise<string> {
  return (await page.screenshot({ fullPage: true })).toString('base64')
}

/**
 * Compte les pixels qui diffèrent entre deux PNG, DANS la page.
 *
 * ⛔ Rend `null` sur tout ce qu'elle ne sait pas comparer — deux tailles
 * différentes, une image qui ne se décode pas. Une comparaison qui rendrait 0
 * dans ces cas-là serait un succès silencieux, exactement la vacuité que ce
 * chantier existe pour lever.
 */
async function ecart(page: Page, a: string, b: string): Promise<{ diff: number; total: number } | null> {
  return page.evaluate(async ([ba, bb]) => {
    const charge = (b64: string) => new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('décodage'))
      i.src = 'data:image/png;base64,' + b64
    })
    const [ia, ib] = await Promise.all([charge(ba), charge(bb)])
    if (ia.width !== ib.width || ia.height !== ib.height) return null
    const px = (img: HTMLImageElement) => {
      const c = document.createElement('canvas')
      c.width = img.width; c.height = img.height
      const x = c.getContext('2d')
      if (!x) return null
      x.drawImage(img, 0, 0)
      return x.getImageData(0, 0, img.width, img.height).data
    }
    const da = px(ia), db = px(ib)
    if (!da || !db) return null
    let diff = 0
    // Tolérance par canal : au-dessus du bruit d'anti-aliasing, très en dessous
    // d'un changement de composition.
    for (let i = 0; i < da.length; i += 4) {
      if (Math.abs(da[i] - db[i]) > 12 || Math.abs(da[i + 1] - db[i + 1]) > 12 || Math.abs(da[i + 2] - db[i + 2]) > 12) diff++
    }
    return { diff, total: da.length / 4 }
  }, [a, b] as const)
}

const releve: Record<string, number> = {}
const plancherReleve: Record<string, number> = {}

test.describe('Sensibilité de la garde visuelle — mesure, pas garde', () => {
  for (const ecran of ECRANS) {
    for (const theme of THEMES) {
      test(`${ecran.id} · ${theme.id} — de combien bouge un redesign complet ?`, async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 720 })
        await page.addInitScript((s) => {
          window.localStorage.setItem('megga.sugar.dark', s ? '1' : '0')
          window.localStorage.setItem('megga-theme', s ? 'dark' : 'light')
        }, theme.sombre)
        await page.goto(ecran.chemin)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(800)

        // Sans lui, un écran qui ne monte pas rendrait deux images identiques,
        // donc un écart de 0 — et « la garde est aveugle » par vacuité.
        const colonnes = await page.locator('.sgPipeBoard').count()
        expect(colonnes, `${ecran.chemin} n'a pas monté le board`).toBeGreaterThan(0)

        const apres = await cliche(page)

        // ── PLANCHER DE BRUIT : la même page, rechargée, contre elle-même.
        // C'est le nombre qui manquait à l'en-tête de `visual-regression.spec.ts`
        // (« je n'ai pas de mesure du plancher réel ») — et sans lui, aucun seuil
        // ne se choisit autrement qu'au jugé.
        await page.reload()
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(800)
        const bis = await cliche(page)
        const rb = await ecart(page, apres, bis)
        expect(rb, 'plancher non mesurable').not.toBeNull()
        const plancher = (100 * rb!.diff) / rb!.total

        // ── SIGNAL : la composition d'AVANT contre celle d'aujourd'hui.
        await page.addStyleTag({ content: CSS_AVANT })
        await page.waitForTimeout(300)
        const avant = await cliche(page)
        const r = await ecart(page, avant, bis)
        expect(r, 'comparaison impossible — la mesure REFUSE au lieu de rendre 0').not.toBeNull()
        const pct = (100 * r!.diff) / r!.total

        releve[`${ecran.id}·${theme.id}`] = pct
        plancherReleve[`${ecran.id}·${theme.id}`] = plancher
        // eslint-disable-next-line no-console
        console.log(`  ${ecran.id.padEnd(7)} ${theme.id.padEnd(7)} → signal ${pct.toFixed(2)} %  ·  plancher ${plancher.toFixed(3)} %`)

        // La composition A CHANGÉ : si l'injection n'a rien fait, tout le reste
        // ne mesure rien.
        expect(pct, 'le CSS d’avant n’a rien déplacé — sélecteurs périmés ?').toBeGreaterThan(0.05)
      })
    }
  }

  /**
   * ⛔ CE QUE LE LOT 0 A TROUVÉ, ET QUI RÉFUTE SA PROPRE PRÉMISSE.
   *
   * Le chantier partait de l'idée que la garde est aveugle PARCE QU'ELLE
   * PHOTOGRAPHIE UN ÉCRAN VIDE, et qu'il fallait donc la déplacer sur le banc
   * peuplé — 2,5 jours chiffrés. Mesuré : l'écran vide bouge de 11,55 % et
   * l'écran peuplé de 12,61 %, soit un gain de **×1,1**. Peupler l'écran n'achète
   * RIEN, et c'est logique après coup : un changement de composition déplace des
   * BORDS de colonnes, or les colonnes existent dans les deux états — les cartes
   * qu'on ajoute dedans ne bougent aucun bord.
   *
   * ⛔ LE LEVIER EST DONC AILLEURS : dans la MÉTRIQUE, pas dans le sujet. Le même
   * changement mesure 11,55 % ici et **1,09 % sur la CI** — un facteur dix, qui
   * vient du seuil PAR PIXEL de Playwright (0,2, perceptuel), pas du cadrage.
   * L'en-tête de `visual-regression.spec.ts` le disait déjà sans pouvoir
   * conclure : « le seuil par pixel n'est délibérément pas touché […] je n'ai pas
   * de mesure du plancher réel. » C'est ce plancher que ce fichier mesure.
   *
   * La clause ci-dessous garde la seule chose qui doit rester vraie pour qu'un
   * seuil EXISTE : le signal doit dominer le bruit d'au moins un ordre de
   * grandeur. Si ce rapport s'effondre, aucun réglage ne sauvera la garde.
   */
  test('le signal domine le plancher de bruit — sans quoi aucun seuil n’existe', () => {
    const cles = Object.keys(releve)
    expect(cles.length, 'relevé incomplet : une mesure a sauté').toBe(ECRANS.length * THEMES.length)
    const lignes = cles.map((k) => {
      const s = releve[k]!, p = plancherReleve[k]!
      return { k, s, p, rapport: p > 0 ? s / p : Infinity }
    })
    // eslint-disable-next-line no-console
    console.log('\n  écran·thème      signal    plancher   rapport')
    for (const l of lignes) {
      // eslint-disable-next-line no-console
      console.log(`  ${l.k.padEnd(16)} ${l.s.toFixed(2).padStart(6)} %  ${l.p.toFixed(3).padStart(7)} %  ${Number.isFinite(l.rapport) ? '×' + Math.round(l.rapport) : '× ∞ (bruit nul)'}`)
    }
    const vide = Math.max(releve['vide·clair'] ?? 0, releve['vide·sombre'] ?? 0)
    const peuple = Math.min(releve['peuple·clair'] ?? 0, releve['peuple·sombre'] ?? 0)
    // eslint-disable-next-line no-console
    console.log(`\n  CONSTAT — peupler l'écran : ×${(peuple / vide).toFixed(1)} de sensibilité. Le sujet n'est pas le levier.\n`)

    const pire = Math.min(...lignes.map((l) => l.rapport))
    expect(pire, 'le signal ne domine plus le bruit : aucun seuil ne peut séparer les deux').toBeGreaterThan(10)
  })
})
