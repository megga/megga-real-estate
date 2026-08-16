// Atelier Matching — mode « Par acheteur » (pivot inversé, handoff §6.8).
// Col 1 : file de biens scorés · Col 2 : profil de recherche · Col 3 :
// pourquoi ce bien. Mêmes gestes (E/X/P, J/K, Backspace), état de triage
// local au composant (comme la maquette) ; l'exécution réelle passe par les
// handles différés du parent (undo 5 s avant toute écriture).

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AtlIcon from './AtlIcon'
import AtlConfirm from './AtlConfirm'
import { SGA_KYC } from './constants'
import { fmtM, atlFmtCHF, atlInitials, atlReturnDate, atlScoreColor } from './format'
import { isSnoozed } from '@/hooks/useAtelierMatching'
import type { AtelierBuyer, AtelierPoolMatch, TriageKind } from './types'
import type { AtelierGestes, PendingHandle } from './pendingTriage'
import { encreSur } from '@/components/megga-x-crm/tokens'

/* ── Col 1 · rangée bien ─────────────────────────────────────────────── */
function SgbLRow({ m, selected, exiting, onClick }: {
  m: AtelierPoolMatch
  selected: boolean
  exiting: string | null
  onClick: () => void
}) {
  const ph = m.L.gallery[0]
  return (
    <div className={'sgb-lrow' + (exiting ? ` exit-${exiting}` : '')} data-sel={selected} onClick={onClick}>
      <span className="flash" />
      <div className="th">{ph?.url ? <img src={ph.url} alt="" draggable="false" /> : null}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="nm">{m.L.title}</div>
        <div className="sub nums">{atlFmtCHF(m.L.price)} · {m.L.rooms ?? '—'} p · {m.L.area ?? '—'} m²</div>
      </div>
      <span className="sc nums" style={{ color: atlScoreColor(m.score) }}>{m.score}</span>
    </div>
  )
}

