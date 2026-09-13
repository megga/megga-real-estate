import { describe, it, expect } from 'vitest'
import {
  extractPairingCode,
  isPairingCodeValid,
  toolTier,
  parseConfirmation,
  isPendingActionValid,
  buildHistoryMessages,
  isValidStage,
  PIPELINE_STAGES,
  deriveDealParty,
  dealStageDefault,
  canLeaveConfirm,
  isUndoCommand,
  isFabricatedKycClaim,
  KYC_CLAIM_RETRY_NUDGE,
  classifyContactArg,
  contactResolutionNote,
  kycScreenLabel,
  kycDateShort,
  projectMatchListing,
  stripExactAddress,
  portalLabel,
  normalizePortal,
  CONFIRM_TOOLS,
} from './whatsapp-agent-router'
import { WHATSAPP_TOOLS } from './whatsapp-tools'

describe('buildHistoryMessages', () => {
  it('reconstruit le fil chronologique (inbound→user, outbound→assistant)', () => {
    const rowsDesc = [
      { direction: 'outbound', body: 'Quel budget ?', transcript: null },
      { direction: 'inbound', body: 'je cherche un 3 pièces', transcript: null },
    ]
    expect(buildHistoryMessages(rowsDesc)).toEqual([
      { role: 'user', content: 'je cherche un 3 pièces' },
      { role: 'assistant', content: 'Quel budget ?' },
    ])
  })
  it('priorise le transcript et ignore les messages vides', () => {
    const rows = [
      { direction: 'inbound', body: null, transcript: 'vocal transcrit' },
      { direction: 'inbound', body: '', transcript: null },
    ]
    expect(buildHistoryMessages(rows)).toEqual([{ role: 'user', content: 'vocal transcrit' }])
  })
})

describe('whatsapp-agent-router — pairing code', () => {
  it('extractPairingCode : isole 8 chiffres exacts (espaces/texte tolérés)', () => {
    expect(extractPairingCode('12345678')).toBe('12345678')
    expect(extractPairingCode('  12345678 ')).toBe('12345678')
    expect(extractPairingCode('Code: 12345678')).toBe('12345678')
    expect(extractPairingCode('mon code est 1234 5678')).toBe('12345678')
    expect(extractPairingCode('00341829')).toBe('00341829') // zéros de tête préservés
  })
  it('extractPairingCode : null si pas exactement 8 chiffres', () => {
    expect(extractPairingCode('1234567')).toBeNull()
    expect(extractPairingCode('123456789')).toBeNull()
    expect(extractPairingCode('123456')).toBeNull()
    expect(extractPairingCode('bonjour')).toBeNull()
    expect(extractPairingCode('')).toBeNull()
    expect(extractPairingCode(null)).toBeNull()
    expect(extractPairingCode(undefined)).toBeNull()
  })
  it('isPairingCodeValid : vrai seulement si futur', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(isPairingCodeValid(future)).toBe(true)
    expect(isPairingCodeValid(past)).toBe(false)
    expect(isPairingCodeValid(null)).toBe(false)
    expect(isPairingCodeValid('not-a-date')).toBe(false)
  })
})

