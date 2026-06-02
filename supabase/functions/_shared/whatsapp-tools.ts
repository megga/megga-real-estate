// Catalogue des outils exposés à DeepSeek (function calling, schéma OpenAI).
// Le tier (auto/confirm/read) vit dans whatsapp-agent-router.ts (toolTier()).
// DeepSeek renvoie les arguments en CHAÎNE JSON à parser.
import { PIPELINE_STAGES } from './whatsapp-agent-router.ts'

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
      description: "Envoie un message WhatsApp à un CLIENT (contact du CRM). Pour répondre à un client ou le relancer. Appelle directement l'outil. contact_id via search_contacts.",
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
  {
    type: 'function',
    function: {
      name: 'get_contact_brief',
      description: "Fiche synthétique d'un contact (infos, critères, 5 dernières actions). Pour « résume Dubois », « où en est X ». contact_id via search_contacts.",
      parameters: { type: 'object', properties: { contact_id: { type: 'string' } }, required: ['contact_id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_followups',
      description: "Liste les leads à compléter / relancer (marqués par MEGGA). Pour « qui relancer ? », « mes leads à finir ».",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_matches',
      description: "Biens correspondant à un contact (moteur de matching). Pour « quels biens pour Sarah ? ». contact_id via search_contacts.",
      parameters: { type: 'object', properties: { contact_id: { type: 'string' } }, required: ['contact_id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_daily_brief',
      description: "Briefing du jour : visites du jour de l'agent + leads à compléter. Pour « ma journée », « qu'est-ce que je fais aujourd'hui ? ».",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'schedule_visit',
      description: "Planifie une visite d'un BIEN pour un contact. Requiert le contact ET le bien. Pour « organise une visite du bien X avec Dubois mardi 14h ». contact_id via search_contacts, property_id via get_matches (ou demande à l'agent quel bien).",
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string' },
          property_id: { type: 'string', description: 'Bien à visiter (obligatoire).' },
          scheduled_at: { type: 'string', description: 'Date/heure ISO 8601, ex 2026-06-05T14:00:00+02:00' },
          duration_minutes: { type: 'number', description: 'Durée en minutes (défaut 45).' },
          visit_type: { type: 'string', enum: ['sur_place', 'video'], description: 'Défaut sur_place.' },
        },
        required: ['contact_id', 'property_id', 'scheduled_at'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_reminder',
      description: "Crée un rappel/tâche pour l'agent à une date. Pour « rappelle-moi de relancer Dubois vendredi », « note d'appeler le notaire lundi ». Lier à un contact si pertinent.",
      parameters: {
        type: 'object',
        properties: {
          body: { type: 'string', description: "Ce qu'il faut faire (objet du rappel)." },
          due_at: { type: 'string', description: 'Date/heure ISO 8601 du rappel.' },
          contact_id: { type: 'string', description: 'Contact lié (optionnel, via search_contacts).' },
        },
        required: ['body', 'due_at'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_pipeline',
      description: "Déplace le dossier d'un contact dans le pipeline. Pour « passe Dubois en négociation », « le dossier Martin est signé ». Appelle directement l'outil sans rien vérifier avant : il retrouve le dossier du contact et signale lui-même s'il n'y en a pas. contact_id via search_contacts.",
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string' },
          stage: {
            type: 'string',
            enum: [...PIPELINE_STAGES],
            description: 'Étape cible : new_lead (nouveau lead) · to_qualify (à qualifier) · active_search (recherche active) · visit_planned (visite planifiée) · visit_done (visite faite) · interest_confirmed (intérêt confirmé) · offer (offre) · negotiation (négociation) · reserved (réservé) · financing (financement) · notary (notaire) · signed (signé) · lost (perdu) · to_recontact (à relancer).',
          },
        },
        required: ['contact_id', 'stage'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'qualify_lead',
      description: "Qualifie un contact en lead avec ses critères de recherche → déclenche le matching automatique. Pour « Dubois cherche un 4 pièces à Carouge en location vers 3000 ». contact_id via search_contacts. Donne les critères connus (les manquants seront notés « à compléter »).",
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string' },
          transaction_type: { type: 'string', enum: ['rent', 'buy'], description: 'location (rent) ou achat (buy).' },
          property_type: { type: 'string', description: 'Type en français : appartement, maison, villa, terrain, commercial, bureau, parking…' },
          zones: { type: 'array', items: { type: 'string' }, description: 'Secteurs / communes recherchés.' },
          budget_max: { type: 'string', description: 'Budget max (loyer mensuel si location, prix si achat). Ex « 3000 », « 1.2M ».' },
          rooms_min: { type: 'number', description: 'Nombre de pièces minimum.' },
        },
        required: ['contact_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_listings',
      description: "Envoie une sélection de biens à un client par WhatsApp. Pour « envoie à Sarah ses meilleures correspondances », « envoie ces biens à Dubois ». Sans listing_ids, prend automatiquement les meilleures correspondances du contact. Appelle directement l'outil.",
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string' },
          listing_ids: { type: 'array', items: { type: 'string' }, description: 'IDs de biens (market_listing_id/property_id via get_matches). Optionnel : par défaut, les meilleures correspondances.' },
        },
        required: ['contact_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'record_offer',
      description: "Enregistre une offre reçue dans le dossier d'un contact. Pour « Marc a fait une offre de 850k », « offre de 2.1M sur le dossier Cologny ». Appelle directement l'outil. contact_id via search_contacts.",
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string' },
          amount: { type: 'string', description: "Montant de l'offre. Ex « 850000 », « 2.1M »." },
          from_party: { type: 'string', enum: ['buyer', 'seller'], description: "Qui fait l'offre (par défaut déduit du dossier)." },
          expires_in_days: { type: 'number', description: 'Validité de l’offre en jours (défaut 30).' },
        },
        required: ['contact_id', 'amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_kyc_case',
      description: "Ouvre un dossier KYC (LBA) pour un contact. Le système retrouve le contact, déduit le type (acheteur/vendeur, personne physique/morale) et confirme avant de créer. Appelle directement l'outil sans rien vérifier avant. Exemples : « ouvre un KYC pour Dubois », « lance la conformité de Mme Vaucher en vigilance renforcée ». contact_id via search_contacts.",
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string', description: 'ID du contact (via search_contacts).' },
          vigilance: { type: 'string', enum: ['standard', 'renforced'], description: "Défaut 'standard'. 'renforced' si l'agent le demande (PEP, montant élevé…)." },
          entity: { type: 'string', enum: ['pp', 'pm'], description: "Optionnel. Personne physique (pp) ou morale (pm). Défaut = celui du contact." },
        },
        required: ['contact_id'],
      },
    },
  },
]
