/**
 * Les signaux « pourquoi maintenant » du fil (lot C, conception de la boucle §4.1) : une baisse de prix récente,
 * une annonce nouvelle, un nouveau mandat ; et l'ordre qu'ils donnent à score égal. Les seuils sont aussi ceux de
 * la base (`matching_fil_marche_resume`) : ce fichier lit la migration pour les confronter.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  construireFil, construireSelections, type FilBien, type FilMatch, type FilSelectionResume,
} from '@/components/matching-fil/filModele'
import { aUnSignal, JOURS_BAISSE, JOURS_NOUVEAU, signalBien } from '@/components/matching-fil/filSignaux'

const T = Date.parse('2026-09-22T12:00:00.000Z')
const JOUR = 86_400_000
const il = (jours: number) => new Date(T - jours * JOUR).toISOString()
const SANS_FILTRE = { bienId: null, acheteurId: null, texte: '' }
const annonce = (champs: Partial<FilBien> = {}): FilBien => ({
  id: 'ml', titre: 'Annonce', prix: 1_000_000, location: false, type: 'apartment', pieces: 4, surface: 100,
  ville: 'Genève', canton: 'GE', adresse: null, equipements: [], photo: null, marche: { ref: 'MG-FL-1', sourceUrl: null }, ...champs,
})
const mandat = (id: string, champs: Partial<FilBien> = {}): FilBien => ({ ...annonce({ id, ...champs }), marche: undefined })
const acheteur = { id: 'c1', prenom: 'Julie', nom: 'Morand', telephone: null, email: null, kyc: 'none' as const }
const match = (id: string, score: number, bien: FilBien, champs: Partial<FilMatch> = {}): FilMatch => ({
  id, score, raisons: null, criteres: null, creeLe: '2026-09-10T10:00:00.000Z', reporteJusquau: null, bien, acheteur, ...champs,
})

describe('signalBien', () => {
  it('une baisse récente, chiffrée et datée ; trop ancienne, plus de signal de baisse', () => {
    expect(signalBien(annonce({ prix: 950_000, prixInitial: 1_000_000, baisseLe: il(5) }), T))
      .toEqual({ genre: 'baisse', montant: 50_000, le: il(5) })
    expect(signalBien(annonce({ prix: 950_000, prixInitial: 1_000_000, baisseLe: il(JOURS_BAISSE + 1) }), T)).toBeNull()
  })
  it('une annonce nouvelle ; la baisse passe avant la nouveauté', () => {
    expect(signalBien(annonce({ vuLe: il(1) }), T)).toEqual({ genre: 'nouveau', le: il(1) })
    expect(signalBien(annonce({ vuLe: il(JOURS_NOUVEAU + 1) }), T)).toBeNull()
    expect(signalBien(annonce({ vuLe: il(1), prix: 950_000, prixInitial: 1_000_000, baisseLe: il(1) }), T)?.genre).toBe('baisse')
  })
  it('un prix nul ou une hausse ne sont pas une baisse ; une date future n’est pas récente', () => {
    expect(signalBien(annonce({ prix: 0, prixInitial: 1_000_000, baisseLe: il(1) }), T)).toBeNull()
    expect(signalBien(annonce({ prix: 1_100_000, prixInitial: 1_000_000, baisseLe: il(1) }), T)).toBeNull()
    expect(signalBien(annonce({ vuLe: new Date(T + JOUR).toISOString() }), T)).toBeNull()
  })
  it('un mandat : signé ou mis en service il y a 7 jours au plus', () => {
    expect(signalBien(mandat('p1', { mandatLe: il(2) }), T)).toEqual({ genre: 'mandat', le: il(2) })
    expect(signalBien(mandat('p1', { mandatLe: il(8) }), T)).toBeNull()
    expect(signalBien(mandat('p1', { vuLe: il(1) }), T), 'un mandat n’est pas « nouveau sur le marché »').toBeNull()
  })
  it('aUnSignal : celui du match (lot B) ou celui de son bien', () => {
    expect(aUnSignal(match('m', 80, mandat('p1', { mandatLe: il(2) })), T)).toBe(true)
    expect(aUnSignal(match('m', 80, mandat('p1', { prix: 900_000 }), {
      suivi: { statut: 'sent', proposeLe: il(3), reponduLe: null, motif: null, note: null, prixPropose: 1_000_000, apprisLe: null },
    }), T)).toBe(true)
    expect(aUnSignal(match('m', 80, mandat('p1')), T)).toBe(false)
  })
})

describe('l’ordre, à score égal', () => {
  it('construireFil : un match à signal, et son groupe, passent devant', () => {
    const neuf = mandat('p2', { mandatLe: il(1) })
    const vieux = mandat('p1')
    const signal = (m: FilMatch) => aUnSignal(m, T)
    const vue = construireFil([match('a', 90, vieux), match('b', 90, neuf, { creeLe: '2026-09-01T00:00:00.000Z' })], SANS_FILTRE, T, signal)
    expect(vue.groupes.map((g) => g.bien.id)).toEqual(['p2', 'p1'])
    // Sans comparateur, l'ordre d'avant : le plus récent d'abord.
    expect(construireFil([match('a', 90, vieux), match('b', 90, neuf, { creeLe: '2026-09-01T00:00:00.000Z' })], SANS_FILTRE, T)
      .groupes.map((g) => g.bien.id)).toEqual(['p1', 'p2'])
  })
  it('construireSelections : une ligne « Marché » à signal passe devant, à meilleur score égal', () => {
    const resume = (id: string, champs: Partial<FilSelectionResume> = {}): FilSelectionResume => ({
      acheteur: { ...acheteur, id, prenom: id, nom: id }, nombre: 3, meilleurScore: 90, vignettes: [], ...champs,
    })
    expect(construireSelections([resume('a'), resume('b', { nouveaux: 1 })], SANS_FILTRE).map((s) => s.acheteur.id)).toEqual(['b', 'a'])
    expect(construireSelections([resume('a', { meilleurScore: 91 }), resume('b', { baisses: 2 })], SANS_FILTRE).map((s) => s.acheteur.id)).toEqual(['a', 'b'])
  })
})

describe('les seuils de la base', () => {
  it('matching_fil_marche_resume compte avec les mêmes seuils', () => {
    const dossier = 'supabase/migrations'
    const fichier = readdirSync(dossier).find((f) => f.endsWith('_matching_explique.sql'))
    expect(fichier, 'migration du lot C introuvable').toBeDefined()
    const sql = readFileSync(join(dossier, fichier!), 'utf8')
    expect(sql).toMatch(new RegExp(`price_reduced_at > now\\(\\) - interval '${JOURS_BAISSE} days'`))
    expect(sql).toMatch(new RegExp(`first_seen_at > now\\(\\) - interval '${JOURS_NOUVEAU} days'`))
    // Une date FUTURE n'est pas un signal, ni à l'écran (`recente`) ni en base.
    expect(sql).toMatch(/price_reduced_at <= now\(\)/)
    expect(sql).toMatch(/first_seen_at <= now\(\)/)
  })
})
