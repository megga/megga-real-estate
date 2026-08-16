// MEGGA — Réception acheteur (page publique par token, mobile MEGGA X).
//
// Moitié acheteur de la boucle de match : l'acheteur ouvre le lien privé transmis
// par son conseiller, consulte la sélection et réagit (♥ intéressé / ✕ écarté +
// motif). Chaque réaction est transmise en direct (edge buyer-reception-react) et
// remonte dans la fiche contact de l'agent. Port du proto handoff `reception-app.jsx`
// (données LIVE, sans localStorage). FR-CH · Manrope · public (pas de compte).

import { useMemo, useState } from 'react'
import type { CSSProperties, UIEvent as ReactUIEvent } from 'react'
import { useParams } from 'react-router-dom'
import { useBuyerReception, useBuyerReactionMutation, type ReceptionBien } from '@/hooks/useBuyerReception'
import { MLK } from '@/components/kyc-magic-link/mlkTokens'
import { crmVoileEncre } from '@/components/crm/tokens'

/** Alias local : `fontFamily` est écrit une dizaine de fois, et `MLK.font` y allongerait chaque ligne sans rien dire de plus. */
const FONT = MLK.font

const MOTIFS = ['Trop cher', 'Quartier', 'Étage / luminosité', 'Trop petit', 'Pas le bon moment', 'Autre']
// \s couvre déjà U+202F / U+00A0 (séparateurs de milliers fr-CH) — inutile de
// les répéter en clair dans la classe : invisibles en relecture.
const fmtCHF = (n: number) => 'CHF ' + Math.round(n).toLocaleString('fr-CH').replace(/[\s,]/g, "'")
const priceOf = (b: ReceptionBien) => (b.transaction === 'location' ? b.rent : b.price)

