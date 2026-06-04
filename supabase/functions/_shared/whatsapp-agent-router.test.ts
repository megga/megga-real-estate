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
} from './whatsapp-agent-router'

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
  it('extractPairingCode : isole 6 chiffres exacts (espaces/texte tolérés)', () => {
    expect(extractPairingCode('123456')).toBe('123456')
    expect(extractPairingCode('  123456 ')).toBe('123456')
    expect(extractPairingCode('Code: 123456')).toBe('123456')
    expect(extractPairingCode('mon code est 123 456')).toBe('123456')
  })
  it('extractPairingCode : null si pas exactement 6 chiffres', () => {
    expect(extractPairingCode('12345')).toBeNull()
    expect(extractPairingCode('1234567')).toBeNull()
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
  })
  it('search_listings et get_kyc_status sont read (lecture seule)', () => {
    expect(toolTier('search_listings')).toBe('read')
    expect(toolTier('get_kyc_status')).toBe('read')
  })
  it('classe les outils confirm (sensibles : pipeline + envois client + offre)', () => {
    expect(toolTier('update_pipeline')).toBe('confirm')
    expect(toolTier('send_client_message')).toBe('confirm')
    expect(toolTier('send_listings')).toBe('confirm')
    expect(toolTier('record_offer')).toBe('confirm')
    expect(toolTier('send_client_email')).toBe('confirm')
  })
  it('send_kyc_link est confirm (envoi email au client ; KYC facultatif)', () => {
    expect(toolTier('send_kyc_link')).toBe('confirm')
  })
  it('open_kyc_case est confirm (création de dossier LBA → validation agent)', () => {
    expect(toolTier('open_kyc_case')).toBe('confirm')
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
    for (const t of ['send_client_message', 'send_listings', 'record_offer', 'open_kyc_case', 'send_client_email']) {
      expect(canLeaveConfirm(t)).toBe(false)
    }
  })
  it('un outil inconnu ne quitte pas confirm', () => {
    expect(canLeaveConfirm('outil_inconnu')).toBe(false)
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
  const fab1 = "J'ai lancé le screening sur Vladimir Putin (poutin@megga.ch). Résultats dans quelques instants. Je te préviens dès que c'est dispo."
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
    expect(isFabricatedKycClaim('Les deux Vladimir : 1. test-pep@test.ch 2. poutin@megga.ch', false)).toBe(false)
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
})
