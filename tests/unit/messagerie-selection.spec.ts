/**
 * La sélection de la liste (15.09.2026, les gestes en lot) : ce que le reducer garantit.
 *
 * ⛔ La règle qui compte : la sélection se VIDE dès que la liste change de sens — dossier,
 * libellé, recherche, filtre, page, boîte — ou qu'un fil s'ouvre. Sans elle, « Supprimer »
 * partirait sur des fils que l'écran ne montre plus.
 */
import { describe, it, expect } from 'vitest'
import { initialMailState, mailReducer, type MailAction, type MailState } from '@/components/crm/messagerie/mailState'

const avec = (selection: string[]): MailState => ({ ...initialMailState('a1'), selection })

describe('mailReducer — la sélection', () => {
  it('cocher bascule un fil ; une plage s’ajoute sans doublon ; la décocher la retire', () => {
    let s = mailReducer(avec([]), { type: 'select', threadId: 't1' })
    expect(s.selection).toEqual(['t1'])
    s = mailReducer(s, { type: 'select-many', threadIds: ['t1', 't2', 't3'], on: true })
    expect(s.selection).toEqual(['t1', 't2', 't3'])
    s = mailReducer(s, { type: 'select-many', threadIds: ['t2', 't3'], on: false })
    expect(s.selection).toEqual(['t1'])
    s = mailReducer(s, { type: 'select', threadId: 't1' })
    expect(s.selection).toEqual([])
  })

  it('⛔ changer ce que la liste montre, ou ouvrir un fil, vide la sélection', () => {
    const gestes: MailAction[] = [
      { type: 'folder', folder: 'arch' },
      { type: 'label', labelId: 'l1' },
      { type: 'q', q: 'banque' },
      { type: 'unread-only', on: true },
      { type: 'att-only', on: true },
      { type: 'page', page: 1 },
      { type: 'open', threadId: 't9' },
      { type: 'select-account', accountId: 'a2' },
      { type: 'select-clear' },
    ]
    for (const g of gestes) expect(mailReducer(avec(['t1', 't2']), g).selection, g.type).toEqual([])
  })

  it('les gestes qui ne changent pas la liste gardent la sélection', () => {
    const gestes: MailAction[] = [
      { type: 'ctx', ctx: null },
      { type: 'modal', modal: { kind: 'delete', threadIds: ['t1', 't2'] } },
      { type: 'toggle-box' },
    ]
    for (const g of gestes) expect(mailReducer(avec(['t1', 't2']), g).selection, g.type).toEqual(['t1', 't2'])
  })
})