describe('toolTier', () => {
  it('classe les outils read', () => {
    expect(toolTier('get_my_agenda')).toBe('read')
    expect(toolTier('search_contacts')).toBe('read')
    expect(toolTier('get_contact_brief')).toBe('read')
    expect(toolTier('list_followups')).toBe('read')
    expect(toolTier('get_matches')).toBe('read')
    expect(toolTier('get_daily_brief')).toBe('read')
  })
  it('classe les outils auto', () => {
    expect(toolTier('create_contact')).toBe('auto')
    expect(toolTier('add_note')).toBe('auto')
    expect(toolTier('schedule_visit')).toBe('auto')
    expect(toolTier('create_reminder')).toBe('auto')
    expect(toolTier('qualify_lead')).toBe('auto')
    expect(toolTier('create_deal')).toBe('auto')
    expect(toolTier('attach_property_photos')).toBe('auto')
    expect(toolTier('update_property')).toBe('auto')
    expect(toolTier('create_property')).toBe('auto')
  })
  it('search_listings et get_kyc_status sont read (lecture seule)', () => {
    expect(toolTier('search_listings')).toBe('read')
    expect(toolTier('get_kyc_status')).toBe('read')
  })
  it("lames groupe read-tier — agent-facing, rien d'envoyé", () => {
    // summarize_group_thread et check_group_leak : lecture + analyse pure,
    // résultat rendu uniquement à l'agent dans son 1:1 — jamais envoyé au client.
    expect(toolTier('summarize_group_thread')).toBe('read')
    expect(toolTier('check_group_leak')).toBe('read')
  })
  it("draft_listing_copy est read — brouillon d'annonce agent-facing, rien d'envoyé", () => {
    // Rédige le contenu d'une annonce (titre + description + grille) pour un bien de
    // l'agence ; résultat rendu à l'agent dans son 1:1, jamais envoyé au client.
    expect(toolTier('draft_listing_copy')).toBe('read')
  })
  it("prepare_meeting est read — brief de préparation de RDV agent-facing, rien d'envoyé", () => {
    // Agrège fiche + biens correspondants + visite à venir (vraies tables, scope agence)
    // + 3 points à aborder ; résultat rendu à l'agent dans son 1:1, jamais envoyé au client.
    expect(toolTier('prepare_meeting')).toBe('read')
  })
  it("read_document est read — lit une pièce entrante et rend la lecture à l'agent, rien d'écrit/envoyé", () => {
    // OCR Gemini + digest DeepSeek d'un document du message courant ; résultat rendu à l'agent,
    // aucune écriture CRM, aucun envoi client → read.
    expect(toolTier('read_document')).toBe('read')
  })
  it('file_document est auto — classe la lecture en note timeline, aucun envoi client', () => {
    // Même lecture que read_document, puis écrit une NOTE sur la timeline du contact
    // (état CRM interne réversible/audité, jamais d'envoi client) → auto, comme add_note.
    expect(toolTier('file_document')).toBe('auto')
  })
  it('classe les outils confirm (sensibles : pipeline + envois client + offre)', () => {
    expect(toolTier('update_pipeline')).toBe('confirm')
    expect(toolTier('send_client_message')).toBe('confirm')
    expect(toolTier('send_listings')).toBe('confirm')
    expect(toolTier('record_offer')).toBe('confirm')
    expect(toolTier('send_client_email')).toBe('confirm')
  })
  it('invite_optin est confirm — il engage juridiquement l’agence', () => {
    // L'e-mail porte l'information préalable de l'art. 6 al. 6 nLPD. Et « invite Dubois »
    // avec deux Dubois au fichier doit pouvoir être arrêté AVANT l'envoi : c'est le seul
    // garde-fou entre une phrase en langage naturel et un e-mail à la mauvaise personne.
    expect(toolTier('invite_optin')).toBe('confirm')
  })

  it('send_kyc_link est confirm (envoi email au client ; KYC facultatif)', () => {
    expect(toolTier('send_kyc_link')).toBe('confirm')
  })
  it('open_kyc_case est confirm (création de dossier LBA → validation agent)', () => {
    expect(toolTier('open_kyc_case')).toBe('confirm')
  })
  it('delete_contact est confirm (suppression DÉFINITIVE → jamais auto, jamais dans la boucle)', () => {
    expect(toolTier('delete_contact')).toBe('confirm')
  })
  it('run_kyc_screening est slow_async (Palier 2 : ~50s Dilisense → hors boucle)', () => {
    expect(toolTier('run_kyc_screening')).toBe('slow_async')
  })
  it('attach_kyc_document est auto (joint une pièce, aucun envoi client)', () => {
    expect(toolTier('attach_kyc_document')).toBe('auto')
  })
  it('par défaut un outil inconnu est confirm (fail-safe)', () => {
    expect(toolTier('delete_everything')).toBe('confirm')
  })
  it('un nom qui existe sur le PROTOTYPE reste confirm — il rendait une fonction', () => {
    for (const name of ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__']) {
      expect(toolTier(name), name).toBe('confirm')
    }
  })
})

// Le défaut fail-safe de toolTier (inconnu ⇒ 'confirm') garantit qu'un nom inventé n'est jamais
// EXÉCUTÉ ; CONFIRM_TOOLS garantit qu'il n'est jamais PROPOSÉ à la confirmation — stashPending
// le refuse avant la question, au lieu de « Je vais effectuer cette action » puis unknownAction.
describe('CONFIRM_TOOLS — les seuls outils que stashPending prépare', () => {
  it('contient exactement les outils confirm du registre', () => {
    expect([...CONFIRM_TOOLS].sort()).toEqual([
      'delete_contact', 'invite_optin', 'open_kyc_case', 'publish_to_portals', 'record_offer',
      'send_client_email', 'send_client_message', 'send_kyc_link', 'send_listings',
      'update_pipeline', 'withdraw_from_portals',
    ])
  })

  it('le catalogue envoyé au modèle et le registre désignent les mêmes outils confirm', () => {
    // Un outil du catalogue que le registre oublie retombe sur le défaut 'confirm' : il apparaît
    // à gauche et pas à droite. Un outil confirm retiré du catalogue mais resté au registre : l'inverse.
    const catalogueConfirm = WHATSAPP_TOOLS.map((t) => t.function.name).filter((n) => toolTier(n) === 'confirm')
    expect(catalogueConfirm.sort()).toEqual([...CONFIRM_TOOLS].sort())
  })

  it('un nom inventé est confirm par défaut, mais n’en fait jamais partie', () => {
    for (const name of ['send_whatsapp_message', 'delete_everything', '', 'constructor', 'toString', '__proto__']) {
      expect(toolTier(name), name).toBe('confirm')
      expect(CONFIRM_TOOLS.has(name), name).toBe(false)
    }
  })

  it('aucun outil read, auto ou slow_async n’en fait partie', () => {
    for (const name of ['search_contacts', 'get_kyc_status', 'create_contact', 'add_note', 'run_kyc_screening', 'send_kyc_report']) {
      expect(CONFIRM_TOOLS.has(name), name).toBe(false)
    }
  })
})

