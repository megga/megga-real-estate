// MEGGA — Réception acheteur (page publique par token, mobile MEGGA X).
//
// Moitié acheteur de la boucle de match : l'acheteur ouvre le lien privé transmis
// par son conseiller, consulte la sélection et réagit (♥ intéressé / ✕ écarté +
// motif). Chaque réaction est transmise en direct (edge buyer-reception-react) et
// remonte dans la fiche contact de l'agent. Port du proto handoff `reception-app.jsx`
// (données LIVE, sans localStorage). FR-CH · Manrope · public (pas de compte).
//
// ── ⛔ POURQUOI LE FIL PRINCIPAL N'EST PAS DANS UN `MlkShell` (16 août 2026) ──────────
// L'étape 2 du chantier prescrit `<MlkBackground><MlkShell>…</MlkShell></MlkBackground>`
// pour chaque surface publique. Cette page prend la MARQUE et le PIED — ce qui manquait
// vraiment — mais PAS la coquille sur son fil principal, et c'est mesuré, pas préféré :
//
//   · `MlkShell` est une CARTE de document (720 px par défaut, rayon 32, `shadowLg`,
//     padding 56). Le fil d'ici est une application TÉLÉPHONE : 480 px, `100dvh`,
//     `env(safe-area-inset-bottom)`, une galerie à `scroll-snap`, et des cartes de bien
//     qui sont DÉJÀ des `MLK.card` avec `MLK.shadow`. La coquille y mettrait une carte
//     dans une carte.
//   · Les trois panneaux (détail, motif, récapitulatif) sont en `position: fixed` :
//     ils sortiraient de la coquille de toute façon, donc elle n'unifierait rien.
//   · `MlkBackground` impose `minHeight: 100vh` et `padding: '48px 16px'`. Sur un
//     téléphone, `100vh` au lieu de `100dvh` est une RÉGRESSION (la barre du navigateur
//     recouvre le bas), et 16 px de marge en plus des 18 px des cartes rétrécit le fil.
//
// ⚠ LES ÉTATS « CHARGEMENT » ET « LIEN INVALIDE » LA PRENNENT, EUX, EN ENTIER : ce sont
// des documents — rien n'y défile ni ne s'y actionne. La règle n'est donc pas « cette
// page échappe à la direction », c'est « la coquille habille un document, pas une
// application ».
//
// ── ET ELLE SE LIT AUSSI AU BUREAU DEPUIS LE 17 AOÛT 2026 (demande de Julien) ────────
// La clause ci-dessus se terminait par « si un jour ce fil devient une page lue au
// bureau, il reprendra la coquille ». Ce jour est arrivé, et la réponse est plus fine
// que prévu : le fil ne reprend TOUJOURS pas `MlkShell`, parce que les trois raisons
// mesurées plus haut tiennent encore — les cartes de bien sont déjà des cartes, les
// panneaux sont en `position: fixed`, et `100dvh` reste juste sur téléphone.
//
// ⛔ CE QUI CHANGE EST LA FORME, PAS LA COQUILLE. Une sélection de biens se COMPARE :
// en colonne unique sur un écran large, on fait défiler pour tenir deux cartes en tête,
// ce que la grille donne d'un regard. C'est précisément ce qui distingue cette surface
// de `/kyc/:token`, un document qu'on LIT et qui reste donc en colonne.
//
// Tout est en CSS (classes `rc-*` + une seule requête de média à 768 px), sans état
// React ni `matchMedia` : pas de rendu intermédiaire, pas de branche à tenir. Les trois
// panneaux cessent d'être des feuilles montantes pour devenir des modales centrées —
// collés en bas d'un écran large, ils lisaient comme un tiroir de téléphone égaré.

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CSSProperties, UIEvent as ReactUIEvent } from 'react'
import { useParams } from 'react-router-dom'
import { useBuyerReception, useBuyerReactionMutation, type ReceptionBien } from '@/hooks/useBuyerReception'
import { MLK } from '@/components/kyc-magic-link/mlkTokens'
// ⛔ LES PRIMITIVES, PAS SEULEMENT LES JETONS. Cette page avait le dégradé, l'encre et
// Manrope — donc « les bonnes couleurs » — mais ni la marque ni le pied. À côté de
// `/kyc/:token`, elle ne ressemblait pas à la même maison. Prendre les jetons sans la
// composition, c'est refaire la direction de mémoire.
import { MlkBackground, MlkShell, MlkWordmark, MlkFooter } from '@/components/kyc-magic-link/MlkPrimitives'
import { crmVoileEncre } from '@/components/crm/tokens'

