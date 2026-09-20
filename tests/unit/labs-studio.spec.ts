/**
 * Le studio Labs — ce que l'écran PROMET et ce que l'edge APPLIQUE doivent dire la
 * même chose, et la section doit exister partout où une section existe.
 *
 *  · Les quotas et les formules de coût de `src/lib/labs.ts` sont le MIROIR de
 *    `supabase/functions/_shared/labs.ts` : un écart ferait annoncer une génération
 *    que le serveur refuse (ou l'inverse). Les deux modules sont importés et comparés.
 *  · Le catalogue des plans (`PLANS`) porte le poste `labs_video` aux mêmes paliers.
 *  · La barre latérale a une entrée `labs`, son libellé et son sous-titre d'onglet
 *    existent dans les quatre langues, et le namespace `labs` est chargé.
 *  · Les codes d'erreur que les edges rendent ont TOUS un libellé FR — un code sans
 *    libellé s'afficherait brut à l'écran (`errors.unknown` ne couvre que l'inconnu).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  LABS_QUOTAS, LABS_VOICEOVER_MAX_CHARS, LABS_VOICES, LABS_VOICE_LANGS, labsColonnes, labsEstimateChf, labsFilter,
  labsMonthUsage, labsVideoCostUsd, labsVideoDurationS, labsVoiceoverSeconds,
} from '@/lib/labs'
import {
  LABS_PLAN_QUOTAS, LABS_VOICEOVER_MAX_CHARS as EDGE_VO_MAX, LABS_VOICES as EDGE_VOICES,
  LABS_VOICE_LANGS as EDGE_LANGS, labsVideoCostUsd as edgeVideoCostUsd, labsVideoDuration as edgeVideoDuration,
} from '../../supabase/functions/_shared/labs'
import { PLANS } from '@/lib/plans'
import { CRM_SIDEBAR_SECTIONS, crmSidebarActiveFor } from '@/components/crm/crmSidebarNav'
import type { LabsAsset } from '@/types/labs'

const LANGS = ['fr', 'de', 'en', 'it'] as const
const lire = (lng: string, ns: string) => JSON.parse(readFileSync(`src/i18n/locales/${lng}/${ns}.json`, 'utf8')) as Record<string, unknown>
const chemin = (o: Record<string, unknown>, p: string): unknown => p.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), o)

describe('labs — l’écran est le miroir de l’edge', () => {
  it('quotas identiques, plan par plan', () => {
    expect(LABS_QUOTAS).toEqual(LABS_PLAN_QUOTAS)
  })
  it('même plafond de narration, mêmes voix, mêmes langues', () => {
    expect(LABS_VOICEOVER_MAX_CHARS).toBe(EDGE_VO_MAX)
    expect([...LABS_VOICES]).toEqual([...EDGE_VOICES])
    // ⚠ Une langue offerte à l'écran que l'edge refuserait retomberait en silence
    // sur le français : l'agent croirait avoir choisi, et n'aurait rien choisi.
    expect([...LABS_VOICE_LANGS]).toEqual([...EDGE_LANGS])
  })
  it('même barème vidéo au jeton', () => {
    for (const res of ['720p', '1080p'] as const) {
      for (const s of [4, 8, 15, 30]) expect(labsVideoCostUsd(res, s)).toBeCloseTo(edgeVideoCostUsd(res, s), 6)
    }
  })
  it('même règle de durée : la narration + 1 s, bornée 4–30', () => {
    expect(labsVideoDurationS(6.2, 8)).toBe(Number(edgeVideoDuration(6.2, 8)))
    expect(labsVideoDurationS(45, 8)).toBe(Number(edgeVideoDuration(45, 8)))
    expect(labsVideoDurationS(null, 2)).toBe(Number(edgeVideoDuration(null, 2)))
    expect(labsVideoDurationS(null, 12)).toBe(Number(edgeVideoDuration(null, 12)))
  })
  it('le catalogue des plans porte `labs_video` aux paliers du quota vidéo', () => {
    for (const plan of PLANS) {
      const f = plan.features.find((x) => x.key === 'labs_video')
      expect(f, `plan ${plan.id} sans poste labs_video`).toBeDefined()
      const quota = LABS_QUOTAS.video[plan.id]
      expect(f!.included).toBe(quota > 0)
      if (quota > 0) expect(f!.limit).toBe(quota)
    }
  })
})

describe('labs — estimations et lectures', () => {
  it('une image 2K vaut ~CHF 0,09 ; une vidéo suit sa durée et sa résolution', () => {
    expect(labsEstimateChf({ mode: 'image', resolution: '720p', durationS: 8, hasVoiceover: false })).toBeCloseTo(0.091, 3)
    const v8 = labsEstimateChf({ mode: 'video', resolution: '720p', durationS: 8, hasVoiceover: false })
    const v16 = labsEstimateChf({ mode: 'video', resolution: '720p', durationS: 16, hasVoiceover: false })
    const hd8 = labsEstimateChf({ mode: 'video', resolution: '1080p', durationS: 8, hasVoiceover: false })
    expect(v16).toBeGreaterThan(v8 * 1.9)
    expect(hd8).toBeGreaterThan(v8 * 2)
  })
  it('la narration se lit à ~155 mots par minute', () => {
    expect(labsVoiceoverSeconds('')).toBe(0)
    expect(labsVoiceoverSeconds('un deux trois quatre cinq six sept huit neuf dix onze douze treize')).toBeCloseTo(5, 0)
  })
  it('les filtres et le compteur du mois lisent la liste, pas la base', () => {
    const now = new Date('2026-09-20T10:00:00Z')
    const base = (o: Partial<LabsAsset> & Pick<LabsAsset, 'id' | 'kind'>): LabsAsset => ({
      folderId: null, createdBy: null, status: 'ready', prompt: null, voiceoverText: null, voiceoverVoice: null, sourceAssetId: null,
      url: null, thumbnailUrl: null, width: null, height: null, durationS: null, aspectRatio: null, model: null, errorCode: null,
      costChf: null, isFavorite: false, createdAt: '2026-09-18T10:00:00Z', completedAt: null, ...o,
    })
    const assets = [
      base({ id: 'a', kind: 'image', folderId: 'f1', isFavorite: true }),
      base({ id: 'b', kind: 'video', folderId: 'f1', status: 'generating' }),
      base({ id: 'c', kind: 'image', status: 'failed' }),
      base({ id: 'd', kind: 'upload' }),
      base({ id: 'e', kind: 'image', createdAt: '2026-08-30T10:00:00Z' }),
    ]
    expect(labsFilter(assets, { folderId: 'f1', view: 'all', kind: 'all' }).map((a) => a.id)).toEqual(['a', 'b'])
    expect(labsFilter(assets, { folderId: null, view: 'favorites', kind: 'all' }).map((a) => a.id)).toEqual(['a'])
    expect(labsFilter(assets, { folderId: null, view: 'all', kind: 'video' }).map((a) => a.id)).toEqual(['b'])
    expect(labsFilter(assets, { folderId: null, view: 'all', kind: 'image' }).map((a) => a.id)).toEqual(['a', 'c', 'd', 'e'])
    // Le mois : ni les échecs, ni les imports, ni le mois d'avant.
    expect(labsMonthUsage(assets, now)).toEqual({ image: 1, video: 1 })
  })
})

describe('labs — la galerie REMPLIT', () => {
  /**
   * ⛔ `column-count` remplit en FLUX : il sert la dernière colonne avec ce qui reste.
   * Mesuré le 20.09.2026 à 1440 × 900 sur huit productions : 527 / 532 / 493 / **282**,
   * 250 px d'écart. Après `labsColonnes` : 986 / 1025 / 1090 / 1025 sur dix-huit, 104 px.
   */
  const faux = (id: string, ratio: number): LabsAsset => ({
    id, folderId: null, createdBy: null, kind: 'image', status: 'ready', prompt: null,
    voiceoverText: null, voiceoverVoice: null, voiceoverLang: null, voiceoverUrl: null,
    sourceAssetId: null, url: null, thumbnailUrl: null, width: 100, height: ratio,
    durationS: null, aspectRatio: null, model: null, errorCode: null, costChf: null,
    isFavorite: false, createdAt: '2026-09-20T10:00:00Z', completedAt: null,
  })

  it('ne perd ni ne duplique aucune production', () => {
    const items = Array.from({ length: 17 }, (_, i) => faux(`a${i}`, 60 + (i * 37) % 140))
    const cols = labsColonnes(items, 4)
    expect(cols).toHaveLength(4)
    const remis = cols.flat().map((a) => a.id).sort()
    expect(remis).toEqual(items.map((a) => a.id).sort())
  })

  it('équilibre les colonnes — l’écart reste sous la plus haute tuile', () => {
    const items = Array.from({ length: 24 }, (_, i) => faux(`a${i}`, 50 + (i * 53) % 150))
    for (const n of [2, 3, 4, 5, 6]) {
      const hauteurs = labsColonnes(items, n).map((c) => c.reduce((t, a) => t + (a.height ?? 100) / (a.width ?? 100), 0))
      const ecart = Math.max(...hauteurs) - Math.min(...hauteurs)
      // Borne du glouton « colonne la plus courte » : jamais plus d'UNE tuile d'écart.
      expect(ecart, `${n} colonnes`).toBeLessThanOrEqual(2)
    }
  })

  it('est déterministe et ne rend jamais moins d’une colonne', () => {
    const items = Array.from({ length: 9 }, (_, i) => faux(`a${i}`, 80 + i * 11))
    expect(labsColonnes(items, 3)).toEqual(labsColonnes(items, 3))
    expect(labsColonnes(items, 0)).toHaveLength(1)
    expect(labsColonnes([], 4)).toEqual([[], [], [], []])
  })
})