describe('send_kyc_report tier', () => {
  it('est slow_async (Palier 2 : ~60s render PDF + envoi → hors boucle)', () => {
    expect(toolTier('send_kyc_report')).toBe('slow_async')
  })
})

describe('parseConfirmation', () => {
  it('reconnaît oui', () => {
    expect(parseConfirmation('oui')).toBe('yes')
    expect(parseConfirmation('  OUI ')).toBe('yes')
    expect(parseConfirmation('ok')).toBe('yes')
    expect(parseConfirmation('vas-y')).toBe('yes')
    expect(parseConfirmation('confirme')).toBe('yes')
  })
  it('reconnaît non', () => {
    expect(parseConfirmation('non')).toBe('no')
    expect(parseConfirmation('annule')).toBe('no')
    expect(parseConfirmation('stop')).toBe('no')
  })
  it("renvoie none si ce n'est ni oui ni non", () => {
    expect(parseConfirmation('crée un contact Marie')).toBe('none')
    expect(parseConfirmation('')).toBe('none')
    expect(parseConfirmation(null)).toBe('none')
  })
})

describe('isPendingActionValid', () => {
  it('valide si non expiré', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    expect(isPendingActionValid(future)).toBe(true)
  })
  it('invalide si expiré ou absent', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(isPendingActionValid(past)).toBe(false)
    expect(isPendingActionValid(null)).toBe(false)
  })
})

describe('toolTier — tiers des outils KYC (Palier 2)', () => {
  it('run_kyc_screening et send_kyc_report sont slow_async', () => {
    expect(toolTier('run_kyc_screening')).toBe('slow_async')
    expect(toolTier('send_kyc_report')).toBe('slow_async')
  })
  it('attach_kyc_document reste auto (synchrone, P2b)', () => {
    expect(toolTier('attach_kyc_document')).toBe('auto')
  })
  it('le socle légal reste confirm (jamais slow_async/auto)', () => {
    for (const t of ['send_client_message', 'send_listings', 'record_offer', 'open_kyc_case', 'send_client_email']) {
      expect(toolTier(t)).toBe('confirm')
    }
  })
  it('un outil inconnu reste confirm (fail-safe)', () => {
    expect(toolTier('outil_inexistant')).toBe('confirm')
  })
})

describe('isValidStage', () => {
  it('accepte les 14 étapes canoniques', () => {
    expect(PIPELINE_STAGES).toHaveLength(14)
    expect(isValidStage('new_lead')).toBe(true)
    expect(isValidStage('negotiation')).toBe(true)
    expect(isValidStage('signed')).toBe(true)
    expect(isValidStage('to_recontact')).toBe(true)
  })
  it('rejette les valeurs legacy, vides ou de mauvaise casse', () => {
    expect(isValidStage('closed')).toBe(false)
    expect(isValidStage('lead')).toBe(false)
    expect(isValidStage('visit_planned_legacy')).toBe(false)
    expect(isValidStage('')).toBe(false)
    expect(isValidStage('NEGOTIATION')).toBe(false)
  })
})

describe('deriveDealParty', () => {
  it("respecte le choix explicite de l'agent", () => {
    expect(deriveDealParty('buyer', 'seller')).toBe('seller')
    expect(deriveDealParty('seller', 'buyer')).toBe('buyer')
  })
  it('déduit du type de contact si pas de choix explicite', () => {
    expect(deriveDealParty('seller')).toBe('seller')
    expect(deriveDealParty('buyer')).toBe('buyer')
    expect(deriveDealParty('lead')).toBe('buyer')
    expect(deriveDealParty(null)).toBe('buyer')
  })
  it('ignore une valeur explicite invalide', () => {
    expect(deriveDealParty('seller', "n'importe quoi")).toBe('seller')
    expect(deriveDealParty('buyer', '')).toBe('buyer')
  })
})

describe('dealStageDefault', () => {
  it('vendeur → new_lead (mandat), acheteur → active_search (recherche)', () => {
    expect(dealStageDefault('seller')).toBe('new_lead')
    expect(dealStageDefault('buyer')).toBe('active_search')
  })
  it('renvoie toujours une étape canonique valide', () => {
    expect(isValidStage(dealStageDefault('seller'))).toBe(true)
    expect(isValidStage(dealStageDefault('buyer'))).toBe(true)
  })
})

