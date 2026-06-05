// Invariants DÉTERMINISTES de la « préparation de rendez-vous » (outil prepare_meeting, v1).
//
// Ce spec couvre UNIQUEMENT les invariants purs :
//   1. prepare_meeting est en tier 'read' → exécution directe sans stash ni confirm, rien n'est
//      jamais envoyé. C'est une agrégation lecture seule (fiche + biens + visite + 3 points
//      DeepSeek) rendue à l'agent dans son 1:1 — agent-facing, jamais au client.
//   2. Le socle légal reste intact : send_client_message et send_client_email ne peuvent JAMAIS
//      quitter confirm (canLeaveConfirm renvoie false) — cette feature n'ajoute qu'UN outil
//      read, elle ne doit pas affaiblir le mur légal.
//   3. prepare_meeting est présent dans WHATSAPP_TOOLS avec le paramètre requis exact —
//      si l'outil est absent ou mal déclaré, DeepSeek ne peut pas l'appeler et la feature
//      est morte en silencieux.
//
// Ce que ce spec ne couvre PAS volontairement :
//   - Le brief + les 3 points produits par DeepSeek : sortie non-déterministe.
//   - L'agrégation factuelle (fiche/biens/visite) : dépend de Supabase (vraies tables),
//     validée par le design conversationnel (l'agent lit la réponse dans son 1:1) et la
//     validation manuelle en staging — pas un test unitaire.
//
// Aucun skipIf : ces assertions sont purement fonctionnelles, sans Supabase ni réseau.
// Elles passent partout (local, CI, sans clés d'env).

import { describe, it, expect } from 'vitest'
import { WHATSAPP_TOOLS } from '../../supabase/functions/_shared/whatsapp-tools'
import { toolTier, canLeaveConfirm } from '../../supabase/functions/_shared/whatsapp-agent-router'

describe('préparation de rendez-vous — invariants prepare_meeting (read)', () => {
  // ── 1. Tier read — exécution directe, rien d'envoyé ──────────────────────────
  // prepare_meeting agrège des briques lecture seule (fiche, biens correspondants, visite à
  // venir) + une couche DeepSeek pour les 3 points à aborder. Aucun envoi, aucune écriture :
  // le résultat est rendu uniquement à l'agent (agent-facing, privé). Toute dégradation vers
  // 'auto' ou 'confirm' serait un régressif (inutilement restrictif pour une simple synthèse).

  it("toolTier('prepare_meeting') === 'read'", () => {
    // prepare_meeting : l'agent demande un brief de RDV pour un contact, l'outil rend la
    // synthèse. Aucun envoi, aucune écriture — fail-safe absolu, doit rester read.
    expect(toolTier('prepare_meeting')).toBe('read')
  })

  // ── 2. Socle légal intact — les envois client restent confirm ─────────────────
  // Cette feature n'ajoute QU'UN outil read. Elle ne doit en aucun cas affaiblir le mur
  // légal : toute communication client (WhatsApp ou email) sort UNIQUEMENT sous validation
  // humaine explicite. canLeaveConfirm = false = impossible de passer en auto.

  it("canLeaveConfirm('send_client_message') === false (envoi WhatsApp client — irréversible)", () => {
    // send_client_message est la vitrine de l'agence. Un envoi auto non-validé = risque
    // réputationnel + légal. Ce mur NE DOIT PAS bouger même si de nouveaux outils sont ajoutés.
    expect(canLeaveConfirm('send_client_message')).toBe(false)
  })

  it("canLeaveConfirm('send_client_email') === false (envoi email client — irréversible)", () => {
    // Même invariant pour l'email : toute communication client sortante reste sous
    // validation humaine, qu'elle parte par WhatsApp ou par email.
    expect(canLeaveConfirm('send_client_email')).toBe(false)
  })

  // ── 3. Présence dans le catalogue + paramètre requis exact ───────────────────
  // DeepSeek ne peut proposer QUE les outils enregistrés dans WHATSAPP_TOOLS.
  // Si l'outil est absent ou mal déclaré, la feature est morte silencieusement
  // (DeepSeek ne tente jamais de l'appeler — il ne peut pas improviser un outil inconnu).
  // Trier détecte tout param requis ajouté/retiré sans casser sur un réordonnancement cosmétique.

  it("prepare_meeting est dans WHATSAPP_TOOLS avec required ['contact_id'] exact", () => {
    const tool = WHATSAPP_TOOLS.find(t => t.function.name === 'prepare_meeting')
    expect(tool).toBeDefined()
    // contact_id : le contact concerné par le RDV (résolu via search_contacts / get_my_agenda).
    // Seul paramètre requis — nécessaire et suffisant pour agréger la fiche et le dossier.
    const params = tool!.function.parameters as { required?: string[] }
    expect([...(params.required ?? [])].sort()).toEqual(['contact_id'])
  })
})
