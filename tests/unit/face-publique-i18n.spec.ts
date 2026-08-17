/**
 * La face publique parle la langue du CLIENT, pas celle du code.
 *
 * ── POURQUOI CETTE GARDE EXISTE ──────────────────────────────────────────────
 * ⛔ TROIS SURFACES CLIENTES N'AVAIENT AUCUNE TRADUCTION, et rien ne le disait.
 * Relevé le 17 août 2026 : `BuyerReceptionPage`, `VisitManagePage` et
 * `VisitFeedbackPage` ne montaient pas `useTranslation` du tout et portaient
 * ~66 chaînes françaises en dur. Un acheteur alémanique recevait sa sélection de
 * biens en français.
 *
 * ⚠ `lint:i18n` NE POUVAIT PAS LES VOIR : sa règle `i18next/no-literal-string`
 * ne s'applique qu'aux « surfaces agent verrouillées ». La face publique était
 * hors de son champ — le défaut n'était donc pas une régression, mais un angle
 * mort qui n'avait jamais été couvert.
 *
 * ── CE QUE CETTE GARDE MESURE, ET CE QU'ELLE NE MESURE PAS ───────────────────
 * Elle lit le TEXTE RENDU : le contenu littéral entre deux balises JSX, et les
 * chaînes passées aux props qui s'affichent (`placeholder`, `aria-label`, `alt`,
 * `title`, `label`). Elle ne juge pas la QUALITÉ d'une traduction — `i18n:parity`
 * s'en charge — seulement qu'aucune phrase ne court-circuite le mécanisme.
 *
 * ⛔ LE PÉRIMÈTRE EST DÉRIVÉ DU DOSSIER, JAMAIS ÉCRIT À LA MAIN. C'est la leçon
 * de `mlk-contraste`, qui annonçait « les six fichiers » alors qu'ils étaient
 * dix : une page neuve dans `src/pages/public/` entre ici d'office et doit se
 * justifier pour en sortir. Un périmètre figé rétrécit en silence.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'

const DOSSIER = 'src/pages/public'

/**
 * Les pages qui ne portent pas de copie cliente, avec leur motif. Une entrée
 * sans motif n'a rien à faire ici : c'est le motif qui force la décision.
 */
const EXEMPTES: Record<string, string> = {
  'NotFoundPage.tsx': 'un 404 — aucune copie de parcours',
  'AuthCallbackPage.tsx': "un écran d'attente technique, jamais lu",
  'AuthBentoPage.tsx': 'coquille morte, une seule route vivante sur quinze',
  'KycReportRenderPage.tsx':
    "le papier A4 du rapport KYC — rendu pour l'AGENT et son dossier, pas pour le client, et CLAUDE.md l'exempte déjà des règles de direction",
  'OnboardingCallManagePage.tsx':
    "suit les classes Webflow de la vitrine (`mx-appshell`, `pd-medium-*`), pas les jetons du CRM ; elle n'est ni sur le banc /dev/public ni dans les inventaires de cliquet",
}

/** Le code sans ses commentaires — une phrase française y est licite. */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/**
 * ⚠ DEUX FORMES, ET RATER LA SECONDE LAISSAIT PASSER LA MOITIÉ DU DÉFAUT :
 * le texte entre balises (`>Bonjour<`) et les props qui s'affichent
 * (`placeholder="Précisez…"`). Sur les trois pages corrigées, les props
 * portaient à elles seules le libellé de fermeture, celui du champ de note et
 * les intitulés d'étoiles.
 */
function phrasesEnDur(src: string): string[] {
  const code = sansCommentaires(src)
  const trouve: string[] = []

  for (const m of code.matchAll(/>\s*([A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ][^<>{}\n]{3,})\s*</g)) {
    trouve.push(m[1]!.trim())
  }
  for (const m of code.matchAll(
    /(?:placeholder|aria-label|alt|title|label)\s*=\s*["']([A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ][^"'\n]{3,})["']/g,
  )) {
    trouve.push(m[1]!.trim())
  }
  // Une majuscule suivie de minuscules accentuées : de la prose, pas un jeton.
  return trouve.filter((t) => /[a-zà-ÿ]{3}/.test(t) && !/^[A-Z][a-z]+[A-Z]/.test(t))
}

const PAGES = readdirSync(DOSSIER)
  .filter((f) => f.endsWith('.tsx'))
  .sort()