describe('labs — le cadre tient les gouttières des autres écrans', () => {
  /**
   * ⛔ LE DÉFAUT QUE LA MESSAGERIE A PAYÉ LE 12.09.2026, et qui se reproduit à
   * l'identique sur toute surface qui pose sa carte directement dans la coquille :
   * sans `<main>`, le cadre COLLE à la carte latérale (0 px au lieu de 12) et monte
   * sous la bande d'onglets. Mesuré à 1440 × 900 après correction : carte latérale à
   * droite 276, cadre à gauche 288 — douze pixels, les mêmes que la Messagerie.
   *
   * ⚠ La garde ne réécrit AUCUN nombre : elle lit les quatre gouttières de
   * `MessagerieApp` et exige les mêmes. Le jour où la convention bouge, les deux
   * écrans bougent ensemble ou la porte rougit.
   */
  const gouttieres = (src: string) => {
    const m = /<main style=\{\{([^}]*)\}\}/.exec(src)
    expect(m, 'balise <main> introuvable — la carte est posée à nu dans la coquille').not.toBeNull()
    const lire = (prop: string) => new RegExp(`${prop}: '([^']+)'`).exec(m![1])?.[1] ?? null
    return {
      top: lire('paddingTop'), left: lire('paddingLeft'),
      right: lire('paddingRight'), bottom: lire('paddingBottom'),
    }
  }

  it('les quatre gouttières sont celles de la Messagerie, jeton pour jeton', () => {
    const ref = gouttieres(readFileSync('src/components/crm/messagerie/MessagerieApp.tsx', 'utf8'))
    // Contrôle positif : un lecteur qui rendrait « rien » partout échouerait ici.
    expect(Object.values(ref).every((v) => typeof v === 'string' && v.startsWith('var(--crm-space-'))).toBe(true)
    expect(gouttieres(readFileSync('src/components/crm/labs/LabsApp.tsx', 'utf8'))).toEqual(ref)
  })

  it('le cadre porte le rayon des bentos, et non celui d’une carte intérieure', () => {
    const src = readFileSync('src/components/crm/labs/LabsApp.tsx', 'utf8')
    const section = /<section\s+style=\{\{([\s\S]*?)\}\}/.exec(src)
    expect(section, '<section> du cadre introuvable').not.toBeNull()
    expect(section![1]).toContain("borderRadius: 'var(--crm-radius-6xl)'")
    expect(section![1]).toContain("height: '100%'")
  })
})

