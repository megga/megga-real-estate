import { describe, it, expect } from 'vitest'
import { npaToCanton, NPA_RANGES, NPA_AMBIGUS } from './npa'

const CANTONS_CH = [
  'AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE',
  'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG', 'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH',
]

describe('intégrité de la table NPA_RANGES', () => {
  it('est triée, sans chevauchement ni trou entre 1000 et 9658', () => {
    let attendu = 1000
    for (const [min, max, canton] of NPA_RANGES) {
      expect(min, `plage démarrant à ${min}`).toBe(attendu)
      expect(max).toBeGreaterThanOrEqual(min)
      expect(canton).toMatch(/^[A-Z]{2}$/)
      attendu = max + 1
    }
    expect(attendu - 1).toBe(9658) // 9658 Wildhaus = plus haut NPA suisse
  })

  it('rend les 26 cantons atteignables — 5 ne l\'étaient plus', () => {
    const emis = new Set(NPA_RANGES.map(([, , c]) => c))
    for (const c of CANTONS_CH) expect(emis.has(c), `canton ${c} jamais émis`).toBe(true)
    // Le défaut historique : GL/NW/OW/UR absents, AI émis par la seule plage
    // morte [9700,9799] alors que les NPA suisses s'arrêtent à 9658.
    for (const c of ['AI', 'GL', 'NW', 'OW', 'UR']) expect(emis.has(c)).toBe(true)
  })

  it('n\'a aucune plage morte au-dessus du registre', () => {
    for (const [min] of NPA_RANGES) expect(min).toBeLessThanOrEqual(9658)
  })
})

describe('npaToCanton — les 5 cantons rendus invisibles par l\'ancienne table', () => {
  // Chaque cas partait dans un canton voisin (ou pas même voisin) avant correction.
  it.each([
    [6460, 'UR', 'Altdorf — partait en SZ'],
    [6472, 'UR', 'Erstfeld — partait en SZ'],
    [6490, 'UR', 'Andermatt — partait en SZ'],
    [6060, 'OW', 'Sarnen — partait en LU'],
    [6390, 'OW', 'Engelberg — partait en ZG'],
    [6370, 'NW', 'Stans — partait en ZG'],
    [6052, 'NW', 'Hergiswil — partait en LU'],
    [8750, 'GL', 'Glaris — partait en TG'],
    [8783, 'GL', 'Linthal — partait en TG'],
    [9050, 'AI', 'Appenzell — partait en SG'],
    [9054, 'AI', 'Schlatt-Haslen — partait en SG'],
  ])('NPA %i → %s (%s)', (npa, canton) => {
    expect(npaToCanton(npa)).toBe(canton)
  })
})

describe('npaToCanton — blocs volés au canton voisin', () => {
  it.each([
    [1260, 'VD', 'Nyon — comptait en GE et tirait la médiane genevoise vers le bas'],
    [1279, 'VD', 'Bogis-Bossey — idem'],
    [1290, 'GE', 'Versoix reste bien GE'],
    [4125, 'BS', 'Riehen — commune bâloise rangée en BL'],
    [4126, 'BS', 'Bettingen — idem'],
    [4710, 'SO', 'Balsthal — le Thal soleurois comptait en BL'],
    [1868, 'VS', 'Collombey — Chablais valaisan compté en VD'],
    [2350, 'JU', 'Saignelégier — Franches-Montagnes comptées en NE'],
  ])('NPA %i → %s (%s)', (npa, canton) => {
    expect(npaToCanton(npa)).toBe(canton)
  })
})

describe('npaToCanton — grandes villes, non-régression', () => {
  it.each([
    [1201, 'GE'], [1003, 'VD'], [1950, 'VS'], [2000, 'NE'], [3000, 'BE'],
    [1700, 'FR'], [4000, 'BS'], [5000, 'AG'], [6000, 'LU'], [6300, 'ZG'],
    [6900, 'TI'], [7000, 'GR'], [8000, 'ZH'], [9000, 'SG'], [8200, 'SH'],
    [4500, 'SO'], [8500, 'TG'], [9100, 'AR'], [6430, 'SZ'], [2800, 'JU'],
    [4410, 'BL'],
  ])('NPA %i → %s', (npa, canton) => {
    expect(npaToCanton(npa)).toBe(canton)
  })
})

