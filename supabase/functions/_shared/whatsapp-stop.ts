// Effets d'une demande de désinscription : ce qu'on ÉCRIT, puis ce qu'on RÉPOND.
//
// Un seul module pour trois points d'interception — le bouton Meta et le texte libre dans
// `whatsapp-webhook`, la transcription d'une note vocale dans `whatsapp-process`. Dupliquer
// la séquence, c'est la laisser diverger : le jour où l'un des trois oublie de couper les
// relances ou de marquer l'accusé, rien ne le dira.
//
// La détection, elle, vit à part (`whatsapp-stop-keywords.ts`) et reste PURE.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendOutboundGuarded } from './whatsapp-outbound-guard.ts'
import { buildStopAck } from './whatsapp-stop-ack.ts'
import { resolveStopLang, type StopLang } from './whatsapp-stop-keywords.ts'

export interface StopSubject {
  /** Numéro de l'expéditeur, chiffres nus. */
  phone: string
  /** Fiche du CRM, si le numéro en désigne UNE seule. */
  contactId: string | null
  /** Agence constatante, ou null quand elle est indéterminable (≥ 2 agences vérifiées). */
  agencyId: string | null
  /** `whatsapp_messages.id` du message porteur — la preuve. */
  messageId: string | null
  /** La personne a CLIQUÉ le bouton d'opt-out de Meta, elle n'a pas écrit. */
  viaButton: boolean
}

/**
 * Enregistre le refus. Deux chemins, parce que le sujet n'est pas le même :
 *
 *  · contact connu → `record_whatsapp_consent`, qui écrit la déclaration ET applique ses
 *    effets dans la MÊME transaction (suppression du numéro, suggestions écartées, rappels
 *    WhatsApp annulés, action stashée supprimée, cache `contacts` recalculé) ;
 *  · numéro inconnu → `suppress_contact_phone` seule. Sans sujet, il n'y a personne à qui
 *    attribuer une déclaration ; la preuve est le message lui-même, conservé.
 *
 * ⛔ NE JETTE JAMAIS. Un webhook qui rend 500 sur une erreur métier déclenche une tempête
 * de rejeux Meta — et un STOP posté dans un groupe suffirait à la provoquer.
 */
export async function recordStopRequest(admin: SupabaseClient, s: StopSubject): Promise<void> {
  const source = s.viaButton ? 'meta_block' : 'stop_keyword'
  try {
    if (s.contactId) {
      const { error } = await admin.rpc('record_whatsapp_consent', {
        p_kind: 'contact', p_wa_phone: s.phone, p_event: 'opt_out', p_source: source,
        p_contact_id: s.contactId, p_agency_id: s.agencyId, p_source_ref: s.messageId,
      })
      if (error) throw new Error(error.message)
    } else {
      const { error } = await admin.rpc('suppress_contact_phone', {
        p_wa_phone: s.phone, p_channel: 'all', p_reason: source,
        p_source_ref: s.messageId, p_agency_id: s.agencyId,
      })
      if (error) throw new Error(error.message)
    }
  } catch (e) {
    console.warn('whatsapp stop: écriture du refus échouée:',
      String((e as Error)?.message ?? 'error').slice(0, 120))
  }
}

/** Coupe le brief d'un AGENT qui a cliqué l'opt-out d'un template marketing de Meta. */
export async function recordAgentBriefOptOut(
  admin: SupabaseClient,
  a: { phone: string; profileId: string; agencyId: string | null; messageId: string | null },
): Promise<void> {
  try {
    // ⛔ Portée `daily_brief`, JAMAIS 'all' : Meta exige que l'opt-out de ses templates
    // soit honoré, pas que l'agent perde son copilote. Et aucune suppression par numéro —
    // sur un WABA mono-numéro elle vaudrait pour tout le monde.
    const { error } = await admin.rpc('record_whatsapp_consent', {
      p_kind: 'profile', p_wa_phone: a.phone, p_event: 'opt_out', p_source: 'meta_block',
      p_profile_id: a.profileId, p_agency_id: a.agencyId, p_legal_basis: 'contract',
      p_source_ref: a.messageId, p_scope: 'daily_brief',
    })
    if (error) throw new Error(error.message)
    await admin.from('whatsapp_agent_links')
      .update({ morning_brief_enabled: false }).eq('profile_id', a.profileId)
  } catch (e) {
    console.warn('whatsapp stop (agent): coupure du brief échouée:',
      String((e as Error)?.message ?? 'error').slice(0, 120))
  }
}

