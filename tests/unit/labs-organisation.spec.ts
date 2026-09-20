/**
 * Le studio Labs — ce qui range, ce qui cherche, ce qui refait.
 *
 * Trois familles, et chacune garde une décision qu'un refactor casserait en silence :
 *
 *  · LE VOCABULAIRE DE STAGING EST CELUI DE LA FICHE BIEN. `useVirtualStaging` porte
 *    déjà les cinq styles du panneau « MEGGA Staging » ; les redire autrement donnerait
 *    à l'agent deux listes pour un seul produit. La garde confronte les deux jeux, et
 *    NOMME la seule exception (`autre`, qui classe une photo mais ne compose rien).
 *  · LA CONSIGNE COMPOSÉE NE LAISSE AUCUN TROU. Un `{{room}}` non résolu partirait tel
 *    quel au modèle — dans les quatre langues, pour huit pièces et cinq styles, soit
 *    320 phrases que personne ne relira jamais à la main.
 *  · LA PLAGE, LA RECHERCHE ET LA SÉLECTION sont les trois lectures pures dont dépend
 *    tout le rangement. Elles n'ont pas d'écran : si elles se trompent, l'agent range
 *    douze productions qu'il n'avait pas cochées.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  LABS_STAGING_ROOMS, LABS_STAGING_STYLES, LABS_VARIATIONS, LABS_LOCAL_PREFIX,
  labsCorrespond, labsEstLocale, labsFilter, labsNormaliser, labsPlage, labsSelectionEtat,
  labsStagingPrompt, labsTuileLocale, labsVariationsPossibles,
} from '@/lib/labs'
import { ROOM_TYPES, STAGING_STYLES } from '@/hooks/useVirtualStaging'
import type { LabsAsset } from '@/types/labs'

const LANGS = ['fr', 'de', 'en', 'it'] as const

const lire = (lng: string) => JSON.parse(readFileSync(`src/i18n/locales/${lng}/labs.json`, 'utf8')) as Record<string, unknown>
const chemin = (o: Record<string, unknown>, p: string): unknown =>
  p.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), o)

/** Un `t` minimal : il lit le vrai JSON et interpole comme i18next. */
const traducteur = (lng: string) => {
  const dict = lire(lng)
  return (cle: string, params?: Record<string, string>): string => {
    const v = chemin(dict, cle)
    if (typeof v !== 'string') throw new Error(`${lng}: clé absente — ${cle}`)
    return v.replace(/\{\{(\w+)\}\}/g, (_, k: string) => params?.[k] ?? `{{${k}}}`)
  }
}

const faux = (o: Partial<LabsAsset> & Pick<LabsAsset, 'id'>): LabsAsset => ({
  folderId: null, createdBy: null, kind: 'image', status: 'ready', prompt: null,
  voiceoverText: null, voiceoverVoice: null, voiceoverLang: null, voiceoverUrl: null,
  sourceAssetId: null, url: null, thumbnailUrl: null, width: null, height: null,
  durationS: null, aspectRatio: null, model: null, errorCode: null, costChf: null,
  isFavorite: false, createdAt: '2026-09-20T10:00:00Z', completedAt: null, ...o,
})

describe('labs — le staging parle la langue de la fiche bien', () => {
  it('les cinq styles sont EXACTEMENT ceux de `useVirtualStaging`', () => {
    expect([...LABS_STAGING_STYLES]).toEqual(STAGING_STYLES.map((s) => s.value))
  })

  it('les pièces sont celles de la fiche, moins le fourre-tout `autre`', () => {
    const fiche = ROOM_TYPES.map((r) => r.value)
    // ⛔ L'exception est NOMMÉE : un préréglage « autre » ne compose aucune phrase utile.
    // Toute AUTRE divergence fait rougir — c'est le point de la garde.
    expect([...LABS_STAGING_ROOMS]).toEqual(fiche.filter((r) => r !== 'autre'))
  })

  it('chaque style garde son indice descriptif, dans les quatre langues', () => {
    for (const lng of LANGS) {
      const d = lire(lng)
      for (const st of LABS_STAGING_STYLES) {
        expect(chemin(d, `staging.styles.${st}`), `${lng}: staging.styles.${st}`).toBeTypeOf('string')
        expect(chemin(d, `staging.hints.${st}`), `${lng}: staging.hints.${st}`).toBeTypeOf('string')
      }
      for (const r of LABS_STAGING_ROOMS) {
        expect(chemin(d, `staging.rooms.${r}`), `${lng}: staging.rooms.${r}`).toBeTypeOf('string')
      }
    }
  })
})

