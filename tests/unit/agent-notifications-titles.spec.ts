// Titres de la cloche de l'agent (`useAgentNotifications`).
//
// Une action sans titre connu s'affiche HUMANISÉE — « Whatsapp number verified » dans un CRM
// français. L'appairage WhatsApp (migration 20260911000100, acteur 'system') passe par la
// cloche de toute l'agence : il porte donc un titre écrit, et ce banc le tient.

import { describe, it, expect } from 'vitest'
import { titleFor } from '@/hooks/useAgentNotifications'

describe('cloche agent — titre des événements', () => {
  it('l’appairage WhatsApp porte un titre français', () => {
    // La forme que le webhook écrit : aucun libellé serveur.
    expect(titleFor({ action: 'whatsapp_number_verified', object_label: null })).toBe('Numéro WhatsApp lié')
  })

  it('sans titre connu, l’action retombe humanisée — ce que l’entrée évite', () => {
    expect(titleFor({ action: 'whatsapp_number_unknown', object_label: null })).toBe('Whatsapp number unknown')
  })
})
