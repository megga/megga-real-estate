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
  {
    type: 'function',
    function: {
      name: 'delete_contact',
      description: "Supprime DÉFINITIVEMENT un contact du CRM de l'agence (le système confirme d'abord). Action IRRÉVERSIBLE, réservée à une vraie demande de suppression : « supprime le contact Dubois », « efface cette fiche », « retire Jean Martin du CRM ». Ne l'utilise JAMAIS pour archiver, marquer perdu ou déplacer dans le pipeline (c'est update_pipeline). Les dossiers KYC et transactions du contact sont conservés (déliés), le reste (correspondances, visites) part avec la fiche. contact_id obtenu via search_contacts — n'invente jamais d'identifiant ; si plusieurs contacts correspondent, demande lequel.",
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string', description: 'ID du contact à supprimer (via search_contacts).' },
        },
        required: ['contact_id'],
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
      description: "Fiche synthétique d'un contact (infos, critères, 5 dernières actions) + compréhension de la dernière conversation WhatsApp (résumé, mémoire longue, piste évoquée en conversation) + prochaine action du dossier (next_action_estimee, estimation déterministe interne). Pour « résume Dubois », « où en est X », « rédige une réponse pour X ». contact_id via search_contacts.",
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
      description: "Planifie une visite d'un BIEN pour un contact, EN INTERNE seulement : enregistre la visite dans le CRM, n'envoie RIEN au client (ni invitation, ni email, ni lien) et ne le prévient pas. Requiert le contact ET le bien. Pour « organise une visite du bien X avec Dubois mardi 14h ». contact_id via search_contacts, property_id via get_matches (ou demande à l'agent quel bien).",
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
      description: "Envoie une sélection de biens à un client par WhatsApp (texte + première photo de chaque bien quand elle existe). Pour « envoie à Sarah ses meilleures correspondances », « envoie ces biens à Dubois ». Sans listing_ids, prend automatiquement les meilleures correspondances du contact. Appelle directement l'outil.",
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
      name: 'invite_optin',
      description: "Envoie au CLIENT, par e-mail, une invitation à recevoir tes messages sur WhatsApp. C'est le SEUL moyen d'obtenir son consentement : sans lui, aucun message promotionnel ne peut partir. Pour « invite Dubois sur WhatsApp », « demande à Mme Vaucher si je peux lui écrire ». La personne DOIT déjà exister dans les contacts — si elle n'y est pas, dis-le et propose de la créer d'abord avec create_contact (nom, numéro, e-mail), puis rappelle cet outil. contact_id via search_contacts.",
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
      description: "Rédige le CONTENU d'une annonce immobilière (titre marketing + description bilingue FR/EN + grille de détails) pour un bien des mandats de l'agence, à partir de ses VRAIES données. Deux variantes : 'confidential' (sans coordonnées ni adresse exacte) ou 'public' (avec l'agence + l'agent). Si la variante n'est pas précisée, DEMANDE-la avant d'appeler. Pour « rédige l'annonce du 3 pièces de Champel », « fais le descriptif du bien X ». NE l'envoie pas au client — c'est pour l'agent. Si l'agent veut l'ENREGISTRER / l'utiliser sur le bien, appelle ensuite update_property avec le titre et la description que tu viens de rédiger.",
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
  {
    type: 'function',
    function: {
      name: 'publish_to_portals',
      description: "Publie un bien de l'agence sur les portails immobiliers externes (syndication IDX). Pour « publie le 3 pièces des Eaux-Vives sur immobilier.ch », « mets ce bien en ligne ». Le bien est cherché dans les biens de l'agence (par titre/adresse). Nécessite un bien actif avec des données complètes (titre, prix, adresse, ≥1 photo) ; le mandat n'est PAS requis. Avant de publier, l'outil montre un aperçu de l'annonce puis demande confirmation. Appelle directement l'outil.",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: "Nom / adresse / référence du bien à publier (cherché dans les mandats de l'agence)." },
          portals: { type: 'array', items: { type: 'string' }, description: "Portails cibles. Optionnel : par défaut immobilier.ch. Valeurs : immobilier_ch." },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'withdraw_from_portals',
      description: "Retire un bien de la publication sur les portails externes (le bien disparaîtra au prochain import du portail). Pour « retire le bien de Champel d'immobilier.ch », « dépublie ce bien ». Le bien est cherché dans les mandats de l'agence. Appelle directement l'outil ; il demande confirmation avant de retirer.",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: "Nom / adresse / référence du bien à retirer (cherché dans les mandats de l'agence)." },
          portals: { type: 'array', items: { type: 'string' }, description: "Portails à retirer. Optionnel : par défaut, tous ceux où le bien est publié. Valeurs : immobilier_ch." },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_publication_status',
      description: "Indique sur quels portails externes un bien des mandats est publié (et son état : en ligne / en file pour le prochain import). Lecture seule. Pour « où est publié le bien de Champel ? », « ce bien est-il sur immobilier.ch ? ». Le bien est cherché dans les mandats de l'agence.",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: "Nom / adresse / référence du bien (cherché dans les mandats de l'agence)." },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_property',
      description: "Crée un NOUVEAU bien (brouillon) dans l'agence à partir de ce que l'agent dicte. Pour « crée un 3 pièces aux Eaux-Vives en location à 2400 », « ajoute un nouveau bien : villa à Cologny ». NE remplis QUE les champs que l'agent donne — n'invente JAMAIS. Sans titre fourni, il sera composé du type + pièces + localité. Le bien est créé en BROUILLON ; ensuite l'agent ajoute des photos (attach_property_photos), complète (update_property) puis « publie-le » (publish_to_portals active automatiquement le brouillon).",
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: "Titre de l'annonce (sinon composé du type + pièces + localité)." },
          property_type: { type: 'string', description: 'Type : appartement, maison, villa, terrain, commercial (bureau/local).' },
          transaction_type: { type: 'string', enum: ['rent', 'buy'], description: 'location (rent) ou vente (buy).' },
          price: { type: 'string', description: 'Prix de vente, ou loyer mensuel si location. Ex « 2400 », « 1.2M ».' },
          charges_monthly: { type: 'string', description: 'Charges mensuelles (location).' },
          rooms: { type: 'number', description: 'Nombre de pièces (ex. 3.5).' },
          surface_m2: { type: 'number', description: 'Surface habitable en m².' },
          address: { type: 'string', description: 'Adresse (rue + numéro).' },
          postal_code: { type: 'string', description: 'NPA (code postal suisse).' },
          city: { type: 'string', description: 'Localité.' },
          canton: { type: 'string', description: 'Canton (ex. GE, VD).' },
          year_built: { type: 'number', description: 'Année de construction.' },
          description: { type: 'string', description: "Description, SEULEMENT si l'agent la dicte." },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_property',
      description: "Met à jour ou complète les champs d'un bien de l'agence (pour finir une annonce avant publication, ou corriger une info). NE passe QUE les champs que l'agent te donne EXPLICITEMENT — n'invente JAMAIS de valeur. Le bien est cherché par titre/adresse. Exemples : « pour le 3 pièces des Eaux-Vives, le NPA c'est 1207 et le loyer 2400 », « corrige la surface du bien de Champel à 95 m² », « le bien de Cologny est une villa ». Utile quand publier échoue faute d'une info (l'agent la donne, tu complètes, puis il republie).",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: "Nom / adresse / référence du bien à compléter (cherché dans les biens de l'agence)." },
          title: { type: 'string', description: "Titre de l'annonce." },
          property_type: { type: 'string', description: 'Type : appartement, maison, villa, terrain, commercial (bureau/local).' },
          transaction_type: { type: 'string', enum: ['rent', 'buy'], description: 'location (rent) ou vente (buy).' },
          price: { type: 'string', description: 'Prix de vente, ou loyer mensuel si location. Ex « 2400 », « 1.2M ».' },
          charges_monthly: { type: 'string', description: 'Charges mensuelles (location).' },
          rooms: { type: 'number', description: 'Nombre de pièces (ex. 3.5).' },
          surface_m2: { type: 'number', description: 'Surface habitable en m².' },
          address: { type: 'string', description: 'Adresse (rue + numéro).' },
          postal_code: { type: 'string', description: 'NPA (code postal suisse, 4 chiffres).' },
          city: { type: 'string', description: 'Localité.' },
          canton: { type: 'string', description: 'Canton (ex. GE, VD).' },
          year_built: { type: 'number', description: 'Année de construction.' },
          description: { type: 'string', description: "Description de l'annonce, SEULEMENT si l'agent la dicte (sinon ne pas remplir)." },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'attach_property_photos',
      description: "Ajoute la PHOTO que TU viens d'envoyer dans CE message à un bien de l'agence (sa galerie). Pour « voici les photos du 3 pièces des Eaux-Vives », « ajoute cette photo au bien de Champel ». Une photo par message : si l'agent envoie plusieurs photos d'affilée pour le même bien, rappelle le même `query` à chaque appel (déduit du contexte récent). N'appelle cet outil QUE si une image est jointe à ce message. Utile avant de publier un bien qui n'a pas encore de photos.",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: "Nom / adresse / référence du bien auquel ajouter la photo (cherché dans les biens de l'agence)." },
        },
        required: ['query'],
      },
    },
  },
]
