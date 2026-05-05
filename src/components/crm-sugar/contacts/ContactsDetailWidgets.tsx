// MEGGA CRM Sugar v2 — Widgets de la fiche détail (activity, composer, criteria, matches, deals, kyc, seller stats)
// 1:1 port from `crm-screen-contacts-sugar.jsx` (CtCriteria, CtMatches, CtActivity, CtComposer, CtDeals, CtSellerStats, CtKyc).

import { Fragment, useState } from 'react'
import CRMIcon, { type CrmIconName } from '../CRMIcon'
import {
  CRM_ACTIVITY,
  CRM_BIENS,
  CRM_DEALS,
  CRM_MATCHES,
  crmBienById,
  type CrmContact,
} from '../mockData'
import { CRM_STAGES, type SugarPalette } from '../tokens'
import { CtCard, CtChip, CtKv } from './ContactsBentos'
import { ctFmtCHF, ctRelativeTime } from './helpers'

// ─── Critères acheteur ─────────────────────────────────────────────────
export function CtCriteria({
  contact,
  sp,
  dark,
}: {
  contact: CrmContact
  sp: SugarPalette
  dark: boolean
}) {
  const c = contact.criteria
  if (!c) return null

  const budgetLabel = c.budgetMin
    ? `${ctFmtCHF(c.budgetMin)} – ${ctFmtCHF(c.budgetMax)}`
    : `≤ ${ctFmtCHF(c.budgetMax)}`

  return (
    <CtCard sp={sp} padding="6px 16px">
      <CtKv
        sp={sp}
        label="Transaction"
        value={c.transaction === 'vente' ? 'Achat' : 'Location'}
      />
      <CtKv
        sp={sp}
        label="Type"
        value={(c.types || []).map(t => t[0].toUpperCase() + t.slice(1)).join(', ') || '—'}
      />
      <CtKv
        sp={sp}
        label="Zones"
        value={[...(c.cities || []), ...(c.cantons || [])].join(' · ') || '—'}
      />
      <CtKv sp={sp} label="Budget" value={budgetLabel} mono />
      <CtKv sp={sp} label="Surface" value={c.areaMin ? `≥ ${c.areaMin} m²` : '—'} mono />
      <CtKv sp={sp} label="Pièces" value={c.roomsMin ? `≥ ${c.roomsMin}` : '—'} mono />
      {((c.mustHave?.length ?? 0) > 0 || (c.niceToHave?.length ?? 0) > 0) && (
        <div style={{ padding: '10px 0 12px', borderTop: `1px solid ${sp.cardBorder}` }}>
          {(c.mustHave?.length ?? 0) > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: sp.sub,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Indispensable
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {c.mustHave!.map(m => (
                  <CtChip key={m} sp={sp} dark={dark} color="#0041D9">
                    {m}
                  </CtChip>
                ))}
              </div>
            </div>
          )}
          {(c.niceToHave?.length ?? 0) > 0 && (
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: sp.sub,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Souhaité
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {c.niceToHave!.map(m => (
                  <CtChip key={m} sp={sp} dark={dark}>
                    {m}
                  </CtChip>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </CtCard>
  )
}

// ─── Matchs liste ──────────────────────────────────────────────────────
export function CtMatches({ contact, sp }: { contact: CrmContact; sp: SugarPalette }) {
  const matches = CRM_MATCHES.filter(m => m.contactId === contact.id).sort(
    (a, b) => b.score - a.score,
  )

  if (matches.length === 0) {
    return (
      <CtCard sp={sp} padding="20px 16px">
        <div style={{ fontSize: 12.5, color: sp.sub, textAlign: 'center' }}>
          Aucun match calculé pour ce contact.
        </div>
      </CtCard>
    )
  }

  return (
    <CtCard sp={sp} padding="6px 8px">
      {matches.map((m, i) => {
        const b = crmBienById(m.bienId)
        if (!b) return null
        const dot = m.score >= 85 ? '#0E9F6E' : m.score >= 70 ? '#F59E0B' : '#E53935'
        const statusLabel =
          ({
            'to-send': 'À envoyer',
            sent: 'Envoyé',
            viewed: 'Vu',
            liked: 'Aimé',
            rejected: 'Rejeté',
          } as const)[m.status] || '—'
        return (
          <div
            key={`${m.contactId}-${m.bienId}`}
            style={{
              padding: '10px 10px',
              borderBottom: i < matches.length - 1 ? `1px solid ${sp.cardBorder}` : 0,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 56, flexShrink: 0 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: dot,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: sp.ink,
                  letterSpacing: -0.4,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {m.score}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: sp.ink,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {b.title}
              </div>
              <div style={{ fontSize: 10.5, color: sp.sub, marginTop: 1 }}>
                {b.rooms}p · {b.area}m² ·{' '}
                {b.price ? ctFmtCHF(b.price) : ctFmtCHF(b.rent ?? null) + '/mois'}
              </div>
            </div>
            <span
              style={{
                fontSize: 11,
                color: sp.sub,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {statusLabel}
            </span>
            <button
              style={{
                height: 28,
                padding: '0 12px',
                borderRadius: 8,
                background: m.status === 'to-send' ? '#0041D9' : sp.cardBg,
                color: m.status === 'to-send' ? '#fff' : sp.ink,
                border: `1px solid ${m.status === 'to-send' ? '#0041D9' : sp.cardBorder}`,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                flexShrink: 0,
              }}
            >
              {m.status === 'to-send' ? 'Envoyer' : 'Ouvrir'}
            </button>
          </div>
        )
      })}
    </CtCard>
  )
}

// ─── Activity timeline ────────────────────────────────────────────────
export function CtActivity({
  contact,
  sp,
  fill,
}: {
  contact: CrmContact
  sp: SugarPalette
  fill?: boolean
}) {
  const items = CRM_ACTIVITY.filter(a => a.contactId === contact.id)
  // Mock fallback si peu d'activité
  const all =
    items.length > 0
      ? items
      : [
          {
            id: 'mock-1',
            at: '2026-04-29T15:32:00',
            kind: 'note',
            text: "Notes synchronisées depuis l'agenda.",
          },
          {
            id: 'mock-2',
            at: '2026-04-25T11:00:00',
            kind: 'call',
            text: 'Premier appel de qualification — 12 min.',
          },
          {
            id: 'mock-3',
            at: '2026-04-20T09:00:00',
            kind: 'lead-in',
            text: 'Contact créé via ' + (contact.source || 'import') + '.',
          },
        ]

  const iconMap: Record<string, CrmIconName> = {
    'ai-action': 'spark',
    'email-open': 'mail',
    visit: 'home',
    note: 'file',
    'doc-signed': 'check',
    call: 'phone',
    offer: 'flag',
    'lead-in': 'plus',
    'match-sent': 'matching',
  }
  const iconFor = (k: string): CrmIconName => iconMap[k] ?? 'msg'

  const colorMap: Record<string, string> = {
    'ai-action': '#8B5CF6',
    visit: '#0041D9',
    'doc-signed': '#0E9F6E',
    offer: '#8B5CF6',
    'lead-in': '#10B981',
    call: '#06B6D4',
    'email-open': '#F59E0B',
  }
  const colorFor = (k: string): string => colorMap[k] ?? '#7A8079'

  return (
    <CtCard sp={sp} padding="6px 14px" fill={fill} style={fill ? { overflowY: 'auto' } : undefined}>
      {all.map((a, i) => (
        <div
          key={a.id}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '10px 0',
            borderBottom: i < all.length - 1 ? `1px solid ${sp.cardBorder}` : 0,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              flexShrink: 0,
              background: colorFor(a.kind) + '1A',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <CRMIcon name={iconFor(a.kind)} size={12} stroke={colorFor(a.kind)} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: sp.ink, lineHeight: 1.45 }}>{a.text}</div>
            <div
              style={{
                fontSize: 10.5,
                color: sp.sub,
                marginTop: 2,
                fontWeight: 600,
              }}
            >
              {ctRelativeTime(a.at)}
            </div>
          </div>
        </div>
      ))}
    </CtCard>
  )
}

// ─── Activity composer ───────────────────────────────────────────────
type ComposerTab = 'note' | 'call' | 'email' | 'task'

export function CtComposer({ sp, fill }: { sp: SugarPalette; dark: boolean; fill?: boolean }) {
  const [tab, setTab] = useState<ComposerTab>('note')
  const [val, setVal] = useState('')

  const tabs: { k: ComposerTab; label: string; icon: CrmIconName }[] = [
    { k: 'note', label: 'Note', icon: 'file' },
    { k: 'call', label: 'Appel', icon: 'phone' },
    { k: 'email', label: 'Email', icon: 'mail' },
    { k: 'task', label: 'Tâche', icon: 'check' },
  ]
  const placeholders: Record<ComposerTab, string> = {
    note: 'Ajouter une note rapide…',
    call: 'Résumer un appel — points clés, prochaine étape…',
    email: "Sujet + corps de l'email…",
    task: 'Tâche à faire — date, qui ?',
  }

  return (
    <CtCard
      sp={sp}
      padding="10px 12px"
      fill={fill}
      style={
        fill ? { display: 'flex', flexDirection: 'column' } : { marginBottom: 10 }
      }
    >
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexShrink: 0 }}>
        {tabs.map(tb => (
          <button
            key={tb.k}
            onClick={() => setTab(tb.k)}
            style={{
              height: 28,
              padding: '0 10px',
              borderRadius: 8,
              background: tab === tb.k ? sp.ink : 'transparent',
              color: tab === tb.k ? sp.pageBg : sp.soft,
              border: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 11.5,
              fontWeight: tab === tb.k ? 700 : 500,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <CRMIcon
              name={tb.icon}
              size={11}
              stroke={tab === tb.k ? sp.pageBg : sp.soft}
            />
            {tb.label}
          </button>
        ))}
      </div>
      <textarea
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder={placeholders[tab]}
        style={{
          width: '100%',
          flex: fill ? 1 : 'none',
          minHeight: fill ? 0 : 56,
          resize: fill ? 'none' : 'vertical',
          background: 'transparent',
          border: 0,
          outline: 'none',
          color: sp.ink,
          fontSize: 12.5,
          fontFamily: 'inherit',
          lineHeight: 1.5,
          padding: 0,
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: `1px solid ${sp.cardBorder}`,
          paddingTop: 8,
          marginTop: 6,
          flexShrink: 0,
        }}
      >
        <button
          style={{
            height: 26,
            padding: '0 10px',
            borderRadius: 8,
            background: 'transparent',
            color: sp.sub,
            border: `1px solid ${sp.cardBorder}`,
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <CRMIcon name="spark" size={11} stroke={sp.sub} />
          Suggérer avec MEGGA AI
        </button>
        <button
          style={{
            height: 28,
            padding: '0 14px',
            borderRadius: 8,
            background: '#0041D9',
            color: '#fff',
            border: 0,
            fontSize: 11.5,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Enregistrer
        </button>
      </div>
    </CtCard>
  )
}

// ─── Deals liés ────────────────────────────────────────────────────────
export function CtDeals({
  contact,
  sp,
  fill,
}: {
  contact: CrmContact
  sp: SugarPalette
  fill?: boolean
}) {
  const deals = CRM_DEALS.filter(d => d.contactId === contact.id)
  if (deals.length === 0) {
    return (
      <CtCard sp={sp} padding="20px 16px">
        <div style={{ fontSize: 12.5, color: sp.sub, textAlign: 'center' }}>
          Aucun deal en cours pour ce contact.
          <button
            style={{
              marginTop: 10,
              height: 28,
              padding: '0 14px',
              borderRadius: 8,
              background: sp.ink,
              color: sp.pageBg,
              border: 0,
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'block',
              margin: '10px auto 0',
            }}
          >
            + Nouveau deal
          </button>
        </div>
      </CtCard>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        height: fill ? '100%' : 'auto',
      }}
    >
      {deals.map(d => {
        const stage = CRM_STAGES[d.stage]
        const b = d.bienId ? crmBienById(d.bienId) : null
        const riskColor =
          d.risk === 'at-risk' ? '#F59E0B' : d.risk === 'stalled' ? '#E53935' : '#0E9F6E'
        const nextActionIcon: CrmIconName =
          d.nextAction.kind === 'call'
            ? 'phone'
            : d.nextAction.kind === 'visit'
              ? 'home'
              : d.nextAction.kind === 'kyc'
                ? 'kyc'
                : 'flag'

        return (
          <CtCard key={d.id} sp={sp} padding="12px 14px">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      background: stage.color,
                    }}
                  />
                  <span style={{ fontSize: 11, fontWeight: 700, color: sp.soft }}>
                    {stage.label}
                  </span>
                  <span style={{ fontSize: 10, color: sp.sub }}>· {d.probability}%</span>
                  <span style={{ flex: 1 }} />
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      color: riskColor,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: riskColor + '1A',
                    }}
                  >
                    {d.risk === 'at-risk'
                      ? 'À risque'
                      : d.risk === 'stalled'
                        ? 'Bloqué'
                        : 'Sain'}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: sp.ink,
                    marginBottom: 4,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {b ? b.title : 'Recherche active'}
                </div>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                    color: sp.ink,
                    letterSpacing: -0.4,
                    fontVariantNumeric: 'tabular-nums',
                    marginBottom: 8,
                  }}
                >
                  {d.value ? ctFmtCHF(d.value) : '—'}
                </div>
                {d.nextAction && (
                  <div
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: sp.cardSubBg,
                      border: `1px solid ${sp.cardBorder}`,
                      fontSize: 11,
                      color: sp.soft,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <CRMIcon name={nextActionIcon} size={11} stroke={sp.soft} />
                    <span
                      style={{
                        flex: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {d.nextAction.note}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: sp.sub,
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {d.nextAction.dueAt.slice(5, 10).split('-').reverse().join('/')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CtCard>
        )
      })}
    </div>
  )
}

// ─── Stats vendeur (au lieu de critères) ─────────────────────────────
export function CtSellerStats({
  contact,
  sp,
}: {
  contact: CrmContact
  sp: SugarPalette
}) {
  const biens = CRM_BIENS.filter(b => b.ownerContactId === contact.id)
  if (biens.length === 0) {
    return (
      <CtCard sp={sp} padding="20px 16px">
        <div style={{ fontSize: 12.5, color: sp.sub, textAlign: 'center' }}>
          Aucun bien actif sous mandat.
        </div>
      </CtCard>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {biens.map(b => (
        <CtCard key={b.id} sp={sp} padding="12px 14px">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                flexShrink: 0,
                background: b.accent + '1A',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <CRMIcon name="bien" size={16} stroke={b.accent} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: sp.ink,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {b.title}
              </div>
              <div style={{ fontSize: 10.5, color: sp.sub, marginTop: 1 }}>
                {b.ref} · Mandat {b.mandat?.type} · {b.mandat?.commission}%
              </div>
            </div>
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 800,
                color: sp.ink,
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
              }}
            >
              {ctFmtCHF(b.price)}
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              paddingTop: 10,
              borderTop: `1px solid ${sp.cardBorder}`,
            }}
          >
            {[
              { label: 'Vues', value: b.stats.views },
              { label: 'Favoris', value: b.stats.favorites },
              { label: 'Visites', value: b.stats.visitRequests },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: sp.ink,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: -0.3,
                  }}
                >
                  {s.value}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: sp.sub,
                    fontWeight: 600,
                    marginTop: 2,
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </CtCard>
      ))}
    </div>
  )
}

// ─── KYC card ─────────────────────────────────────────────────────────
// Mode non-bloquant : affiche l'état du dossier sans jamais empêcher d'action.
// Mini-stepper 6 étapes (Identité → Béné. → Fonds → Screening → Risque → Validation)
// + 3 KPIs (Risque, Pièces, Dernier screening) + CTA contextuel.
export function CtKyc({
  contact,
  sp,
  fill,
}: {
  contact: CrmContact
  sp: SugarPalette
  fill?: boolean
}) {
  const status = contact.kyc?.status || 'none'

  const stepByStatus: Record<string, number> = {
    none: 0,
    pending: 3,
    stale: 5,
    verified: 6,
  }
  const activeStep = stepByStatus[status] ?? 0
  const STEPS = ['Identité', 'Béné.', 'Fonds', 'Screening', 'Risque', 'Validation']

  const header: Record<string, { tone: string; soft: string; label: string; hint: string }> = {
    none: {
      tone: '#F59E0B',
      soft: '#FFF4E0',
      label: 'À démarrer',
      hint: 'Vous pouvez continuer à travailler ce dossier — pensez à le compléter avant la signature.',
    },
    pending: {
      tone: '#F59E0B',
      soft: '#FFF4E0',
      label: 'En cours',
      hint: 'Vérifications en attente · délai habituel 24-48h.',
    },
    verified: {
      tone: '#0E9F6E',
      soft: '#E5F4EC',
      label: 'Validé',
      hint: `Risque ${contact.kyc?.riskLevel || 'Faible'} · dernier screening ${
        contact.kyc?.expiresAt?.slice(0, 10) || '—'
      }.`,
    },
    stale: {
      tone: '#F59E0B',
      soft: '#FFF4E0',
      label: 'À re-screener',
      hint: 'Sanctions/PEP à rafraîchir — recommandé après 12 mois ou changement de situation.',
    },
  }
  const h = header[status]

  const cta = ({
    none: 'Démarrer le dossier KYC',
    pending: 'Voir le dossier',
    verified: 'Consulter le dossier',
    stale: 'Relancer le screening',
  } as const)[status]

  // KPIs
  const docsTotal = 6
  const docsDone = ({ none: 0, pending: 3, verified: 6, stale: 6 } as const)[status] ?? 0
  const riskValue = status === 'verified' || status === 'stale' ? 14 : null
  const riskLabel =
    contact.kyc?.riskLevel ||
    (riskValue != null ? (riskValue < 25 ? 'Faible' : riskValue < 60 ? 'Modéré' : 'Élevé') : '—')
  const riskColor =
    riskValue == null
      ? sp.sub
      : riskValue < 25
        ? '#0E9F6E'
        : riskValue < 60
          ? '#F59E0B'
          : '#E53935'
  const lastScreen =
    status === 'verified' ? '12.04.26' : status === 'stale' ? '03.02.25' : '—'

  return (
    <CtCard sp={sp} padding="14px 16px" fill={fill}>
      {/* Header : statut + hint */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            flexShrink: 0,
            background: h.soft,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <CRMIcon name="kyc" size={14} stroke={h.tone} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: sp.ink,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            Conformité KYC / LBA
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 999,
                background: h.soft,
                color: h.tone,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: 0.2,
              }}
            >
              {h.label}
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: sp.soft,
              marginTop: 2,
              lineHeight: 1.45,
            }}
          >
            {h.hint}
          </div>
        </div>
      </div>

      {/* Mini-stepper horizontal */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 0,
          marginBottom: 14,
        }}
      >
        {STEPS.map((l, i) => {
          const done = i < activeStep
          const active = i === activeStep && status !== 'verified'
          return (
            <Fragment key={l}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    background: done ? '#0E9F6E' : active ? sp.ink : sp.cardSubBg,
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: active ? `0 0 0 3px ${sp.cardSubBg}` : 'none',
                    border: !done && !active ? `1px solid ${sp.cardBorder}` : 0,
                  }}
                >
                  {done && <CRMIcon name="check" size={8} stroke="#fff" />}
                </div>
                <div
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    textAlign: 'center',
                    color: done || active ? sp.ink : sp.sub,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {l}
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    height: 2,
                    flex: 0.5,
                    alignSelf: 'center',
                    marginTop: -14,
                    marginLeft: -2,
                    marginRight: -2,
                    background: i < activeStep - 1 ? '#0E9F6E' : sp.cardSubBg,
                  }}
                />
              )}
            </Fragment>
          )
        })}
      </div>

      {/* 3 KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ padding: '8px 10px', borderRadius: 8, background: sp.cardSubBg }}>
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              color: sp.sub,
            }}
          >
            Risque
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: riskColor,
              marginTop: 2,
            }}
          >
            {riskValue != null ? riskValue : '—'}
            <span
              style={{
                fontSize: 10,
                color: sp.sub,
                fontWeight: 600,
                marginLeft: 4,
              }}
            >
              {riskValue != null ? `/ ${riskLabel}` : ''}
            </span>
          </div>
        </div>
        <div style={{ padding: '8px 10px', borderRadius: 8, background: sp.cardSubBg }}>
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              color: sp.sub,
            }}
          >
            Pièces
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: sp.ink,
              marginTop: 2,
            }}
          >
            {docsDone}
            <span style={{ fontSize: 10, color: sp.sub, fontWeight: 600 }}> / {docsTotal}</span>
          </div>
        </div>
        <div style={{ padding: '8px 10px', borderRadius: 8, background: sp.cardSubBg }}>
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              color: sp.sub,
            }}
          >
            Dernier screening
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: sp.ink,
              marginTop: 2,
            }}
          >
            {lastScreen}
          </div>
        </div>
      </div>

      {/* CTA */}
      <button
        style={{
          width: '100%',
          height: 32,
          borderRadius: 8,
          background: status === 'verified' ? 'transparent' : '#0041D9',
          color: status === 'verified' ? sp.ink : '#fff',
          border: status === 'verified' ? `1px solid ${sp.cardBorder}` : 0,
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <CRMIcon name="kyc" size={12} stroke={status === 'verified' ? sp.ink : '#fff'} />
        {cta}
      </button>
    </CtCard>
  )
}