describe('canLeaveConfirm — invariant socle légal (Palier 3)', () => {
  // update_pipeline est l'unique true par construction (===). Socle légal (5 outils) : tous
  // renvoient false. Si un 6e outil du socle est ajouté, l'ajouter ici ET dans
  // tests/backend/whatsapp-assisted-outbound.spec.ts.
  it('SEUL update_pipeline peut quitter confirm', () => {
    expect(canLeaveConfirm('update_pipeline')).toBe(true)
  })
  it('le socle légal ne quitte JAMAIS confirm', () => {
    for (const t of ['send_client_message', 'send_listings', 'record_offer', 'open_kyc_case', 'send_client_email', 'publish_to_portals', 'withdraw_from_portals']) {
      expect(canLeaveConfirm(t)).toBe(false)
    }
  })
  it('un outil inconnu ne quitte pas confirm', () => {
    expect(canLeaveConfirm('outil_inconnu')).toBe(false)
  })
})

describe('syndication portails (Phase 2) — tiers + libellés', () => {
  it('publish/withdraw sont confirm (jamais sans le « oui » de l\'agent)', () => {
    expect(toolTier('publish_to_portals')).toBe('confirm')
    expect(toolTier('withdraw_from_portals')).toBe('confirm')
  })
  it('get_publication_status est read (lecture seule)', () => {
    expect(toolTier('get_publication_status')).toBe('read')
  })
  it('portalLabel rend un libellé humain (jamais l\'enum brut)', () => {
    expect(portalLabel('immobilier_ch')).toBe('immobilier.ch')
    expect(portalLabel('portail_inconnu')).toBe('portail_inconnu')
  })
  it('normalizePortal mappe la saisie libre vers la clé interne', () => {
    expect(normalizePortal('immobilier.ch')).toBe('immobilier_ch')
    expect(normalizePortal('Immobilier-CH')).toBe('immobilier_ch')
    expect(normalizePortal('  immobilier ch ')).toBe('immobilier_ch')
  })
})

describe('isUndoCommand', () => {
  it('reconnaît les annulations courtes', () => {
    for (const t of ['/annuler', 'annuler', 'annule', 'undo', 'reviens', 'rétablis', 'retablis']) expect(isUndoCommand(t)).toBe(true)
  })
  it('ne matche pas une phrase normale', () => {
    expect(isUndoCommand('déplace Dupont en négociation')).toBe(false)
    expect(isUndoCommand('')).toBe(false)
  })
})

