/**
 * MEGGA CRM — Pipeline v2 « Sugar Pure » : création inline « Nouveau deal »
 * dans une colonne du kanban (concept B, juil. 2026). Port 1:1 du handoff
 * crm-pipeline-inline-deal.jsx : le « + » d'une colonne ouvre cette carte
 * fantôme (contact + valeur), Entrée = créé à l'étape de la colonne,
 * « Plus d'options » ouvre la modale complète pré-remplie.
 *
 * Câblage prod : useCreateTransaction (price_offered) + reminder « Premier
 * suivi » à J+2 — le deal réel apparaît en tête de colonne via l'invalidation
 * (ordre updated_at desc) avec son échéance.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type StageId, type SugarPalette } from '../tokens'
import { encreSur } from '@/components/megga-x-crm/tokens'
import { useAuth } from '@/hooks/useAuth'
import { useContactsSugar } from '@/hooks/useContactsSugar'
import { useCreateTransaction } from '@/hooks/useTransactions'
import { usePipelineReminderCreators } from '@/hooks/usePipelineNextActions'
import { stageIdToTransactionStage } from '@/lib/sugarAdapters'
import type { NewDealPrefill } from './NewDealModal'
import type { CrmContact } from '../mockData'

interface Props {
  stage: StageId
  sp: SugarPalette
  dark: boolean
  onCancel: () => void
  /** Deal créé côté Supabase — le parent affiche le toast « Deal créé » (+ undo). */
  onCreated: (txId: string) => void
  /** « Plus d'options » → ouvre la modale complète pré-remplie. */
  onMore: (prefill: NewDealPrefill) => void
  /**
   * Substitution d'aperçu (`/dev/pipeline`) : `useContactsSugar` est gaté sur
   * la session, donc sans banc la recherche de contact ne propose JAMAIS rien —
   * la moitié utile de la carte fantôme (les trois suggestions) restait
   * invisible. L'écriture, elle, est déjà bloquée par la garde `agency_id`.
   */
  banc?: { contacts: CrmContact[] }
}

