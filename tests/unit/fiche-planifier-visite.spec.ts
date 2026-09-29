/**
 * « Planifier une visite » depuis la fiche d'un mandat (lot E1, conception §5.6, décision 9c) : qui est proposé comme
 * visiteur, à qui un message de confirmation est préparé, ce que fait la création — la règle du fil et du copilote
 * WhatsApp (`wa_matching_visite`), une seule.
 *
 * Ce que cette spec refuse :
 *   · un message pré-rempli (WhatsApp, e-mail) ou un rappel la veille pour un acquéreur compatible — un deal perdu n'en
 *     fait pas un acheteur en cours ;
 *   · un match « intéressé » qui ne passerait pas par l'écrivain du fil, ou un match d'un autre statut qui bougerait ;
 *   · un pré-remplissage ou un rappel retirés à un visiteur hors du matching, ou à un acheteur en deal ouvert que le
 *     matching ne dit pas intéressé ;
 *   · un message ou un rappel préparés pour un contact dont on ne sait pas encore s'il est du matching ;
 *   · un acquéreur compatible proposé sur un mandat qui n'est plus en vente.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Compatible } from '@/components/matching-fil/filQuiPour'
import {
  creationVisite, preRemplissagePermis, visiteursLies, type ContexteVisite, type DealDuBien,
} from '@/components/crm/biens/fiche/visiteurs'
import { ligneVisite, type CreateVisitInput } from '@/hooks/useVisitDetail'

type Statut = 'suggested' | 'sent' | 'interested' | 'visit_planned'

/** Un acquéreur compatible du mandat ; sans statut, une suggestion jamais proposée, qui n'a pas de suivi. */
const compatible = (contactId: string, prenom: string, score: number, statut?: Statut): Compatible => ({
  id: `m-${contactId}`, score, reporteJusquau: null, acheteur: { id: contactId, prenom, nom: 'Morand' },
  ...(statut ? {
    suivi: { statut, proposeLe: '2026-09-20T09:00:00Z', reponduLe: null, motif: null, note: null, prixPropose: null, apprisLe: null },
  } : {}),
})
const deal = (
  id: string, contactId: string, status: DealDuBien['status'], stage: DealDuBien['stage'], archived_at: string | null = null,
): DealDuBien => ({ id, contact_buyer_id: contactId, status, stage, archived_at })

/**
 * Marc : en deal ouvert sur le bien, et compatible (intéressé, sauf `marc` ; `null` : hors des compatibles). Paul :
 * compatible, son deal sur ce bien est PERDU — l'étape `lost`, le statut resté `active`, ce qu'écrit « Marquer perdu ».
 * Julie : compatible, sans deal.
 */
const contexte = (julie?: Statut, enVente = true, paul: Statut = 'sent', marc: Statut | null = 'interested'): ContexteVisite => ({
  deals: [deal('d-marc', 'c-marc', 'active', 'offer'), deal('d-paul', 'c-paul', 'active', 'lost')],
  compatibles: [
    compatible('c-julie', 'Julie', 92, julie),
    ...(marc ? [compatible('c-marc', 'Marc', 88, marc)] : []),
    compatible('c-paul', 'Paul', 81, paul),
  ],
  enVente,
})
const NOMS: Record<string, string> = { 'c-marc': 'Marc Morand', 'c-paul': 'Paul Morand', 'c-julie': 'Julie Morand' }
const nomDe = (id: string): string | null => NOMS[id] ?? null

// La règle d'un deal ouvert elle-même (statuts, étape `lost`) se garde avec son module : `deal-ouvert.spec.ts`.

