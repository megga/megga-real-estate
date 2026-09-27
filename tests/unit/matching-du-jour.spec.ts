/**
 * « Aujourd'hui » — le segment Matching (lot D1, conception §5) : où chaque action mène, avec quels mots, et les seuils
 * que la base partage avec les signaux du fil.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MAX_ACTIONS, versAction, type LigneAction } from '@/components/crm/today/matchingDuJour'
import { JOURS_BAISSE, JOURS_MANDAT, JOURS_NOUVEAU } from '@/components/matching-fil/filSignaux'

const ligne = (champs: Partial<LigneAction>): LigneAction => ({
  genre: 'retour', contact_id: null, prenom: null, nom: null, match_id: null, property_id: null, market_listing_id: null,
  statut: null, titre: null, ville: null, nombre: null, nouveaux: null, baisses: null, montant: null, location: null,
  quand: null, total: null, ...champs,
})

describe('versAction — où chaque action mène', () => {
  it('un retour dû ouvre « Retours de … »', () => {
    const a = versAction(ligne({ genre: 'retour', contact_id: 'c7', prenom: 'Emma', nombre: 2 }))
    expect(a).toMatchObject({ cle: 'retour:c7', genre: 'retour', cible: { vers: 'fil', requete: 'attente=c7' } })
    expect(a!.texte).toEqual({ cle: 'today.h.matching.retour', valeurs: { prenom: 'Emma', count: 2 } })
  })

  it('une baisse sur un bien proposé mène à « Retours de … »', () => {
    const a = versAction(ligne({ genre: 'prix', contact_id: 'c9', prenom: 'Julie', match_id: 'm15', market_listing_id: 'ml', statut: 'sent', montant: '50000', titre: 'Champel' }))
    expect(a).toMatchObject({ cle: 'prix:m15', montant: 50_000, detail: 'Champel', cible: { vers: 'fil', requete: 'attente=c9' } })
    expect(a!.texte.cle).toBe('today.h.matching.prixPropose')
  })

  it('une baisse sur un bien revenu mène à sa ligne ; sur une annonce du marché, à la ligne « Marché »', () => {
    const mandat = versAction(ligne({ genre: 'prix', contact_id: 'c10', prenom: 'Antoine', match_id: 'm5', property_id: 'p2', statut: 'suggested', montant: 250_000 }))
    expect(mandat).toMatchObject({ cible: { vers: 'fil', requete: 'ligne=m5&contact=c10' } })
    expect(mandat!.texte.cle).toBe('today.h.matching.prixRefuse')
    const marche = versAction(ligne({ genre: 'prix', contact_id: 'c7', match_id: 'm20', market_listing_id: 'ml', statut: 'suggested', montant: 110_000 }))
    expect(marche).toMatchObject({ cible: { vers: 'fil', requete: 'ligne=marche%3Ac7&contact=c7' } })
  })

  it('un nouveau mandat mène à sa fiche', () => {
    expect(versAction(ligne({ genre: 'mandat', property_id: 'p3', nombre: 2, titre: 'Florissant' }))).toMatchObject({
      cle: 'mandat:p3', detail: 'Florissant', cible: { vers: 'mandat', id: 'p3' },
      texte: { cle: 'today.h.matching.mandat', valeurs: { count: 2 } },
    })
    // Une location traverse jusqu'à l'action : l'écran y accorde son texte (loyer vs prix).
    expect(versAction(ligne({ genre: 'mandat', property_id: 'p4', location: true }))).toMatchObject({ location: true })
  })

  it('le marché nomme UNE annonce, et compte au-delà', () => {
    const une = versAction(ligne({ genre: 'marche', contact_id: 'c11', prenom: 'Anastasia', nouveaux: 1, baisses: 0, ville: 'Cologny', titre: 'Villa' }))
    expect(une!.texte).toEqual({ cle: 'today.h.matching.marcheNouveau', valeurs: { prenom: 'Anastasia', ville: 'Cologny', nouveaux: 1, baisses: 0 } })
    expect(une!.detail).toBe('Villa')
    expect(une!.cle).toBe('marche:c11')
    expect(versAction(ligne({ genre: 'marche', contact_id: 'c11', nouveaux: 0, baisses: 1 }))!.texte.cle).toBe('today.h.matching.marcheBaisseSansVille')
    const deux = versAction(ligne({ genre: 'marche', contact_id: 'c11', nouveaux: 1, baisses: 1, titre: 'ignoré' }))
    expect(deux).toMatchObject({ detail: null, texte: { cle: 'today.h.matching.marchePlusieurs' }, cible: { requete: 'ligne=marche%3Ac11&contact=c11' } })
  })

  it('une ligne qui ne mène nulle part est écartée', () => {
    for (const l of [
      ligne({ genre: 'retour' }),
      ligne({ genre: 'prix', contact_id: 'c1', match_id: 'm1', statut: 'sent', montant: 0 }),
      ligne({ genre: 'prix', contact_id: 'c1', match_id: 'm1', statut: 'rejected', montant: 10 }),
      ligne({ genre: 'prix', contact_id: 'c1', match_id: 'm1', statut: 'interested', montant: 10 }),
      ligne({ genre: 'mandat' }),
      ligne({ genre: 'marche', contact_id: 'c1', nouveaux: 0, baisses: 0 }),
      ligne({ genre: 'inconnu', contact_id: 'c1' }),
    ]) expect(versAction(l), JSON.stringify(l)).toBeNull()
  })

  it('le plafond est de cinq', () => {
    expect(MAX_ACTIONS).toBe(5)
  })
})

describe('les seuils de la base', () => {
  it('matching_actions_du_jour compte avec les seuils des signaux', () => {
    const dossier = 'supabase/migrations'
    const fichier = readdirSync(dossier).find((f) => f.endsWith('_matching_surfaces.sql'))
    expect(fichier, 'migration du lot D1 introuvable').toBeDefined()
    const sql = readFileSync(join(dossier, fichier!), 'utf8')
    expect(sql).toMatch(new RegExp(`price_reduced_at > now\\(\\) - interval '${JOURS_BAISSE} days'`))
    expect(sql).toMatch(new RegExp(`first_seen_at > now\\(\\) - interval '${JOURS_NOUVEAU} days'`))
    expect(sql).toMatch(new RegExp(`greatest\\(p\\.mandate_signed_at, p\\.published_at\\) > now\\(\\) - interval '${JOURS_MANDAT} days'`))
    // Une date FUTURE n'est pas un signal, ni à l'écran (`recente`) ni en base.
    expect(sql).toMatch(/price_reduced_at <= now\(\)/)
    expect(sql).toMatch(/first_seen_at <= now\(\)/)
    expect(sql).toMatch(/greatest\(p\.mandate_signed_at, p\.published_at\) <= now\(\)/)
  })
})