describe('Face publique — la langue du client', () => {
  it('le périmètre est dérivé du dossier, et les exemptions existent encore', () => {
    expect(PAGES.length, 'plus aucune page lue — le chemin a bougé').toBeGreaterThan(5)
    const fantomes = Object.keys(EXEMPTES).filter((f) => !PAGES.includes(f))
    expect(fantomes, `exemptée mais absente du dossier — retirer :\n  ${fantomes.join('\n  ')}`).toEqual([])
  })

  it('aucune page cliente ne parle français en dur', () => {
    const fautes: string[] = []
    for (const page of PAGES) {
      if (EXEMPTES[page]) continue
      const dur = phrasesEnDur(readFileSync(`${DOSSIER}/${page}`, 'utf-8'))
      if (dur.length) fautes.push(`${page} — ${dur.length} : ${dur.slice(0, 3).map((d) => `« ${d} »`).join(' ')}`)
    }
    expect(
      fautes,
      `du texte rendu court-circuite i18n :\n  ${fautes.join('\n  ')}\n` +
        'Passer par une clé, ou inscrire la page dans EXEMPTES avec son motif.',
    ).toEqual([])
  })

  /**
   * ⚠ LA LOCALE D'UNE DATE EST DU TEXTE, et c'est le défaut qu'un comptage de
   * chaînes ne voit pas. `VisitManagePage` écrivait
   * `toLocaleDateString('fr-CH')` : même traduite, la page rendait
   * « lundi 1 septembre » à un client zurichois. `dfLocale()` lit i18n.
   */
  it('aucune locale figée dans une page cliente', () => {
    const fautes: string[] = []
    for (const page of PAGES) {
      if (EXEMPTES[page]) continue
      const code = sansCommentaires(readFileSync(`${DOSSIER}/${page}`, 'utf-8'))
      // ⚠ `toLocaleDateString` et `toLocaleTimeString` SEULEMENT, et l'omission
      // de `toLocaleString` est délibérée : sur un NOMBRE, il ne rend pas de la
      // langue mais un FORMAT. `fmtCHF` écrit `toLocaleString('fr-CH')` puis
      // remplace les séparateurs par des apostrophes — c'est la convention
      // suisse, identique en allemand et en italien. La figer est correct ;
      // c'est la DATE qui doit suivre le client.
      for (const m of code.matchAll(/toLocale(?:Date|Time)String\(\s*['"]([a-z]{2}(?:-[A-Z]{2})?)['"]/g)) {
        fautes.push(`${page} — toLocale…String('${m[1]}')`)
      }
    }
    expect(
      fautes,
      `locale figée, la date ne suivra pas la langue :\n  ${fautes.join('\n  ')}\n` +
        'Utiliser `dfLocale()` de @/lib/utils avec date-fns.',
    ).toEqual([])
  })

  /**
   * ⛔ ET LA CLÉ STOCKÉE N'EST PAS LE LIBELLÉ AFFICHÉ. Les points forts, les
   * objections et les motifs de refus PARTENT AU BACKEND — `visits.ai_objections`
   * et `matches.reaction_motif`. Traduits, ils auraient stocké « Helligkeit »
   * pour un client alémanique et « Luminosité » pour un romand : la même donnée
   * sous deux formes, inexploitable en agrégation.
   *
   * Ces trois tableaux ne portent donc que des clés `snake_case`, et cette
   * clause rougit si une phrase y revient.
   */
  it('les valeurs envoyées au backend restent des clés, pas des libellés', () => {
    const fautes: string[] = []
    const cibles: Array<[string, string]> = [
      ['VisitFeedbackPage.tsx', 'STRENGTHS'],
      ['VisitFeedbackPage.tsx', 'OBJECTIONS'],
      ['BuyerReceptionPage.tsx', 'MOTIFS'],
    ]
    for (const [page, nom] of cibles) {
      const code = sansCommentaires(readFileSync(`${DOSSIER}/${page}`, 'utf-8'))
      const bloc = new RegExp(`const ${nom} = \\[([^\\]]*)\\]`).exec(code)
      expect(bloc, `${page} : ${nom} introuvable — la garde ne lit plus rien`).not.toBeNull()
      for (const m of bloc![1]!.matchAll(/'([^']+)'/g)) {
        if (!/^[a-z][a-z0-9_]*$/.test(m[1]!)) fautes.push(`${page} · ${nom} → « ${m[1]} »`)
      }
    }
    expect(
      fautes,
      `valeur stockée écrite en clair — elle divergera selon la langue :\n  ${fautes.join('\n  ')}`,
    ).toEqual([])
  })
})