describe('labs — la section existe partout où une section existe', () => {
  it('la barre latérale porte `labs`, sur `/dashboard/labs`', () => {
    const s = CRM_SIDEBAR_SECTIONS.find((x) => x.id === 'labs')
    expect(s?.route).toBe('/dashboard/labs')
    expect(crmSidebarActiveFor('/dashboard/labs')).toBe('labs')
  })
  it('libellé de nav, sous-titre d’onglet et namespace, dans les quatre langues', () => {
    for (const lng of LANGS) {
      const common = lire(lng, 'common')
      expect(chemin(common, 'nav.labs'), `${lng}: nav.labs`).toBeTypeOf('string')
      expect(chemin(common, 'newTab.hints.labs'), `${lng}: newTab.hints.labs`).toBeTypeOf('string')
      const labs = lire(lng, 'labs')
      expect(chemin(labs, 'prompt.generate'), `${lng}: labs.prompt.generate`).toBeTypeOf('string')
    }
    const index = readFileSync('src/i18n/index.ts', 'utf8')
    expect(index).toMatch(/'onboarding', 'labs',\s*\n\] as const/)
    expect((index.match(/labs: labs\.default/g) ?? []).length).toBe(3)
    expect((index.match(/labs: frLabs/g) ?? []).length).toBe(2)
  })
  it('chaque code d’erreur rendu par les edges a son libellé', () => {
    const codes = new Set<string>()
    for (const fn of ['labs-image', 'labs-video', 'labs-video-status']) {
      const src = readFileSync(`supabase/functions/${fn}/index.ts`, 'utf8')
      for (const m of src.matchAll(/(?:error: '|fail\(')([a-z_]+)'/g)) codes.add(m[1])
    }
    // Ceux-là ne se montrent pas : ils disent qu'un appelant s'est trompé de verbe ou de corps.
    for (const technique of ['method_not_allowed', 'invalid_body', 'invalid_folder', 'invalid_source', 'invalid_asset', 'asset_not_found', 'record_failed']) codes.delete(technique)
    expect(codes.size).toBeGreaterThan(8)
    const fr = lire('fr', 'labs')
    const sans = [...codes].filter((c) => typeof chemin(fr, `errors.${c}`) !== 'string')
    expect(sans, 'codes d’erreur sans libellé FR').toEqual([])
  })
})
