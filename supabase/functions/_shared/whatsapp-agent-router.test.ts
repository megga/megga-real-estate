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
  canLeaveConfirm,
  isUndoCommand,
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
  })
  it('classe les outils confirm (sensibles : pipeline + envois client + offre)', () => {
    expect(toolTier('update_pipeline')).toBe('confirm')
    expect(toolTier('send_client_message')).toBe('confirm')
    expect(toolTier('send_listings')).toBe('confirm')
    expect(toolTier('record_offer')).toBe('confirm')
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
  it('renvoie none si ce n’est ni oui ni non', () => {
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
    for (const t of ['send_client_message', 'send_listings', 'record_offer', 'open_kyc_case']) {
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

describe('canLeaveConfirm — invariant socle légal (Palier 3)', () => {
  // Les 4 outils du socle légal sont testés explicitement ; update_pipeline est l'unique
  // true par construction (=== ). Si un 5e outil confirm-tier est ajouté, l'ajouter ici.
  it('SEUL update_pipeline peut quitter confirm', () => {
    expect(canLeaveConfirm('update_pipeline')).toBe(true)
  })
  it('le socle légal ne quitte JAMAIS confirm', () => {
    for (const t of ['send_client_message', 'send_listings', 'record_offer', 'open_kyc_case']) {
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

