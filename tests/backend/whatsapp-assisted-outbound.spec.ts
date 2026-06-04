// Invariants DÉTERMINISTES de la feature « sortie assistée » (Palier 4C — send_client_email).
//
// Ce spec couvre UNIQUEMENT les invariants purs :
//   1. L'outil send_client_email est bien enregistré dans WHATSAPP_TOOLS avec les bons paramètres.
//   2. Le socle légal : send_client_email est confirm-tier et ne peut JAMAIS quitter confirm
//      (canLeaveConfirm renvoie false) — toute communication client sort sous validation humaine.
//
// Ce que ce spec ne couvre PAS volontairement :
//   - La rédaction du brouillon par DeepSeek (prepareSendClientEmail) : sortie non-déterministe.
//   - L'envoi via Resend (executeSendClientEmail) : API externe, pas de mock ici.
//   Ces deux chemins sont validés par le design WYSIWYG (l'agent voit le brouillon complet
//   avant de confirmer) et par la validation manuelle en staging — pas des tests unitaires.
//
// Aucun skipIf : ces assertions sont purement fonctionnelles, sans Supabase ni réseau.
// Elles passent partout (local, CI, sans clés d'env).

import { describe, it, expect } from 'vitest'
import { WHATSAPP_TOOLS } from '../../supabase/functions/_shared/whatsapp-tools'
import { toolTier, canLeaveConfirm } from '../../supabase/functions/_shared/whatsapp-agent-router'

describe('send_client_email — invariants sortie assistée', () => {
  // ── 1. Présence dans le catalogue d'outils ──────────────────────────────────
  // DeepSeek ne peut proposer que des outils présents dans WHATSAPP_TOOLS.
  // Si l'outil est absent, la feature est morte en silencieux.

  it("send_client_email est présent dans WHATSAPP_TOOLS", () => {
    const tool = WHATSAPP_TOOLS.find(t => t.function.name === 'send_client_email')
    expect(tool).toBeDefined()
  })

  it("les deux paramètres requis (contact_id, instruction) sont déclarés required", () => {
    const tool = WHATSAPP_TOOLS.find(t => t.function.name === 'send_client_email')
    // contact_id : identifie le destinataire (jamais d'email envoyé sans destinataire explicite)
    // instruction : l'intention de l'agent (cadre le brouillon DeepSeek)
    const params = tool!.function.parameters as { required?: string[] }
    // Ordre-indépendant mais EXACT : trier les deux côtés détecte un param requis ajouté/retiré
    // sans casser sur un simple réordonnancement cosmétique dans la source.
    expect([...(params.required ?? [])].sort()).toEqual(['contact_id', 'instruction'])
  })

  // ── 2. Socle légal — le tier est confirm ───────────────────────────────────
  // Les communications client (email comme WhatsApp) sont la vitrine de l'agence.
  // Un envoi auto non-validé = risque réputationnel + légal. Le tier confirm force
  // une action humaine explicite (« oui » de l'agent) avant tout envoi.

  it("toolTier('send_client_email') === 'confirm'", () => {
    expect(toolTier('send_client_email')).toBe('confirm')
  })

  // ── 3. Socle légal — canLeaveConfirm est false ─────────────────────────────
  // update_pipeline est l'unique outil confirm-tier pouvant passer en auto (Palier 3 :
  // réversible, aucun flux client). send_client_email ne doit JAMAIS auto-passer :
  // l'envoi d'un email client est irréversible et engageant pour l'agence.

  it("canLeaveConfirm('send_client_email') === false (ne quitte jamais confirm)", () => {
    expect(canLeaveConfirm('send_client_email')).toBe(false)
  })

  it("canLeaveConfirm('send_client_message') === false (cohérence — même socle)", () => {
    // send_client_message partage le même invariant : toute communication client sortante
    // reste sous validation humaine, qu'elle parte par email ou par WhatsApp.
    expect(canLeaveConfirm('send_client_message')).toBe(false)
  })
})
