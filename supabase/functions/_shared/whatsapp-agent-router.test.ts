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
  it('par défaut un outil inconnu est confirm (fail-safe)', () => {
    expect(toolTier('delete_everything')).toBe('confirm')
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
