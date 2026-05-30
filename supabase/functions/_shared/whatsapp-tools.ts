// Catalogue des outils exposés à DeepSeek (function calling, schéma OpenAI).
// Le tier (auto/confirm/read) vit dans whatsapp-agent-router.ts (toolTier()).
// DeepSeek renvoie les arguments en CHAÎNE JSON à parser.

export interface DeepSeekTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export const WHATSAPP_TOOLS: DeepSeekTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_my_agenda',
      description: "Liste les rendez-vous / visites de l'agent courant sur une période. Utiliser pour « mes RDV demain », « mon agenda de la semaine ».",
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Date ISO de début (incluse), ex 2026-05-31T00:00:00Z' },
          to: { type: 'string', description: 'Date ISO de fin (incluse), ex 2026-05-31T23:59:59Z' },
        },
        required: ['from', 'to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_contacts',
      description: "Recherche des contacts du CRM de l'agence par nom, email ou téléphone.",
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Terme de recherche' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_contact',
      description: 'Crée un nouveau contact dans le CRM de l’agence.',
      parameters: {
        type: 'object',
        properties: {
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          phone: { type: 'string', description: 'Numéro, format suisse ou international' },
          email: { type: 'string' },
          notes: { type: 'string', description: 'Contexte libre (critères de recherche, source…)' },
        },
        required: ['first_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_note',
      description: "Ajoute une note datée dans la timeline d'un contact existant (contact_id obtenu via search_contacts).",
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['contact_id', 'body'],
      },
    },
  },
  // create_task : DIFFÉRÉ (4A.1) — modèle reminders vs ai_actions_queue à trancher.
  {
    type: 'function',
    function: {
      name: 'send_client_message',
      description: "Envoie un message WhatsApp à un CLIENT (contact du CRM). Action sensible : sera confirmée par l'agent avant envoi.",
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['contact_id', 'body'],
      },
    },
  },
]