/**
 * Envoie l'accusé de désinscription, qui porte l'avis LPD.
 *
 * ⚠ C'est la GARDE qui arbitre, PAS ce code : elle interroge `whatsapp_send_allowed` avec
 * `purpose:'opt_out_ack'`, qui exige une suppression active, née d'une demande de la
 * personne, et un `ack_sent_at` vide — puis consomme ce jeton si et seulement si l'envoi
 * est parti. Le plafond vit donc en base, hors d'atteinte d'un appelant distrait.
 *
 * ⛔ NE JETTE JAMAIS : appelé en tâche de fond, après l'ACK 200 rendu à Meta.
 */
export async function sendStopAck(
  admin: SupabaseClient,
  s: StopSubject & { langHint: StopLang | null },
): Promise<void> {
  try {
    // Qui traite, et dans quelle langue. Deux lectures, toutes deux facultatives : sans
    // agence on nomme MEGGA, sans langue déclarée on retombe sur celle du mot-clé.
    const [agency, contact] = await Promise.all([
      s.agencyId
        ? admin.from('agencies').select('name').eq('id', s.agencyId).maybeSingle()
        : Promise.resolve({ data: null }),
      s.contactId
        ? admin.from('contacts').select('language').eq('id', s.contactId).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    const lang = resolveStopLang(
      s.langHint, (contact.data as { language?: string | null } | null)?.language ?? null)
    const body = buildStopAck({
      lang, agencyName: (agency.data as { name?: string | null } | null)?.name ?? null,
    })

    // ⚠ `requireWindow:false` : l'accusé est une obligation d'information, pas un message
    // de service. Le pré-refuser sur la fenêtre le ferait disparaître sans que personne ne
    // le sache ; le laisser partir fait trancher Meta, et un refus de sa part laisse
    // `ack_sent_at` vide, donc le rattrapage du cron réessaie dans les 24 h.
    const sent = await sendOutboundGuarded({
      admin, to: s.phone,
      purpose: 'opt_out_ack',
      payload: { type: 'text', body },
      contactId: s.contactId, agencyId: s.agencyId,
      isAutomated: true, requireWindow: false,
      // Profil resserré, délibéré : 2 tentatives et 6 s. `retryNetworkError:false` ne rejoue
      // que les refus de QUOTA (429 + throttle Meta en 400), rejetés AVANT mise en file donc
      // sûrs ; jamais un 5xx ni un timeout, ambigus (Meta a peut-être livré → doublon vers un
      // client). Sans ce profil, un throttle sur l'accusé — seul message que recevra jamais
      // qui écrit « stop » en premier — ne serait pas rejoué du tout.
      retryProfile: { maxAttempts: 2, timeoutMs: 6000, retryNetworkError: false },
    })
    if (!sent.ok) {
      // `ack_already_sent` et `ack_not_requested` sont NOMINAUX : le rattrapage du cron
      // repasse sur des suppressions déjà servies, et la garde les écarte en base.
      console.warn('whatsapp stop: accusé non envoyé,',
        ('error' in sent ? sent.error : sent.reason) ?? 'motif absent')
      return
    }

    // L'accusé A PORTÉ l'avis LPD. `whatsapp_pending_notices` exclut déjà les numéros
    // bloqués, mais cette ligne survit à une LEVÉE de la suppression : sans elle, un
    // déblocage par un super-admin ferait repartir un avis que la personne a déjà reçu.
    if (s.agencyId) {
      await admin.from('whatsapp_notices').upsert(
        { agency_id: s.agencyId, wa_phone: s.phone },
        { onConflict: 'agency_id,wa_phone', ignoreDuplicates: true },
      )
    }
  } catch (e) {
    console.error('whatsapp stop: accusé échoué:', String((e as Error)?.message ?? 'error').slice(0, 120))
  }
}