describe('labs — la consigne composée ne laisse aucun trou', () => {
  it('320 phrases (4 langues × 8 pièces × 5 styles × 2 cas) sont pleines', () => {
    let n = 0
    for (const lng of LANGS) {
      const t = traducteur(lng)
      for (const room of LABS_STAGING_ROOMS) {
        for (const style of LABS_STAGING_STYLES) {
          for (const avecSource of [true, false]) {
            const phrase = labsStagingPrompt(t, room, style, avecSource)
            // ⛔ Un `{{room}}` non résolu partirait TEL QUEL au modèle.
            expect(phrase, `${lng}/${room}/${style}/${avecSource}`).not.toContain('{{')
            expect(phrase.length, `${lng}/${room}/${style}/${avecSource}`).toBeGreaterThan(40)
            n += 1
          }
        }
      }
    }
    expect(n).toBe(LANGS.length * LABS_STAGING_ROOMS.length * LABS_STAGING_STYLES.length * 2)
  })

  it('avec une photo source, la consigne EXIGE de garder l’existant', () => {
    const t = traducteur('fr')
    const avec = labsStagingPrompt(t, 'salon', 'scandinavian', true)
    const sans = labsStagingPrompt(t, 'salon', 'scandinavian', false)
    // ⚠ C'est la clause qui sépare un meublement d'une image inventée : sans elle, le
    // modèle refait la pièce, et la photo ne montre plus le bien qu'on vend.
    expect(avec).toMatch(/architecture/i)
    expect(sans).not.toMatch(/architecture/i)
    expect(avec).not.toBe(sans)
  })

  it('la pièce et le style choisis se lisent dans la phrase', () => {
    const t = traducteur('fr')
    const phrase = labsStagingPrompt(t, 'cuisine', 'luxury', true)
    expect(phrase).toContain(t('staging.rooms.cuisine'))
    expect(phrase).toContain(t('staging.styles.luxury'))
    expect(phrase).toContain(t('staging.hints.luxury'))
  })
})

describe('labs — la plage Maj+clic suit la LISTE', () => {
  const ordre = ['a', 'b', 'c', 'd', 'e']

  it('prend les deux bouts, dans les deux sens', () => {
    expect(labsPlage(ordre, 'b', 'd')).toEqual(['b', 'c', 'd'])
    expect(labsPlage(ordre, 'd', 'b')).toEqual(['b', 'c', 'd'])
  })

  it('une plage d’un seul élément est cet élément', () => {
    expect(labsPlage(ordre, 'c', 'c')).toEqual(['c'])
  })

  it('une ancre disparue ne perd pas le clic — elle coche la cible seule', () => {
    // ⚠ Le cas arrive pour de vrai : l'ancre peut avoir été supprimée, ou sortir du
    // filtre entre deux clics. Rendre la liste ENTIÈRE ici cocherait tout l'écran.
    expect(labsPlage(ordre, 'zz', 'd')).toEqual(['d'])
    expect(labsPlage(ordre, 'b', 'zz')).toEqual([])
  })
})

describe('labs — la recherche', () => {
  it('plie les accents et la casse', () => {
    expect(labsNormaliser('  DÉCORÉE  ')).toBe('decoree')
    const a = faux({ id: 'x', prompt: 'Chambre décorée, lumière du soir' })
    expect(labsCorrespond(a, 'decoree')).toBe(true)
    expect(labsCorrespond(a, 'DECOREE')).toBe(true)
  })

  it('exige TOUS les mots — ajouter un mot resserre', () => {
    const a = faux({ id: 'x', prompt: 'Salon scandinave lumineux' })
    expect(labsCorrespond(a, 'salon')).toBe(true)
    expect(labsCorrespond(a, 'salon scandinave')).toBe(true)
    expect(labsCorrespond(a, 'salon marbre')).toBe(false)
  })

  it('lit aussi la voix off, et rend tout sur une requête vide', () => {
    const a = faux({ id: 'x', voiceoverText: 'Bienvenue aux Eaux-Vives' })
    expect(labsCorrespond(a, 'eaux-vives')).toBe(true)
    expect(labsCorrespond(a, '')).toBe(true)
  })

  it('se combine aux autres filtres, et laisse l’import introuvable par mot', () => {
    const liste = [
      faux({ id: 'a', prompt: 'Salon scandinave', folderId: 'f1' }),
      faux({ id: 'b', prompt: 'Cuisine marbre', folderId: 'f1' }),
      faux({ id: 'c', kind: 'upload', folderId: 'f1' }),
    ]
    expect(labsFilter(liste, { folderId: 'f1', view: 'all', kind: 'all', q: 'salon' }).map((x) => x.id)).toEqual(['a'])
    // ⚠ Une photo importée n'a ni prompt ni narration : c'est son dossier qui la
    // retrouve, et l'état vide de la recherche le dit à l'écran.
    expect(labsFilter(liste, { folderId: null, view: 'all', kind: 'all', q: 'photo' })).toEqual([])
    expect(labsFilter(liste, { folderId: null, view: 'all', kind: 'all', q: '  ' })).toHaveLength(3)
  })
})

