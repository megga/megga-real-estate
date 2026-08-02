/**
 * Garde-fou : la langue déduite du pays du visiteur (`/api/geo`).
 *
 * Pourquoi un test. L'arbitrage vit dans `sites/megga-vitrine/_worker.js`, qui
 * ne tourne QUE sur le réseau Cloudflare : `request.cf` est absent en local et
 * dans l'éditeur du tableau de bord, donc la table ne peut pas se vérifier en
 * ouvrant un navigateur. Sans ces assertions, une erreur de correspondance —
 * un canton oublié, un romand versé chez les alémaniques — ne se verrait qu'en
 * production, et seulement si quelqu'un se plaignait.
 *
 * Trois invariants sont gardés ici :
 *
 * 1. Les 26 cantons sont couverts, et exactement eux : la liste du worker est
 *    confrontée à `CANTONS` (src/lib/constants.ts), la seule liste canonique.
 * 2. Un code inconnu fait ABSTENIR, il ne tombe pas dans une langue par défaut.
 *    C'est la protection contre le `FL` du Liechtenstein rendu par
 *    `npaToCanton`, contre `CH-ZH` mal découpé et contre la chaîne vide.
 * 3. La langue du navigateur ne tranche qu'entre des langues plausibles là où
 *    se trouve la personne — un macOS en anglais à Genève ne bascule rien.
 */
import { describe, it, expect } from 'vitest'
import { CANTONS } from '@/lib/constants'
// @ts-expect-error -- worker Cloudflare en JS pur, sans déclaration de types
import * as worker from '../../sites/megga-vitrine/_worker.js'

const {
  LANGUE_PAR_CANTON,
  languesAcceptees,
  normaliserPays,
  normaliserSubdivision,
  origineAutorisee,
  resoudreLangue,
} = worker as {
  LANGUE_PAR_CANTON: Record<string, string>
  languesAcceptees: (entete: string | null) => string[]
  normaliserPays: (brut: unknown) => string | null
  normaliserSubdivision: (brut: unknown) => string | null
  origineAutorisee: (origine: string | null) => boolean
  resoudreLangue: (
    pays: string | null,
    subdivision: string | null,
    acceptLanguage: string | null,
  ) => { language: string; confidence: string; source: string }
}

describe('géo — la table des cantons couvre les 26, et rien d\'autre', () => {
  it('chaque canton de CANTONS a une langue', () => {
    const sansLangue = CANTONS.filter((c) => !LANGUE_PAR_CANTON[c])
    expect(sansLangue, `cantons sans langue : ${sansLangue.join(', ')}`).toEqual([])
  })

  it('la table n\'invente aucun canton', () => {
    const inconnus = Object.keys(LANGUE_PAR_CANTON).filter(
      (c) => !(CANTONS as readonly string[]).includes(c)
    )
    expect(inconnus, `codes absents de CANTONS : ${inconnus.join(', ')}`).toEqual([])
  })

  it('la répartition linguistique est celle attendue', () => {
    const parLangue = Object.entries(LANGUE_PAR_CANTON).reduce<Record<string, string[]>>(
      (acc, [canton, langue]) => {
        (acc[langue] ||= []).push(canton)
        return acc
      },
      {}
    )
    expect(parLangue.fr.sort()).toEqual(['FR', 'GE', 'JU', 'NE', 'VD', 'VS'])
    expect(parLangue.it).toEqual(['TI'])
    expect(parLangue.de).toHaveLength(19)
    // Les quatre plurilingues, arbitrés à l'échelle du canton (cf. _worker.js).
    expect(LANGUE_PAR_CANTON.BE).toBe('de')
    expect(LANGUE_PAR_CANTON.GR).toBe('de')
    expect(LANGUE_PAR_CANTON.FR).toBe('fr')
    expect(LANGUE_PAR_CANTON.VS).toBe('fr')
  })

  it('aucun canton ne se voit proposer une langue que le produit ne parle pas', () => {
    for (const langue of Object.values(LANGUE_PAR_CANTON)) {
      expect(['fr', 'de', 'it', 'en']).toContain(langue)
    }
  })
})

describe('géo — normalisation des codes rendus par Cloudflare', () => {
  it('accepte un code pays à deux lettres, quelle que soit la casse', () => {
    expect(normaliserPays('ch')).toBe('CH')
    expect(normaliserPays(' FR ')).toBe('FR')
  })

  it('rejette tout ce qui n\'est pas un code pays', () => {
    for (const brut of [null, undefined, '', 'CHE', 'X', 42, {}]) {
      expect(normaliserPays(brut)).toBeNull()
    }
  })

  it('retire le préfixe pays d\'une subdivision ISO 3166-2', () => {
    // Sans ce retrait, `CH-GE` serait indistinguable d'un canton inconnu et
    // ferait taire la détection sans que rien ne le signale.
    expect(normaliserSubdivision('CH-GE')).toBe('GE')
    expect(normaliserSubdivision('ge')).toBe('GE')
    expect(normaliserSubdivision(null)).toBeNull()
  })
})

