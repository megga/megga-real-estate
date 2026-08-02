// Extraction déterministe pièces/surface depuis la description
// (migration 20260802130000_market_listings_extract_rooms_surface.sql).
//
// Ce qui est vérifié, et pourquoi
// -----------------------------------------------------------------------------
// Les deux fonctions sont pures (immutables, zéro I/O) : on les éprouve donc par
// appel RPC direct sur des textes qui rejouent les MODES D'ÉCHEC OBSERVÉS en prod
// (échantillons du 02/08/2026), pas des cas théoriques :
//   · fourchettes de promotion « de 2.5 à 5.5 pièces » → null ;
//   · multi-lots (immeuble, Mehrfamilienhaus, logements…) → null ;
//   · valeurs distinctes multiples → null (ambigu) ;
//   · maisons décrites étage par étage (« OG: 3 Zimmer ») → null sans ancre ;
//   · « villa de 900 m² » = parcelle → null (les maisons exigent Wohnfläche /
//     surface habitable) ;
//   · apostrophe suisse « 1'383 m² » → 1383, pas 383 ;
//   · sommes « 100 + 90 m² » et potentiels « bis zu 360 m² » → null ;
//   · bornes : 25 pièces ou 3000 m² → null.
// Un test purement négatif serait creux (une fonction qui rend toujours null le
// passerait) : chaque bloc contient des extractions POSITIVES FR/DE/IT.
//
// Runs live in CI (SUPABASE_TEST_* keys present). Skips locally without keys.

import { describe, it, expect } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

async function rooms(type: string, description: string): Promise<number | null> {
  const { data, error } = await serviceRoleClient().rpc('ml_extract_rooms', {
    p_type: type,
    p_description: description,
  })
  if (error) throw new Error(`ml_extract_rooms: ${error.message}`)
  return data === null ? null : Number(data)
}

async function surface(type: string, description: string): Promise<number | null> {
  const { data, error } = await serviceRoleClient().rpc('ml_extract_surface_m2', {
    p_type: type,
    p_description: description,
  })
  if (error) throw new Error(`ml_extract_surface_m2: ${error.message}`)
  return data === null ? null : Number(data)
}

describe.skipIf(!HAS_KEYS)('ml_extract_rooms — pièces depuis la description', () => {
  it('extrait les formes FR/DE/IT usuelles (apartment, motif générique)', async () => {
    expect(await rooms('apartment', 'Bel appartement de 4,5 pièces avec balcon.')).toBe(4.5)
    expect(await rooms('apartment', 'Helle 3.5-Zimmer-Wohnung an ruhiger Lage.')).toBe(3.5)
    expect(await rooms('apartment', 'Luminoso 4,5 locali con terrazza.')).toBe(4.5)
    expect(await rooms('apartment', 'Spacieux 3 1/2 pièces rénové.')).toBe(3.5)
  })

  it('house : seulement si le nombre TOUCHE le nom du logement', async () => {
    expect(await rooms('house', 'Magnifique villa de 6 pièces avec jardin.')).toBe(6)
    expect(await rooms('house', 'Charmantes 5.5-Zimmer-Einfamilienhaus mit Garten.')).toBe(5.5)
    // Inventaire par étage sans ancre : c'est LE mode d'échec des maisons.
    expect(await rooms('house', 'EG: Küche und Bad. OG: 3 Zimmer und Dusche/WC.')).toBeNull()
  })

  it('fourchettes et alternatives ⇒ null (promotions)', async () => {
    expect(await rooms('apartment', 'Appartements du 1,5 au 4,5 pièces à vendre.')).toBeNull()
    expect(await rooms('house', 'Doppel-Einfamilienhaus mit wahlweise 5,5 oder 6,5 Zimmern.')).toBeNull()
  })

  it('multi-lots et valeurs multiples ⇒ null (ambigu)', async () => {
    expect(await rooms('apartment', 'Immeuble de rendement, appartements de 3,5 pièces loués.')).toBeNull()
    expect(await rooms('apartment', 'Un 2,5 pièces au rez et un 4,5 pièces à l’étage.')).toBeNull()
  })

  it('bornes et types hors périmètre ⇒ null', async () => {
    expect(await rooms('apartment', 'Objet rare de 25 pièces.')).toBeNull()
    expect(await rooms('land', 'Terrain proche d’un 4,5 pièces.')).toBeNull()
  })
})

describe.skipIf(!HAS_KEYS)('ml_extract_surface_m2 — surface habitable depuis la description', () => {
  it('extrait les ancres explicites FR/DE/IT', async () => {
    expect(await surface('apartment', 'Surface habitable de 120 m² avec balcon.')).toBe(120)
    expect(await surface('house', 'Wohnfläche: ca. 192 m², Grundstück 800 m².')).toBe(192)
    expect(await surface('apartment', 'Superficie abitabile di 95 m2.')).toBe(95)
    expect(await surface('apartment', 'Bel appartement de 85 m² au centre.')).toBe(85)
  })

  it("apostrophe suisse : 1'383 m² lu 1383, pas 383", async () => {
    expect(await surface('house', "La propriété déploie 1'383 m² de surface habitable nette.")).toBe(1383)
  })

  it('house : « villa de X m² » sans ancre = parcelle probable ⇒ null', async () => {
    expect(await surface('house', 'Villa de 900 m² avec piscine.')).toBeNull()
  })

  it('sommes et potentiels ⇒ null', async () => {
    expect(await surface('house', 'Wohnfläche: ca. 100 + 90 m2 Rustico.')).toBeNull()
    expect(await surface('house', 'Erweiterung mit bis zu 360 m² neuer Wohnfläche möglich.')).toBeNull()
  })

  it('bornes ⇒ null', async () => {
    expect(await surface('house', 'Surface habitable de 3000 m².')).toBeNull()
  })
})