describe('isFabricatedKycClaim — garde anti-hallucination KYC (hotfix Vladimir)', () => {
  // Les 2 messages EXACTS de l'incident prod (DeepSeek a inventé le screening sans appeler l'outil).
  const fab1 = "J'ai lancé le screening sur Vladimir Putin (poutin@getmegga.com). Résultats dans quelques instants. Je te préviens dès que c'est dispo."
  const fab2 = "Désolé, le screening ne me remonte pas de résultat immédiat – c'est un traitement asynchrone. Je peux te recréer un rappel pour dans 30 minutes si tu veux que je vérifie à ce moment-là."

  it("détecte les fabrications de l'incident quand AUCUN outil KYC n'a tourné", () => {
    expect(isFabricatedKycClaim(fab1, false)).toBe(true)
    expect(isFabricatedKycClaim(fab2, false)).toBe(true)
  })

  it('ne flague PAS si un outil KYC a réellement été appelé (ACK/relais légitime)', () => {
    // Le job EST en file → le message « je lance le screening » est honnête.
    expect(isFabricatedKycClaim(fab1, true)).toBe(false)
    expect(isFabricatedKycClaim('Screening de Vladimir : PEP détecté ⚠️, correspondance sanctions ⚠️.', true)).toBe(false)
  })

  it("ne flague PAS une OFFRE/QUESTION (pas une affirmation d'action faite)", () => {
    expect(isFabricatedKycClaim('Tu veux que je relance un screening sur le 2 ?', false)).toBe(false)
    expect(isFabricatedKycClaim('Les deux Vladimir : 1. test-pep@test.ch 2. poutin@getmegga.com', false)).toBe(false)
    expect(isFabricatedKycClaim('Je peux lancer le screening si tu me confirmes le contact.', false)).toBe(false)
  })

  it('ne flague PAS un message hors-KYC', () => {
    expect(isFabricatedKycClaim('Visite planifiée demain 14h pour Dupont.', false)).toBe(false)
    expect(isFabricatedKycClaim('', false)).toBe(false)
    expect(isFabricatedKycClaim(null, false)).toBe(false)
  })

  it('détecte aussi un RÉSULTAT fabriqué (sans outil) et une fausse confirmation de rapport', () => {
    expect(isFabricatedKycClaim('Screening effectué : pas de PEP, pas de sanction, risque faible.', false)).toBe(true)
    expect(isFabricatedKycClaim('Le rapport KYC de Vladimir a été envoyé en PDF.', false)).toBe(true)
  })

  it('couvre les SYNONYMES FR de fabrication (revue adversariale)', () => {
    const fabs = [
      'Le contrôle LBA est lancé.',
      'Vérification PEP faite : RAS.',
      "J'ai déclenché le screening.",
      'Screening en cours…',
      'Le screening tourne, je reviens vers toi.',
      'La vérification sanctions est en route.',
      "Je m'occupe du screening, ça arrive.",
      'Je viens de lancer le screening.',
      'Screening démarré, résultats à venir.',
      "C'est parti pour la vérif PEP de Vladimir.",
      'Screening OK, aucun PEP trouvé.',
    ]
    for (const f of fabs) expect(isFabricatedKycClaim(f, false), f).toBe(true)
  })

  it("couvre les fabrications EN (l'agent est FR/EN)", () => {
    const fabs = [
      'I launched the screening, results shortly.',
      "It's processing asynchronously, I'll let you know.",
      'Screening done: low risk, no PEP match.',
      'I sent the KYC report PDF.',
      'The sanctions check is in progress.',
    ]
    for (const f of fabs) expect(isFabricatedKycClaim(f, false), f).toBe(true)
  })

  it('ne flague PAS une référence HISTORIQUE légitime (« déjà », « hier »)', () => {
    expect(isFabricatedKycClaim('On a déjà généré le rapport KYC de Vladimir.', false)).toBe(false)
    expect(isFabricatedKycClaim("Le screening d'hier montre un PEP — risque élevé.", false)).toBe(false)
    expect(isFabricatedKycClaim('Le rapport KYC a déjà été envoyé la semaine dernière.', false)).toBe(false)
  })

  it('ne flague PAS les OFFRES / questions / futur (pas une affirmation faite)', () => {
    const offers = [
      'Tu veux que je lance le screening sur le 2 ?',
      'Je peux lancer le screening si tu me confirmes le contact.',
      'Je vais lancer le screening de Dupont.',
      'Tu veux une vérification PEP ou autre chose ?',
      'Le dossier KYC de Dupont est ouvert, tu veux le screener ?',
    ]
    for (const o of offers) expect(isFabricatedKycClaim(o, false), o).toBe(false)
  })

  // ── get_kyc_status (lecture) arme kycStatusRead : légitime la NARRATION d'ÉTAT/RÉSULTAT d'un statut
  // réellement lu (le vrai faux positif = un statut 'pending' rendu « screening en cours », ou un
  // « risque faible » de risk_level), SANS désarmer la garde contre une revendication d'ACTION. ─────
  it('kycStatusRead légitime la narration d\'ÉTAT/RÉSULTAT d\'un statut réellement lu', () => {
    // Sans lecture (kycStatusRead=false) → fabrication de résultat ; avec lecture → narration légitime.
    expect(isFabricatedKycClaim('Le screening de Dupont est en cours.', false, false)).toBe(true)
    expect(isFabricatedKycClaim('Le screening de Dupont est en cours.', false, true)).toBe(false)
    expect(isFabricatedKycClaim('Dupont : risque faible, pas de PEP côté sanctions.', false, false)).toBe(true)
    expect(isFabricatedKycClaim('Dupont : risque faible, pas de PEP côté sanctions.', false, true)).toBe(false)
  })

  it('kycStatusRead ne légitime PAS une revendication d\'ACTION (lire ≠ lancer) — garde Vladimir intacte', () => {
    // Cœur du correctif L2 : lire un statut ne doit jamais couvrir une fausse ACTION (lancement/envoi/
    // promesse de résultat à venir), même au même tour. Sinon régression Vladimir par effet de bord.
    expect(isFabricatedKycClaim("J'ai lancé le screening de Dupont.", false, true)).toBe(true)
    expect(isFabricatedKycClaim("Screening en cours, je te préviens dès que j'ai les résultats.", false, true)).toBe(true)
    expect(isFabricatedKycClaim('Le rapport KYC est parti.', false, true)).toBe(true)
  })

  it('kycToolCalled=true (action KYC réellement exécutée) court-circuite tout', () => {
    expect(isFabricatedKycClaim("J'ai lancé le screening de Dupont.", true)).toBe(false)
    expect(isFabricatedKycClaim('Le screening est en cours.', true)).toBe(false)
  })

  // ── Incident du 13.09.2026 : « Donne-moi le PDF » → DeepSeek répond deux fois que le rapport est
  // parti, sans avoir appelé send_kyc_report (aucune tâche en file, aucun appel à kyc-report-pdf).
  // Les motifs ne connaissaient que « est parti » et la 1re personne. ─────────────────────────────
  const incident = [
    'Le rapport KYC part sur ton WhatsApp.',
    'Le rapport KYC (PDF) de Julien Ahmedi vient de partir sur ton WhatsApp, comme demandé.',
  ]

  it('détecte les deux réponses EXACTES de l’incident du 13.09.2026 quand aucun outil n’a tourné', () => {
    for (const f of incident) expect(isFabricatedKycClaim(f, false), f).toBe(true)
    // Et une lecture de statut ne les légitime pas : narrer un envoi n'est pas narrer un état.
    for (const f of incident) expect(isFabricatedKycClaim(f, false, true), f).toBe(true)
  })

  it('les mêmes phrases passent quand send_kyc_report a réellement tourné', () => {
    for (const f of incident) expect(isFabricatedKycClaim(f, true), f).toBe(false)
  })

  it('couvre les autres formes de délivrance narrée (présent, 3e personne, apostrophe typographique)', () => {
    const fabs = [
      'Je te l’envoie, le rapport KYC de Dubois.',
      "Je te l'ai envoyé : rapport KYC de Dubois.",
      'Voici le rapport KYC de Dubois 📎',
      'Rapport KYC ci-joint.',
      'Le rapport KYC vient d’être envoyé.',
      'Tu le reçois dans la conversation : rapport KYC de Dubois.',
      'Tu vas le recevoir dans un instant, le rapport KYC.',
      'The KYC report is on its way.',
      "Here's the KYC report for Dubois.",
      "C’est parti pour le screening de Dubois.",
    ]
    for (const f of fabs) expect(isFabricatedKycClaim(f, false), f).toBe(true)
  })

  it('ne flague PAS les voisins légitimes de ces formes', () => {
    const legit = [
      // Offre / question
      'Tu veux que je t’envoie le rapport KYC de Julien Ahmedi ?',
      // « de ma part » n'est pas un envoi
      'Désolé, erreur de ma part sur le screening de Dubois : quel contact veux-tu ?',
      // Demander à l'agent de transférer une pièce qu'il RECEVRA du client
      'Dès que tu la reçois, transfère-moi la pièce d’identité pour le dossier KYC.',
      // Historique nommé (même marqueurs que la garde anti-confirmation simulée)
      'Oui, le rapport KYC t’a été envoyé tout à l’heure.',
      'Le screening de Dubois a été fait ce matin : RAS.',
      // Le relais du CRM après ouverture (aucune délivrance)
      'Dossier KYC ouvert. Tu peux me transférer les pièces que tu as quand tu veux.',
    ]
    for (const l of legit) expect(isFabricatedKycClaim(l, false), l).toBe(false)
  })

  it('la consigne de relance nomme les deux outils et interdit de narrer l’envoi', () => {
    expect(KYC_CLAIM_RETRY_NUDGE).toMatch(/send_kyc_report/)
    expect(KYC_CLAIM_RETRY_NUDGE).toMatch(/run_kyc_screening/)
    expect(KYC_CLAIM_RETRY_NUDGE).toMatch(/search_contacts/)
    expect(KYC_CLAIM_RETRY_NUDGE).toMatch(/Ne rappelle pas un outil qui a déjà abouti/)
    // L'identifiant, jamais le nom : c'est le nom qui a fait échouer la file le même soir.
    expect(KYC_CLAIM_RETRY_NUDGE).toMatch(/IDENTIFIANT.*jamais son nom/)
  })

  // ── Même soirée, APRÈS le premier correctif : deux nouvelles tournures sont passées. ────────
  const incident2 = [
    'Je relance l’envoi du rapport KYC de Julien Ahmedi sur ton WhatsApp.',
    // La 2e phrase offre (« je peux réessayer ») : elle excusait toute la réponse.
    'Le système a bien repris l’envoi du rapport sur ton WhatsApp à l’instant. Si tu ne le vois toujours pas, dis-le moi : je peux réessayer ou vérifier le dossier avec toi.',
  ]

  it('détecte les deux réponses exactes du second essai (13.09.2026, après déploiement)', () => {
    for (const f of incident2) expect(isFabricatedKycClaim(f, false), f).toBe(true)
    for (const f of incident2) expect(isFabricatedKycClaim(f, true), f).toBe(false)
  })

  it('une offre n’excuse plus que SA phrase', () => {
    expect(isFabricatedKycClaim('Le rapport KYC est parti. Tu veux autre chose ?', false)).toBe(true)
    expect(isFabricatedKycClaim('Je lance le screening de Dubois. Si tu veux, je te préviens après.', false)).toBe(true)
    // …et une offre SEULE reste une offre
    expect(isFabricatedKycClaim('Si tu veux, je relance le screening de Dubois.', false)).toBe(false)
    expect(isFabricatedKycClaim('Dès que tu confirmes, je lance le screening.', false)).toBe(false)
  })

  it('le PDF qui part est surveillé même sans le mot « KYC »', () => {
    const fabs = [
      'Le système a bien repris l’envoi du rapport sur ton WhatsApp.',
      'Je renvoie le PDF sur ton WhatsApp.',
      'Je te renvoie le PDF sur ton WhatsApp.',
      "Je t'envoie le rapport en pièce jointe.",
      'Voici le PDF.',
    ]
    for (const f of fabs) expect(isFabricatedKycClaim(f, false), f).toBe(true)
    // Le récapitulatif hebdomadaire dit légitimement « voici ton rapport » : sans PDF ni
    // marqueur de livraison, hors périmètre.
    expect(isFabricatedKycClaim('Voici ton rapport de la semaine : 3 visites, 2 offres.', false)).toBe(false)
  })

  it('un PDF ENTRANT n’est pas une livraison, même avec « envoyé » ou « c’est fait »', () => {
    const legit = [
      // read_document / file_document : l'agent a envoyé la pièce, MEGGA la lit ou la classe
      "J'ai classé le PDF en note sur la fiche de Dubois.",
      'Voici le résumé du PDF que tu m’as envoyé : bail de 3 ans.',
      "C'est fait : j'ai classé le PDF que tu m'as envoyé sur WhatsApp dans les notes de Dubois.",
      // narration du message lui-même, pas une pièce jointe
      "Je t'envoie le statut KYC de Dubois : 3 contrôles sur 5.",
    ]
    for (const l of legit) expect(isFabricatedKycClaim(l, false, true), l).toBe(false)
  })

  it('l’ACK réel de la file reste légitime — et devient une fabrication s’il est recopié sans outil', () => {
    const ack = 'Je prépare le rapport KYC de Julien Ahmedi, tu reçois le PDF dans ~15 s.'
    expect(isFabricatedKycClaim(ack, true)).toBe(false)
    expect(isFabricatedKycClaim(ack, false)).toBe(true)
  })
})

