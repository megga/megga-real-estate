/**
 * Le Pipeline du banc `/dev/crm` (27.09.2026) : ses fixtures rendent-elles le board qu'elles annoncent ?
 *
 * ⛔ LE BOARD ÉCARTE EN SILENCE. `usePipelineScreen` ne garde un deal que si son contact se résout
 * (`filteredDeals`), et `DealCard` rend `null` sans contact : un identifiant mal recopié ne se voit
 * pas, la carte manque, et on corrige l'écran pour une faute de la fixture. Cette spec rejoue donc
 * les VRAIS adaptateurs sur les lignes du banc — pas une copie de leur logique.
 */
import { describe, expect, it } from 'vitest'
import { CONTACTS, CRM_RPC, CRM_TABLES, DEALS_BANC } from '@/pages/dev/crmFixtures'
import { reminderToNextAction, transactionToCrmDeal, type PipelineReminderRow } from '@/lib/crmAdapters'
import type { ContactTransaction } from '@/hooks/useTransactions'
import { CRM_STAGE_ORDER } from '@/components/crm/tokens'

/** Les deals tels que le board les reçoit : le même adaptateur, le même contact que `usePipelineScreen`. */
const dealsDuBoard = () => DEALS_BANC.map((t) =>
  transactionToCrmDeal(t as unknown as ContactTransaction, t.contact_buyer_id ?? t.contact_seller_id ?? '', t.property_id))

/** L'exclusion du board, telle que `PipelinePage` l'écrit : rangé, gagné ou perdu. */
const auBoard = (d: ReturnType<typeof dealsDuBoard>[number]) => !d.archived && !d.won && d.stage !== 'lost'

describe('le Pipeline du banc', () => {
  it('chaque deal se résout : son contact existe, son bien aussi', () => {
    const biens = new Set((CRM_TABLES.properties as { id: string }[]).map((p) => p.id))
    for (const t of DEALS_BANC) {
      const contact = t.contact_buyer_id ?? t.contact_seller_id
      expect(CONTACTS.some((c) => c.id === contact), t.id).toBe(true)
      if (t.property_id) {
        expect(biens.has(t.property_id), t.id).toBe(true)
        // La jointure portée par la ligne doit désigner le MÊME bien — le board et le Parcours la lisent.
        expect(t.property?.id, t.id).toBe(t.property_id)
      }
    }
  })

  it('les huit colonnes ont chacune une carte, et trois deals sortent du board', () => {
    const deals = dealsDuBoard()
    const visibles = deals.filter(auBoard)
    for (const colonne of CRM_STAGE_ORDER) {
      expect(visibles.some((d) => d.stage === colonne), colonne).toBe(true)
    }
    expect(deals.filter((d) => !auBoard(d)).map((d) => d.id).sort()).toEqual(['d13', 'd14', 'd15'])
  })

  it('chaque stade écrit est un stade que le board range nommément', () => {
    // `mapStage` retombe sur « Nouveau lead » pour l'inconnu : un stade mal écrit y atterrirait sans bruit.
    // Les quatorze qu'il nomme (pipeline-stages.spec.ts les épingle) — les quatre hérités n'en font pas partie.
    const nommes = ['new_lead', 'to_qualify', 'active_search', 'visit_planned', 'visit_done', 'interest_confirmed',
      'offer', 'negotiation', 'reserved', 'financing', 'notary', 'signed', 'lost', 'to_recontact']
    for (const t of DEALS_BANC) expect(nommes, t.id).toContain(t.stage)
  })

  it('les prochaines actions : de vrais kinds, un vrai deal, et une seule carte sans action', () => {
    const rappels = (CRM_TABLES.reminders as (PipelineReminderRow & { kind: string | null })[])
      .filter((r) => r.transaction_id)
    // La contrainte `reminders_kind_check` (20260721150000) : rien d'autre ne passerait la base.
    for (const r of rappels) expect(['call', 'visit', 'kyc', 'match', 'offer', 'note'], r.id).toContain(r.kind)
    const ids = new Set(DEALS_BANC.map((t) => t.id))
    for (const r of rappels) expect(ids.has(r.transaction_id!), r.id).toBe(true)
    // Le gabarit « Planifier une action » : Philippe (d3), et lui seul.
    const avecAction = new Set(rappels.filter((r) => reminderToNextAction(r)).map((r) => r.transaction_id))
    expect(dealsDuBoard().filter(auBoard).filter((d) => !avecAction.has(d.id)).map((d) => d.id)).toEqual(['d3'])
  })

  it('la fiche deal d10 : trois tours, chacun répond au précédent, le dernier en attente', () => {
    const chaine = (CRM_RPC.crm_offer_chain as (a: Record<string, unknown>) => { id: string; parent_offer_id: string | null; status: string }[])({ p_deal_id: 'd10' })
    expect(chaine.map((o) => o.id)).toEqual(['o1', 'o2', 'o3'])
    expect(chaine.map((o) => o.parent_offer_id)).toEqual([null, 'o1', 'o2'])
    expect(chaine.at(-1)?.status).toBe('pending')
  })
})
