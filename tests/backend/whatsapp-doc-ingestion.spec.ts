// Invariants DÉTERMINISTES de la « lecture de documents entrants » (doc-ingestion v1).
//
// L'agent envoie une pièce (photo/scan/PDF) dans le message courant et désigne ce qu'il veut.
// L'OCR est DÉJÀ fait par le webhook à la réception (texte transmis via ctx.inboundMedia.ocrText) ;
// les outils le réutilisent (digest DeepSeek) et ne re-lisent la pièce qu'en repli :
//   - read_document (read) : rend la lecture structurée À L'AGENT. Aucune écriture CRM, aucun envoi.
//   - file_document (auto) : même lecture, puis classe le digest en NOTE timeline sur un contact.
//     État CRM interne (jamais d'envoi client) ; l'agent valide ensuite dans le CRM.
//
// Ce spec couvre UNIQUEMENT les invariants purs (tier + présence/forme dans le catalogue +
// socle légal intact). Il ne couvre PAS :
//   - l'extraction Gemini/DeepSeek (sortie non déterministe, réseau) ;
//   - l'écriture activity_events (dépend de Supabase, validée par documents-contact-id /
//     rls-isolation-activity-events et la validation manuelle en staging).
//
// Aucun skipIf : assertions purement fonctionnelles, sans Supabase ni réseau → passent partout.

import { describe, it, expect } from 'vitest'
import { WHATSAPP_TOOLS } from '../../supabase/functions/_shared/whatsapp-tools'
import { toolTier, canLeaveConfirm } from '../../supabase/functions/_shared/whatsapp-agent-router'

describe('lecture de documents entrants — invariants doc-ingestion (read + auto)', () => {
  // ── 1. Tiers : read pour la lecture seule, auto pour le classement ───────────
  // read_document n'écrit rien et n'envoie rien : il rend la lecture à l'agent → read.
  // Toute dérive vers auto/confirm serait un régressif inutilement restrictif.
  it("toolTier('read_document') === 'read' (lecture rendue à l'agent, rien d'écrit/envoyé)", () => {
    expect(toolTier('read_document')).toBe('read')
  })

  // file_document écrit une NOTE timeline (état CRM interne réversible, jamais d'envoi client) :
  // c'est auto, exactement comme add_note — pas confirm (aucun flux client/argent).
  it("toolTier('file_document') === 'auto' (classe une note, aucun envoi client)", () => {
    expect(toolTier('file_document')).toBe('auto')
  })

  // ── 2. Socle légal intact — les envois client restent confirm ────────────────
  // Cette feature n'ajoute qu'un outil read et un outil auto (interne). Elle ne doit JAMAIS
  // affaiblir le mur légal : toute communication client sort sous validation humaine explicite.
  it("canLeaveConfirm('send_client_message') === false (mur légal inchangé)", () => {
    expect(canLeaveConfirm('send_client_message')).toBe(false)
  })
  it("canLeaveConfirm('send_client_email') === false (mur légal inchangé)", () => {
    expect(canLeaveConfirm('send_client_email')).toBe(false)
  })
  it("canLeaveConfirm('file_document') === false (un outil auto ne franchit jamais le mur confirm)", () => {
    // file_document est déjà auto ; canLeaveConfirm ne concerne que les outils confirm.
    // On verrouille néanmoins qu'il ne soit jamais traité comme un confirm « libérable ».
    expect(canLeaveConfirm('file_document')).toBe(false)
  })

  // ── 3. Présence dans le catalogue + forme exacte ─────────────────────────────
  // DeepSeek ne peut appeler QUE les outils enregistrés dans WHATSAPP_TOOLS. Absent ou mal
  // déclaré = feature morte en silence.
  it('read_document est dans WHATSAPP_TOOLS sans paramètre requis (focus optionnel)', () => {
    const tool = WHATSAPP_TOOLS.find(t => t.function.name === 'read_document')
    expect(tool).toBeDefined()
    // Aucun paramètre requis : la pièce vient du message courant (ctx.inboundMedia),
    // pas d'un argument. `focus` est une consigne facultative.
    const params = tool!.function.parameters as { required?: string[]; properties?: Record<string, unknown> }
    expect([...(params.required ?? [])]).toEqual([])
    expect(params.properties).toHaveProperty('focus')
  })

  it("file_document est dans WHATSAPP_TOOLS avec required ['contact_id'] exact", () => {
    const tool = WHATSAPP_TOOLS.find(t => t.function.name === 'file_document')
    expect(tool).toBeDefined()
    // contact_id obligatoire : on ne classe une note QUE dans une fiche identifiée
    // (résolue via search_contacts). `focus` reste optionnel.
    const params = tool!.function.parameters as { required?: string[]; properties?: Record<string, unknown> }
    expect([...(params.required ?? [])].sort()).toEqual(['contact_id'])
    expect(params.properties).toHaveProperty('focus')
  })
})