/** Alias local : `fontFamily` est écrit une dizaine de fois, et `MLK.font` y allongerait chaque ligne sans rien dire de plus. */
const FONT = MLK.font

/**
 * ⛔ CLÉS STABLES, PAS DES LIBELLÉS. Ces motifs partent dans `reaction_motif`
 * (table `matches`) via l'edge `buyer-reception-react` : traduits, ils auraient
 * stocké « Zu teuer » pour un client alémanique et « Trop cher » pour un romand.
 * ⚠ Sans migration parce que la colonne est VIDE — 1 775 matches, 0 motif au
 * 17 août 2026.
 */
const MOTIFS = ['price', 'area', 'light', 'size', 'timing', 'other'] as const
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
const blackBtn = (extra?: CSSProperties): CSSProperties => ({ width: '100%', height: 52, borderRadius: 999, border: 0, cursor: 'pointer', background: MLK.accent, color: '#fff', fontSize: 'var(--crm-text-xl)', fontWeight: 600, letterSpacing: -0.2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-lg)', boxShadow: `0 8px 20px ${crmVoileEncre(false, 0.20)}`, fontFamily: FONT, ...extra })
const ghostBtn = (extra?: CSSProperties): CSSProperties => ({ height: 52, borderRadius: 999, border: 0, cursor: 'pointer', background: MLK.cardSubtle, color: MLK.inkSoft, fontSize: 'var(--crm-text-xl)', fontWeight: 600, letterSpacing: -0.2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-sm)', fontFamily: FONT, ...extra })
const KEYFRAMES = `@keyframes rcUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes rcFade{from{opacity:0}to{opacity:1}}
@keyframes rcSheet{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes rcPop{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
.rc-scroll::-webkit-scrollbar{display:none}
@media (prefers-reduced-motion: reduce){*{animation-duration:.001ms!important}}

/* ── Le fil, en colonne de téléphone par défaut ──────────────────────────── */
.rc-shell{max-width:480px;margin:0 auto;position:relative;min-height:100dvh}
.rc-cartes{display:flex;flex-direction:column;gap:18px;padding:var(--crm-space-2xs) 18px 0}
/* Les trois panneaux : des feuilles qui remontent du bas. */
.rc-panneau{position:fixed;inset:0;max-width:480px;margin:0 auto}
.rc-feuille{position:absolute;left:0;right:0;bottom:0}
.rc-feuille-haute{top:40px}

/* ── AU BUREAU ────────────────────────────────────────────────────────────
   ⛔ CE N'EST PAS « LA MÊME PAGE PLUS LARGE ». Une sélection de biens se
   COMPARE : en colonne unique sur 1400 px, on fait défiler pour tenir deux
   cartes en tête, ce que la grille donne d'un regard. C'est ce qui distingue
   cette surface de /kyc/:token, qui est un document qu'on LIT et reste donc
   en colonne.

   ⚠ auto-fill + minmax, pas un nombre de colonnes figé : la grille rend 2
   ou 3 cartes selon la place, sans point de rupture supplémentaire à tenir.

   ⚠ LES PANNEAUX CESSENT D'ÊTRE DES FEUILLES. Collés en bas d'un écran large,
   ils lisent comme un tiroir de téléphone égaré ; centrés, ce sont des modales.
   Leurs coins s'arrondissent des quatre côtés — une feuille n'arrondit que le
   haut parce que le bas sort de l'écran, ce qui n'est plus vrai au centre. */
@media (min-width:768px){
  .rc-shell{max-width:1040px}
  .rc-cartes{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));padding:var(--crm-space-2xs) var(--crm-space-6xl) 0}
  .rc-panneau{max-width:none;display:grid;place-items:center;padding:var(--crm-space-6xl)}
  .rc-feuille{position:relative;inset:auto;width:100%;max-width:560px;border-radius:28px!important;
    max-height:calc(100dvh - 64px);animation-name:rcPop!important}
  .rc-feuille-haute{top:auto;max-height:calc(100dvh - 64px)}
}`

type UiStatus = 'liked' | 'rejected' | null

export default function BuyerReceptionPage() {
  const { t } = useTranslation('kyc')
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

  const detailBien = detailId ? items.find((b) => b.match_id === detailId) ?? null : null
  const rejectBien = rejectId ? items.find((b) => b.match_id === rejectId) ?? null : null

  const stage: CSSProperties = { minHeight: '100dvh', background: MLK.bgGradient, fontFamily: FONT, color: MLK.ink, fontVariantNumeric: 'tabular-nums' }

  // ── États lien invalide / expiré / chargement ──
  //
  // ⚠ CES DEUX ÉTATS-LÀ SONT DES DOCUMENTS, PAS L'APPLICATION : rien ne défile, rien ne
  // s'actionne. Ils prennent donc la composition canonique en entier — celle de
  // `DesinscriptionPage` et de `/kyc/:token`. C'est le fil principal qui ne peut pas la
  // prendre, et le pourquoi est écrit en tête de fichier.
  if (isLoading) {
    return (
      <MlkBackground>
        <MlkShell width={480} pad={40}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--crm-space-4xl)' }}><MlkWordmark size={16} /></div>
          <p style={{ margin: 0, textAlign: 'center', color: MLK.muted, fontSize: 'var(--crm-text-lg)', fontWeight: 600 }}>{t('client.reception.loading')}</p>
        </MlkShell>
      </MlkBackground>
    )
  }
  if (isError || !data || data.ok === false) {
    const expired = data?.reason === 'expired'
    return (
      <MlkBackground>
        <MlkShell width={480} pad={40}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--crm-space-4xl)' }}><MlkWordmark size={16} /></div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: MLK.ink, letterSpacing: -0.4 }}>{t(expired ? 'client.reception.expired_title' : 'client.reception.invalid_title')}</div>
            <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: MLK.muted, marginTop: 'var(--crm-space-lg)', lineHeight: 1.55 }}>
              {t('client.reception.invalid_body')}
            </div>
          </div>
          <MlkFooter />
        </MlkShell>
      </MlkBackground>
    )
  }

  return (
    <div style={stage}>
      <style>{KEYFRAMES}</style>
      <div className="rc-shell">
        <div className="rc-scroll" style={{ paddingTop: 'var(--crm-space-6xl)', paddingBottom: 128 }}>
          {/* ⚠ LA MARQUE ET SA MENTION, dans le couple `space-between` de la maison —
              le même qu'en tête de `/kyc/:token`. La mention de lien privé traînait
              tout en BAS de la page, orpheline ; elle appartient ici, à côté du
              logotype qu'elle qualifie. */}
          <div style={{ padding: '0 var(--crm-space-4xl)', marginBottom: 'var(--crm-space-6xl)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--crm-space-lg)' }}>
            <MlkWordmark size={18} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', padding: 'var(--crm-space-2xs) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: MLK.cardSubtle, fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: MLK.muted, whiteSpace: 'nowrap' }}>
              <Icon d={ICO.lock} size={13} stroke={MLK.muted} /> {t('client.reception.private_link')}
            </span>
          </div>

          {/* En-tête conseiller */}
          <div style={{ padding: '0 var(--crm-space-5xl) var(--crm-space-xs)', animation: 'rcUp .5s cubic-bezier(.2,.8,.2,1) both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)' }}>
              {agent?.avatar
                ? <img src={agent.avatar} alt={agent.name} referrerPolicy="no-referrer" style={{ width: 56, height: 56, borderRadius: 999, objectFit: 'cover', flexShrink: 0, boxShadow: MLK.shadowSm, background: MLK.cardSubtle }} />
                : <span style={{ width: 56, height: 56, borderRadius: 999, flexShrink: 0, display: 'grid', placeItems: 'center', background: MLK.ink, color: '#fff', fontSize: 'var(--crm-text-3xl)', fontWeight: 600 }}>{(agent?.name || '?').split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}</span>}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: MLK.ink, letterSpacing: -0.4 }}>{agent?.name || t('client.reception.adviser')}</div>
                <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: MLK.muted, marginTop: 2 }}>{t('client.reception.adviser')}{agent?.agency ? ' · ' + agent.agency : ''}</div>
              </div>
            </div>
            <div style={{ marginTop: 'var(--crm-space-2xl)', background: MLK.card, borderRadius: 18, boxShadow: MLK.shadow, padding: 'var(--crm-space-2xl) var(--crm-space-4xl)' }}>
              <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, lineHeight: 1.55, color: MLK.inkSoft }}>
                {t('client.reception.greeting', { firstName: data.contact.firstName || '' })}
              </div>
            </div>
          </div>

          {/* Progression */}
          <div style={{ padding: 'var(--crm-space-6xl) var(--crm-space-5xl) var(--crm-space-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h1 style={{ margin: 0, fontSize: 'var(--crm-text-5xl)', fontWeight: 600, letterSpacing: -0.7, color: MLK.ink }}>{t('client.reception.selection_title')}</h1>
              <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: MLK.muted }}>{t('client.reception.progress', { treated, total })}</span>
            </div>
            <div style={{ marginTop: 'var(--crm-space-xl)', height: 5, borderRadius: 999, background: crmVoileEncre(false, 0.07), overflow: 'hidden' }}>
              <div style={{ height: '100%', width: (total ? (treated / total) * 100 : 0) + '%', background: MLK.ink, borderRadius: 999, transition: 'width .45s cubic-bezier(.2,.8,.2,1)' }} />
            </div>
          </div>

          {/* Cartes */}
          <div className="rc-cartes">
            {items.map((b, i) => {
              const st = statusOf(b)
              const p = priceOf(b)
              return (
                <div key={b.match_id} style={{ background: MLK.card, borderRadius: 22, boxShadow: MLK.shadow, overflow: 'hidden', animation: `rcUp .5s cubic-bezier(.2,.8,.2,1) ${(0.06 + i * 0.07).toFixed(2)}s both` }}>
                  <button onClick={() => setDetailId(b.match_id)} style={{ display: 'block', width: '100%', border: 0, padding: 0, cursor: 'pointer', background: 'none', position: 'relative', textAlign: 'left' }}>
                    <div style={{ position: 'relative', height: 208, background: MLK.cardSubtle, opacity: st === 'rejected' ? 0.5 : 1, transition: 'opacity .3s' }}>
                      {b.photos[0] && <img src={b.photos[0]} alt={b.title} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                      {b.photos.length > 0 && (
                        <span style={{ position: 'absolute', bottom: 14, right: 14, height: 26, padding: '0 var(--crm-space-xl)', borderRadius: 999, background: crmVoileEncre(false, 0.66), color: '#fff', fontSize: 'var(--crm-text-xs)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)' }}>
                          <Icon d={ICO.camera} size={13} stroke="#fff" sw={1.7} /> {b.photos.length}
                        </span>
                      )}
                    </div>
                  </button>
                  <div style={{ padding: 'var(--crm-space-2xl) var(--crm-space-4xl) var(--crm-space-4xl)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--crm-space-xl)' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: MLK.ink, letterSpacing: -0.4 }}>{b.title}</div>
                        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: MLK.muted, marginTop: 3 }}>{[b.quartier, b.rooms != null ? t('client.reception.rooms', { count: b.rooms }) : null, b.area != null ? b.area + ' m²' : null].filter(Boolean).join(' · ')}</div>
                      </div>
                      <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: MLK.ink, letterSpacing: -0.4, whiteSpace: 'nowrap', flexShrink: 0 }}>{p ? fmtCHF(p) : '—'}{b.transaction === 'location' && p ? <span style={{ fontSize: 'var(--crm-text-sm)', color: MLK.muted }}>{t('client.reception.per_month')}</span> : null}</div>
                    </div>
                    {!st ? (
                      <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-2xl)' }}>
                        <button onClick={() => openReject(b.match_id)} style={ghostBtn({ flex: '0 0 auto', width: 56, padding: 0 })} aria-label={t('client.reception.reject_aria')}><Icon d={ICO.x} size={20} stroke={MLK.inkSoft} /></button>
                        <button onClick={() => like(b.match_id)} style={blackBtn({ flex: 1, height: 52 })}><Icon d={ICO.heart} size={19} stroke="#fff" fill="#fff" sw={1.4} /> {t('client.reception.interested')}</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--crm-space-xl)', marginTop: 'var(--crm-space-2xl)' }}>
                        {st === 'liked'
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 40, padding: '0 var(--crm-space-2xl)', borderRadius: 999, background: MLK.ink, color: '#fff', fontSize: 'var(--crm-text-md)', fontWeight: 600 }}><Icon d={ICO.heart} size={15} stroke="#fff" fill="#fff" sw={1.4} /> {t('client.reception.interested_done')}</span>
                          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 40, padding: '0 var(--crm-space-2xl)', borderRadius: 999, background: MLK.cardSubtle, color: MLK.muted, fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{t('client.reception.rejected')}{motifOf(b) ? ' · ' + t(`client.reception.motifs.${motifOf(b)}`) : ''}</span>}
                        <button onClick={() => backTo(b.match_id)} style={{ border: 0, background: 'none', cursor: 'pointer', color: MLK.inkSoft, fontSize: 'var(--crm-text-md)', fontWeight: 600, padding: 'var(--crm-space-sm) var(--crm-space-sm)', fontFamily: FONT }}>{t('client.reception.back')}</button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {total > 0 && treated === total && (
            <div style={{ padding: 'var(--crm-space-6xl) var(--crm-space-4xl) 0' }}>
              <button onClick={() => setDone(true)} style={blackBtn()}>{t('client.reception.see_summary')}</button>
            </div>
          )}

          {/* ⚠ LE PIED LÉGAL MANQUAIT ENTIÈREMENT. Mentions légales et confidentialité
              sont sur toutes les autres surfaces clientes ; cette page — qui porte des
              biens et une identité de contact — n'en avait aucune. */}
          <div style={{ padding: '0 var(--crm-space-4xl)' }}>
            <MlkFooter />
          </div>
        </div>

        {/* Feuille détail */}
        {detailBien && <ReceptionDetail bien={detailBien} status={statusOf(detailBien)} motif={motifOf(detailBien)} onClose={() => setDetailId(null)} onLike={() => like(detailBien.match_id)} onReject={() => openReject(detailBien.match_id)} onBack={() => backTo(detailBien.match_id)} />}
        {/* Feuille motif */}
        {rejectBien && <ReceptionReject onClose={() => setRejectId(null)} onConfirm={(m, n) => confirmReject(rejectBien.match_id, m, n)} />}
        {/* Récap */}
        {done && <ReceptionDone liked={liked} total={total} contactFirst={data.contact.firstName} agent={agent} onReview={() => setDone(false)} />}
      </div>
    </div>
  )
}