export function SgInlineNewDeal({ stage, sp, dark, onCancel, onCreated, onMore, banc }: Props) {
  const { t } = useTranslation('pipeline')
  const { profile } = useAuth()
  const { contacts: liveContacts } = useContactsSugar()
  const all = banc ? banc.contacts : liveContacts
  const createTransaction = useCreateTransaction()
  const { createFirstFollowUp } = usePipelineReminderCreators()

  const [q, setQ] = useState('')
  const [contactId, setContactId] = useState<string | null>(null)
  const [val, setVal] = useState('')
  const [creating, setCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [contactId])

  const selected = contactId ? all.find(c => c.id === contactId) ?? null : null
  // Défaut intelligent : budget max des critères du contact → valeur pré-remplie (modifiable).
  useEffect(() => {
    if (!selected) return
    const b = selected.criteria?.budgetMax
    if (b) setVal(String(b))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId])

  const matches = useMemo(() => {
    if (selected || !q.trim()) return []
    const needle = q.toLowerCase()
    return all
      .filter(c => `${c.firstName} ${c.lastName} ${c.email || ''}`.toLowerCase().includes(needle))
      .slice(0, 3)
  }, [all, q, selected])

  const canCreate = !!selected && !creating
  const create = async () => {
    if (!canCreate || !selected) return
    const agencyId = profile?.agency_id
    if (!agencyId) return
    setCreating(true)
    try {
      const tx = await createTransaction.mutateAsync({
        agency_id: agencyId,
        contact_buyer_id: selected.id,
        stage: stageIdToTransactionStage(stage),
        price_offered: Number(val) || undefined,
      })
      const txId = (tx as { id?: string } | null)?.id
      if (txId) {
        await createFirstFollowUp({ transactionId: txId, contactId: selected.id })
        onCreated(txId)
      }
    } finally {
      setCreating(false)
    }
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel()
    if (e.key === 'Enter') void create()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 36, padding: '0 var(--crm-space-xl)',
    background: dark ? 'rgba(255,255,255,.06)' : '#F1F4F8',
    border: 0, borderRadius: 'var(--crm-radius-md)', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
    color: sp.ink, outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{
      background: sp.cardBg, borderRadius: 'var(--crm-radius-2xl)', padding: 'var(--crm-space-2xl)', flexShrink: 0,
      boxShadow: `0 0 0 2px ${sp.ink} inset, ${sp.shadowSm}`,
      animation: 'sugar-fade-up .4s cubic-bezier(.2,.8,.2,1) both',
    }}>
      <style>{`.sgInlineInp::placeholder{color:${dark ? 'rgba(255,255,255,.8)' : '#7A8088'};opacity:1}`}</style>
      <div style={{
        fontSize: 'var(--crm-text-xs)', fontWeight: 600,
        color: sp.sub, marginBottom: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{t('new_deal')}</div>
      {selected ? (
        <div onClick={() => { setContactId(null); setQ('') }} title={t('inline.changeContact')} style={{
          display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-md) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-md)',
          background: sp.cardSubBg, cursor: 'pointer', minWidth: 0,
        }}>
          <span style={{
            width: 26, height: 26, borderRadius: 'var(--crm-radius-pill)', background: selected.avatarBg || sp.ink,
            color: encreSur(selected.avatarBg || sp.ink),
            display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-xs)', fontWeight: 600, flexShrink: 0,
          }}>{(selected.firstName[0] || '') + (selected.lastName[0] || '')}</span>
          <span style={{
            fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, flex: 1, minWidth: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{selected.firstName} {selected.lastName}</span>
          <span style={{ fontSize: 'var(--crm-text-xl)', color: sp.sub, flexShrink: 0, lineHeight: 1 }}>×</span>
        </div>
      ) : (
        <input ref={inputRef} className="sgInlineInp" value={q}
          onChange={e => setQ(e.target.value)} onKeyDown={onKey}
          placeholder={t('inline.searchPlaceholder')} style={inputStyle} />
      )}
      {matches.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)', marginTop: 6 }}>
          {matches.map(c => (
            <button key={c.id} onClick={() => setContactId(c.id)} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-md)',
              border: 0, cursor: 'pointer', background: 'transparent', fontFamily: 'inherit',
              textAlign: 'left', minWidth: 0, width: '100%',
            }}>
              <span style={{
                width: 24, height: 24, borderRadius: 'var(--crm-radius-pill)', background: c.avatarBg || sp.ink,
                color: encreSur(c.avatarBg || sp.ink),
                display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-xs)', fontWeight: 600, flexShrink: 0,
              }}>{(c.firstName[0] || '') + (c.lastName[0] || '')}</span>
              <span style={{
                display: 'block', flex: 1, minWidth: 0, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{c.firstName} {c.lastName}</span>
            </button>
          ))}
        </div>
      )}
      <input className="sgInlineInp" value={val}
        onChange={e => setVal(e.target.value.replace(/[^\d]/g, ''))} onKeyDown={onKey}
        placeholder={t('inline.valuePlaceholder')}
        style={{ ...inputStyle, marginTop: 8, fontVariantNumeric: 'tabular-nums' }} />
      {selected && val && selected.criteria && String(selected.criteria.budgetMax) === val && (
        <div style={{
          fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub, marginTop: 5,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{t('inline.budgetHint')}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 12 }}>
        <button onClick={() => void create()} disabled={!canCreate} style={{
          height: 30, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
          cursor: canCreate ? 'pointer' : 'not-allowed', opacity: canCreate ? 1 : 0.4,
          background: sp.accent, color: sp.accentInk, fontSize: 'var(--crm-text-sm)', fontWeight: 600, fontFamily: 'inherit',
        }}>{t('inline.create')}</button>
        <button onClick={() => onMore({ stage, contactId, contactQuery: q, value: val ? Number(val) : null })} style={{
          border: 0, background: 'transparent', cursor: 'pointer', padding: 0,
          fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub, fontFamily: 'inherit',
          textDecoration: 'underline', textUnderlineOffset: 2, whiteSpace: 'nowrap',
        }}>{t('inline.more')}</button>
        <div style={{ flex: 1 }} />
        <button onClick={onCancel} title={t('inline.cancelTitle')} style={{
          border: 0, background: 'transparent', cursor: 'pointer', color: sp.sub,
          fontSize: 'var(--crm-text-xl)', fontFamily: 'inherit', padding: 0, lineHeight: 1,
        }}>×</button>
      </div>
    </div>
  )
}