describe('npaToCanton — arbitrage par le libellé de la source', () => {
  it('laisse le libellé trancher un NPA à cheval', () => {
    // 6388 Grafenort NW / Engelberg OW : la table dit NW (majorité d'adresses),
    // mais si la source dit Obwalden, c'est elle qui sait.
    expect(npaToCanton(6388)).toBe('NW')
    expect(npaToCanton(6388, 'Obwalden')).toBe('OW')
    expect(npaToCanton(6388, 'Nidwalden')).toBe('NW')
  })

  it('ignore un libellé qui ne fait pas partie des candidats du NPA', () => {
    expect(npaToCanton(6388, 'Zürich')).toBe('NW')
  })

  it('ne laisse PAS le libellé écraser un NPA non ambigu', () => {
    // Sinon une source qui se trompe de canton corromprait des NPA parfaitement
    // déterminés. Le NPA fait foi hors des 31 cas à cheval.
    expect(npaToCanton(8001, 'Uri')).toBe('ZH')
    expect(npaToCanton(1201, 'Vaud')).toBe('GE')
  })

  it('ne connaît que des cantons réels dans la table des ambigus', () => {
    for (const [npa, candidats] of Object.entries(NPA_AMBIGUS)) {
      expect(candidats.length).toBeGreaterThanOrEqual(2)
      for (const c of candidats) expect(CANTONS_CH, `NPA ${npa}`).toContain(c)
    }
  })
})

describe('npaToCanton — hors registre suisse', () => {
  it('retombe sur le libellé quand le NPA est absent ou illisible', () => {
    expect(npaToCanton(null, 'Uri')).toBe('UR')
    expect(npaToCanton('', 'Appenzell Innerrhoden')).toBe('AI')
    expect(npaToCanton('n/a', 'Glarus')).toBe('GL')
  })

  it('retombe sur le libellé pour un code postal étranger', () => {
    // 75008 Paris : hors des bornes suisses. C'est précisément le cas que
    // l'ancienne table ne pouvait pas atteindre pour un NPA à 4 chiffres.
    expect(npaToCanton(75008, 'Zürich')).toBe('ZH')
    expect(npaToCanton(9800, 'Glarus')).toBe('GL') // 9800 : plus aucun NPA suisse
  })

  it('rend null quand il n\'y a ni NPA exploitable ni libellé', () => {
    expect(npaToCanton(null)).toBeNull()
    expect(npaToCanton(undefined, undefined)).toBeNull()
  })

  it('signale le Liechtenstein au lieu de le ranger en Saint-Gall', () => {
    expect(npaToCanton(9490)).toBe('FL') // Vaduz
    expect(npaToCanton(9485)).toBe('FL') // Nendeln
    expect(npaToCanton(9499)).toBe('SG') // juste après, on est bien en Suisse
  })

  // ── Les annonces que Flatfox sert et qu'on ne peut pas situer ──────────────
  // Relevé le 03.09.2026 en balayant les 35 787 annonces RENT de l'API Flatfox :
  // 17 ne se résolvent pas. flatfox-sync appelle npaToCanton SANS second argument
  // (le champ `state` de Flatfox est NULL sur ces 17), donc ce que ce bloc fige,
  // c'est très exactement le prédicat d'écart de la fonction de synchro.
  // ⛔ Si l'une de ces assertions se met à rendre un canton, ce n'est PAS une
  // amélioration : cela voudrait dire qu'un code postal étranger est désormais
  // rangé dans un canton suisse, et les annonces d'Alassio reviendraient polluer
  // le marché tessinois.
  it('rend null pour les codes postaux étrangers servis par Flatfox, sans libellé', () => {
    expect(npaToCanton(17021)).toBeNull() // Alassio (IT) — 5 annonces
    expect(npaToCanton(22100)).toBeNull() // Como (IT)
    expect(npaToCanton(74160)).toBeNull() // Saint-Julien-en-Genevois (FR)
    expect(npaToCanton(35580)).toBeNull() // Playa Blanca (ES)
    expect(npaToCanton(99428)).toBeNull() // Nohra (DE)
    expect(npaToCanton(50309)).toBeNull() // Tamarindo (CR)
  })

  it('rend null pour un NPA suisse aux chiffres transposés', () => {
    // Deux annonces réelles, étiquetées `country: 'CH'`, dont le NPA saisi n'existe
    // pas : 18009 pour 1809 Fenil-sur-Corsier (VD) et 9745 pour 9475 Sevelen (SG).
    // On ne devine PAS l'intention — écrire VD ou SG ici demanderait d'inventer une
    // correction de saisie, et une annonce mal située vaut moins qu'une annonce absente.
    expect(npaToCanton(18009)).toBeNull()
    expect(npaToCanton(9745)).toBeNull()
    // La preuve que ce sont bien des transpositions : les NPA corrects, eux, résolvent.
    expect(npaToCanton(1809)).toBe('VD')
    expect(npaToCanton(9475)).toBe('SG')
  })
})
