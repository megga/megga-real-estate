// Catalogue des outils exposés à DeepSeek (function calling, schéma OpenAI).
// Le tier (read/auto/confirm/slow_async) vit dans whatsapp-agent-router.ts (toolTier()).
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
      description: 'Crée un nouveau contact dans le CRM de l’agence. Email et téléphone FACULTATIFS : crée le contact même avec juste un nom (ex. « Vladimir Poutine »), ne réclame pas de coordonnées si l’agent n’en donne pas.',
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
      description: "Fiche synthétique d'un contact (infos, critères, 5 dernières actions) + compréhension de la dernière conversation WhatsApp (résumé, intention, prochaine action suggérée). Pour « résume Dubois », « où en est X », « rédige une réponse pour X ». contact_id via search_contacts.",
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
      name: 'create_deal',
      description: "Ouvre un dossier (transaction) pour un contact, à une étape de départ. À utiliser quand l'agent veut suivre une affaire, ou quand enregistrer une offre / faire avancer le pipeline échoue faute de dossier. Appelle directement l'outil : il déduit acheteur/vendeur et signale si un dossier existe déjà. contact_id via search_contacts.",
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string' },
          party: { type: 'string', enum: ['buyer', 'seller'], description: "Côté du dossier. Optionnel : déduit du type de contact (vendeur → seller, sinon buyer)." },
          property_id: { type: 'string', description: "Bien concerné (optionnel, ex. mandat de vente ou bien visé)." },
          stage: { type: 'string', enum: [...PIPELINE_STAGES], description: "Étape de départ (optionnel). Défaut : new_lead pour un vendeur, active_search pour un acheteur." },
        },
        required: ['contact_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_listings',
      description: "Recherche des biens sur le marché (annonces) par critères. Pour « trouve un 3,5 pièces à Carouge en location sous 2500 », « des bureaux à Lausanne », « combien d'appartements à Lausanne ». Interroge l'inventaire MARCHÉ réel (les annonces du marché, PAS le CRM de l'agence). Renvoie le NOMBRE TOTAL ESTIMÉ de biens correspondants (champ `total`) en plus d'un échantillon de biens réels (`biens`) avec leur id (utilisable ensuite avec send_listings) ; annonce ce total à l'agent. N'invente jamais de bien.",
      parameters: {
        type: 'object',
        properties: {
          transaction_type: { type: 'string', enum: ['rent', 'buy'], description: "location (rent) ou achat (buy). Défaut rent (l'essentiel de l'inventaire)." },
          property_type: { type: 'string', description: 'Type en français : appartement, maison, villa, terrain, commercial, bureau, parking, dépôt…' },
          zones: { type: 'array', items: { type: 'string' }, description: 'Communes / secteurs (ex. ["Carouge","Lancy"]).' },
          budget_max: { type: 'string', description: 'Budget max (loyer mensuel si location, prix si achat). Ex « 2500 », « 1.2M ».' },
          rooms_min: { type: 'number', description: 'Nombre de pièces minimum.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_kyc_status',
      description: "État du dossier KYC d'un contact (statut, screening PEP/sanctions, pièces fournies/validées). Pour « où en est le KYC de Dubois ? ». Lecture seule. Le KYC est facultatif : si aucun dossier, ce n'est pas un blocage. contact_id via search_contacts.",
      parameters: { type: 'object', properties: { contact_id: { type: 'string' } }, required: ['contact_id'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_kyc_link',
      description: "Envoie au CLIENT, par email, un lien sécurisé pour déposer lui-même ses pièces KYC. Pour « envoie le lien KYC à Dubois ». Le KYC reste FACULTATIF : c'est une aide, jamais une étape obligatoire. Nécessite un dossier KYC déjà ouvert et un email sur le contact. Appelle directement l'outil. contact_id via search_contacts.",
      parameters: { type: 'object', properties: { contact_id: { type: 'string' } }, required: ['contact_id'] },
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
  {
    type: 'function',
    function: {
      name: 'run_kyc_screening',
      description: "Lance le screening LBA (PEP + listes de sanctions) sur le dossier KYC d'un contact. Read-only côté client, aucun message envoyé. APPELLE TOUJOURS cet outil pour lancer un screening — ne dis JAMAIS qu'il est lancé/en cours sans l'avoir appelé (le système confirme lui-même). Exemples : « screen Dubois », « vérifie les sanctions pour Mme Vaucher ». contact_id via search_contacts. Il faut un dossier KYC déjà ouvert (open_kyc_case).",
      parameters: {
        type: 'object',
        properties: { contact_id: { type: 'string', description: 'ID du contact (via search_contacts).' } },
        required: ['contact_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'attach_kyc_document',
      description: "Joint au dossier KYC d'un contact la pièce que TU VIENS d'envoyer dans ce message (photo/scan/PDF). À n'appeler QUE si tu désignes explicitement la pièce (« c'est la pièce d'identité de Dubois », « justif de domicile de Mme Vaucher »). Le système lit la pièce et la joint — il ne coche jamais la case (réservé au validateur). contact_id via search_contacts.",
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string', description: 'ID du contact (via search_contacts).' },
          category: { type: 'string', enum: ['identity', 'address', 'funds'], description: "Type de pièce : identity (pièce d'identité), address (justif. domicile), funds (justif. fonds)." },
        },
        required: ['contact_id', 'category'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_kyc_report',
      description: "Génère le rapport KYC officiel (PDF) d'un contact et l'envoie en pièce jointe à l'agent lui-même sur WhatsApp. Pour « envoie-moi le rapport KYC de Dubois », « le PDF KYC de Mme Vaucher ». APPELLE TOUJOURS cet outil pour envoyer un rapport — ne dis JAMAIS qu'il est parti/généré sans l'avoir appelé. Il faut un dossier KYC déjà ouvert. contact_id via search_contacts.",
      parameters: {
        type: 'object',
        properties: { contact_id: { type: 'string', description: 'ID du contact (via search_contacts).' } },
        required: ['contact_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_client_email',
      description: "Rédige un EMAIL à un client (contact du CRM) et l'envoie APRÈS validation de l'agent. MEGGA rédige le brouillon (sujet + corps) au ton de l'agent et selon la conversation ; l'agent valide ou corrige avant l'envoi.",
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string', description: 'ID du contact destinataire' },
          instruction: { type: 'string', description: "Ce que l'email doit dire (intention), en quelques mots" },
        },
        required: ['contact_id', 'instruction'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'summarize_group_thread',
      description: "Résume un fil de conversation de GROUPE que l'agent colle ou transfère (plusieurs intervenants). Rends un digest court : décisions, questions ouvertes, qui attend quoi, point bloquant. Pour « résume ce groupe », « où on en est dans ce fil ». NE poste rien — c'est pour l'agent.",
      parameters: {
        type: 'object',
        properties: {
          thread: { type: 'string', description: "Le texte du fil de groupe collé/transféré par l'agent" },
        },
        required: ['thread'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_group_leak',
      description: "Vérifie qu'un brouillon destiné à un GROUPE ne révèle pas une info confidentielle d'une partie à l'autre (ex : dévoiler le budget max de l'acheteur au vendeur). À utiliser avant de poster dans une salle de transaction. Renvoie une alerte si fuite, sinon un OK. NE poste rien.",
      parameters: {
        type: 'object',
        properties: {
          draft: { type: 'string', description: "Le brouillon que l'agent veut poster dans le groupe" },
          parties: { type: 'string', description: "Les parties présentes dans le groupe (ex : « acheteur Dupont, vendeur Martin, notaire »)" },
        },
        required: ['draft', 'parties'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_listing_copy',
      description: "Rédige le CONTENU d'une annonce immobilière (titre marketing + description bilingue FR/EN + grille de détails) pour un bien des mandats de l'agence, à partir de ses VRAIES données. Deux variantes : 'confidential' (sans coordonnées ni adresse exacte) ou 'public' (avec l'agence + l'agent). Si la variante n'est pas précisée, DEMANDE-la avant d'appeler. Pour « rédige l'annonce du 3 pièces de Champel », « fais le descriptif du bien X ». NE l'envoie pas au client — c'est pour l'agent.",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: "Nom / adresse / référence du bien à mettre en annonce (cherché dans les mandats de l'agence)" },
          variant: { type: 'string', enum: ['confidential', 'public'], description: "confidential = sans coordonnées ni adresse exacte ; public = avec l'agence et l'agent. Demander à l'agent si non précisé." },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'prepare_meeting',
      description: "Prépare un rendez-vous / une visite avec un contact : rend une synthèse (qui c'est, où en est le dossier, biens qui correspondent, RDV à venir) + 3 points concrets à aborder. Pour « prépare mon RDV avec Dupont », « brief de visite pour Mme Vaucher ». NE poste rien — c'est pour l'agent. contact_id via search_contacts ; si l'agent ne donne qu'une heure, retrouve d'abord le contact via get_my_agenda.",
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string', description: 'ID du contact concerné par le RDV (via search_contacts)' },
        },
        required: ['contact_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_document',
      description: "Lit le document que TU viens d'envoyer dans CE message (photo, scan ou PDF) et en rend une lecture fidèle et structurée (type, parties, montants, dates, objet). Pour « lis ce courrier », « qu'est-ce que dit ce relevé », « extrais ce mandat ». N'invente rien (info illisible = « à vérifier »). NE range rien, n'envoie rien — c'est pour toi. N'appelle cet outil QUE si un document est joint à ce message.",
      parameters: {
        type: 'object',
        properties: {
          focus: { type: 'string', description: "Optionnel : ce que tu veux en priorité (ex. « le montant et l'échéance », « les parties et la commission »)." },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_document',
      description: "Lit le document que TU viens d'envoyer dans CE message ET classe sa lecture dans la fiche d'un contact (sa timeline). Pour « ajoute ce relevé à la fiche de Dubois », « range ce mandat dans le dossier Martin ». N'invente rien ; c'est une lecture IA que tu valides ensuite dans le CRM (rien n'est envoyé au client). contact_id via search_contacts. N'appelle cet outil QUE si un document est joint à ce message.",
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string', description: 'ID du contact dans la fiche duquel classer le document (via search_contacts).' },
          focus: { type: 'string', description: "Optionnel : ce qu'il faut surtout retenir du document." },
        },
        required: ['contact_id'],
      },
    },
  },
]