describe('les visiteurs proposés', () => {
  it('les acheteurs en deal ouvert d’abord, puis les acquéreurs compatibles ; un deal perdu ne fait pas un acheteur en cours', () => {
    expect(visiteursLies(contexte(), nomDe)).toEqual([
      { contactId: 'c-marc', nom: 'Marc Morand', dealId: 'd-marc' },
      { contactId: 'c-julie', nom: 'Julie Morand', score: 92 },
      { contactId: 'c-paul', nom: 'Paul Morand', score: 81 },
    ])
  })

  it('un mandat qui n’est plus en vente ne propose que ses acheteurs en deal ouvert', () => {
    expect(visiteursLies(contexte(undefined, false), nomDe)).toEqual([{ contactId: 'c-marc', nom: 'Marc Morand', dealId: 'd-marc' }])
  })

  it('un deal archivé ne fait pas un acheteur en cours : la visite ne s’y rattache pas, et son acquéreur suit la règle du fil', () => {
    const archive: ContexteVisite = { ...contexte(), deals: [deal('d-marc', 'c-marc', 'active', 'offer', '2026-09-01T08:00:00Z')] }
    expect(visiteursLies(archive, nomDe).map((l) => l.contactId)).toEqual(['c-julie', 'c-marc', 'c-paul'])
    expect(creationVisite('c-marc', archive)).toEqual({
      fil: { id: 'c-marc', matchId: 'm-c-marc', first: 'Marc', last: 'Morand', score: 88 },
      dealId: null,
      rappelVeille: false,
    })
  })
})

describe('le message de confirmation pré-rempli (WhatsApp, e-mail)', () => {
  it('refusé à un acquéreur compatible sans deal, et à celui dont le deal sur ce bien est perdu', () => {
    expect(preRemplissagePermis('c-julie', contexte())).toBe(false)
    expect(preRemplissagePermis('c-paul', contexte())).toBe(false)
  })

  it('gardé pour un acheteur en deal ouvert sans match, ou dont le match n’est pas « intéressé »', () => {
    expect(preRemplissagePermis('c-marc', contexte(undefined, true, 'sent', null))).toBe(true)
    for (const marc of ['suggested', 'sent', 'visit_planned'] as const) {
      expect(preRemplissagePermis('c-marc', contexte(undefined, true, 'sent', marc)), marc).toBe(true)
    }
  })

  it('refusé à un acheteur en deal ouvert INTÉRESSÉ : il suit la règle du fil, comme sur WhatsApp', () => {
    expect(preRemplissagePermis('c-marc', contexte())).toBe(false)
  })

  it('gardé pour un visiteur hors du matching : un contact du carnet, un visiteur créé sur place', () => {
    expect(preRemplissagePermis('c-carnet', contexte())).toBe(true)
    expect(preRemplissagePermis(null, contexte())).toBe(true)
  })

  it('refusé à un acquéreur compatible choisi dans le carnet, même sur un mandat qui n’est plus en vente', () => {
    expect(preRemplissagePermis('c-julie', contexte(undefined, false))).toBe(false)
  })

  it('ses compatibles pas encore lus : on ne sait pas qui est du matching, acheteur en deal compris — seul un visiteur créé sur place y a droit', () => {
    const nonLus: ContexteVisite = { ...contexte(), compatibles: null }
    expect(preRemplissagePermis('c-carnet', nonLus)).toBe(false)
    expect(creationVisite('c-carnet', nonLus)).toEqual({ fil: null, dealId: null, rappelVeille: false })
    expect(preRemplissagePermis('c-marc', nonLus)).toBe(false)
    expect(creationVisite('c-marc', nonLus)).toEqual({ fil: null, dealId: 'd-marc', rappelVeille: false })
    expect(preRemplissagePermis(null, nonLus)).toBe(true)
    expect(creationVisite(null, nonLus)).toEqual({ fil: null, dealId: null, rappelVeille: true })
  })
})