const ICO = {
  heart: 'M12 20.5S3.5 15.4 3.5 9.6C3.5 6.9 5.6 5 8 5c1.7 0 3.1 1 4 2.4C12.9 6 14.3 5 16 5c2.4 0 4.5 1.9 4.5 4.6 0 5.8-8.5 10.9-8.5 10.9z',
  x: 'M6 6l12 12M18 6L6 18', check: 'M5 12.5l4.2 4.2L19 7',
  chevL: 'M15 5l-7 7 7 7', chevR: 'M9 5l7 7-7 7',
  phone: 'M6.6 3.5 4.2 4.8c-.8.5-1.2 1.5-.9 2.4a17 17 0 0 0 11.5 11.5c.9.3 1.9-.1 2.4-.9l1.3-2.4c.4-.7.2-1.6-.5-2l-2.6-1.7c-.6-.4-1.4-.3-1.9.2l-.9.9a13 13 0 0 1-5-5l.9-.9c.5-.5.6-1.3.2-1.9L7.5 3.9c-.4-.6-1.2-.8-1.9-.4z',
  lock: ['M6 10V8a6 6 0 1 1 12 0v2', 'M5 10h14v10H5z'],
  camera: ['M4 8h3l1.5-2h7L17 8h3v11H4z', 'M12 16.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
}
function Icon({ d, size = 22, stroke = 'currentColor', fill = 'none', sw = 1.9 }: { d: string | string[]; size?: number; stroke?: string; fill?: string; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  )
}
const blackBtn = (extra?: CSSProperties): CSSProperties => ({ width: '100%', height: 52, borderRadius: 999, border: 0, cursor: 'pointer', background: MLK.accent, color: '#fff', fontSize: 'var(--crm-text-xl)', fontWeight: 600, letterSpacing: -0.2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: `0 8px 20px ${crmVoileEncre(false, 0.20)}`, fontFamily: FONT, ...extra })
const ghostBtn = (extra?: CSSProperties): CSSProperties => ({ height: 52, borderRadius: 999, border: 0, cursor: 'pointer', background: MLK.cardSubtle, color: MLK.inkSoft, fontSize: 'var(--crm-text-xl)', fontWeight: 600, letterSpacing: -0.2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: FONT, ...extra })
const KEYFRAMES = `@keyframes rcUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes rcFade{from{opacity:0}to{opacity:1}}
@keyframes rcSheet{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes rcPop{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
.rc-scroll::-webkit-scrollbar{display:none}
@media (prefers-reduced-motion: reduce){*{animation-duration:.001ms!important}}`

type UiStatus = 'liked' | 'rejected' | null

export default function BuyerReceptionPage() {
  const { token } = useParams<{ token: string }>()
  const { data, isLoading, isError } = useBuyerReception(token)
  const reactM = useBuyerReactionMutation()

  // Surcouche optimiste locale (réaction instantanée) + édition (« Revenir »).
  const [over, setOver] = useState<Record<string, { status: 'interested' | 'rejected'; motif: string | null }>>({})
  const [editing, setEditing] = useState<Set<string>>(new Set())
  const [detailId, setDetailId] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const items = useMemo(() => data?.items ?? [], [data])
  const statusOf = (b: ReceptionBien): UiStatus => {
    if (editing.has(b.match_id)) return null
    const s = over[b.match_id]?.status ?? b.status
    return s === 'interested' ? 'liked' : s === 'rejected' ? 'rejected' : null
  }
  const motifOf = (b: ReceptionBien): string | null => over[b.match_id]?.motif ?? b.reaction_motif

  const react = (matchId: string, reaction: 'interested' | 'rejected', motif: string | null = null, note: string | null = null) => {
    if (!token) return
    setOver((o) => ({ ...o, [matchId]: { status: reaction, motif } }))
    setEditing((e) => { const q = new Set(e); q.delete(matchId); return q })
    reactM.mutate({ token, matchId, reaction, motif, note }, {
      onError: () => setOver((o) => { const q = { ...o }; delete q[matchId]; return q }),
    })
  }
  const like = (matchId: string) => { react(matchId, 'interested'); setDetailId(null) }
  const openReject = (matchId: string) => { setRejectId(matchId); setDetailId(null) }
  const confirmReject = (matchId: string, motif: string | null, note: string | null) => { react(matchId, 'rejected', motif, note); setRejectId(null) }
  const backTo = (matchId: string) => setEditing((e) => new Set(e).add(matchId))

  const treated = items.filter((b) => statusOf(b)).length
  const liked = items.filter((b) => statusOf(b) === 'liked')
  const total = items.length
  const agent = data?.agent
  const firstName = agent?.name?.split(' ')[0] || 'votre conseiller'

  const detailBien = detailId ? items.find((b) => b.match_id === detailId) ?? null : null
  const rejectBien = rejectId ? items.find((b) => b.match_id === rejectId) ?? null : null

  const stage: CSSProperties = { minHeight: '100dvh', background: MLK.bgGradient, fontFamily: FONT, color: MLK.ink, fontVariantNumeric: 'tabular-nums' }
  const shell: CSSProperties = { maxWidth: 480, margin: '0 auto', position: 'relative', minHeight: '100dvh' }

  // ── États lien invalide / expiré / chargement ──
  if (isLoading) {
    return <div style={{ ...stage, display: 'grid', placeItems: 'center' }}><style>{KEYFRAMES}</style>
      <div style={{ color: MLK.muted, fontSize: 'var(--crm-text-lg)', fontWeight: 600 }}>Chargement de votre sélection…</div></div>
  }
  if (isError || !data || data.ok === false) {
    const expired = data?.reason === 'expired'
    return (
      <div style={{ ...stage, display: 'grid', placeItems: 'center', padding: 24 }}>
        <style>{KEYFRAMES}</style>
        <div style={{ background: MLK.card, borderRadius: 22, boxShadow: MLK.shadow, padding: '32px 26px', textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: MLK.ink, letterSpacing: -0.4 }}>{expired ? 'Ce lien a expiré' : "Ce lien n'est plus valide"}</div>
          <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: MLK.muted, marginTop: 10, lineHeight: 1.55 }}>
            Contactez votre conseiller pour recevoir une nouvelle sélection.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={stage}>
      <style>{KEYFRAMES}</style>
      <div style={shell}>
        <div className="rc-scroll" style={{ paddingTop: 40, paddingBottom: 128 }}>
          {/* En-tête conseiller */}
          <div style={{ padding: '0 20px 4px', animation: 'rcUp .5s cubic-bezier(.2,.8,.2,1) both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {agent?.avatar
                ? <img src={agent.avatar} alt={agent.name} referrerPolicy="no-referrer" style={{ width: 56, height: 56, borderRadius: 999, objectFit: 'cover', flexShrink: 0, boxShadow: MLK.shadowSm, background: MLK.cardSubtle }} />
                : <span style={{ width: 56, height: 56, borderRadius: 999, flexShrink: 0, display: 'grid', placeItems: 'center', background: MLK.ink, color: '#fff', fontSize: 'var(--crm-text-3xl)', fontWeight: 600 }}>{(agent?.name || '?').split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}</span>}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: MLK.ink, letterSpacing: -0.4 }}>{agent?.name || 'Votre conseiller'}</div>
                <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: MLK.muted, marginTop: 2 }}>Votre conseiller{agent?.agency ? ' · ' + agent.agency : ''}</div>
              </div>
            </div>
            <div style={{ marginTop: 16, background: MLK.card, borderRadius: 18, boxShadow: MLK.shadow, padding: '16px 18px' }}>
              <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, lineHeight: 1.55, color: MLK.inkSoft }}>
                Bonjour {data.contact.firstName || ''}, voici une sélection de biens qui collent à votre recherche. Dites-moi lesquels vous parlent — j'organise les visites dans la foulée.
              </div>
            </div>
          </div>

          {/* Progression */}
          <div style={{ padding: '22px 20px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h1 style={{ margin: 0, fontSize: 'var(--crm-text-5xl)', fontWeight: 600, letterSpacing: -0.7, color: MLK.ink }}>Votre sélection</h1>
              <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: MLK.muted }}>{treated} sur {total}</span>
            </div>
            <div style={{ marginTop: 12, height: 5, borderRadius: 999, background: crmVoileEncre(false, 0.07), overflow: 'hidden' }}>
              <div style={{ height: '100%', width: (total ? (treated / total) * 100 : 0) + '%', background: MLK.ink, borderRadius: 999, transition: 'width .45s cubic-bezier(.2,.8,.2,1)' }} />
            </div>
          </div>

          {/* Cartes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 18px 0' }}>
            {items.map((b, i) => {
              const st = statusOf(b)
              const p = priceOf(b)
              return (
                <div key={b.match_id} style={{ background: MLK.card, borderRadius: 22, boxShadow: MLK.shadow, overflow: 'hidden', animation: `rcUp .5s cubic-bezier(.2,.8,.2,1) ${(0.06 + i * 0.07).toFixed(2)}s both` }}>
                  <button onClick={() => setDetailId(b.match_id)} style={{ display: 'block', width: '100%', border: 0, padding: 0, cursor: 'pointer', background: 'none', position: 'relative', textAlign: 'left' }}>
                    <div style={{ position: 'relative', height: 208, background: MLK.cardSubtle, opacity: st === 'rejected' ? 0.5 : 1, transition: 'opacity .3s' }}>
                      {b.photos[0] && <img src={b.photos[0]} alt={b.title} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                      {b.photos.length > 0 && (
                        <span style={{ position: 'absolute', bottom: 14, right: 14, height: 26, padding: '0 11px', borderRadius: 999, background: crmVoileEncre(false, 0.66), color: '#fff', fontSize: 'var(--crm-text-xs)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Icon d={ICO.camera} size={13} stroke="#fff" sw={1.7} /> {b.photos.length}
                        </span>
                      )}
                    </div>
                  </button>
                  <div style={{ padding: '16px 18px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: MLK.ink, letterSpacing: -0.4 }}>{b.title}</div>
                        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: MLK.muted, marginTop: 3 }}>{[b.quartier, b.rooms != null ? b.rooms + ' pièces' : null, b.area != null ? b.area + ' m²' : null].filter(Boolean).join(' · ')}</div>
                      </div>
                      <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: MLK.ink, letterSpacing: -0.4, whiteSpace: 'nowrap', flexShrink: 0 }}>{p ? fmtCHF(p) : '—'}{b.transaction === 'location' && p ? <span style={{ fontSize: 'var(--crm-text-sm)', color: MLK.muted }}>/mois</span> : null}</div>
                    </div>
                    {!st ? (
                      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                        <button onClick={() => openReject(b.match_id)} style={ghostBtn({ flex: '0 0 auto', width: 56, padding: 0 })} aria-label="Écarter ce bien"><Icon d={ICO.x} size={20} stroke={MLK.inkSoft} /></button>
                        <button onClick={() => like(b.match_id)} style={blackBtn({ flex: 1, height: 52 })}><Icon d={ICO.heart} size={19} stroke="#fff" fill="#fff" sw={1.4} /> Ça m'intéresse</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16 }}>
                        {st === 'liked'
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px', borderRadius: 999, background: MLK.ink, color: '#fff', fontSize: 'var(--crm-text-md)', fontWeight: 600 }}><Icon d={ICO.heart} size={15} stroke="#fff" fill="#fff" sw={1.4} /> Ça vous intéresse</span>
                          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px', borderRadius: 999, background: MLK.cardSubtle, color: MLK.muted, fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>Écarté{motifOf(b) ? ' · ' + motifOf(b) : ''}</span>}
                        <button onClick={() => backTo(b.match_id)} style={{ border: 0, background: 'none', cursor: 'pointer', color: MLK.inkSoft, fontSize: 'var(--crm-text-md)', fontWeight: 600, padding: '8px 6px', fontFamily: FONT }}>Revenir</button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {total > 0 && treated === total && (
            <div style={{ padding: '22px 18px 0' }}>
              <button onClick={() => setDone(true)} style={blackBtn()}>Voir le récapitulatif</button>
            </div>
          )}

          <div style={{ padding: '26px 20px 0', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: MLK.muted }}>
              <Icon d={ICO.lock} size={13} stroke={MLK.muted} /> Lien privé sécurisé · transmis par {firstName} via MEGGA
            </div>
          </div>
        </div>

        {/* Feuille détail */}
        {detailBien && <ReceptionDetail bien={detailBien} status={statusOf(detailBien)} motif={motifOf(detailBien)} onClose={() => setDetailId(null)} onLike={() => like(detailBien.match_id)} onReject={() => openReject(detailBien.match_id)} onBack={() => backTo(detailBien.match_id)} />}
        {/* Feuille motif */}
        {rejectBien && <ReceptionReject firstName={firstName} onClose={() => setRejectId(null)} onConfirm={(m, n) => confirmReject(rejectBien.match_id, m, n)} />}
        {/* Récap */}
        {done && <ReceptionDone liked={liked} total={total} contactFirst={data.contact.firstName} agent={agent} onReview={() => setDone(false)} />}
      </div>
    </div>
  )
}