describe('géo — Accept-Language, trié par q', () => {
  it('rend les langues de la plus voulue à la moins voulue', () => {
    // `de-CH` n'a pas de q : il vaut 1, donc il passe devant, quoique écrit en
    // deuxième. Rien n'oblige un navigateur à envoyer sa liste déjà triée.
    expect(languesAcceptees('en;q=0.3,de-CH,fr;q=0.8')).toEqual(['de', 'fr', 'en'])
  })

  it('respecte l\'ordre d\'apparition à poids égal', () => {
    expect(languesAcceptees('fr-CH,de-CH,it-CH')).toEqual(['fr', 'de', 'it'])
  })

  it('écarte q=0, le joker et les valeurs illisibles', () => {
    expect(languesAcceptees('de;q=0,fr')).toEqual(['fr'])
    expect(languesAcceptees('*')).toEqual([])
    expect(languesAcceptees(null)).toEqual([])
    expect(languesAcceptees('')).toEqual([])
  })
})

describe('géo — Suisse', () => {
  it('déduit la langue du canton quand le navigateur ne dit rien d\'utile', () => {
    expect(resoudreLangue('CH', 'GE', null)).toMatchObject({ language: 'fr', confidence: 'high', source: 'canton' })
    expect(resoudreLangue('CH', 'ZH', null)).toMatchObject({ language: 'de', confidence: 'high' })
    expect(resoudreLangue('CH', 'TI', null)).toMatchObject({ language: 'it', confidence: 'high' })
  })

  it('le navigateur bat l\'adresse IP — le Genevois derrière un VPN zurichois', () => {
    // Le cas qui justifie à lui seul de lire Accept-Language : l'IP dit Zurich,
    // la personne dit français. C'est la personne qui a raison.
    expect(resoudreLangue('CH', 'ZH', 'fr-CH,fr;q=0.9')).toMatchObject({
      language: 'fr',
      confidence: 'high',
      source: 'accept-language',
    })
  })

  it('un macOS en anglais à Genève ne bascule rien', () => {
    // `en` n'est pas une langue plausible en Suisse : on retombe sur le canton.
    expect(resoudreLangue('CH', 'GE', 'en-US,en;q=0.9')).toMatchObject({
      language: 'fr',
      source: 'canton',
    })
    expect(resoudreLangue('CH', 'ZH', 'en-GB')).toMatchObject({ language: 'de', source: 'canton' })
  })

  it('S\'ABSTIENT quand le canton est inconnu', () => {
    // Mobile derrière un CGNAT, relais privé iCloud, VPN : le pays est là, la
    // subdivision non. La réponse est le défaut produit, mais `low` dit à
    // l'appelant de ne RIEN proposer.
    for (const subdivision of [null, '', 'FL', 'XX', 'ZZ']) {
      expect(resoudreLangue('CH', subdivision, null)).toMatchObject({
        language: 'fr',
        confidence: 'low',
        source: 'defaut',
      })
    }
  })
})

describe('géo — hors de Suisse', () => {
  it('reconnaît les pays de nos trois langues', () => {
    expect(resoudreLangue('DE', null, null)).toMatchObject({ language: 'de', confidence: 'medium' })
    expect(resoudreLangue('LI', null, null)).toMatchObject({ language: 'de' })
    expect(resoudreLangue('FR', null, null)).toMatchObject({ language: 'fr' })
    expect(resoudreLangue('IT', null, null)).toMatchObject({ language: 'it' })
  })

  it('la langue du navigateur ne renverse pas un pays monolingue', () => {
    // Un agent en Allemagne travaille en allemand, quelle que soit la langue
    // de son navigateur.
    expect(resoudreLangue('DE', null, 'fr-FR')).toMatchObject({ language: 'de', source: 'pays' })
  })

  it('sert le français aux francophones que le code pays trahit', () => {
    expect(resoudreLangue('MA', null, null)).toMatchObject({ language: 'fr' })
    expect(resoudreLangue('RE', null, null)).toMatchObject({ language: 'fr' })
    expect(resoudreLangue('NC', null, null)).toMatchObject({ language: 'fr' })
  })

  it('l\'anglais est le défaut, sauf si le navigateur demande une de nos langues', () => {
    expect(resoudreLangue('JP', null, null)).toMatchObject({ language: 'en', source: 'pays-defaut' })
    expect(resoudreLangue('JP', null, 'ja,en;q=0.8')).toMatchObject({ language: 'en' })
    expect(resoudreLangue('PL', null, 'pl,it;q=0.7')).toMatchObject({
      language: 'it',
      source: 'accept-language',
    })
  })

  it('sans pays du tout, on s\'abstient', () => {
    // Hors réseau Cloudflare : `request.cf` est absent, on ne sait rien.
    expect(resoudreLangue(null, null, 'de-DE')).toMatchObject({ confidence: 'low', source: 'defaut' })
  })
})

describe('géo — origines admises en cross-origin', () => {
  it('admet le CRM et ses préversions', () => {
    expect(origineAutorisee('https://app.megga.ch')).toBe(true)
    expect(origineAutorisee('https://feat-geo.megga-app.pages.dev')).toBe(true)
    expect(origineAutorisee('http://localhost:5173')).toBe(true)
  })

  it('refuse tout le reste, y compris les suffixes trompeurs', () => {
    for (const origine of [
      null,
      '',
      'https://app.megga.ch.evil.com',
      'https://evil.com',
      'http://app.megga.ch',
      'https://megga-app.pages.dev.evil.com',
    ]) {
      expect(origineAutorisee(origine), `${origine} ne doit pas être admis`).toBe(false)
    }
  })
})