describe('ce que fait la création', () => {
  it('un acquéreur intéressé passe par l’écrivain du fil (son match, son deal), sans rappel la veille', () => {
    expect(creationVisite('c-julie', contexte('interested'))).toEqual({
      fil: { id: 'c-julie', matchId: 'm-c-julie', first: 'Julie', last: 'Morand', score: 92 },
      dealId: null,
      rappelVeille: false,
    })
  })

  it('à proposer, proposé ou déjà en visite : la visite seule, son match ne bouge pas, et pas de rappel la veille', () => {
    for (const statut of [undefined, 'suggested', 'sent', 'visit_planned'] as const) {
      expect(creationVisite('c-julie', contexte(statut)), String(statut)).toEqual({ fil: null, dealId: null, rappelVeille: false })
    }
  })

  it('un deal perdu : la visite ne s’y rattache pas, et l’acquéreur suit la règle du fil', () => {
    expect(creationVisite('c-paul', contexte())).toEqual({ fil: null, dealId: null, rappelVeille: false })
    expect(creationVisite('c-paul', contexte(undefined, true, 'interested'))).toEqual({
      fil: { id: 'c-paul', matchId: 'm-c-paul', first: 'Paul', last: 'Morand', score: 81 },
      dealId: null,
      rappelVeille: false,
    })
  })

  it('un acheteur en deal ouvert, sans match ou pas « intéressé » : la visite rejoint son deal et le rappel part', () => {
    expect(creationVisite('c-marc', contexte(undefined, true, 'sent', null))).toEqual({ fil: null, dealId: 'd-marc', rappelVeille: true })
    expect(creationVisite('c-marc', contexte(undefined, true, 'sent', 'sent'))).toEqual({ fil: null, dealId: 'd-marc', rappelVeille: true })
  })

  it('un acheteur en deal ouvert ET intéressé : l’écrivain du fil, qui rattache la visite à son deal, sans rappel la veille', () => {
    expect(creationVisite('c-marc', contexte())).toEqual({
      fil: { id: 'c-marc', matchId: 'm-c-marc', first: 'Marc', last: 'Morand', score: 88 },
      dealId: 'd-marc',
      rappelVeille: false,
    })
  })

  it('hors du matching, un contact du carnet ou un visiteur créé sur place : la visite seule, avec son rappel', () => {
    expect(creationVisite('c-carnet', contexte())).toEqual({ fil: null, dealId: null, rappelVeille: true })
    expect(creationVisite(null, contexte())).toEqual({ fil: null, dealId: null, rappelVeille: true })
  })
})

describe('la visite écrite par la fiche (`ligneVisite`)', () => {
  const ENTREE: CreateVisitInput = { bienId: 'p1', contactId: 'c-julie', scheduledAt: '2026-10-02T12:00:00.000Z', durationMinutes: 45 }

  it('un acquéreur compatible : `reminder_sent` est posé, `visit-reminders-j1` ne lui écrit pas la veille', () => {
    const { dealId, rappelVeille } = creationVisite('c-julie', contexte('sent'))
    expect(ligneVisite({ ...ENTREE, dealId, reminderSent: !rappelVeille }, 'ag-1', 'u-1')).toMatchObject({
      agency_id: 'ag-1', agent_id: 'u-1', property_id: 'p1', contact_id: 'c-julie', transaction_id: null, status: 'planned',
      reminder_sent: true,
    })
  })

  it('un acheteur en deal ouvert, hors du matching : rien ne change, la colonne garde son défaut et le rappel part', () => {
    const { dealId, rappelVeille } = creationVisite('c-marc', contexte(undefined, true, 'sent', null))
    const ligne = ligneVisite({ ...ENTREE, contactId: 'c-marc', dealId, reminderSent: !rappelVeille }, 'ag-1', 'u-1')
    expect(ligne).toMatchObject({ contact_id: 'c-marc', transaction_id: 'd-marc' })
    expect(ligne).not.toHaveProperty('reminder_sent')
  })
})

describe('la fiche lit ces règles (lecture du code)', () => {
  const source = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

  it('`PlanifierVisite` appelle les trois règles, et confie un acquéreur intéressé à l’écrivain du fil', () => {
    const code = source('src/components/crm/biens/fiche/PlanifierVisite.tsx')
    for (const appel of ['visiteursLies(', 'preRemplissagePermis(', 'creationVisite(', 'execPlanifierVisite(']) {
      expect(code, appel).toContain(appel)
    }
  })

  it('la fiche d’un mandat lui passe ses deals, ses acquéreurs compatibles une fois lus, et son état', () => {
    expect(source('src/pages/agent/ListingDetailPage.tsx')).toMatch(
      /deals: dealsForBien, compatibles: quiPour\.aDesDonnees \? quiPour\.compatibles : null, enVente: bien\.status === 'active'/,
    )
  })
})
