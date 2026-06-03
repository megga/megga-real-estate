// MEGGA CRM Sugar v2 — Contact detail side drawer
// 1:1 port from the Claude Design bundle (crm-screen-today-sugar.jsx).

import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { crmInitials, type SugarPalette } from './tokens'
import type { CrmContact } from './mockData'

interface ActivityItem { kind: 'call' | 'email' | 'visit' | 'match'; label: string; when: string; dur: string }

const ACT_ICONS: Record<ActivityItem['kind'], MEIconName> = {
  call:  'phone',
  email: 'mail',
  visit: 'home',
  match: 'pipeline',
}

interface SugarContactDetailProps {
  contact: CrmContact | null
  onClose: () => void
  sp: SugarPalette
  dark: boolean
}

export default function SugarContactDetail({ contact, onClose, sp, dark }: SugarContactDetailProps) {
  if (!contact) return null

  const fullName = `${contact.firstName} ${contact.lastName}`
  const initials = crmInitials(fullName)
  const isLead = contact.status === 'lead'
  const score = contact.score || 0
  const scoreColor = score >= 75 ? '#0E9F6E' : score >= 50 ? '#F59E0B' : '#E53935'
  const typeLabel = contact.type === 'buyer' ? 'Acheteur' : contact.type === 'seller' ? 'Vendeur' : 'Lead'

  const activity: ActivityItem[] = [
    { kind: 'call',  label: 'Appel de qualification',    when: 'Hier · 16:42', dur: '12 min' },
    { kind: 'email', label: 'Email — Recap visite',      when: 'Mar. 14:00',   dur: 'Lu' },
    { kind: 'visit', label: 'Visite Carouge — Maison',   when: 'Lun. 10:30',   dur: '45 min' },
    { kind: 'match', label: '3 nouveaux matchs envoyés', when: 'Dim. 09:15',   dur: '' },
  ]

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1200,
          background: dark ? 'rgba(0,0,0,0.55)' : 'rgba(15,23,42,0.30)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          animation: 'sugar-overlay-fade 220ms ease',
        }}
      />
      {/* Bento panel — flottant, ne touche pas les bords haut/bas/droit */}
      <aside style={{
        position: 'fixed', top: 24, right: 24, bottom: 24, width: 460, zIndex: 1201,
        background: sp.frameBg,
        backdropFilter: 'blur(24px) saturate(140%)',
        WebkitBackdropFilter: 'blur(24px) saturate(140%)',
        border: `1px solid ${sp.frameBorder}`,
        borderRadius: 32,
        boxShadow: dark
          ? '-20px 20px 60px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.04) inset'
          : '-20px 20px 60px rgba(15,23,42,0.18), 0 1px 0 rgba(255,255,255,0.6) inset',
        display: 'flex', flexDirection: 'column',
        animation: 'sugar-bento-in 380ms cubic-bezier(.22,1,.36,1)',
        color: sp.ink,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '22px 24px 16px',
          display: 'flex', alignItems: 'flex-start', gap: 16,
          position: 'relative',
        }}>
          {/* Halo coloré en fond */}
          <div aria-hidden style={{
            position: 'absolute', top: -40, left: -40, right: -40, height: 200,
            background: `radial-gradient(circle at 30% 0%, ${contact.avatarBg || '#0041D9'}22 0%, transparent 65%)`,
            pointerEvents: 'none', zIndex: 0,
          }} />

          <div style={{
            width: 60, height: 60, borderRadius: 999,
            background: contact.avatarBg || '#0041D9', color: '#fff',
            display: 'grid', placeItems: 'center', fontSize: 19, fontWeight: 800,
            boxShadow: `0 6px 20px ${contact.avatarBg || '#0041D9'}55`,
            border: `3px solid ${sp.avatarBorder}`,
            flexShrink: 0, position: 'relative', zIndex: 1,
          }}>{initials}</div>

          <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1, paddingTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
                padding: '3px 10px', borderRadius: 999,
                background: contact.type === 'buyer' ? 'rgba(0,65,217,0.12)' : 'rgba(245,158,11,0.16)',
                color: contact.type === 'buyer' ? '#0041D9' : '#B45309',
              }}>{typeLabel}</span>
              {isLead && <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                padding: '3px 10px', borderRadius: 999,
                background: 'rgba(14,159,110,0.12)', color: '#0E9F6E',
              }}>Nouveau</span>}
            </div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: -0.6, color: sp.ink, lineHeight: 1.15 }}>
              {fullName}
            </h2>
            <div style={{ fontSize: 12, color: sp.sub, marginTop: 4, fontWeight: 500 }}>
              {contact.source ? `Via ${contact.source}` : 'Source inconnue'} · {contact.lang ? contact.lang.toUpperCase() : '—'}
            </div>
          </div>

          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: 999, border: 0,
            background: sp.cardSubBg, cursor: 'pointer',
            display: 'grid', placeItems: 'center',
            position: 'relative', zIndex: 1, flexShrink: 0,
            transition: 'background 160ms ease, transform 160ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = sp.cardBorder; e.currentTarget.style.transform = 'rotate(90deg)' }}
          onMouseLeave={e => { e.currentTarget.style.background = sp.cardSubBg; e.currentTarget.style.transform = 'rotate(0)' }}
          >
            <MEIcon name="close" size={14} color={sp.soft} />
          </button>
        </div>

        {/* Body scroll */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 24px' }}>
          {/* Score hero */}
          <div style={{
            background: `linear-gradient(135deg, ${scoreColor}14, ${scoreColor}05)`,
            border: `1px solid ${scoreColor}22`,
            borderRadius: 20, padding: '16px 18px',
            display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14,
          }}>
            <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
              <svg width="56" height="56" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="22" stroke={`${scoreColor}22`} strokeWidth="5" fill="none" />
                <circle cx="28" cy="28" r="22" stroke={scoreColor} strokeWidth="5" fill="none"
                  strokeDasharray={2 * Math.PI * 22}
                  strokeDashoffset={2 * Math.PI * 22 * (1 - score / 100)}
                  strokeLinecap="round"
                  transform="rotate(-90 28 28)" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: scoreColor, fontVariantNumeric: 'tabular-nums' }}>{score}</span>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: sp.sub, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                Score MEGGA
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: sp.ink, marginTop: 2 }}>
                {score >= 75 ? 'Lead chaud' : score >= 50 ? 'À nourrir' : 'À qualifier'}
              </div>
              <div style={{ fontSize: 11, color: sp.sub, marginTop: 2 }}>
                {score >= 75 ? "Forte intention d'achat" : score >= 50 ? 'Engagement modéré' : 'Données insuffisantes'}
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
            {([
              { icon: 'phone', label: 'Appeler', color: '#0E9F6E' },
              { icon: 'mail',  label: 'Email',   color: '#0041D9' },
              { icon: 'calendar',   label: 'Planifier', color: '#F59E0B' },
              { icon: 'plus',  label: 'Note',   color: sp.ink },
            ] as const).map(a => (
              <button key={a.label} style={{
                flex: 1, height: 60, borderRadius: 16, cursor: 'pointer',
                background: sp.cardBg,
                border: `1px solid ${sp.cardBorder}`,
                backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
                boxShadow: sp.shadowSm,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                fontFamily: 'inherit',
                transition: 'transform 200ms cubic-bezier(.22,1,.36,1), box-shadow 200ms ease, background 200ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = sp.shadow }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = sp.shadowSm }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: 999,
                  background: `${a.color}14`, display: 'grid', placeItems: 'center',
                }}>
                  <MEIcon name={a.icon} size={13} color={a.color} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: sp.sub, letterSpacing: 0.2 }}>{a.label}</span>
              </button>
            ))}
          </div>

          {/* Coordonnées */}
          <div style={{ marginBottom: 22 }}>
            <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: sp.sub, marginBottom: 10 }}>Coordonnées</h3>
            <div style={{
              background: sp.cardBg, border: `1px solid ${sp.cardBorder}`, borderRadius: 18,
              boxShadow: sp.shadowSm,
              backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${sp.cardBorder}` }}>
                <div style={{ width: 30, height: 30, borderRadius: 999, background: sp.cardSubBg, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <MEIcon name="mail" size={13} color={sp.soft} />
                </div>
                <div style={{ flex: 1, fontSize: 13, color: sp.ink, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact.email}</div>
              </div>
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: 999, background: sp.cardSubBg, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <MEIcon name="phone" size={13} color={sp.soft} />
                </div>
                <div style={{ flex: 1, fontSize: 13, color: sp.ink, fontWeight: 500, fontFamily: 'JetBrains Mono, monospace' }}>{contact.phone}</div>
              </div>
            </div>
          </div>

          {/* Activité récente */}
          <div>
            <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: sp.sub, marginBottom: 10 }}>Activité récente</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activity.map((a, i) => (
                <div key={i} style={{
                  background: sp.cardBg, border: `1px solid ${sp.cardBorder}`, borderRadius: 14,
                  padding: '10px 12px', boxShadow: sp.shadowSm,
                  backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ width: 30, height: 30, borderRadius: 999, background: sp.cardSubBg, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <MEIcon name={ACT_ICONS[a.kind]} size={13} color={sp.soft} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: sp.ink, lineHeight: 1.3 }}>{a.label}</div>
                    <div style={{ fontSize: 10.5, color: sp.sub, marginTop: 2 }}>{a.when}{a.dur ? ` · ${a.dur}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div style={{
          padding: '12px 24px 18px',
          display: 'flex', gap: 10,
          background: `linear-gradient(to top, ${dark ? 'rgba(20,24,33,0.5)' : 'rgba(255,255,255,0.4)'}, transparent)`,
        }}>
          <button style={{
            flex: 1, height: 46, borderRadius: 14, border: 0, cursor: 'pointer',
            background: sp.ink, color: sp.pageBg,
            fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
            boxShadow: sp.focusShadow,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'transform 200ms cubic-bezier(.22,1,.36,1)',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
          >
            Ouvrir la fiche complète
            <span style={{ fontSize: 14 }}>→</span>
          </button>
        </div>
      </aside>
    </>
  )
}