/* ── Col 2 · profil de recherche (pivot) ─────────────────────────────── */
function SgbProfile({ b }: { b: AtelierBuyer }) {
  const { t } = useTranslation('matching')
  const kyc = SGA_KYC[b.kyc]
  const c = b.criteria
  const rows: Array<{ lb: string; vl: string }> = []
  if (c?.budget_min && c?.budget_max) rows.push({ lb: t('atelier.budget'), vl: `CHF ${fmtM(c.budget_min)} – ${fmtM(c.budget_max)}` })
  else if (c?.budget_max) rows.push({ lb: t('atelier.budget'), vl: `≤ CHF ${fmtM(c.budget_max)}` })
  if (c?.zones?.length) rows.push({ lb: t('atelier.targetZones'), vl: c.zones.join(' · ') })
  if (c?.surface_min) rows.push({ lb: t('atelier.minSurface'), vl: `${c.surface_min} m²` })
  if (c?.rooms_min) rows.push({ lb: t('atelier.specRooms'), vl: c.rooms_max ? `${c.rooms_min} – ${c.rooms_max}` : `${c.rooms_min}+` })
  if (c?.type) rows.push({ lb: t('atelier.type'), vl: c.type })

  return (
    <section className="sga-panel sga-enter d1" aria-label={t('atelier.searchProfile')}>
      <div className="sgb-pivot-scroll">
        <div className="sgb-id">
          <div className="av" style={{ width: 72, height: 72, background: b.av, color: encreSur(b.av), fontSize: 'var(--crm-text-5xl)', boxShadow: `0 0 0 6px ${b.av}1c` }}>
            {atlInitials(b.first, b.last)}
          </div>
          <div>
            <div className="t5 semi" style={{ color: 'var(--ink)' }}>{b.first} {b.last}</div>
            <div className="t1 muted" style={{ marginTop: 4 }}>{b.type} · {b.zone}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span className={`chip sm tone-${kyc.tone}`}><AtlIcon d="shield" size={12} /> {kyc.label}</span>
            <span className="chip sm">{b.engage}</span>
          </div>
        </div>

        <div className="sga-aicard">
          <span className="spark"><AtlIcon d="sparkle" size={15} /></span>
          <div style={{ flex: 1 }}>
            <div className="t1 semi" style={{ marginBottom: 2, color: 'var(--ink)' }}>MEGGA AI</div>
            <div className="t1 soft" style={{ lineHeight: 1.5 }}>{b.ai}</div>
          </div>
        </div>

        {rows.length > 0 && (
          <div>
            <span className="eyebrow">{t('atelier.activeSearch')}</span>
            <div className="sgb-crit" style={{ marginTop: 8 }}>
              {rows.map(r => (
                <div className="row" key={r.lb}>
                  <span className="lb">{r.lb}</span>
                  <span className="vl nums">{r.vl}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

/* ── Col 3 · pourquoi ce bien matche ─────────────────────────────────── */
function SgbWhyBien({ m, onSend, onSkip, onLater }: {
  m: AtelierPoolMatch
  onSend: () => void
  onSkip: () => void
  onLater: () => void
}) {
  const { t } = useTranslation('matching')
  const L = m.L
  const reasons = [...m.reasons].sort((a, z) => Number(z.ok) - Number(a.ok) || z.pts - a.pts)
  const posSum = m.reasons.filter(r => r.ok).reduce((s, r) => s + r.pts, 0)
  const negSum = m.reasons.filter(r => !r.ok).reduce((s, r) => s + Math.abs(r.pts), 0)
  const ph = L.gallery[0]
  return (
    <div className="sga-why-anim" key={m.lid}>
      <div className="sgb-hero">
        {ph?.url ? <img src={ph.url} alt={L.title} draggable="false" /> : null}
        {m.current && <span className="sgb-current chip sm">{t('atelier.currentListing')}</span>}
      </div>
      <div className="sga-why-head" style={{ paddingTop: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t4 semi" style={{ color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {L.title}
          </div>
          <div className="t1 muted nums" style={{ marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {atlFmtCHF(L.price)} · {L.rooms != null ? t('atelier.roomsCount', { count: L.rooms }) : t('atelier.roomsLabel', { value: '—' })} · {L.area ?? '—'} m² · {L.quartier}
          </div>
        </div>
        <div className="sga-bigscore" title={t('atelier.compatibilityScoreEst')}>
          <span className="v nums" style={{ color: atlScoreColor(m.score) }}>{m.score}</span>
          <span className="pct">/100</span>
        </div>
      </div>

      <div className="sga-gauge"><i style={{ width: `${m.score}%` }} /></div>

      <div className="sga-why-scroll">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
            <span className="eyebrow">{t('atelier.whyMatchesCriteria', { count: m.reasons.length })}</span>
            <span style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
              <span className="sga-sumpill pos">+{posSum}</span>
              {negSum > 0 && <span className="sga-sumpill neg">−{negSum}</span>}
            </span>
          </div>
          <div className="sga-reasons">
            {reasons.map((r, i) => (
              <div className={`sga-reason ${r.ok ? 'pos' : 'neg'}`} key={i}>
                <span className="lbl">{r.label}<em>{r.detail}</em></span>
                <span className="pts nums">{r.pts > 0 ? '+' : ''}{r.pts}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="sga-triage">
        <div className="btns" data-cols="3">
          <button className="btn btn-ghost" onClick={onSkip}>
            <AtlIcon d="close" size={16} /> {t('atelier.dismiss')}
          </button>
          <button className="btn btn-ghost" onClick={onLater}>
            <AtlIcon d="clock" size={16} /> {t('atelier.later')}
          </button>
          <button className="btn btn-primary" onClick={onSend}>
            {t('common:actions.send')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Racine du mode acheteur (3 colonnes, état de triage propre) ──────── */
interface AtlAcheteurModeProps {
  b: AtelierBuyer
  pool: AtelierPoolMatch[]
  gestes: AtelierGestes
  onOpenDeal: (dealId: string | null) => void
}

interface SgbToast {
  msg: string
  deal: boolean
  key: number
  handle: PendingHandle | null
}

export default function AtlAcheteurMode({ b, pool, gestes, onOpenDeal }: AtlAcheteurModeProps) {
  const { t } = useTranslation('matching')
  const [processed, setProcessed] = useState<Record<string, TriageKind>>({})
  const [laterInfo, setLaterInfo] = useState<Record<string, string>>({})
  const [history, setHistory] = useState<string[]>([])
  const [exiting, setExiting] = useState<{ id: string; dir: string } | null>(null)
  const [toast, setToast] = useState<SgbToast | null>(null)
  const [confirmLid, setConfirmLid] = useState<string | null>(null)
  const handles = useRef(new Map<string, PendingHandle>())
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const open = pool.filter(m => !processed[m.lid] && !isSnoozed(m.snoozedUntil))
  const dbSnoozed = pool.filter(m => !processed[m.lid] && isSnoozed(m.snoozedUntil))
  const [selLid, setSelLid] = useState<string | null>(open.length ? open[0].lid : null)
  const selected = open.find(m => m.lid === selLid) ?? open[0] ?? null

  useEffect(() => {
    if (open.length && !open.some(m => m.lid === selLid)) setSelLid(open[0].lid)
  }, [processed]) // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = (msg: string, deal: boolean, handle: PendingHandle | null) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, deal, key: Date.now(), handle })
    toastTimer.current = setTimeout(() => setToast(null), 4200)
  }

  const triage = useCallback((lid: string, kind: TriageKind) => {
    if (exitTimer.current) return
    const m = pool.find(x => x.lid === lid)
    if (!m) return
    const idx = open.findIndex(x => x.lid === lid)
    const rest = open.filter(x => x.lid !== lid)
    const nxt = rest.length ? (open[idx + 1] ?? rest[rest.length - 1]).lid : null
    const ret = kind === 'later' ? atlReturnDate() : null

    // Écriture différée (annulable pendant le toast)
    const handle =
      kind === 'sent' ? gestes.send(m.matchId)
      : kind === 'later' ? gestes.snooze(m.matchId)
      : gestes.dismiss(m.matchId)
    handles.current.set(lid, handle)

    setExiting({ id: lid, dir: kind === 'sent' ? 'send' : kind === 'later' ? 'later' : 'skip' })
    exitTimer.current = setTimeout(() => {
      setProcessed(p => ({ ...p, [lid]: kind }))
      if (ret) setLaterInfo(q => ({ ...q, [lid]: ret }))
      setHistory(h => [...h, lid])
      setExiting(null)
      if (nxt) setSelLid(nxt)
      exitTimer.current = null
      showToast(
        kind === 'sent' ? t('atelier.toastSentBuyer', { name: b.first, title: m.L.title })
        : kind === 'later' ? t('atelier.toastLaterListing', { title: m.L.title, date: ret })
        : t('atelier.toastDismissedBuyer', { title: m.L.title, name: b.first }),
        kind === 'sent',
        handle,
      )
    }, 340)
  }, [pool, open, gestes, b.first, t])

  const requestSend = useCallback((lid: string) => {
    if (exitTimer.current) return
    setConfirmLid(lid)
  }, [])

  const undo = useCallback(() => {
    setHistory(h => {
      if (!h.length) return h
      const last = h[h.length - 1]
      handles.current.get(last)?.cancel()
      handles.current.delete(last)
      setProcessed(p => { const q = { ...p }; delete q[last]; return q })
      setLaterInfo(q => { if (!(last in q)) return q; const r = { ...q }; delete r[last]; return r })
      setSelLid(last)
      setToast(null)
      return h.slice(0, -1)
    })
  }, [])

  // Réactiver : session (annule l'écriture différée) ou DB (snoozed_until=null)
  const wake = useCallback((lid: string) => {
    const m = pool.find(x => x.lid === lid)
    if (!m) return
    const handle = handles.current.get(lid)
    if (handle) { handle.cancel(); handles.current.delete(lid) }
    else gestes.wake(m.matchId)
    setProcessed(p => { const q = { ...p }; delete q[lid]; return q })
    setLaterInfo(q => { const r = { ...q }; delete r[lid]; return r })
    setHistory(h => h.filter(x => x !== lid))
    setSelLid(lid)
    showToast(t('atelier.toastBackInQueue', { title: m.L.title }), false, null)
  }, [pool, gestes, t])

  const move = (dir: number) => {
    if (!open.length) return
    const idx = open.findIndex(m => m.lid === selLid)
    const ni = Math.max(0, Math.min(open.length - 1, (idx < 0 ? 0 : idx) + dir))
    setSelLid(open[ni].lid)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmLid) return
      const tag = ((e.target as HTMLElement)?.tagName ?? '').toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      const k = e.key.toLowerCase()
      // ←/→ naviguent (même convention que l'atelier par annonce) : une touche de
      // déplacement ne doit pas écrire un triage.
      if (k === 'e') { e.preventDefault(); if (selected) requestSend(selected.lid) }
      else if (k === 'x') { e.preventDefault(); if (selected) triage(selected.lid, 'skipped') }
      else if (k === 'p') { e.preventDefault(); if (selected) triage(selected.lid, 'later') }
      else if (k === 'j' || e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); move(1) }
      else if (k === 'k' || e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); move(-1) }
      else if (e.key === 'Backspace') { e.preventDefault(); undo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, open, confirmLid, requestSend, triage, undo]) // eslint-disable-line react-hooks/exhaustive-deps

  // Parking : reportés de la session + reportés en base (snoozed_until futur)
  const snoozed: Array<{ m: AtelierPoolMatch; until: string }> = [
    ...history
      .filter(lid => processed[lid] === 'later')
      .map(lid => ({ m: pool.find(x => x.lid === lid), until: laterInfo[lid] ?? '—' }))
      .filter((x): x is { m: AtelierPoolMatch; until: string } => Boolean(x.m)),
    ...dbSnoozed.map(m => ({ m, until: atlReturnDate(m.snoozedUntil ?? undefined) })),
  ]

  const confirmMatch = confirmLid ? pool.find(x => x.lid === confirmLid) : null

  return (
    <>
      {/* ── col 1 · biens matchés ── */}
      <section className="sga-panel sga-enter" aria-label={t('atelier.matchedListings')}>
        <div className="sga-queue-h">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="eyebrow" style={{ whiteSpace: 'nowrap' }}>{t('atelier.matchedListingsCount', { count: open.length })}</span>
            <span className="t1 dim" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AtlIcon d="sort" size={13} /> {t('atelier.scoreDesc')}
            </span>
          </div>
        </div>
        <div className="sga-queue-list">
          {open.length === 0 && (
            <div className="sga-empty">
              <div>
                <div className="t4 med" style={{ marginBottom: 6, color: 'var(--ink)' }}>{t('atelier.queueProcessed')}</div>
                <div className="t1 muted">{t('atelier.allListingsSorted', { name: b.first })}</div>
              </div>
            </div>
          )}
          {open.map(m => (
            <SgbLRow
              key={m.lid}
              m={m}
              selected={selected != null && m.lid === selected.lid}
              exiting={exiting && exiting.id === m.lid ? exiting.dir : null}
              onClick={() => setSelLid(m.lid)}
            />
          ))}
        </div>
        {snoozed.length > 0 && (
          <div className="sga-snoozed" data-open="true">
            <button className="sga-snoozed-h" style={{ cursor: 'default' }}>
              <AtlIcon d="clock" size={13} />
              <span>{t('atelier.snoozed')}</span>
              <span className="cnt nums">{snoozed.length}</span>
            </button>
            <div className="sga-snoozed-body">
              <div className="inner">
                {snoozed.map(({ m, until }, i) => (
                  <div
                    className="sga-snooze-row"
                    key={m.lid}
                    style={{ animationDelay: `${i * 40}ms` }}
                    onClick={() => wake(m.lid)}
                    title={t('atelier.reactivateNow')}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="nm">{m.L.title}</div>
                      <div className="ret"><AtlIcon d="clock" size={11} /> {t('atelier.backOn', { date: until })}</div>
                    </div>
                    <button className="wake" onClick={e => { e.stopPropagation(); wake(m.lid) }}>{t('atelier.reactivate')}</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── col 2 · profil pivot ── */}
      <SgbProfile b={b} />

      {/* ── col 3 · pourquoi ce bien ── */}
      <section className="sga-panel sga-enter d2" aria-label={t('atelier.whyThisListing')}>
        {selected ? (
          <SgbWhyBien
            m={selected}
            onSend={() => requestSend(selected.lid)}
            onSkip={() => triage(selected.lid, 'skipped')}
            onLater={() => triage(selected.lid, 'later')}
          />
        ) : (
          <div className="sga-empty">
            <div>
              <div className="t4 semi" style={{ marginBottom: 6, color: 'var(--ink)' }}>{t('atelier.queueProcessed')}</div>
              <div className="t1 muted" style={{ maxWidth: 240 }}>
                {t('atelier.allListingsSortedBack', { name: b.first })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── confirmation d'envoi (réutilisée) ── */}
      {confirmMatch && (
        <AtlConfirm
          b={b}
          L={confirmMatch.L}
          onClose={() => setConfirmLid(null)}
          onConfirm={() => { setConfirmLid(null); triage(confirmMatch.lid, 'sent') }}
        />
      )}

      {/* ── toast ── */}
      {toast && (
        <div className="sga-toast" key={toast.key}>
          <span>{toast.msg}</span>
          {toast.deal && (
            <button
              className="undo deal"
              onClick={() => {
                const h = toast.handle
                setToast(null)
                if (!h) return
                void h.flushNow().then(r => onOpenDeal(r?.dealId ?? null))
              }}
            >
              {t('atelier.seeDeal')}
            </button>
          )}
          <button className="undo" onClick={undo}>{t('common:actions.cancel')}</button>
        </div>
      )}
    </>
  )
}
