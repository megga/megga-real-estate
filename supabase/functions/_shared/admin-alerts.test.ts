// Règle 12 d'admin-alerts : les dossiers KYB en attente de revue humaine.
//
// Vise la fonction PURE (buildKybReviewAlerts), comme les autres specs de _shared :
// aucun faux client Supabase, aucun stub de fetch. Ce qui est vérifié ici, c'est ce que
// le module DÉCIDE ; que la RPC réponde et que Resend parte se prouve en production,
// pas avec un double.
import { describe, it, expect } from 'vitest'
import {
  buildKybReviewAlerts,
  buildEmailFailureAlerts,
  type KybReviewQueueRow,
  type EmailFailureRow,
} from './admin-alerts'

const MAINTENANT = new Date('2026-08-15T12:00:00.000Z')

const ligne = (over: Partial<KybReviewQueueRow> = {}): KybReviewQueueRow => ({
  agency_id: 'a1',
  agency_name: 'Régie du Rhône Sàrl',
  country: 'CH',
  verification_score: null,
  identity_submitted_at: '2026-08-15T06:00:00.000Z',
  total_count: 1,
  ...over,
})

describe('buildKybReviewAlerts — la file de revue cesse d\'être silencieuse', () => {
  it('file vide -> aucune alerte (le silence est le cas normal)', () => {
    expect(buildKybReviewAlerts([], MAINTENANT)).toEqual([])
  })

  it('une clé PAR AGENCE : le cooldown 24h du module isole les dossiers entre eux', () => {
    const alertes = buildKybReviewAlerts([ligne(), ligne({ agency_id: 'a2', agency_name: 'Foncière Léman SA' })], MAINTENANT)
    expect(alertes.map((a) => a.key)).toEqual(['kyb:review:a1', 'kyb:review:a2'])
    // Sans le nom dans l'objet, l'e-mail agrégé ne dirait pas QUEL dossier traiter.
    expect(alertes[1].subject).toContain('Foncière Léman SA')
  })

  it('dit la CONSÉQUENCE — l\'agence est bloquée sur KYC et signature — et où agir', () => {
    const [a] = buildKybReviewAlerts([ligne()], MAINTENANT)
    expect(a.body).toContain('ni ouvrir un dossier KYC ni envoyer une signature')
    expect(a.body).toContain('/dashboard/admin/kyb-review')
  })

  it('score absent -> « jamais calculé », jamais 0.000 : c\'est l\'état de TOUT dossier suisse aujourd\'hui', () => {
    // La nuance porte un diagnostic : un score nul se lirait comme un dossier douteux,
    // alors que l'absence vient de MAPBOX_TOKEN manquant côté plateforme.
    const [a] = buildKybReviewAlerts([ligne({ verification_score: null })], MAINTENANT)
    expect(a.body).toContain('jamais calculé')
    expect(a.body).not.toContain('0.000')
  })

  it('score rendu en CHAÎNE par PostgREST (numeric) -> formaté, pas recraché tel quel', () => {
    const [a] = buildKybReviewAlerts([ligne({ verification_score: '0.4' })], MAINTENANT)
    expect(a.body).toContain('0.400')
  })

  it('attente : heures sous 48h, jours au-delà', () => {
    const [court] = buildKybReviewAlerts([ligne({ identity_submitted_at: '2026-08-15T06:00:00.000Z' })], MAINTENANT)
    expect(court.body).toContain('depuis 6h')
    const [long] = buildKybReviewAlerts([ligne({ identity_submitted_at: '2026-08-12T12:00:00.000Z' })], MAINTENANT)
    expect(long.body).toContain('depuis 3 jours')
  })

  it('le reste de la file est annoncé quand elle dépasse les lignes nommées', () => {
    // 20 nommées sur 23 : les 3 autres doivent être dites, sinon l'e-mail laisse croire
    // que la file tient dans ce qu'il montre.
    const file = Array.from({ length: 20 }, (_, i) => ligne({ agency_id: `a${i}`, total_count: 23 }))
    expect(buildKybReviewAlerts(file, MAINTENANT)[0].body).toContain('3 autre(s) dossier(s) en attente')
    // File entièrement nommée : aucune mention d'un reste fantôme.
    expect(buildKybReviewAlerts([ligne({ total_count: 1 })], MAINTENANT)[0].body).not.toContain('autre(s) dossier(s)')
  })
})

describe('buildEmailFailureAlerts — l\'alerte SUR l\'alerte', () => {
  const echec = (over: Partial<EmailFailureRow> = {}): EmailFailureRow => ({
    event_type: 'email.bounced',
    recipient: 'hello@juarts.com',
    subject: '[MEGGA Admin] 2 alertes plateforme',
    bounce_type: 'Permanent',
    occurred_at: '2026-08-15T12:44:00.000Z',
    ...over,
  })

  it('aucun échec -> aucune alerte', () => {
    expect(buildEmailFailureAlerts([], 24)).toEqual([])
  })

  it('groupe PAR DESTINATAIRE : dix rebonds sur une boîte sont un seul fait à traiter', () => {
    const alertes = buildEmailFailureAlerts(
      [echec(), echec(), echec({ recipient: 'autre@example.ch' })], 24,
    )
    expect(alertes).toHaveLength(2)
    expect(alertes[0].key).toBe('email:failure:hello@juarts.com')
    expect(alertes[0].body).toContain('2 e-mail(s) non remis')
  })

  it('un rebond PERMANENT dit la conséquence : les envois suivants seront refusés en silence', () => {
    const [a] = buildEmailFailureAlerts([echec({ bounce_type: 'Permanent' })], 24)
    expect(a.subject).toContain('Adresse morte')
    expect(a.body).toContain('liste de suppression')
    expect(a.body).toContain('sans erreur visible côté code')
  })

  it('un rebond TRANSITOIRE ne crie pas : il peut se résoudre seul', () => {
    const [a] = buildEmailFailureAlerts([echec({ bounce_type: 'Transient' })], 24)
    expect(a.subject).toContain('Remise en échec')
    expect(a.body).toContain('peut se résoudre seul')
    expect(a.body).not.toContain('liste de suppression')
  })

  it('une PLAINTE prime sur le reste : ne plus solliciter', () => {
    const [a] = buildEmailFailureAlerts([echec({ event_type: 'email.complained', bounce_type: null })], 24)
    expect(a.subject).toContain('Plainte')
    expect(a.body).toContain('à ne plus solliciter')
  })

  it('nomme le destinataire touché — c\'est ce qui rend la ligne lisible en console quand l\'e-mail lui-même n\'arrive pas', () => {
    const [a] = buildEmailFailureAlerts([echec()], 24)
    expect(a.body).toContain('hello@juarts.com')
    expect(a.body).toContain('/dashboard/admin/monitoring')
  })

  it('un destinataire absent ne fait pas disparaître l\'événement', () => {
    const [a] = buildEmailFailureAlerts([echec({ recipient: null })], 24)
    expect(a.key).toBe('email:failure:destinataire inconnu')
  })
})
