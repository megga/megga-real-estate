// Titres de la cloche de l'agent (`useAgentNotifications`).
//
// Une action sans titre connu s'affiche HUMANISÉE — « Whatsapp number verified » dans un CRM
// français. L'appairage WhatsApp (migration 20260911000100, acteur 'system') passe par la
// cloche de toute l'agence : il porte donc un titre écrit, et ce banc le tient.

import { describe, it, expect } from 'vitest'
import { titleFor } from '@/hooks/useAgentNotifications'
import { auditActionLabel, auditEntityLabel } from '@/lib/auditActionLabel'

describe('cloche agent — titre des événements', () => {
  it('l’appairage WhatsApp porte un titre français', () => {
    // La forme que le webhook écrit : aucun libellé serveur.
    expect(titleFor({ action: 'whatsapp_number_verified', object_label: null })).toBe('Numéro WhatsApp lié')
  })

  it('sans titre connu, l’action retombe humanisée — ce que l’entrée évite', () => {
    expect(titleFor({ action: 'whatsapp_number_unknown', object_label: null })).toBe('Whatsapp number unknown')
  })

  // ⛔ i18next lit le point comme séparateur de clés : `contact_scores.recompute` — la
  // deuxième action de la production — manquait sa clé pourtant écrite, et la cloche
  // affichait « Contact scores.recompute » (13.09.2026).
  it('une action à identifiant POINTÉ atteint sa clé', () => {
    expect(titleFor({ action: 'contact_scores.recompute', object_label: null })).toBe('Scores de contacts recalculés')
    expect(auditActionLabel('signature.created')).toBe('Demande de signature créée')
  })

  it('le type d’objet visé se lit traduit, jamais en identifiant technique', () => {
    expect(auditEntityLabel('visit')).toBe('Visite')
    expect(auditEntityLabel('kyc_case')).toBe('Dossier KYC')
    expect(auditEntityLabel(null)).toBe('—')
  })
})
