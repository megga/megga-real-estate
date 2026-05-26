// MEGGA CRM Sugar v2 — Deal detail drawer (slide from right, 600px / fullscreen).
// 1:1 port from the Claude Design bundle (crm-pipeline-deal-detail.jsx).

import { useState, useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Sheet from '@/components/ui/Sheet'
import CRMIcon, { type CrmIconName } from '../CRMIcon'
import {
  CRM_STAGES, CRM_STAGE_ORDER, crmFmtCHF, crmInitials, crmRelative,
  type CrmTheme, type SugarPalette, type StageId,
} from '../tokens'
import {
  CRM_DEALS, CRM_ACTIVITY, CRM_MATCHES,
  crmContactById, crmBienById,
  type CrmActivity, type CrmBien,
} from '../mockData'
import { useLogAudit } from '@/hooks/useAuditLog'

// Mock-id guard — CRM_DEALS uses `d-…` ids; real Supabase rows use UUIDs.
// Mutations that hit real tables skip cleanly for mock data instead of
// 4xx-ing with cryptic FK violations.
const MOCK_ID_RE = /^[bcd]-\d/
const isMockId = (id: string | null | undefined): boolean => !!id && MOCK_ID_RE.test(id)

const KIND_LABEL: Record<string, string> = {
  call: 'Appel', email: 'Email', sms: 'SMS', visit: 'Visite', meeting: 'RDV',
  note: 'Note', 'doc-sent': 'Document envoyé', 'doc-signed': 'Signature',
  'kyc-update': 'KYC', 'match-sent': 'Matchs envoyés', 'stage-change': 'Étape',
  'ai-action': 'MEGGA AI', offer: 'Offre', 'lead-in': 'Lead',
  'email-open': 'Email ouvert',
}

function kindIcon(k: string): CrmIconName {
  if (k === 'call') return 'phone'
  if (k === 'email' || k === 'email-open') return 'mail'
  if (k === 'visit') return 'home'
  if (k === 'kyc-update') return 'kyc'
  if (k === 'match-sent') return 'spark'
  if (k === 'doc-sent' || k === 'doc-signed') return 'docs'
  if (k === 'ai-action') return 'spark'
  if (k === 'offer') return 'flag'
  return 'flag'
}

interface DealDetailDrawerProps {
  open: boolean
  onClose: () => void
  dealId: string | null
  sp: SugarPalette
  t: CrmTheme
  dark: boolean
}

export function DealDetailDrawer({ open, onClose, dealId, sp, t: _t, dark }: DealDetailDrawerProps) {
  void _t // overlay was sourced from t.overlay; <Sheet> now provides backdrop
  const navigate = useNavigate()
  const logAudit = useLogAudit()
  const [composer, setComposer] = useState<'note' | 'call' | 'email' | 'visit'>('note')
  const [text, setText] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [savingTrace, setSavingTrace] = useState(false)

  useEffect(() => { if (!open) setExpanded(false) }, [open])

  // Persist a call/email/visit/note trace as an activity_event row.
  // The composer used to be a silent no-op (button had no onClick at all).
  async function saveTrace() {
    if (!text.trim() || savingTrace) return
    setSavingTrace(true)
    try {
      // The action enum on activity_events is free-form text in our schema —
      // use a clear prefix so this kind of agent-typed trace is queryable.
      await new Promise<void>((resolve, reject) => {
        logAudit.mutate(
          {
            category: 'deal',
            severity: 'info',
            action: `deal-${composer}-trace`,
            entityType: 'transaction',
            entityId: dealId && !isMockId(dealId) ? dealId : null,
            objectLabel: `Deal ${dealId ?? ''}`,
            metadata: {
              body: text.trim(),
              composer,
              // Flag mock deals so reports can filter demo data out.
              demo_data: isMockId(dealId),
            },
          },
          {
            onSuccess: () => resolve(),
            onError: (err) => reject(err),
          }
        )
      })
      setText('')
    } catch (err) {
      // Surface via window.alert (lightweight — the drawer has no toast slot).
      // Better UX = small toast inside the drawer; chip for follow-up.
      // eslint-disable-next-line no-alert, no-console
      console.error('[deal-drawer] saveTrace failed', err)
      // eslint-disable-next-line no-alert
      window.alert("Échec de l'enregistrement de la trace. Réessayez.")
    } finally {
      setSavingTrace(false)
    }
  }

  const deal = dealId ? CRM_DEALS.find(d => d.id === dealId) : null
  if (!open || !deal) return null

  const c = crmContactById(deal.contactId)!
  const b = deal.bienId ? crmBienById(deal.bienId) : null
  const stageIdx = CRM_STAGE_ORDER.indexOf(deal.stage)
  const activities: CrmActivity[] = CRM_ACTIVITY
    .filter(a => a.contactId === deal.contactId)
    .sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime())
  const matches = CRM_MATCHES.filter(m => m.contactId === deal.contactId).slice(0, 3)

  const kycRequiredHere = ['interest-confirmed', 'offer', 'signed'].includes(deal.stage)
  const showKycBanner = c.kyc?.status !== 'verified' && kycRequiredHere

  return (
    <Sheet
      open={open}
      onClose={onClose}
      side="right"
      width={expanded ? '100vw' : 600}
      ariaLabel={`Deal ${deal.id}`}
      style={{
        background: dark ? sp.pageBg : '#F4F5F8',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: expanded ? 'none' : '-20px 0 60px -20px rgba(14,20,16,.30)',
      }}
    >

        {/* Header */}
        <div style={{
          padding: '20px 24px 18px', background: sp.pageBg,
          borderBottom: `1px solid ${sp.cardBorder}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 999, flexShrink: 0,
              background: c.avatarBg || '#0041D9', color: '#fff',
              display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 800,
            }}>{crmInitials(`${c.firstName} ${c.lastName}`)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: sp.sub,
                letterSpacing: 0.4, textTransform: 'uppercase',
              }}>Deal · {deal.id}</div>
              <h2 style={{
                margin: '2px 0 0', fontSize: 22, fontWeight: 800, color: sp.ink, letterSpacing: -0.5,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {c.firstName} {c.lastName}
              </h2>
              <div style={{
                fontSize: 12, color: sp.sub, marginTop: 2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {b ? b.title : 'Recherche active'} · {b?.addr || c.email}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{
                fontSize: 22, fontWeight: 800, color: sp.ink,
                fontVariantNumeric: 'tabular-nums', letterSpacing: -0.6,
              }}>{deal.value ? crmFmtCHF(deal.value) : '—'}</div>
              <div style={{ fontSize: 11, color: sp.sub, fontWeight: 600 }}>{deal.probability}% probabilité</div>
            </div>
            <button onClick={() => setExpanded(e => !e)} title={expanded ? 'Réduire' : 'Agrandir'} style={{
              width: 36, height: 36, borderRadius: 999, border: 0, cursor: 'pointer',
              background: sp.cardBg, boxShadow: sp.shadowSm,
              display: 'grid', placeItems: 'center', fontFamily: 'inherit', marginRight: 6,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={sp.soft} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {expanded ? (
                  <><path d="M9 4v5H4"/><path d="M20 4l-7 7"/><path d="M15 20v-5h5"/><path d="M4 20l7-7"/></>
                ) : (
                  <><path d="M15 4h5v5"/><path d="M20 4l-7 7"/><path d="M9 20H4v-5"/><path d="M4 20l7-7"/></>
                )}
              </svg>
            </button>
            <button onClick={onClose} style={{
              width: 36, height: 36, borderRadius: 999, border: 0, cursor: 'pointer',
              background: sp.cardBg, boxShadow: sp.shadowSm,
              fontSize: 18, color: sp.soft, fontFamily: 'inherit',
            }}>×</button>
          </div>

          <Stepper sp={sp} currentIdx={stageIdx} />
        </div>

        {/* Body */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: expanded ? '24px 10vw 160px' : '20px 24px 140px',
          maxWidth: expanded ? 1100 : 'none', margin: expanded ? '0 auto' : 0, width: '100%',
        }}>
          {/* Risk + KYC banners */}
          {deal.risk !== 'healthy' && (
            <Banner sp={sp} tone={deal.risk === 'stalled' ? 'danger' : 'warn'}
              title={deal.risk === 'stalled' ? 'Deal bloqué' : 'Deal à risque'}
              body={deal.risk === 'stalled' ? 'Aucune activité depuis +10 jours. Lancer une relance ?' : 'Suivi à intensifier cette semaine.'} />
          )}
          {showKycBanner && (
            <Banner sp={sp} tone="info" title="KYC requis"
              body={`Statut : ${c.kyc?.status || 'non lancé'}. Bloquant avant la signature.`}
              cta="Lancer KYC" />
          )}

          {/* Next action */}
          {deal.nextAction && (
            <Section sp={sp} title="Prochaine action">
              <div style={{
                background: sp.cardBg, border: `1px solid ${sp.cardBorder}`, borderRadius: 18,
                padding: 16, boxShadow: sp.shadow,
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                  background: sp.ink, display: 'grid', placeItems: 'center',
                }}>
                  <CRMIcon name={kindIcon(deal.nextAction.kind)} size={16} stroke={sp.pageBg} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13.5, fontWeight: 700, color: sp.ink, letterSpacing: -0.2,
                  }}>{deal.nextAction.note}</div>
                  <div style={{
                    fontSize: 11.5, color: sp.sub, marginTop: 2, fontVariantNumeric: 'tabular-nums',
                  }}>
                    {KIND_LABEL[deal.nextAction.kind] || deal.nextAction.kind} · échéance {deal.nextAction.dueAt.slice(0, 10).split('-').reverse().join('/')} {deal.nextAction.dueAt.slice(11, 16)}
                  </div>
                </div>
                <button style={{
                  padding: '9px 16px', borderRadius: 999, border: 0, cursor: 'pointer',
                  background: sp.ink, color: sp.pageBg, fontWeight: 700, fontSize: 12,
                  fontFamily: 'inherit', boxShadow: sp.focusShadow,
                }}>Marquer fait</button>
              </div>
            </Section>
          )}

          {/* Quick actions — wired to real flows. The 8 buttons used to all
              be window.alert() placeholders. Each now navigates to the
              corresponding existing page (which already has its own data
              + mutations wired). */}
          <Section sp={sp} title="Actions">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <Quick
                sp={sp}
                icon="phone"
                label="Appeler"
                onClick={() => {
                  // tel: deep-link is the cleanest "call now" UX — opens
                  // the OS dialer / soft-phone. Falls back to alert if no
                  // phone on file.
                  if (c.phone) window.location.href = `tel:${c.phone.replace(/\s/g, '')}`
                  // eslint-disable-next-line no-alert
                  else window.alert(`Pas de numéro renseigné pour ${c.firstName} ${c.lastName}`)
                }}
              />
              <Quick
                sp={sp}
                icon="mail"
                label="Email"
                onClick={() => {
                  if (c.email) window.location.href = `mailto:${c.email}`
                  // eslint-disable-next-line no-alert
                  else window.alert(`Pas d'email renseigné pour ${c.firstName} ${c.lastName}`)
                }}
              />
              <Quick
                sp={sp}
                icon="home"
                label="Visite"
                onClick={() => {
                  // /dashboard/visites/nouveau exists + is wired (#429 +
                  // existing useCreateAgentVisit). Pre-fill via query string
                  // — page accepts ?contactId / ?propertyId hints.
                  const q = new URLSearchParams()
                  if (!isMockId(deal.contactId)) q.set('contactId', deal.contactId)
                  if (deal.bienId && !isMockId(deal.bienId)) q.set('propertyId', deal.bienId)
                  navigate(`/dashboard/visites/nouveau${q.toString() ? '?' + q : ''}`)
                  onClose()
                }}
              />
              <Quick
                sp={sp}
                icon="docs"
                label="Document"
                onClick={() => {
                  navigate('/dashboard/documents/generate')
                  onClose()
                }}
              />
              <Quick
                sp={sp}
                icon="spark"
                label="Matchs"
                onClick={() => {
                  navigate('/dashboard/matching')
                  onClose()
                }}
              />
              <Quick
                sp={sp}
                icon="kyc"
                label="KYC"
                onClick={() => {
                  navigate('/dashboard/kyc')
                  onClose()
                }}
              />
              <Quick
                sp={sp}
                icon="flag"
                label="Offre"
                onClick={() => {
                  // The offer modal lives at /dashboard/transactions/:id/offre/:kind
                  // — chip says route exists. Skip for mock deals (no real id).
                  if (isMockId(dealId)) {
                    // eslint-disable-next-line no-alert
                    window.alert('Création d\'offre disponible sur un deal réel uniquement.')
                    return
                  }
                  navigate(`/dashboard/transactions/${dealId}/offre/contre-offre`)
                  onClose()
                }}
              />
              <Quick
                sp={sp}
                icon="cal"
                label="Planifier"
                onClick={() => {
                  navigate('/dashboard/calendar')
                  onClose()
                }}
              />
            </div>
          </Section>

          {/* Parties */}
          <Section sp={sp} title="Parties">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <PartyCard sp={sp}
                role="Acheteur"
                name={`${c.firstName} ${c.lastName}`}
                sub={c.email}
                kyc={c.kyc?.status}
                avatarBg={c.avatarBg} />
              {b && <BienCard sp={sp} bien={b} />}
            </div>
          </Section>

          {/* Matchs */}
          {matches.length > 0 && (
            <Section sp={sp} title="Matchs IA">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {matches.map(m => {
                  const mb = crmBienById(m.bienId)
                  if (!mb) return null
                  return (
                    <div key={m.bienId} style={{
                      background: sp.cardBg, border: `1px solid ${sp.cardBorder}`, borderRadius: 14,
                      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
                      boxShadow: sp.shadowSm,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 10, background: mb.accent || '#0041D9',
                        display: 'grid', placeItems: 'center', color: '#fff',
                        fontSize: 9, fontWeight: 800, flexShrink: 0,
                      }}>{mb.ref.split('-').pop()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12.5, fontWeight: 700, color: sp.ink,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{mb.title}</div>
                        <div style={{ fontSize: 10.5, color: sp.sub, marginTop: 1 }}>
                          {m.reasons.slice(0, 3).join(' · ')}
                        </div>
                      </div>
                      <div style={{
                        padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                        background: m.score >= 90 ? '#E1F5EC' : m.score >= 75 ? '#E8EFFE' : sp.cardSubBg,
                        color: m.score >= 90 ? '#0E9F6E' : m.score >= 75 ? '#0041D9' : sp.soft,
                        fontVariantNumeric: 'tabular-nums',
                      }}>{m.score}</div>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

          {/* Timeline */}
          <Section sp={sp} title="Activité">
            <div style={{ position: 'relative', paddingLeft: 20 }}>
              <div style={{
                position: 'absolute', left: 7, top: 8, bottom: 8, width: 2,
                background: sp.cardBorder,
              }} />
              {activities.length === 0 && (
                <div style={{ padding: '20px 4px', color: sp.sub, fontSize: 12 }}>
                  Aucune activité encore.
                </div>
              )}
              {activities.map(a => (
                <div key={a.id} style={{ position: 'relative', paddingBottom: 14 }}>
                  <div style={{
                    position: 'absolute', left: -20, top: 4,
                    width: 16, height: 16, borderRadius: 999, background: sp.pageBg,
                    border: `2px solid ${sp.ink}`,
                    display: 'grid', placeItems: 'center',
                  }}>
                    <CRMIcon name={kindIcon(a.kind)} size={8} stroke={sp.ink} />
                  </div>
                  <div style={{
                    background: sp.cardBg, border: `1px solid ${sp.cardBorder}`,
                    borderRadius: 12, padding: '10px 12px', boxShadow: sp.shadowSm,
                  }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                      gap: 8, marginBottom: 3,
                    }}>
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, color: sp.sub,
                        letterSpacing: 0.3, textTransform: 'uppercase',
                      }}>{KIND_LABEL[a.kind] || a.kind}</span>
                      <span style={{
                        fontSize: 10, color: sp.sub, fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                      }}>{crmRelative(a.at)}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: sp.ink, lineHeight: 1.5 }}>{a.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* Composer footer */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '14px 20px',
          background: sp.pageBg, borderTop: `1px solid ${sp.cardBorder}`,
        }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {([
              { k: 'note' as const,  label: 'Note' },
              { k: 'call' as const,  label: 'Appel' },
              { k: 'email' as const, label: 'Email' },
              { k: 'visit' as const, label: 'Visite' },
            ]).map(o => {
              const sel = o.k === composer
              return (
                <button key={o.k} onClick={() => setComposer(o.k)} style={{
                  padding: '5px 12px', borderRadius: 999,
                  background: sel ? sp.ink : sp.cardSubBg,
                  color: sel ? sp.pageBg : sp.soft, border: 0, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 11, fontWeight: sel ? 700 : 600,
                }}>{o.label}</button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              value={text} onChange={e => setText(e.target.value)}
              placeholder={`Ajouter une ${composer === 'note' ? 'note' : composer === 'call' ? "trace d'appel" : composer === 'email' ? "trace d'email" : 'trace de visite'}…`}
              style={{
                flex: 1, minHeight: 40, maxHeight: 120, padding: 10, borderRadius: 14,
                background: sp.cardBg, color: sp.ink,
                border: `1px solid ${sp.cardBorder}`, boxShadow: sp.shadowSm,
                fontSize: 13, fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.4,
              }}
            />
            <button
              onClick={saveTrace}
              disabled={!text || savingTrace}
              style={{
                height: 40, padding: '0 18px', borderRadius: 999, border: 0,
                cursor: text && !savingTrace ? 'pointer' : 'not-allowed',
                background: text && !savingTrace ? sp.ink : sp.cardSubBg,
                color: text && !savingTrace ? sp.pageBg : sp.sub,
                fontWeight: 700, fontSize: 12.5, fontFamily: 'inherit',
                boxShadow: text && !savingTrace ? sp.focusShadow : 'none',
              }}>
              {savingTrace ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
    </Sheet>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────
function Stepper({ sp, currentIdx }: { sp: SugarPalette; currentIdx: number }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {CRM_STAGE_ORDER.map((s, i) => {
        const info = CRM_STAGES[s]
        const done = i < currentIdx
        const active = i === currentIdx
        return (
          <button key={s} title={info.label} style={{
            flex: active ? '0 0 auto' : 1, height: 28, padding: active ? '0 12px' : 0,
            borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit',
            background: active ? sp.ink : (done ? info.color : sp.cardSubBg),
            color: active ? sp.pageBg : 'transparent',
            fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
            boxShadow: active ? sp.focusShadow : 'none',
            transition: 'all .2s',
          }}>{active ? info.label : '·'}</button>
        )
      })}
    </div>
  )
}

function Section({ sp, title, children }: { sp: SugarPalette; title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: sp.sub,
        letterSpacing: 0.4, textTransform: 'uppercase',
        marginBottom: 10, padding: '0 4px',
      }}>{title}</div>
      {children}
    </div>
  )
}

function Quick({
  sp, icon, label, onClick,
}: { sp: SugarPalette; icon: CrmIconName; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: sp.cardBg, border: `1px solid ${sp.cardBorder}`, borderRadius: 14,
      padding: '12px 6px', boxShadow: sp.shadowSm, cursor: 'pointer',
      fontFamily: 'inherit', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 6,
      transition: 'transform .15s, box-shadow .15s, background .15s',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = sp.shadow }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = sp.shadowSm }}
    onMouseDown={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = sp.cardSubBg }}
    onMouseUp={e => { e.currentTarget.style.background = sp.cardBg }}>
      <CRMIcon name={icon} size={14} stroke={sp.ink} />
      <div style={{ fontSize: 10.5, fontWeight: 700, color: sp.ink }}>{label}</div>
    </button>
  )
}

function PartyCard({
  sp, role, name, sub, kyc, avatarBg,
}: {
  sp: SugarPalette
  role: string
  name: string
  sub: string
  kyc?: string
  avatarBg?: string
}) {
  const kycLabel = kyc === 'verified' ? 'KYC vérifié' : kyc === 'pending' ? 'KYC en cours' : 'KYC à faire'
  const kycColor = kyc === 'verified' ? '#0E9F6E' : kyc === 'pending' ? '#F59E0B' : '#E53935'
  const kycBg = kyc === 'verified' ? '#E1F5EC' : kyc === 'pending' ? '#FEF3DB' : '#FDECEA'
  return (
    <div style={{
      background: sp.cardBg, border: `1px solid ${sp.cardBorder}`, borderRadius: 14,
      padding: '12px 14px', boxShadow: sp.shadowSm,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 999,
        background: avatarBg || '#0041D9', color: '#fff',
        display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0,
      }}>{crmInitials(name)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10.5, color: sp.sub, fontWeight: 700,
          letterSpacing: 0.3, textTransform: 'uppercase',
        }}>{role}</div>
        <div style={{
          fontSize: 13, fontWeight: 700, color: sp.ink, marginTop: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{name}</div>
        <div style={{
          fontSize: 11, color: sp.sub,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{sub}</div>
      </div>
      <span style={{
        padding: '4px 10px', borderRadius: 999, background: kycBg, color: kycColor,
        fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap',
      }}>{kycLabel}</span>
    </div>
  )
}

function BienCard({ sp, bien }: { sp: SugarPalette; bien: CrmBien }) {
  return (
    <div style={{
      background: sp.cardBg, border: `1px solid ${sp.cardBorder}`, borderRadius: 14,
      padding: '12px 14px', boxShadow: sp.shadowSm,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: bien.accent || '#0041D9',
        color: '#fff', display: 'grid', placeItems: 'center',
        fontSize: 9, fontWeight: 800, flexShrink: 0, letterSpacing: 0.3,
      }}>{bien.ref.split('-').pop()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10.5, color: sp.sub, fontWeight: 700,
          letterSpacing: 0.3, textTransform: 'uppercase',
        }}>Bien · {bien.ref}</div>
        <div style={{
          fontSize: 13, fontWeight: 700, color: sp.ink, marginTop: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{bien.title}</div>
        <div style={{ fontSize: 11, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
          {bien.addr} · {bien.area}m² · {bien.price ? crmFmtCHF(bien.price) : (bien.rent ? `CHF ${bien.rent}/m` : '—')}
        </div>
      </div>
      {bien.mandat?.type && (
        <span style={{
          padding: '4px 10px', borderRadius: 999, background: sp.cardSubBg, color: sp.soft,
          fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap', textTransform: 'capitalize',
        }}>Mandat {bien.mandat.type}</span>
      )}
    </div>
  )
}

function Banner({
  sp, tone, title, body, cta,
}: {
  sp: SugarPalette
  tone: 'info' | 'warn' | 'danger'
  title: string
  body: string
  cta?: string
}) {
  const colors = {
    info:   { bg: '#E8EFFE', fg: '#0033AC', dot: '#0041D9' },
    warn:   { bg: '#FEF3DB', fg: '#925700', dot: '#F59E0B' },
    danger: { bg: '#FDECEA', fg: '#A11C16', dot: '#E53935' },
  }[tone]
  // Suppress unused warning — sp is used in case we need to enrich later
  void sp
  return (
    <div style={{
      background: colors.bg, color: colors.fg,
      padding: '12px 14px', borderRadius: 14,
      marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center',
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: 999, background: colors.dot, flexShrink: 0,
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 11.5, fontWeight: 500, lineHeight: 1.5, opacity: .85, marginTop: 2 }}>{body}</div>
      </div>
      {cta && (
        <button style={{
          padding: '6px 12px', borderRadius: 999, border: 0, cursor: 'pointer',
          background: colors.fg, color: colors.bg, fontWeight: 700, fontSize: 11,
          fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}>{cta}</button>
      )}
    </div>
  )
}

export type { StageId }