// ── Feuille détail ──────────────────────────────────────────────────────
function ReceptionDetail({ bien, status, motif, onClose, onLike, onReject, onBack }: { bien: ReceptionBien; status: UiStatus; motif: string | null; onClose: () => void; onLike: () => void; onReject: () => void; onBack: () => void }) {
  const [pi, setPi] = useState(0)
  const p = priceOf(bien)
  const isRent = bien.transaction === 'location'
  const facts: Array<{ k: string; v: string }> = [
    bien.rooms != null ? { k: 'Pièces', v: String(bien.rooms) } : null,
    bien.area != null ? { k: 'Surface', v: bien.area + ' m²' } : null,
    bien.floor != null ? { k: 'Étage', v: String(bien.floor) } : null,
    bien.year != null ? { k: 'Année', v: String(bien.year) } : null,
    bien.charges != null ? { k: 'Charges', v: fmtCHF(bien.charges) + '/mois' } : null,
    bien.price_per_m2 != null ? { k: isRent ? 'Loyer / m²' : 'Prix / m²', v: fmtCHF(bien.price_per_m2) } : null,
  ].filter((f): f is { k: string; v: string } => !!f)
  const onScroll = (e: ReactUIEvent<HTMLDivElement>) => { const w = e.currentTarget.clientWidth || 1; setPi(Math.round(e.currentTarget.scrollLeft / w)) }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, maxWidth: 480, margin: '0 auto' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: crmVoileEncre(false, 0.38), backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'rcFade .25s ease both' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 40, background: MLK.card, borderRadius: '28px 28px 0 0', boxShadow: MLK.sheetShadow, overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'rcSheet .38s cubic-bezier(.2,.85,.25,1) both' }}>
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 40, height: 5, borderRadius: 999, background: crmVoileEncre(false, 0.14), zIndex: 3 }} />
        <button onClick={onClose} aria-label="Fermer" style={{ position: 'absolute', top: 16, right: 16, zIndex: 3, width: 36, height: 36, borderRadius: 999, border: 0, cursor: 'pointer', background: 'rgba(255,255,255,.9)', boxShadow: MLK.shadowSm, display: 'grid', placeItems: 'center' }}><Icon d={ICO.x} size={17} stroke={MLK.ink} /></button>
        <div className="rc-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ position: 'relative' }}>
            <div onScroll={onScroll} className="rc-scroll" style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
              {(bien.photos.length ? bien.photos : ['']).map((ph, i) => (
                <div key={i} style={{ flex: '0 0 100%', width: '100%', aspectRatio: '5 / 4', scrollSnapAlign: 'start', background: MLK.cardSubtle }}>
                  {ph && <img src={ph} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                </div>
              ))}
            </div>
            {bien.photos.length > 1 && (
              <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
                {bien.photos.map((_, i) => <span key={i} style={{ width: i === pi ? 20 : 6, height: 6, borderRadius: 999, background: i === pi ? '#fff' : 'rgba(255,255,255,.6)', transition: 'width .25s' }} />)}
              </div>
            )}
          </div>
          <div style={{ padding: '20px 22px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 600, color: MLK.ink, letterSpacing: -0.6 }}>{bien.title}</div>
                <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: MLK.muted, marginTop: 5 }}>{bien.addr}</div>
              </div>
              <div style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 600, color: MLK.ink, letterSpacing: -0.6, whiteSpace: 'nowrap' }}>{p ? fmtCHF(p) : '—'}</div>
            </div>
            {facts.length > 0 && (
              <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {facts.map((f) => (
                  <div key={f.k} style={{ background: MLK.cardSubtle, borderRadius: 14, padding: '12px 13px' }}>
                    <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: MLK.muted }}>{f.k}</div>
                    <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: MLK.ink, marginTop: 4, letterSpacing: -0.3 }}>{f.v}</div>
                  </div>
                ))}
              </div>
            )}
            {bien.desc && <div style={{ marginTop: 20, fontSize: 'var(--crm-text-lg)', fontWeight: 500, lineHeight: 1.6, color: MLK.inkSoft }}>{bien.desc}</div>}
            {bien.features.length > 0 && (
              <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {bien.features.map((f) => <span key={f} style={{ display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 14px', borderRadius: 999, background: MLK.cardSubtle, color: MLK.inkSoft, fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>{f}</span>)}
              </div>
            )}
            <div style={{ height: 12 }} />
          </div>
        </div>
        <div style={{ flexShrink: 0, padding: '12px 18px calc(12px + env(safe-area-inset-bottom))', background: MLK.card, boxShadow: `0 -8px 24px ${crmVoileEncre(false, 0.05)}` }}>
          {!status ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onReject} style={ghostBtn({ flex: '0 0 auto', width: 58, padding: 0 })} aria-label="Écarter"><Icon d={ICO.x} size={21} stroke={MLK.inkSoft} /></button>
              <button onClick={onLike} style={blackBtn({ flex: 1 })}><Icon d={ICO.heart} size={19} stroke="#fff" fill="#fff" sw={1.4} /> Ça m'intéresse</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: status === 'liked' ? MLK.ink : MLK.muted }}>
                {status === 'liked' ? <><Icon d={ICO.heart} size={17} stroke={MLK.ink} fill={MLK.ink} sw={1.4} /> Ça vous intéresse</> : 'Écarté' + (motif ? ' · ' + motif : '')}
              </span>
              <button onClick={onBack} style={ghostBtn({ padding: '0 18px', height: 44 })}>Revenir</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Feuille motif d'écartement ──────────────────────────────────────────
function ReceptionReject({ firstName, onClose, onConfirm }: { firstName: string; onClose: () => void; onConfirm: (motif: string | null, note: string | null) => void }) {
  const [motif, setMotif] = useState<string | null>(null)
  const [note, setNote] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, maxWidth: 480, margin: '0 auto' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: crmVoileEncre(false, 0.42), backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'rcFade .25s ease both' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: MLK.card, borderRadius: '28px 28px 0 0', boxShadow: MLK.sheetShadow, padding: '22px 22px calc(20px + env(safe-area-inset-bottom))', animation: 'rcSheet .36s cubic-bezier(.2,.85,.25,1) both' }}>
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 40, height: 5, borderRadius: 999, background: crmVoileEncre(false, 0.14) }} />
        <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: MLK.ink, letterSpacing: -0.5, marginTop: 6 }}>Ce bien ne convient pas ?</div>
        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: MLK.muted, marginTop: 6, lineHeight: 1.5 }}>Optionnel — mais ça aide {firstName} à affiner les prochaines propositions.</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
          {MOTIFS.map((m) => {
            const on = motif === m
            return <button key={m} onClick={() => setMotif(on ? null : m)} aria-pressed={on} style={{ height: 40, padding: '0 16px', borderRadius: 999, border: 0, cursor: 'pointer', fontSize: 'var(--crm-text-md)', fontWeight: 600, fontFamily: FONT, background: on ? MLK.accent : MLK.cardSubtle, color: on ? '#fff' : MLK.inkSoft, transition: 'background .15s, color .15s' }}>{m}</button>
          })}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Préciser (facultatif)…" rows={2}
          style={{ marginTop: 14, width: '100%', resize: 'none', borderRadius: 14, border: 0, background: MLK.cardSubtle, padding: '13px 15px', fontFamily: FONT, fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: MLK.ink, outline: 'none', boxShadow: 'inset 0 0 0 1px ' + MLK.line, boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={ghostBtn({ flex: 1 })}>Annuler</button>
          <button onClick={() => onConfirm(motif, note.trim() || null)} style={blackBtn({ flex: 1.4 })}>Écarter ce bien</button>
        </div>
      </div>
    </div>
  )
}

