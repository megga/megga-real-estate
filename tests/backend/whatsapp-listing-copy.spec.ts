// Invariants DÉTERMINISTES du « descriptif d'annonce » (v1 — génération de contenu d'annonce).
//
// Ce spec couvre UNIQUEMENT les invariants purs :
//   1. draft_listing_copy est en tier 'read' → exécution directe sans stash ni confirm ;
//      le contenu rédigé revient à l'agent dans son 1:1, rien n'est jamais envoyé au client.
//   2. Le socle légal reste intact : send_client_message et send_client_email ne peuvent JAMAIS
//      quitter confirm (canLeaveConfirm renvoie false) — cette feature n'ajoute qu'un outil
//      read, elle ne doit pas affaiblir le mur légal des envois client.
//   3. draft_listing_copy est présent dans WHATSAPP_TOOLS avec les paramètres requis exacts
//      (required ['query']) et le paramètre variant déclare l'enum ['confidential','public'] —
//      si l'outil est absent ou mal déclaré, DeepSeek ne peut pas l'appeler et la feature est
//      morte en silencieux ; la variante confidentielle est le garde-fou confidentialité, donc
//      son enum doit rester exact.
//
// Ce que ce spec ne couvre PAS volontairement :
//   - Le titre / la description bilingue produits par DeepSeek : sortie non-déterministe.
//   - La grille de détails (construite EN CODE) et la résolution du bien : nécessitent Supabase
//     + des données, validées par le design conversationnel (l'agent lit le contenu dans son
//     1:1) et par la validation manuelle en staging — pas des tests unitaires.
//
// Aucun skipIf : ces assertions sont purement fonctionnelles, sans Supabase ni réseau.
// Elles passent partout (local, CI, sans clés d'env).

import { describe, it, expect } from 'vitest'
import { WHATSAPP_TOOLS } from '../../supabase/functions/_shared/whatsapp-tools'
import { toolTier, canLeaveConfirm } from '../../supabase/functions/_shared/whatsapp-agent-router'

describe('descriptif d\'annonce — invariants draft_listing_copy (read)', () => {
  // ── 1. Tier read — exécution directe, rien d'envoyé ──────────────────────────
  // draft_listing_copy rédige le CONTENU d'une annonce (titre + description bilingue + grille)
  // et le rend à l'agent dans son 1:1. Aucun envoi, aucune écriture client → fail-safe absolu,
  // doit rester read. Toute dégradation vers 'auto' ou 'confirm' serait aussi un régressif.

  it("toolTier('draft_listing_copy') === 'read'", () => {
    // L'agent demande de rédiger l'annonce d'un de ses biens ; l'outil rend le contenu.
    // Rien n'est envoyé au client — le résultat est agent-facing, doit rester read.
    expect(toolTier('draft_listing_copy')).toBe('read')
  })

  // ── 2. Socle légal intact — les envois client restent confirm ─────────────────
  // Cette feature n'ajoute QU'un outil read. Elle ne doit en aucun cas affaiblir le mur
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

  // ── 3. Présence dans le catalogue + paramètres requis + enum variant exacts ───
  // DeepSeek ne peut proposer QUE les outils enregistrés dans WHATSAPP_TOOLS. Si l'outil est
  // absent ou mal déclaré, la feature est morte silencieusement. La variante confidentielle est
  // le garde-fou confidentialité (masque l'adresse exacte + aucune coordonnée) : son enum doit
  // rester exactement ['confidential','public'] — ni plus, ni moins.

  it("draft_listing_copy est dans WHATSAPP_TOOLS avec required ['query'] exact", () => {
    const tool = WHATSAPP_TOOLS.find(t => t.function.name === 'draft_listing_copy')
    expect(tool).toBeDefined()
    // query : le bien à mettre en annonce (résolu dans les mandats de l'agence) — seul
    // paramètre requis. variant est optionnel : absent → MEGGA le demande (jamais deviner).
    const params = tool!.function.parameters as { required?: string[] }
    expect([...(params.required ?? [])].sort()).toEqual(['query'])
  })

  it("draft_listing_copy déclare variant enum ['confidential','public'] exact", () => {
    const tool = WHATSAPP_TOOLS.find(t => t.function.name === 'draft_listing_copy')
    expect(tool).toBeDefined()
    // L'enum borne la confidentialité : 'confidential' (sans coordonnées ni adresse exacte)
    // vs 'public' (avec l'agence + l'agent). Trier (ordre-indépendant) détecte tout ajout/retrait
    // de valeur sans casser sur un réordonnancement cosmétique dans la source.
    const params = tool!.function.parameters as {
      properties?: { variant?: { enum?: string[] } }
    }
    const variantEnum = params.properties?.variant?.enum
    expect(variantEnum).toBeDefined()
    expect([...(variantEnum ?? [])].sort()).toEqual(['confidential', 'public'])
  })
})