describe('labs — ce que la barre de gestes peut proposer', () => {
  const liste = [
    faux({ id: 'a', isFavorite: true, url: 'https://x/1.jpg' }),
    faux({ id: 'b', isFavorite: true }),
    faux({ id: 'c', url: 'https://x/3.jpg' }),
  ]

  it('compte la sélection, ses fichiers, et retourne le geste favori', () => {
    expect(labsSelectionEtat(liste, new Set(['a', 'b']))).toEqual({ total: 2, telechargeables: 1, toutesFavorites: true })
    expect(labsSelectionEtat(liste, new Set(['a', 'c']))).toEqual({ total: 2, telechargeables: 2, toutesFavorites: false })
  })

  it('une sélection vide ne propose PAS « retirer des favoris »', () => {
    // ⚠ `every` sur une liste vide rend `true` : sans le garde-fou, la barre d'une
    // sélection vide annoncerait un retrait de favoris.
    expect(labsSelectionEtat(liste, new Set()).toutesFavorites).toBe(false)
  })

  it('ignore les identifiants qui ne sont plus dans la liste', () => {
    expect(labsSelectionEtat(liste, new Set(['zz'])).total).toBe(0)
  })
})

describe('labs — variations et tuiles en vol', () => {
  it('le nombre demandé se borne au quota restant', () => {
    expect(labsVariationsPossibles(4, 0, 50)).toBe(4)
    expect(labsVariationsPossibles(4, 48, 50)).toBe(2)
    expect(labsVariationsPossibles(4, 50, 50)).toBe(0)
    expect(labsVariationsPossibles(4, 60, 50)).toBe(0)
  })

  it('un quota nul — plan sans génération — laisse l’edge refuser, il ne devine pas', () => {
    // ⛔ `quota = 0` veut dire « l'écran ne sait pas », jamais « zéro restant » : le
    // plan Starter doit rendre le motif `upgrade_required` de l'edge, pas un blocage
    // muet de l'écran qui ne dirait pas pourquoi.
    expect(labsVariationsPossibles(2, 0, 0)).toBe(2)
  })

  it('les puces de variations restent un nombre qu’on juge d’un regard', () => {
    expect([...LABS_VARIATIONS]).toEqual([1, 2, 4])
  })

  it('une tuile locale se reconnaît, et n’est jamais confondue avec une ligne de base', () => {
    const tuile = labsTuileLocale({ ratio: '4:3', prompt: 'Salon', folderId: 'f1', n: 0 })
    expect(tuile.id.startsWith(LABS_LOCAL_PREFIX)).toBe(true)
    expect(labsEstLocale(tuile.id)).toBe(true)
    expect(tuile.status).toBe('pending')
    expect(tuile.folderId).toBe('f1')
    expect(labsEstLocale('2f5c1b9e-0000-4000-8000-000000000000')).toBe(false)
  })
})

describe('labs — les libellés du rangement existent dans les quatre langues', () => {
  const CLES = [
    'search.placeholder', 'search.aria', 'search.clear',
    'empty.searchTitle', 'empty.searchBody',
    'selection.all', 'selection.none', 'selection.cancel', 'selection.move',
    'selection.favorite', 'selection.unfavorite', 'selection.delete', 'selection.check', 'selection.uncheck',
    'selection.count_one', 'selection.count_other', 'selection.download_one', 'selection.download_other',
    'picker.title', 'picker.none', 'picker.newFolder',
    'thumb.move', 'thumb.redo',
    'lightbox.redo', 'lightbox.compare', 'lightbox.before', 'lightbox.after',
    'prompt.variations', 'prompt.variationsValue_one', 'prompt.variationsValue_other', 'prompt.estimateMany',
    'staging.title', 'staging.chip', 'staging.close', 'staging.room', 'staging.style',
    'staging.hintSource', 'staging.hintScratch', 'staging.promptSource', 'staging.promptScratch',
    'confirm.deleteLotTitle_one', 'confirm.deleteLotTitle_other', 'confirm.deleteLotBody',
    'errors.quota_partial',
  ]

  it('aucune clé ne manque, aucune n’est vide', () => {
    for (const lng of LANGS) {
      const d = lire(lng)
      for (const cle of CLES) {
        const v = chemin(d, cle)
        expect(v, `${lng}: ${cle}`).toBeTypeOf('string')
        expect((v as string).trim().length, `${lng}: ${cle} vide`).toBeGreaterThan(0)
      }
    }
  })

  it('les libellés interpolés gardent leurs variables', () => {
    for (const lng of LANGS) {
      const d = lire(lng)
      expect(chemin(d, 'selection.count_other'), `${lng}`).toContain('{{count}}')
      expect(chemin(d, 'prompt.estimateMany'), `${lng}`).toContain('{{chf}}')
      expect(chemin(d, 'prompt.estimateMany'), `${lng}`).toContain('{{n}}')
      expect(chemin(d, 'errors.quota_partial'), `${lng}`).toContain('{{n}}')
    }
  })
})
