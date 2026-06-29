// Catalogue des outils du copilote WhatsApp (nom + tier), MIROIR FRONTEND de la source de vérité
// edge : supabase/functions/_shared/whatsapp-agent-router.ts (TOOL_TIERS). Le bundle Vite ne peut
// pas importer le code edge (Deno) → ce miroir est maintenu à la main.
// ⚠ À garder en SYNC quand on ajoute/retire un outil côté agent.
// Sert à passer p_known_tools à get_whatsapp_tool_usage_stats pour révéler les outils JAMAIS utilisés.

export type WaToolTier = 'read' | 'auto' | 'confirm' | 'slow_async'

export interface WaToolCatalogEntry {
  name: string
  tier: WaToolTier
}

export const WHATSAPP_TOOL_CATALOG: WaToolCatalogEntry[] = [
  // read (14)
  { name: 'get_my_agenda', tier: 'read' },
  { name: 'search_contacts', tier: 'read' },
  { name: 'get_contact_brief', tier: 'read' },
  { name: 'list_followups', tier: 'read' },
  { name: 'get_matches', tier: 'read' },
  { name: 'get_daily_brief', tier: 'read' },
  { name: 'search_listings', tier: 'read' },
  { name: 'get_kyc_status', tier: 'read' },
  { name: 'summarize_group_thread', tier: 'read' },
  { name: 'check_group_leak', tier: 'read' },
  { name: 'draft_listing_copy', tier: 'read' },
  { name: 'prepare_meeting', tier: 'read' },
  { name: 'read_document', tier: 'read' },
  { name: 'get_publication_status', tier: 'read' },
  // auto (8)
  { name: 'file_document', tier: 'auto' },
  { name: 'create_contact', tier: 'auto' },
  { name: 'add_note', tier: 'auto' },
  { name: 'schedule_visit', tier: 'auto' },
  { name: 'create_reminder', tier: 'auto' },
  { name: 'qualify_lead', tier: 'auto' },
  { name: 'create_deal', tier: 'auto' },
  { name: 'attach_kyc_document', tier: 'auto' },
  // confirm (9)
  { name: 'send_kyc_link', tier: 'confirm' },
  { name: 'send_client_email', tier: 'confirm' },
  { name: 'update_pipeline', tier: 'confirm' },
  { name: 'send_client_message', tier: 'confirm' },
  { name: 'send_listings', tier: 'confirm' },
  { name: 'record_offer', tier: 'confirm' },
  { name: 'open_kyc_case', tier: 'confirm' },
  { name: 'publish_to_portals', tier: 'confirm' },
  { name: 'withdraw_from_portals', tier: 'confirm' },
  // slow_async (2)
  { name: 'run_kyc_screening', tier: 'slow_async' },
  { name: 'send_kyc_report', tier: 'slow_async' },
]

export const WHATSAPP_TOOL_NAMES: string[] = WHATSAPP_TOOL_CATALOG.map((tt) => tt.name)
