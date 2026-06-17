// Invariants anti-fabrication du copilote WhatsApp (chantier fiabilisation).
//
// Couvre la partie DÉTERMINISTE et exportée du fix : la description d'outil schedule_visit
// (donnée du catalogue WHATSAPP_TOOLS envoyée à DeepSeek à chaque tour). Les libellés KYC, la
// projection des matches et la garde isFabricatedKycClaim sont des fonctions PURES testées en
// unit (whatsapp-agent-router.test.ts). Le bloc SYSTEM (antiFabBlock) vit dans index.ts (Deno
// serve, non exporté) → non assertable sans l'exporter ; sa valeur est comportementale.
//
// Aucun skipIf : assertions purement fonctionnelles sur le catalogue, sans Supabase ni réseau.

import { describe, it, expect } from 'vitest'
import { WHATSAPP_TOOLS } from '../../supabase/functions/_shared/whatsapp-tools'

describe('anti-fabrication — description schedule_visit (n\'envoie rien au client)', () => {
  it('schedule_visit annonce explicitement l\'enregistrement INTERNE sans envoi', () => {
    const tool = WHATSAPP_TOOLS.find(t => t.function.name === 'schedule_visit')
    expect(tool).toBeDefined()
    const desc = tool!.function.description.toLowerCase()
    // Ferme la broderie « j'ai prévenu / envoyé l'invitation au client » : la description même
    // de l'outil (contexte le plus proche de la décision) dit qu'aucun envoi n'a lieu.
    expect(desc).toContain('en interne')
    expect(desc).toContain("n'envoie rien")
  })

  it('required schedule_visit inchangé (le fix ne touche que la description)', () => {
    const tool = WHATSAPP_TOOLS.find(t => t.function.name === 'schedule_visit')
    const params = tool!.function.parameters as { required?: string[] }
    expect([...(params.required ?? [])].sort()).toEqual(['contact_id', 'property_id', 'scheduled_at'])
  })
})
