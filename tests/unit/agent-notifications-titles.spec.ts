// Titres de la cloche de l'agent (`useAgentNotifications`).
//
// Une action sans titre connu s'affiche HUMANISÉE — « Whatsapp number verified » dans un CRM
// français. L'appairage WhatsApp (migration 20260911000100, acteur 'system') passe par la
// cloche de toute l'agence : il porte donc un titre écrit, et ce banc le tient.

import { describe, it, expect } from 'vitest'
import { detailFor, titleFor } from '@/hooks/useAgentNotifications'
import { auditActionLabel, auditEntityLabel } from '@/lib/auditActionLabel'

describe('cloche agent — titre des événements', () => {
  it('l’appairage WhatsApp porte un titre français', () => {
    // La forme que le webhook écrit : aucun libellé serveur.
    expect(titleFor({ action: 'whatsapp_number_verified' })).toBe('Numéro WhatsApp lié')
  })

  it('sans titre connu, l’action retombe humanisée — ce que l’entrée évite', () => {
    expect(titleFor({ action: 'whatsapp_number_unknown' })).toBe('Whatsapp number unknown')
  })

  // ⛔ i18next lit le point comme séparateur de clés : `contact_scores.recompute` — la
  // deuxième action de la production — manquait sa clé pourtant écrite, et la cloche
  // affichait « Contact scores.recompute » (13.09.2026).
  it('une action à identifiant POINTÉ atteint sa clé', () => {
    expect(titleFor({ action: 'contact_scores.recompute' })).toBe('Scores de contacts recalculés')
    expect(auditActionLabel('signature.created')).toBe('Demande de signature créée')
  })

  // ⛔ Le libellé serveur REMPLAÇAIT le titre (14.09.2026) : en production, un dossier KYC
  // ouvert s'intitulait « via WhatsApp », un changement d'étape « lead → new_lead ». Le
  // titre dit ce qui s'est passé ; le libellé est le sujet, dessous, étapes traduites.
  it('le titre dit l’action, le libellé serveur devient le sujet', () => {
    expect(titleFor({ action: 'kyc_case_opened' })).toBe('Dossier KYC ouvert')
    expect(detailFor({ action: 'kyc_case_opened', object_label: 'via WhatsApp' })).toBe('via WhatsApp')
    expect(detailFor({ action: 'stage_change', object_label: 'visit_done → offer' })).toBe('Visite effectuée → Offre')
    // Un code inconnu (étape d'avant la refonte du pipeline) reste lisible tel quel.
    expect(detailFor({ action: 'stage_change', object_label: 'lead → new_lead' })).toBe('lead → Nouveau lead')
    expect(detailFor({ action: 'match_suggested', object_label: null })).toBe('')
  })

  it('le type d’objet visé se lit traduit, jamais en identifiant technique', () => {
    expect(auditEntityLabel('visit')).toBe('Visite')
    expect(auditEntityLabel('kyc_case')).toBe('Dossier KYC')
    expect(auditEntityLabel(null)).toBe('—')
  })
})