// ── Écran de fin ────────────────────────────────────────────────────────
function ReceptionDone({ liked, total, contactFirst, agent, onReview }: { liked: ReceptionBien[]; total: number; contactFirst: string; agent: { name: string; phone: string | null } | null | undefined; onReview: () => void }) {
  const rejected = total - liked.length
  const firstName = agent?.name?.split(' ')[0] || 'votre conseiller'
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: MLK.bgGradient, animation: 'rcFade .3s ease both', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', fontFamily: FONT }}>
      <div className="rc-scroll" style={{ flex: 1, overflowY: 'auto', padding: '72px 22px 28px', textAlign: 'center' }}>
        <div style={{ width: 68, height: 68, borderRadius: 999, background: MLK.ink, margin: '0 auto', display: 'grid', placeItems: 'center', boxShadow: `0 12px 30px ${crmVoileEncre(false, 0.25)}`, animation: 'rcPop .5s cubic-bezier(.2,.9,.3,1) both' }}><Icon d={ICO.check} size={30} stroke="#fff" sw={2.2} /></div>
        <h1 style={{ margin: '20px 0 0', fontSize: 'var(--crm-text-5xl)', fontWeight: 600, letterSpacing: -0.8, color: MLK.ink }}>Merci {contactFirst} !</h1>
        <p style={{ margin: '10px auto 0', maxWidth: 300, fontSize: 'var(--crm-text-lg)', fontWeight: 500, lineHeight: 1.55, color: MLK.inkSoft }}>
          Vos réponses sont transmises à {agent?.name || 'votre conseiller'}. Il revient vers vous très vite pour organiser les visites.
        </p>
        <div style={{ marginTop: 26, background: MLK.card, borderRadius: 20, boxShadow: MLK.shadow, padding: '18px 18px 10px', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Icon d={ICO.heart} size={16} stroke={MLK.ink} fill={MLK.ink} sw={1.4} />
            <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: MLK.ink }}>{liked.length === 0 ? 'Aucun bien retenu' : liked.length + (liked.length > 1 ? ' biens vous intéressent' : ' bien vous intéresse')}</span>
          </div>
          {liked.map((b) => (
            <div key={b.match_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid ' + MLK.line }}>
              {b.photos[0] && <img src={b.photos[0]} alt="" referrerPolicy="no-referrer" style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', flexShrink: 0, background: MLK.cardSubtle }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: MLK.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}{b.quartier ? ' · ' + b.quartier : ''}</div>
                <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: MLK.muted, marginTop: 2 }}>{priceOf(b) ? fmtCHF(priceOf(b) as number) : '—'}</div>
              </div>
            </div>
          ))}
          {liked.length === 0 && <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: MLK.muted, lineHeight: 1.5, padding: '4px 0 8px' }}>Pas de souci — {firstName} vous prépare d'autres biens plus proches de vos attentes.</div>}
        </div>
        {rejected > 0 && <div style={{ marginTop: 12, fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: MLK.muted }}>{rejected} bien{rejected > 1 ? 's' : ''} écarté{rejected > 1 ? 's' : ''} — pris en compte.</div>}
      </div>
      <div style={{ flexShrink: 0, padding: '12px 18px calc(16px + env(safe-area-inset-bottom))' }}>
        {agent?.phone && <a href={'tel:' + agent.phone.replace(/\s+/g, '')} style={{ ...blackBtn(), textDecoration: 'none', marginBottom: 10 }}><Icon d={ICO.phone} size={17} stroke="#fff" /> Appeler {firstName}</a>}
        <button onClick={onReview} style={ghostBtn({ width: '100%' })}>Revoir ma sélection</button>
      </div>
    </div>
  )
}
