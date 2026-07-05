// MEGGA CRM — Cockpit « Aujourd'hui » · surface proactive des SUIVIS WhatsApp.
// MEGGA extrait des engagements datés depuis les conversations WhatsApp
// (deriveFollowups → whatsapp_followup_suggestions). Sans cette surface ils ne sont
// visibles qu'en ouvrant chaque fiche. Ici un ruban compact les remonte À TRAVERS
// les contacts ; chaque puce ouvre la fiche du contact, où l'agent accepte
// (→ vrai rappel) ou écarte (HITL — jamais d'action auto invisible, CLAUDE.md).
//
// Données RÉELLES uniquement (RLS agence) — masqué s'il n'y a aucun suivi en
// attente (empty-state honnête, comme CockpitAiInsights). Grammaire cockpit (TK).

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TK } from '@/components/crm-sugar/today/tk'
import { useAgencyFollowupSuggestions, AGENCY_FOLLOWUPS_LIMIT, type AgencyFollowupRow } from '@/hooks/useAgencyFollowupSuggestions'
import { followupDueLabel, type FollowupUrgency } from '@/lib/whatsappFollowupDue'

const WA_BLUE = '#6F8CFF'      // accent MEGGA AI (dark) — cohérent avec CockpitAiInsights
const WA_BLUE_LT = '#1E5BC6'   // accent MEGGA AI (clair)
const MAX_CHIPS = 4            // le reste est résumé en « +N »

const plural = (n: number) => (n > 1 ? 's' : '')

type CkTone = 'warn' | 'danger' | 'info'

// urgency (logique partagée whatsappFollowupDue) → tonalité TK desktop.
const URGENCY_TONE: Record<FollowupUrgency, CkTone> = {
  overdue: 'danger', today: 'warn', tomorrow: 'info', dated: 'info', none: 'info',
}

function FollowupChip({ row }: { row: AgencyFollowupRow }) {
  const [h, setH] = useState(false)
  const navigate = useNavigate()
  const due = followupDueLabel(row.due_at)
  const p = TK[URGENCY_TONE[due.urgency]] || TK.neutral
  return (
    <button
      onClick={() => navigate(`/dashboard/contacts/${row.contact_id}`)}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      title={`${row.contact_name} — ${row.action}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0,
        height: 32, padding: '0 6px 0 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
        maxWidth: 340,
        background: h ? TK.cardHi : TK.card,
        border: `1px solid ${h ? TK.borderHi : TK.cardBorder}`,
        transform: h ? 'translateY(-1px)' : 'none',
        transition: 'background .16s, border-color .16s, transform .16s',
      }}>
      {/* Nom plafonné (ne mange pas toute la largeur) · action flexible · pastille d'échéance. */}
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: -0.1, color: TK.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100, flexShrink: 0 }}>{row.contact_name}</span>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: TK.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: '1 1 auto', minWidth: 0 }}>{row.action}</span>
      {/* Pastille d'échéance : paire DS bg/fg (jamais fg nu). Porte la tonalité (en retard = danger…). */}
      <span style={{ background: p.bg, color: p.fg, padding: '2px 9px', borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: 0.2, whiteSpace: 'nowrap', flexShrink: 0 }}>{due.text}</span>
    </button>
  )
}

export function CockpitWhatsAppFollowups() {
  const { data: rows } = useAgencyFollowupSuggestions()
  const blue = TK.mode === 'light' ? WA_BLUE_LT : WA_BLUE

  // Empty-state honnête : aucun suivi en attente (ou pas encore chargé) → pas de ruban.
  if (!rows || rows.length === 0) return null

  const shown = rows.slice(0, MAX_CHIPS)
  const extra = rows.length - shown.length
  // Lecture plafonnée à AGENCY_FOLLOWUPS_LIMIT : « N+ » plutôt qu'un total mensonger.
  const capped = rows.length >= AGENCY_FOLLOWUPS_LIMIT

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
      animation: 'wafuFade .5s cubic-bezier(.2,.8,.2,1) both',
    }}>
      <style>{`@keyframes wafuFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
        <span style={{
          width: 26, height: 26, borderRadius: 999, flexShrink: 0, background: blue,
          boxShadow: TK.mode === 'light' ? '0 2px 8px rgba(30,91,198,0.35)' : '0 2px 10px rgba(111,140,255,0.45)',
          display: 'grid', placeItems: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </span>
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: blue }}>Suivis WhatsApp</div>
          <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: -0.2, color: TK.ink }}>
            {rows.length}{capped ? '+' : ''} suivi{plural(rows.length)} en attente
          </div>
        </div>
      </div>
      <span style={{ width: 1, height: 26, background: TK.cardBorder, flexShrink: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
        {shown.map((r) => <FollowupChip key={r.id} row={r} />)}
        {extra > 0 && (
          <span style={{ fontSize: 11.5, fontWeight: 700, color: TK.sub, flexShrink: 0 }}>+{extra}</span>
        )}
      </div>
    </div>
  )
}
