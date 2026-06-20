// MEGGA CRM Sugar v2 Wizard — Step 7 : Publication
// 1:1 port from the Claude Design bundle (crm-wizard-sugar-step7.jsx).

import { useState, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { SugarV2, sgOn, sgAcc, fmtCHF, shade, type WizardData } from '../tokens'
import { CRM_CONTACTS } from '@/components/crm-sugar/mockData'

interface StepProps {
  data: WizardData
  set: (patch: Partial<WizardData>) => void
  onClose: () => void
}

export function Step7Publish({ data, set }: StepProps) {
  const { t: tr } = useTranslation('listings')
  const allContacts = CRM_CONTACTS
  const owner = data.ownerContactId
    ? (allContacts.find(c => c.id === data.ownerContactId) || data._newContact)
    : null

  const mode = data.publishMode || 'now'
  const setMode = (v: 'now' | 'schedule' | 'draft') => set({ publishMode: v })

  const defaultSched = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 2); d.setHours(9, 0, 0, 0)
    return d.toISOString().slice(0, 16)
  }, [])
  const [sched, setSched] = useState(data.scheduledAt || defaultSched)

  const visibility = data.visibility || 'public'

  const chips: string[] = []
  if (data.type) chips.push(typeLabel(data.type, tr))
  if (data.area) chips.push(`${data.area} m²`)
  if (data.rooms) chips.push(tr('wizard.step7.chip.rooms', { count: data.rooms }))
  if (data.bedrooms) chips.push(tr('wizard.step7.chip.bedrooms', { count: data.bedrooms }))
  if (data.energy) chips.push(tr('wizard.step7.chip.epc', { grade: data.energy }))

  const photos = data.photos || []
  const cover = photos[0]
  const tx = data.transaction || 'vente'
  const price = tx === 'vente' ? data.price : data.rent

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto',
      animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both' }}>

      <div style={{ marginBottom: 28, maxWidth: 760 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: SugarV2.muted,
          letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
        }}>{tr('wizard.step7.eyebrow')}</div>
        <h1 style={{
          margin: '0 0 14px', fontSize: 38, fontWeight: 700,
          color: SugarV2.ink, letterSpacing: -0.8, lineHeight: 1.1,
        }}>{tr('wizard.step7.title')}</h1>
        <p style={{ margin: 0, fontSize: 15, color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
          {tr('wizard.step7.intro')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 24 }}>
        {/* PREVIEW */}
        <div style={{
          background: SugarV2.card, borderRadius: 28, overflow: 'hidden',
          boxShadow: SugarV2.shadowLg,
        }}>
          <div style={{
            padding: '12px 16px',
            background: SugarV2.cardSubtle,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['#FF5F57', '#FEBC2E', '#28C840'].map(c => (
                <div key={c} style={{ width: 11, height: 11, borderRadius: 999, background: c }} />
              ))}
            </div>
            <div style={{
              flex: 1, height: 26, borderRadius: 8,
              background: sgOn(), display: 'flex', alignItems: 'center', gap: 8,
              padding: '0 12px', fontSize: 11, color: SugarV2.muted, fontWeight: 500,
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.04)',
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              megga.ch / annonce / {(data.addr || tr('wizard.step7.urlSlugFallback')).toLowerCase().replace(/\s+/g, '-').slice(0, 30)}
            </div>
          </div>

          <div style={{
            position: 'relative', aspectRatio: '16 / 9',
            background: cover
              ? `repeating-linear-gradient(135deg, ${cover.tone || '#D4DDE3'} 0 14px, ${shade(cover.tone || '#D4DDE3', -0.04)} 14px 28px)`
              : SugarV2.cardSubtle,
            display: 'grid', placeItems: 'center',
          }}>
            {!cover && (
              <div style={{ color: SugarV2.muted, fontSize: 13, fontWeight: 500 }}>
                {tr('wizard.step7.noCoverPhoto')}
              </div>
            )}
            {cover && (
              <div style={{ color: 'rgba(0,0,0,0.20)' }}>
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <path d="M3 21V11l9-7 9 7v10"/><path d="M9 21v-7h6v7"/>
                </svg>
              </div>
            )}

            <div style={{
              position: 'absolute', top: 14, left: 14,
              display: 'flex', gap: 6, flexWrap: 'wrap',
            }}>
              {data.options?.featured && (
                <span style={{
                  padding: '5px 11px', borderRadius: 999,
                  background: SugarV2.black, color: sgOn(),
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.30)',
                }}>{tr('wizard.step7.badge.featured')}</span>
              )}
              {data.options?.videoTour && (
                <span style={{
                  padding: '5px 11px', borderRadius: 999,
                  background: sgAcc(0.95), color: SugarV2.ink,
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
                }}>{tr('wizard.step7.badge.video')}</span>
              )}
              {data.options?.virtualStagingUser && (
                <span style={{
                  padding: '5px 11px', borderRadius: 999,
                  background: sgAcc(0.95), color: SugarV2.ink,
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
                }}>{tr('wizard.step7.badge.staging')}</span>
              )}
            </div>

            {photos.length > 1 && (
              <div style={{
                position: 'absolute', bottom: 14, right: 14,
                padding: '5px 11px', borderRadius: 999,
                background: 'rgba(0,0,0,0.65)', color: sgOn(),
                fontSize: 10.5, fontWeight: 600, letterSpacing: 0.3,
                backdropFilter: 'blur(6px)',
              }}>1 / {photos.length}</div>
            )}
          </div>

          <div style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, marginBottom: 18 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: SugarV2.muted,
                  letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6,
                }}>
                  {tx === 'vente' ? tr('wizard.txBadge.sale') : tr('wizard.txBadge.rent')} · {data.canton || tr('wizard.country')}
                </div>
                <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.5, lineHeight: 1.2 }}>
                  {data.addr || tr('wizard.step7.addressPlaceholder')}
                </h2>
                <div style={{ fontSize: 13, color: SugarV2.muted, fontWeight: 500 }}>
                  {data.postCode ? `${data.postCode} · ` : ''}{data.canton || ''}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: SugarV2.ink, letterSpacing: -1, lineHeight: 1 }}>
                  {fmtCHF(price) || '—'}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: SugarV2.muted, letterSpacing: 0.5, marginTop: 4 }}>
                  CHF{tx === 'location' ? tr('wizard.perMonth') : ''}
                </div>
              </div>
            </div>

            {chips.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
                {chips.map((c, i) => (
                  <span key={i} style={{
                    padding: '5px 11px', borderRadius: 999,
                    background: SugarV2.cardSubtle, color: SugarV2.ink,
                    fontSize: 11.5, fontWeight: 600, letterSpacing: 0.1,
                  }}>{c}</span>
                ))}
              </div>
            )}

            {data.description && (
              <p style={{
                margin: '0 0 18px', fontSize: 13.5, color: SugarV2.inkSoft,
                fontWeight: 500, lineHeight: 1.6,
                display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {data.description}
              </p>
            )}

            <div style={{
              padding: '14px 16px', borderRadius: 14,
              background: SugarV2.cardSubtle,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 999,
                background: SugarV2.black, color: sgOn(),
                display: 'grid', placeItems: 'center',
                fontSize: 12, fontWeight: 700,
              }}>{owner ? `${owner.firstName?.[0] || ''}${owner.lastName?.[0] || ''}`.toUpperCase() : 'GL'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: SugarV2.ink }}>
                  {owner ? `${owner.firstName} ${owner.lastName}` : 'Gregory Lyonnet'}
                </div>
                <div style={{ fontSize: 11, color: SugarV2.muted, fontWeight: 500 }}>
                  {tr('wizard.step7.agentLine', { canton: data.canton || tr('wizard.country') })}
                </div>
              </div>
              <button style={{
                height: 32, padding: '0 14px', borderRadius: 999, border: 0,
                background: SugarV2.black, color: sgOn(),
                fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, cursor: 'default',
              }}>{tr('wizard.step7.contact')}</button>
            </div>
          </div>
        </div>

        {/* PANNEAU PUBLICATION */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            background: SugarV2.card, borderRadius: 24, padding: 22,
            boxShadow: SugarV2.shadow,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: SugarV2.muted,
              letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14,
            }}>{tr('wizard.step7.whenPublish')}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <PubChoice mode="now" current={mode} onSelect={setMode}
                title={tr('wizard.step7.publishNow.title')}
                sub={tr('wizard.step7.publishNow.sub')}
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-7"/></svg>} />

              <PubChoice mode="schedule" current={mode} onSelect={setMode}
                title={tr('wizard.step7.schedule.title')}
                sub={tr('wizard.step7.schedule.sub')}
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>} />

              <PubChoice mode="draft" current={mode} onSelect={setMode}
                title={tr('wizard.step7.draft.title')}
                sub={tr('wizard.step7.draft.sub')}
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>} />
            </div>

            {mode === 'schedule' && (
              <div style={{
                marginTop: 14, padding: '12px 14px', borderRadius: 14,
                background: SugarV2.cardSubtle,
                animation: 'sgFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
              }}>
                <div style={{
                  fontSize: 10.5, fontWeight: 700, color: SugarV2.muted,
                  letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8,
                }}>{tr('wizard.step7.scheduleDateLabel')}</div>
                <input type="datetime-local" value={sched}
                  onChange={e => { setSched(e.target.value); set({ scheduledAt: e.target.value }) }}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    height: 40, padding: '0 12px', borderRadius: 10,
                    border: 0, outline: 'none', background: sgOn(),
                    fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: SugarV2.ink,
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.04)',
                  }} />
              </div>
            )}
          </div>

          <div style={{
            background: SugarV2.card, borderRadius: 24, padding: 22,
            boxShadow: SugarV2.shadow,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: SugarV2.muted,
              letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14,
            }}>{tr('wizard.step7.visibility.eyebrow')}</div>

            <div style={{ display: 'flex', padding: 4, borderRadius: 999, background: SugarV2.cardSubtle }}>
              {[
                { v: 'public' as const,    l: tr('wizard.step7.visibility.public') },
                { v: 'network' as const,   l: tr('wizard.step7.visibility.network') },
                { v: 'private' as const,   l: tr('wizard.step7.visibility.private') },
              ].map(o => {
                const sel = visibility === o.v
                return (
                  <button key={o.v} onClick={() => set({ visibility: o.v })} style={{
                    flex: 1, height: 34, borderRadius: 999, border: 0,
                    background: sel ? SugarV2.card : 'transparent',
                    color: sel ? SugarV2.ink : SugarV2.inkSoft,
                    fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: sel ? SugarV2.shadowSm : 'none',
                    transition: 'all .15s ease',
                  }}>{o.l}</button>
                )
              })}
            </div>

            <div style={{
              marginTop: 12, fontSize: 12, color: SugarV2.muted, fontWeight: 500, lineHeight: 1.5,
            }}>
              {visibility === 'public' && tr('wizard.step7.visibility.publicDesc')}
              {visibility === 'network' && tr('wizard.step7.visibility.networkDesc')}
              {visibility === 'private' && tr('wizard.step7.visibility.privateDesc')}
            </div>
          </div>

          <div style={{
            background: SugarV2.cardSubtle, borderRadius: 18, padding: '16px 18px',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: SugarV2.muted,
              letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10,
            }}>{tr('wizard.step7.recap.title')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <RecapRow l={tr('wizard.step7.recap.seller')} v={owner ? `${owner.firstName} ${owner.lastName}` : '—'} />
              <RecapRow l={tr('wizard.step7.recap.mandate')} v={
                ({
                  exclusive: tr('wizard.step7.mandate.exclusive'),
                  simple: tr('wizard.step7.mandate.simple'),
                  co: tr('wizard.step7.mandate.co'),
                } as Record<string, string>)[data.mandate?.type] || '—'
              } />
              <RecapRow l={tr('wizard.step7.recap.photos')} v={tr('wizard.photosCount', { count: photos.length })} />
              <RecapRow l={tr('wizard.step7.recap.price')} v={`${fmtCHF(price) || '—'} CHF${tx === 'location' ? tr('wizard.perMonth') : ''}`} />
              <RecapRow l={tr('wizard.step7.recap.description')} v={tr('wizard.step7.recap.charsCount', { count: (data.description || '').length })} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PubChoice({
  mode, current, onSelect, title, sub, icon,
}: {
  mode: 'now' | 'schedule' | 'draft'
  current: string
  onSelect: (v: 'now' | 'schedule' | 'draft') => void
  title: string
  sub: string
  icon: ReactNode
}) {
  const sel = current === mode
  return (
    <button onClick={() => onSelect(mode)} style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 16px', borderRadius: 16, border: 0,
      background: sel ? SugarV2.black : SugarV2.cardSubtle,
      color: sel ? sgOn() : SugarV2.ink,
      fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
      boxShadow: sel ? '0 10px 24px rgba(0,0,0,0.20)' : 'none',
      transition: 'all .2s ease',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: sel ? sgAcc(0.14) : SugarV2.card,
        color: sel ? sgOn() : SugarV2.ink,
        display: 'grid', placeItems: 'center', flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: -0.2, marginBottom: 1 }}>{title}</div>
        <div style={{
          fontSize: 11.5, fontWeight: 500,
          color: sel ? sgAcc(0.70) : SugarV2.muted,
        }}>{sub}</div>
      </div>
      <div style={{
        width: 18, height: 18, borderRadius: 999,
        background: sel ? sgOn() : 'transparent',
        boxShadow: sel ? 'none' : `inset 0 0 0 2px ${SugarV2.ghost}`,
        display: 'grid', placeItems: 'center', flexShrink: 0,
      }}>
        {sel && <span style={{ width: 7, height: 7, borderRadius: 999, background: SugarV2.black }} />}
      </div>
    </button>
  )
}

function RecapRow({ l, v }: { l: string; v: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, fontSize: 12.5 }}>
      <span style={{ color: SugarV2.muted, fontWeight: 500 }}>{l}</span>
      <span style={{
        color: SugarV2.ink, fontWeight: 700, letterSpacing: -0.1, textAlign: 'right',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60%',
      }}>{v}</span>
    </div>
  )
}

const typeLabel = (t: string, tr: TFunction) => ({
  appartement: tr('type.apartment'),
  maison: tr('type.house'),
  villa: tr('type.villa'),
  terrain: tr('type.land'),
} as Record<string, string>)[t] || t
