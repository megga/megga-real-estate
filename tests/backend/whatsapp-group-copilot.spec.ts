// Invariants DÉTERMINISTES du « couteau suisse groupe » (Palier 4 — lames groupe).
//
// Ce spec couvre UNIQUEMENT les invariants purs :
//   1. Les deux lames groupe (summarize_group_thread, check_group_leak) sont en tier 'read' →
//      exécution directe sans stash ni confirm, rien n'est jamais envoyé.
//   2. Le socle légal reste intact : send_client_message et send_client_email ne peuvent JAMAIS
//      quitter confirm (canLeaveConfirm renvoie false) — cette feature n'ajoute que des outils
//      read, elle ne doit pas affaiblir le mur légal.
//   3. Les deux outils sont présents dans WHATSAPP_TOOLS avec les paramètres requis exacts —
//      si un outil est absent, DeepSeek ne peut pas l'appeler et la feature est morte en silencieux.
//
// Ce que ce spec ne couvre PAS volontairement :
//   - Le résumé produit par DeepSeek (summarize_group_thread) : sortie non-déterministe.
//   - La détection de fuite produite par DeepSeek (check_group_leak) : sortie non-déterministe.
//   Ces deux chemins sont validés par le design conversationnel (l'agent lit la réponse dans
//   son 1:1 WhatsApp) et par la validation manuelle en staging — pas des tests unitaires.
//
// Aucun skipIf : ces assertions sont purement fonctionnelles, sans Supabase ni réseau.
// Elles passent partout (local, CI, sans clés d'env).

import { describe, it, expect } from 'vitest'
import { WHATSAPP_TOOLS } from '../../supabase/functions/_shared/whatsapp-tools'
import { toolTier, canLeaveConfirm } from '../../supabase/functions/_shared/whatsapp-agent-router'

describe('couteau suisse groupe — invariants lames read', () => {
  // ── 1. Tier read — exécution directe, rien d'envoyé ──────────────────────────
  // Les outils read sont exécutés immédiatement sans passer par le chemin confirm/stash.
  // Résultat rendu uniquement à l'agent (agent-facing, privé) — impossible d'envoyer
  // quoi que ce soit au client par ce canal. Toute dégradation vers 'auto' ou 'confirm'
  // serait aussi un régressif (inutilement restrictif pour summarize / check).

  it("toolTier('summarize_group_thread') === 'read'", () => {
    // summarize_group_thread : l'agent colle un fil de groupe, l'outil rend un digest.
    // Aucun envoi, aucune écriture — fail-safe absolu, doit rester read.
    expect(toolTier('summarize_group_thread')).toBe('read')
  })

  it("toolTier('check_group_leak') === 'read'", () => {
    // check_group_leak : analyse défensive d'un brouillon avant envoi.
    // Aucun envoi, aucune écriture — verdict rendu uniquement à l'agent, doit rester read.
    expect(toolTier('check_group_leak')).toBe('read')
  })

  // ── 2. Socle légal intact — les envois client restent confirm ─────────────────
  // Ce palier n'ajoute QUE des outils read. Il ne doit en aucun cas affaiblir le mur
  // légal : toute communication client (WhatsApp ou email) sort UNIQUEMENT sous
  // validation humaine explicite. canLeaveConfirm = false = impossible de passer en auto.

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

  // ── 3. Présence dans le catalogue + paramètres requis exacts ─────────────────
  // DeepSeek ne peut proposer QUE les outils enregistrés dans WHATSAPP_TOOLS.
  // Si un outil est absent ou mal déclaré, la feature est morte silencieusement
  // (DeepSeek ne tente jamais de l'appeler — il ne peut pas improviser un outil inconnu).
  // Trier les deux côtés (ordre-indépendant) détecte tout param requis ajouté/retiré
  // sans casser sur un simple réordonnancement cosmétique dans la source.

  it("summarize_group_thread est dans WHATSAPP_TOOLS avec required ['thread'] exact", () => {
    const tool = WHATSAPP_TOOLS.find(t => t.function.name === 'summarize_group_thread')
    expect(tool).toBeDefined()
    // thread : le contenu du fil collé par l'agent — seul paramètre, nécessaire et suffisant.
    const params = tool!.function.parameters as { required?: string[] }
    expect([...(params.required ?? [])].sort()).toEqual(['thread'])
  })

  it("check_group_leak est dans WHATSAPP_TOOLS avec required ['draft', 'parties'] exact", () => {
    const tool = WHATSAPP_TOOLS.find(t => t.function.name === 'check_group_leak')
    expect(tool).toBeDefined()
    // draft : le brouillon à vérifier. parties : les intervenants du groupe (scope de la fuite).
    // Les deux sont nécessaires : sans draft, rien à analyser ; sans parties, impossible de
    // détecter une fuite (on ne sait pas qui est dans la salle).
    const params = tool!.function.parameters as { required?: string[] }
    expect([...(params.required ?? [])].sort()).toEqual(['draft', 'parties'])
  })
})