describe('classifyContactArg / contactResolutionNote — le contact_id des outils lents', () => {
  it('garde un UUID, traite tout autre texte comme un NOM (incident : « Julien Ahmedi »)', () => {
    expect(classifyContactArg('E04DE263-550F-4326-91C2-AB7A396E2592'))
      .toEqual({ kind: 'uuid', id: 'e04de263-550f-4326-91c2-ab7a396e2592' })
    expect(classifyContactArg('Julien Ahmedi')).toEqual({ kind: 'name', name: 'Julien Ahmedi' })
    expect(classifyContactArg('  Dubois ')).toEqual({ kind: 'name', name: 'Dubois' })
  })

  it('rien d’exploitable = contact manquant', () => {
    for (const raw of [undefined, null, '', ' ', 'x', '%', 42, { id: 'x' }]) {
      expect(classifyContactArg(raw), String(raw)).toEqual({ kind: 'missing' })
    }
  })

  it('la note au modèle dit quoi faire, et n’annonce jamais un envoi', () => {
    expect(contactResolutionNote('missing')).toMatch(/search_contacts/)
    const none = contactResolutionNote('none', 'Dubois')
    expect(none).toMatch(/Aucun contact « Dubois »/)
    const many = contactResolutionNote('many', 'Dubois', [
      { id: 'a1', first_name: 'Marie', last_name: 'Dubois' },
      { id: 'b2', first_name: null, last_name: 'Dubois' },
    ])
    expect(many).toMatch(/Marie Dubois \(a1\) ; Dubois \(b2\)/)
    expect(many).toMatch(/Demande à l'agent lequel/)
    for (const n of [none, many]) expect(n).toMatch(/n'annonce aucun envoi/)
    // La note elle-même ne doit pas ressembler à une fabrication si le modèle la recopiait.
    for (const n of [none, many]) expect(isFabricatedKycClaim(n, false), n).toBe(false)
  })
})

describe('kycDateShort — date courte Europe/Zurich (anti-fuite ISO brute)', () => {
  it('formate une ISO valide en DD.MM', () => {
    expect(kycDateShort('2026-06-15T10:00:00Z')).toBe('15.06')
  })
  it('renvoie \'\' pour null / vide / invalide', () => {
    expect(kycDateShort(null)).toBe('')
    expect(kycDateShort(undefined)).toBe('')
    expect(kycDateShort('pas une date')).toBe('')
  })
})

describe('kycScreenLabel — anti-confusion not_checked vs clear (LBA)', () => {
  it('not_checked ≠ clear : une absence de contrôle n\'est JAMAIS narrée « RAS »', () => {
    const notChecked = kycScreenLabel('not_checked', null)
    const clear = kycScreenLabel('clear', '2026-06-15T10:00:00Z')
    expect(notChecked).toBe('non vérifié (aucun screening lancé)')
    expect(clear).toContain('rien à signaler')
    expect(clear).toContain('15.06')
    expect(notChecked).not.toBe(clear)
  })
  it('clear sans date → mention clôturé sans date inventée', () => {
    expect(kycScreenLabel('clear', null)).toBe('rien à signaler (screening clôturé)')
  })
  it('match et pending ont des libellés explicites', () => {
    expect(kycScreenLabel('match', null)).toBe('correspondance détectée ⚠')
    expect(kycScreenLabel('pending', null)).toBe('screening en cours')
  })
  it('NULL / valeur inconnue retombe sur « non vérifié » (jamais RAS)', () => {
    expect(kycScreenLabel(null, null)).toBe('non vérifié (aucun screening lancé)')
    expect(kycScreenLabel('weird', null)).toBe('non vérifié (aucun screening lancé)')
  })
})

describe('projectMatchListing — enrichi sans fabrication (champ absent OMIS)', () => {
  it('property résolue → titre/montant/ville/pièces réels', () => {
    const out = projectMatchListing(
      { score: 87, status: 'sent', property_id: 'p1', market_listing_id: null },
      { title: 'Appartement Eaux-Vives', price: 1850000, city: 'Genève', rooms: 4 },
      null,
    )
    expect(out).toEqual({ id: 'p1', score: 87, statut: 'sent', titre: 'Appartement Eaux-Vives', montant: 1850000, ville: 'Genève', pieces: 4 })
  })
  it('market_listing en location → montant via rent_chf ?? rent ?? price', () => {
    const out = projectMatchListing(
      { score: 70, status: null, property_id: null, market_listing_id: 'm1' },
      null,
      { title: 'Loc Lancy', transaction_type: 'rent', price: 0, rent: 2400, rent_chf: null, city: 'Lancy', rooms: 3 },
    )
    expect(out).toEqual({ id: 'm1', score: 70, titre: 'Loc Lancy', montant: 2400, ville: 'Lancy', pieces: 3 })
    expect(out).not.toHaveProperty('statut') // status null → omis
  })
  it('ni property ni market_listing résolus → AUCUN titre inventé (que id/score/statut)', () => {
    const out = projectMatchListing(
      { score: 50, status: 'suggested', property_id: 'p2', market_listing_id: null },
      null,
      null,
    )
    expect(out).toEqual({ id: 'p2', score: 50, statut: 'suggested' })
    expect(out).not.toHaveProperty('titre')
    expect(out).not.toHaveProperty('montant')
  })
  it('champ null/<=0 OMIS (jamais de clé vide à halluciner)', () => {
    const out = projectMatchListing(
      { score: 60, status: 'sent', property_id: 'p3', market_listing_id: null },
      { title: null, price: 0, city: null, rooms: 0 },
      null,
    )
    expect(out).toEqual({ id: 'p3', score: 60, statut: 'sent' }) // tout le reste omis
  })
})

describe('stripExactAddress — garde anti-fuite adresse (annonce confidentielle)', () => {
  it('masque le numéro quand rue distinctive + numéro co-apparaissent', () => {
    const out = stripExactAddress('Bien proche de la Rue de Carouge 12, lumineux.', 'Rue de Carouge 12')
    expect(out).not.toMatch(/\b12\b/)
    expect(out).toContain('—')
    expect(out).toContain('Carouge') // on ne touche pas au nom de rue, juste au numéro
  })
  it('ne masque PAS un numéro sans le nom de rue dans la phrase (pas de faux positif)', () => {
    const out = stripExactAddress('À 12 minutes du centre, calme.', 'Rue de Carouge 12')
    expect(out).toBe('À 12 minutes du centre, calme.')
  })
  it('accents/casse insensibles (Crêtes ≡ cretes)', () => {
    const out = stripExactAddress('Au chemin des Crêtes 8, récemment rénové.', 'Chemin des Crêtes 8')
    expect(out).not.toMatch(/\b8\b/)
    expect(out).toContain('—')
  })
  it('adresse sans numéro → aucun strip (le nom de rue seul est trop commun)', () => {
    const t = 'Idéalement situé Rue de Carouge, quartier prisé.'
    expect(stripExactAddress(t, 'Rue de Carouge')).toBe(t)
  })
  it('nom de rue < 4 lettres → conservateur, aucun strip', () => {
    const t = 'Proche du Lac 15, vue dégagée.'
    expect(stripExactAddress(t, 'Quai du Lac 15')).toBe(t) // 'lac' (3) exclu, 'quai' générique → rien à matcher
  })
  it('entrées vides / null → texte inchangé', () => {
    expect(stripExactAddress('', 'Rue de Carouge 12')).toBe('')
    expect(stripExactAddress('un texte', null)).toBe('un texte')
    expect(stripExactAddress('un texte', undefined)).toBe('un texte')
  })
})