// ── Feuille détail ──────────────────────────────────────────────────────
function ReceptionDetail({ bien, status, motif, onClose, onLike, onReject, onBack }: { bien: ReceptionBien; status: UiStatus; motif: string | null; onClose: () => void; onLike: () => void; onReject: () => void; onBack: () => void }) {
  const { t } = useTranslation('kyc')
  const [pi, setPi] = useState(0)
  const p = priceOf(bien)
  const isRent = bien.transaction === 'location'
  const facts: Array<{ k: string; v: string }> = [
    bien.rooms != null ? { k: t('client.reception.fact_rooms'), v: String(bien.rooms) } : null,
    bien.area != null ? { k: t('client.reception.fact_area'), v: bien.area + ' m²' } : null,
    bien.floor != null ? { k: t('client.reception.fact_floor'), v: String(bien.floor) } : null,
    bien.year != null ? { k: t('client.reception.fact_year'), v: String(bien.year) } : null,
    bien.charges != null ? { k: t('client.reception.fact_charges'), v: fmtCHF(bien.charges) + t('client.reception.per_month') } : null,
    bien.price_per_m2 != null ? { k: t(isRent ? 'client.reception.fact_rent_m2' : 'client.reception.fact_price_m2'), v: fmtCHF(bien.price_per_m2) } : null,
  ].filter((f): f is { k: string; v: string } => !!f)
  const onScroll = (e: ReactUIEvent<HTMLDivElement>) => { const w = e.currentTarget.clientWidth || 1; setPi(Math.round(e.currentTarget.scrollLeft / w)) }

  return (
    <div className="rc-panneau" style={{ zIndex: 40 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: crmVoileEncre(false, 0.38), backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'rcFade .25s ease both' }} />
      <div className="rc-feuille rc-feuille-haute" style={{ background: MLK.card, borderRadius: '28px 28px 0 0', boxShadow: MLK.sheetShadow, overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'rcSheet .38s cubic-bezier(.2,.85,.25,1) both' }}>
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 40, height: 5, borderRadius: 999, background: crmVoileEncre(false, 0.14), zIndex: 3 }} />
        <button onClick={onClose} aria-label={t('client.reception.close')} style={{ position: 'absolute', top: 16, right: 16, zIndex: 3, width: 36, height: 36, borderRadius: 999, border: 0, cursor: 'pointer', background: 'rgba(255,255,255,.9)', boxShadow: MLK.shadowSm, display: 'grid', placeItems: 'center' }}><Icon d={ICO.x} size={17} stroke={MLK.ink} /></button>
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
              <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 'var(--crm-space-sm)' }}>
                {bien.photos.map((_, i) => <span key={i} style={{ width: i === pi ? 20 : 6, height: 6, borderRadius: 999, background: i === pi ? '#fff' : 'rgba(255,255,255,.6)', transition: 'width .25s' }} />)}
              </div>
            )}
          </div>
          <div style={{ padding: 'var(--crm-space-5xl) var(--crm-space-6xl) var(--crm-space-xl)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--crm-space-2xl)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 600, color: MLK.ink, letterSpacing: -0.6 }}>{bien.title}</div>
                <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: MLK.muted, marginTop: 'var(--crm-space-xs)' }}>{bien.addr}</div>
              </div>
              <div style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 600, color: MLK.ink, letterSpacing: -0.6, whiteSpace: 'nowrap' }}>{p ? fmtCHF(p) : '—'}</div>
            </div>
            {facts.length > 0 && (
              <div style={{ marginTop: 'var(--crm-space-4xl)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--crm-space-lg)' }}>
                {facts.map((f) => (
                  <div key={f.k} style={{ background: MLK.cardSubtle, borderRadius: 14, padding: 'var(--crm-space-xl) var(--crm-space-xl)' }}>
                    <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: MLK.muted }}>{f.k}</div>
                    <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: MLK.ink, marginTop: 'var(--crm-space-xs)', letterSpacing: -0.3 }}>{f.v}</div>
                  </div>
                ))}
              </div>
            )}
            {bien.desc && <div style={{ marginTop: 'var(--crm-space-5xl)', fontSize: 'var(--crm-text-lg)', fontWeight: 500, lineHeight: 1.6, color: MLK.inkSoft }}>{bien.desc}</div>}
            {bien.features.length > 0 && (
              <div style={{ marginTop: 'var(--crm-space-4xl)', display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-sm)' }}>
                {bien.features.map((f) => <span key={f} style={{ display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 var(--crm-space-2xl)', borderRadius: 999, background: MLK.cardSubtle, color: MLK.inkSoft, fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>{f}</span>)}
              </div>
            )}
            <div style={{ height: 12 }} />
          </div>
        </div>
        <div style={{ flexShrink: 0, padding: 'var(--crm-space-xl) var(--crm-space-4xl) calc(var(--crm-space-xl) + env(safe-area-inset-bottom))', background: MLK.card, boxShadow: `0 -8px 24px ${crmVoileEncre(false, 0.05)}` }}>
          {!status ? (
            <div style={{ display: 'flex', gap: 'var(--crm-space-lg)' }}>
              <button onClick={onReject} style={ghostBtn({ flex: '0 0 auto', width: 58, padding: 0 })} aria-label={t('client.reception.reject')}><Icon d={ICO.x} size={21} stroke={MLK.inkSoft} /></button>
              <button onClick={onLike} style={blackBtn({ flex: 1 })}><Icon d={ICO.heart} size={19} stroke="#fff" fill="#fff" sw={1.4} /> {t('client.reception.interested')}</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--crm-space-xl)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: status === 'liked' ? MLK.ink : MLK.muted }}>
                {status === 'liked'
                  ? <><Icon d={ICO.heart} size={17} stroke={MLK.ink} fill={MLK.ink} sw={1.4} /> {t('client.reception.interested_done')}</>
                  : t('client.reception.rejected') + (motif ? ' · ' + t(`client.reception.motifs.${motif}`) : '')}
              </span>
              <button onClick={onBack} style={ghostBtn({ padding: '0 var(--crm-space-4xl)', height: 44 })}>{t('client.reception.back')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Feuille motif d'écartement ──────────────────────────────────────────
function ReceptionReject({ onClose, onConfirm }: { onClose: () => void; onConfirm: (motif: string | null, note: string | null) => void }) {
  const { t } = useTranslation('kyc')
  const [motif, setMotif] = useState<string | null>(null)
  const [note, setNote] = useState('')
  return (
    <div className="rc-panneau" style={{ zIndex: 50 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: crmVoileEncre(false, 0.42), backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'rcFade .25s ease both' }} />
      <div className="rc-feuille" style={{ background: MLK.card, borderRadius: '28px 28px 0 0', boxShadow: MLK.sheetShadow, padding: 'var(--crm-space-6xl) var(--crm-space-6xl) calc(var(--crm-space-5xl) + env(safe-area-inset-bottom))', animation: 'rcSheet .36s cubic-bezier(.2,.85,.25,1) both' }}>
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 40, height: 5, borderRadius: 999, background: crmVoileEncre(false, 0.14) }} />
        <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: MLK.ink, letterSpacing: -0.5, marginTop: 'var(--crm-space-sm)' }}>{t('client.reception.reject_title')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-sm)', marginTop: 'var(--crm-space-4xl)' }}>
          {MOTIFS.map((m) => {
            const on = motif === m
            return <button key={m} onClick={() => setMotif(on ? null : m)} aria-pressed={on} style={{ height: 40, padding: '0 var(--crm-space-2xl)', borderRadius: 999, border: 0, cursor: 'pointer', fontSize: 'var(--crm-text-md)', fontWeight: 600, fontFamily: FONT, background: on ? MLK.accent : MLK.cardSubtle, color: on ? '#fff' : MLK.inkSoft, transition: 'background .15s, color .15s' }}>{m}</button>
          })}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('client.reception.reject_note_placeholder')} rows={2}
          style={{ marginTop: 'var(--crm-space-2xl)', width: '100%', resize: 'none', borderRadius: 14, border: 0, background: MLK.cardSubtle, padding: 'var(--crm-space-xl) var(--crm-space-2xl)', fontFamily: FONT, fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: MLK.ink, outline: 'none', boxShadow: 'inset 0 0 0 1px ' + MLK.line, boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-2xl)' }}>
          <button onClick={onClose} style={ghostBtn({ flex: 1 })}>{t('client.reception.cancel')}</button>
          <button onClick={() => onConfirm(motif, note.trim() || null)} style={blackBtn({ flex: 1.4 })}>{t('client.reception.reject_confirm')}</button>
        </div>
      </div>
    </div>
  )
}

// ── Écran de fin ────────────────────────────────────────────────────────
function ReceptionDone({ liked, total, contactFirst, agent, onReview }: { liked: ReceptionBien[]; total: number; contactFirst: string; agent: { name: string; phone: string | null } | null | undefined; onReview: () => void }) {
  const { t } = useTranslation('kyc')
  const rejected = total - liked.length
  const firstName = agent?.name?.split(' ')[0] || 'votre conseiller'
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: MLK.bgGradient, animation: 'rcFade .3s ease both', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', fontFamily: FONT, width: '100%' }}>
      <div className="rc-scroll" style={{ flex: 1, overflowY: 'auto', padding: '72px var(--crm-space-6xl) 28px', textAlign: 'center' }}>
        <div style={{ width: 68, height: 68, borderRadius: 999, background: MLK.ink, margin: '0 auto', display: 'grid', placeItems: 'center', boxShadow: `0 12px 30px ${crmVoileEncre(false, 0.25)}`, animation: 'rcPop .5s cubic-bezier(.2,.9,.3,1) both' }}><Icon d={ICO.check} size={30} stroke="#fff" sw={2.2} /></div>
        <h1 style={{ margin: 'var(--crm-space-5xl) 0 0', fontSize: 'var(--crm-text-5xl)', fontWeight: 600, letterSpacing: -0.8, color: MLK.ink }}>Merci {contactFirst} !</h1>
        <p style={{ margin: 'var(--crm-space-lg) auto 0', maxWidth: 300, fontSize: 'var(--crm-text-lg)', fontWeight: 500, lineHeight: 1.55, color: MLK.inkSoft }}>
          Vos réponses sont transmises à {agent?.name || 'votre conseiller'}.
        </p>
        <div style={{ marginTop: 26, background: MLK.card, borderRadius: 20, boxShadow: MLK.shadow, padding: 'var(--crm-space-4xl) var(--crm-space-4xl) var(--crm-space-lg)', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', marginBottom: 'var(--crm-space-xs)' }}>
            <Icon d={ICO.heart} size={16} stroke={MLK.ink} fill={MLK.ink} sw={1.4} />
            <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: MLK.ink }}>{liked.length === 0 ? t('client.reception.none_kept') : t('client.reception.liked', { count: liked.length })}</span>
          </div>
          {liked.map((b) => (
            <div key={b.match_id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-lg) 0', borderTop: '1px solid ' + MLK.line }}>
              {b.photos[0] && <img src={b.photos[0]} alt="" referrerPolicy="no-referrer" style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', flexShrink: 0, background: MLK.cardSubtle }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: MLK.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}{b.quartier ? ' · ' + b.quartier : ''}</div>
                <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: MLK.muted, marginTop: 2 }}>{priceOf(b) ? fmtCHF(priceOf(b) as number) : '—'}</div>
              </div>
            </div>
          ))}
        </div>
        {rejected > 0 && <div style={{ marginTop: 'var(--crm-space-xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: MLK.muted }}>{t('client.reception.rejected_count', { count: rejected })}</div>}
      </div>
      <div style={{ flexShrink: 0, padding: 'var(--crm-space-xl) var(--crm-space-4xl) calc(var(--crm-space-2xl) + env(safe-area-inset-bottom))' }}>
        {agent?.phone && <a href={'tel:' + agent.phone.replace(/\s+/g, '')} style={{ ...blackBtn(), textDecoration: 'none', marginBottom: 'var(--crm-space-lg)' }}><Icon d={ICO.phone} size={17} stroke="#fff" /> Appeler {firstName}</a>}
        <button onClick={onReview} style={ghostBtn({ width: '100%' })}>{t('client.reception.review')}</button>
      </div>
    </div>
  )
}
