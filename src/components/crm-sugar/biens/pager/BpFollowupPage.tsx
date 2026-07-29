// MEGGA CRM Sugar v2 — Mes biens · Page 1 « À suivre »
// Port fidèle du handoff Claude Design (crm-screen-biens-proto.jsx, BpFollowupPage).
//
// File d'actions volume-adaptative : charge faible → héro éditorial + listes
// groupées ; charge forte (> 6 actions ou ≥ 3 urgences) → bandeau d'urgences +
// grille dense 2 colonnes. Une ligne = un bien ; clic → fiche du bien.
// Buckets réels : mandats à renouveler + brouillons (diffusion dormante, cf.
// followupData.ts). Rail gauche = filtres par nature.
//
// Note : les blocs répétés (badge, vignette, bouton d'action, ligne, filtre) sont
// des FONCTIONS de rendu (pas des composants déclarés au render) — elles capturent
// le thème/handlers par closure sans réinitialiser d'état (règle static-components).

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import type { CrmBien } from '@/components/crm-sugar/mockData'
import { crmStep, type SugarPalette } from '@/components/crm-sugar/tokens'
import type { GalSurfaces } from '@/components/crm-sugar/biens/gallery/galHelpers'
import { GalPhoto } from '@/components/crm-sugar/biens/gallery/GalleryAtoms'
import { BpRenewModal } from './BpRenewModal'
import { deriveFollowBuckets, expiryLabelKey, type FollowBucket, type FollowBucketId, type FollowRow } from './followupData'

const BUCKET_META: Record<FollowBucketId, { icon: MEIconName; dot: string }> = {
  mandates: { icon: 'calendar', dot: '#1E5BC6' },
  drafts: { icon: 'file', dot: '#6B7280' },
  diffusion: { icon: 'share', dot: '#0891B2' },
}

interface BpFollowupPageProps {
  biens: CrmBien[]
  sp: SugarPalette
  surf: GalSurfaces
  dark: boolean
  now: Date
  /** État de chargement/erreur du chargement des biens — évite d'afficher « Tout
   *  est à jour » pendant un chargement ou une erreur (biens=[] alors). */
  isLoading: boolean
  isError: boolean
  idxEnabled?: boolean
  onOpenBien: (id: string) => void
  onResumeDraft: (b: CrmBien) => void
  /** Gèle le pager tant qu'une modale est ouverte. */
  onFreeze: (frozen: boolean) => void
  /** Refetch après mutation (renew / delete) ET pour réessayer en cas d'erreur. */
  onRefetch?: () => void
}

export function BpFollowupPage({
  biens, sp, surf, dark, now, isLoading, isError, idxEnabled, onOpenBien, onResumeDraft, onFreeze, onRefetch,
}: BpFollowupPageProps) {
  const { t } = useTranslation('listings')
  const [filter, setFilter] = useState<FollowBucketId | null>(null)
  const [renew, setRenew] = useState<{ b: CrmBien; days: number } | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => { onFreeze(!!renew) }, [renew, onFreeze])
  // Sécurité : libère le gel si le composant se démonte modale ouverte.
  useEffect(() => () => onFreeze(false), [onFreeze])

  const buckets = useMemo<FollowBucket[]>(
    () => deriveFollowBuckets(biens, { now, idxEnabled }),
    [biens, now, idxEnabled],
  )

  const orange = dark ? '#D97A1E' : '#C45A00'
  const orangeText = dark ? '#E08A2E' : '#C45A00'

  const total = buckets.reduce((s, g) => s + g.rows.length, 0)
  const mandatBucket = buckets.find((g) => g.id === 'mandates')
  const urgents = mandatBucket ? mandatBucket.rows.filter((r) => r.urgent) : []
  const dense = total > 6 || urgents.length >= 3
  const bandeau = !filter && dense ? urgents.slice(0, 3) : []
  const hero = !filter && !dense && mandatBucket && mandatBucket.rows[0]?.urgent ? mandatBucket.rows[0] : null
  const focusIds = new Set(dense ? bandeau.map((r) => r.b.id) : hero ? [hero.b.id] : [])
  const shownBuckets = (filter ? buckets.filter((g) => g.id === filter) : buckets)
    .map((g) => ({ ...g, rows: g.rows.filter((r) => !focusIds.has(r.b.id)) }))
    .filter((g) => g.rows.length)

  const toggleExp = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }))
  const bucketTitle = (id: FollowBucketId) => t(`biens.followUp.bucket.${id}`)
  // Libellé d'échéance : à venir / aujourd'hui / dépassé (jamais « dans -N j »).
  const expiryText = (days: number): string => {
    const { key, count } = expiryLabelKey(days)
    return t(`biens.followUp.${key}`, { count })
  }
  const rowTagLabel = (id: FollowBucketId, row: FollowRow): string => {
    if (id === 'mandates') return expiryText(row.days ?? 0)
    if (id === 'drafts') return t('biens.followUp.photos', { count: row.b.photoCount })
    return t('biens.followUp.meggaOnly')
  }
  const actionLabel = (id: FollowBucketId) => t(`biens.followUp.action.${id === 'mandates' ? 'renew' : id === 'drafts' ? 'complete' : 'publish'}`)

  // ── Fonctions de rendu (pas de composants au render) ──────────────────────
  const renderTag = (label: string, urgent?: boolean): ReactNode => (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, letterSpacing: -0.1, whiteSpace: 'nowrap', flexShrink: 0, background: urgent ? orange : surf.cardSub, color: urgent ? '#fff' : sp.soft }}>
      {label}
    </span>
  )

  const renderThumb = (b: CrmBien, w = 52, h = 40, r = 9): ReactNode => (
    <div style={{ position: 'relative', width: w, height: h, borderRadius: r, overflow: 'hidden', flexShrink: 0, background: surf.cardSub }}>
      {b.photoCount === 0 ? (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <MEIcon name="home" size={Math.round(w * 0.3)} color={sp.sub} />
        </div>
      ) : (
        <GalPhoto id={b.id} src={b.coverPhoto} dark={dark} radius={r} />
      )}
    </div>
  )

  const renderActBtn = (bucketId: FollowBucketId, b: CrmBien, days?: number): ReactNode => {
    const isMandat = bucketId === 'mandates'
    const onClick = (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isMandat) setRenew({ b, days: days ?? 0 })
      else if (bucketId === 'drafts') onResumeDraft(b)
      else onOpenBien(b.id)
    }
    return (
      <button
        onClick={onClick}
        style={{ height: 32, padding: '0 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, border: isMandat ? 0 : surf.hairline, background: isMandat ? sp.ink : surf.card, color: isMandat ? sp.pageBg : sp.ink, boxShadow: isMandat ? 'none' : surf.shadow }}
      >
        {actionLabel(bucketId)}
      </button>
    )
  }

  const renderRow = (bucketId: FollowBucketId, row: FollowRow): ReactNode => (
    <div className="bpf-row" style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '10px 10px', borderRadius: 13, minWidth: 0 }}>
      <button
        onClick={() => onOpenBien(row.b.id)}
        style={{ display: 'flex', alignItems: 'center', gap: 13, flex: 1, minWidth: 0, border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
      >
        {renderThumb(row.b)}
        <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: -0.2, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.b.title}</div>
      </button>
      {renderTag(rowTagLabel(bucketId, row), row.urgent)}
      {renderActBtn(bucketId, row.b, row.days)}
    </div>
  )

  const renderFilt = (icon: MEIconName, label: string, on: boolean, onClick: () => void): ReactNode => (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%', border: 0, background: on ? surf.card : 'transparent', boxShadow: on ? `0 0 0 1.5px ${sp.ink} inset, ${surf.shadow}` : 'none' }}
    >
      <span style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <MEIcon name={icon} size={17} color={on ? sp.ink : sp.sub} />
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: sp.ink }}>{label}</span>
    </button>
  )

  const divider = (
    <div style={{ height: 1, background: dark ? 'rgba(255,255,255,.06)' : 'rgba(15,23,42,.05)', margin: '0 10px' }} />
  )

  return (
    <div style={{ position: 'absolute', inset: 0, background: sp.pageBg, display: 'grid', gridTemplateColumns: '324px 1fr', overflow: 'hidden' }}>
      <style>{`
        .bpf-row:hover { background: ${dark ? crmStep('s3', 'rgba(255,255,255,0.05)') : 'rgba(15,23,42,0.035)'}; }
        .bpf-feed::-webkit-scrollbar { width: 9px; }
        .bpf-feed::-webkit-scrollbar-thumb { background: ${dark ? 'rgba(255,255,255,.12)' : 'rgba(15,23,42,.14)'}; border-radius: 99px; border: 3px solid transparent; background-clip: content-box; }
        .bpf-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; align-items: start; }
        @media (max-width: 1180px) { .bpf-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* Rail — titre + filtres par nature */}
      <aside style={{ padding: '30px 26px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <h1 style={{ margin: '0 0 22px', fontSize: 31, fontWeight: 800, letterSpacing: -1.1, color: sp.ink, lineHeight: 1 }}>{t('biens.followUp.title')}</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {renderFilt('dashboard', t('biens.followUp.filter.all'), !filter, () => setFilter(null))}
          {buckets.map((g) => (
            <Fragment key={g.id}>
              {renderFilt(BUCKET_META[g.id].icon, t(`biens.followUp.filter.${g.id}`), filter === g.id, () => setFilter(filter === g.id ? null : g.id))}
            </Fragment>
          ))}
        </div>
      </aside>

      {/* Feed — adaptatif au volume */}
      <div style={{ padding: '14px 14px 14px 0', minHeight: 0, display: 'flex' }}>
        {dense ? (
          <div className="bpf-feed" style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: 6, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {bandeau.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 2px 10px' }}>
                  <MEIcon name="bolt" size={14} color={orangeText} />
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: orangeText }}>{t('biens.followUp.priority')}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${bandeau.length}, 1fr)`, gap: 14 }}>
                  {bandeau.map((row) => (
                    <div key={row.b.id} style={{ display: 'flex', alignItems: 'center', gap: 13, background: surf.card, borderRadius: 16, boxShadow: surf.shadow, border: surf.hairline, padding: 12, minWidth: 0 }}>
                      {renderThumb(row.b, 64, 50, 11)}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: orangeText, marginBottom: 3 }}>{expiryText(row.days ?? 0)}</div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: -0.2, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.b.title}</div>
                      </div>
                      <button
                        onClick={() => setRenew({ b: row.b, days: row.days ?? 0 })}
                        style={{ height: 32, padding: '0 14px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, background: sp.ink, color: sp.pageBg }}
                      >
                        {t('biens.followUp.action.renew')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="bpf-grid">
              {shownBuckets.map((g) => {
                const lim = expanded[g.id] ? g.rows.length : 4
                const shownRows = g.rows.slice(0, lim)
                const more = g.rows.length - shownRows.length
                return (
                  <section key={g.id} style={{ background: surf.card, borderRadius: 18, boxShadow: surf.shadow, border: surf.hairline, padding: '14px 12px 8px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 800, color: sp.ink, padding: '2px 6px 8px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: BUCKET_META[g.id].dot, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0 }}>{bucketTitle(g.id)}</span>
                      <span style={{ minWidth: 22, height: 22, padding: '0 7px', borderRadius: 999, display: 'inline-grid', placeItems: 'center', background: sp.ink, color: sp.pageBg, fontSize: 11.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{g.rows.length}</span>
                    </div>
                    {shownRows.map((row, i) => (
                      <Fragment key={row.b.id}>
                        {i > 0 && divider}
                        {renderRow(g.id, row)}
                      </Fragment>
                    ))}
                    {(more > 0 || (expanded[g.id] && g.rows.length > 4)) && (
                      <button
                        onClick={() => toggleExp(g.id)}
                        style={{ margin: '2px 8px 6px', padding: '8px', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: sp.sub }}
                      >
                        {more > 0 ? t('biens.followUp.viewOthers', { count: more }) : t('biens.followUp.reduce')}
                      </button>
                    )}
                  </section>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="bpf-feed" style={{ flex: 1, background: surf.card, borderRadius: 22, boxShadow: surf.shadow, border: surf.hairline, padding: '10px 10px', overflowY: 'auto', minHeight: 0 }}>
            {total === 0 && isError && (
              <div style={{ padding: '56px 20px', textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: 999, margin: '0 auto 14px', background: surf.cardSub, display: 'grid', placeItems: 'center' }}>
                  <MEIcon name="alert" size={22} color="#E53935" />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: sp.ink }}>{t('biens.error.title')}</div>
                <div style={{ fontSize: 13, color: sp.sub, fontWeight: 500, marginTop: 4, lineHeight: 1.5 }}>{t('biens.error.message')}</div>
                {onRefetch && (
                  <button
                    onClick={() => onRefetch()}
                    style={{ marginTop: 14, height: 34, padding: '0 16px', borderRadius: 999, background: surf.card, color: sp.ink, border: surf.hairline, boxShadow: surf.shadow, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <MEIcon name="refresh" size={13} color={sp.soft} /> {t('biens.error.retry')}
                  </button>
                )}
              </div>
            )}
            {total === 0 && !isError && isLoading && (
              <div style={{ padding: '56px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: sp.sub, fontWeight: 500 }}>{t('biens.loading')}</div>
              </div>
            )}
            {total === 0 && !isError && !isLoading && (
              <div style={{ padding: '56px 20px', textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: 999, margin: '0 auto 14px', background: surf.cardSub, display: 'grid', placeItems: 'center' }}>
                  <MEIcon name="check" size={22} color={sp.ink} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: sp.ink }}>{t('biens.followUp.empty.title')}</div>
                <div style={{ fontSize: 13, color: sp.sub, fontWeight: 500, marginTop: 4 }}>{t('biens.followUp.empty.subtitle')}</div>
              </div>
            )}

            {hero && (
              <div style={{ padding: '6px 6px 2px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: orangeText, margin: '4px 6px 8px' }}>
                  <MEIcon name="bolt" size={13} color={orangeText} />
                  {t('biens.followUp.priorityFirst')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: surf.cardSub, borderRadius: 16, padding: '12px 14px' }}>
                  {renderThumb(hero.b, 78, 58, 12)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: sp.sub, marginBottom: 3 }}>{t('biens.followUp.mandateEcheance', { type: hero.b.mandat?.type ?? 'simple' })}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.3, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hero.b.title}</div>
                  </div>
                  {renderTag(expiryText(hero.days ?? 0), hero.urgent)}
                  <button
                    onClick={() => setRenew({ b: hero.b, days: hero.days ?? 0 })}
                    style={{ height: 32, padding: '0 14px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, background: sp.ink, color: sp.pageBg }}
                  >
                    {t('biens.followUp.action.renew')}
                  </button>
                </div>
              </div>
            )}

            {shownBuckets.map((g, gi) => (
              <div key={g.id} style={{ padding: '4px 8px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800, letterSpacing: 0.2, color: sp.ink, padding: '10px 6px 6px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: BUCKET_META[g.id].dot, flexShrink: 0 }} />
                  {bucketTitle(g.id)}
                </div>
                {g.rows.map((row, i) => (
                  <Fragment key={row.b.id}>
                    {i > 0 && divider}
                    {renderRow(g.id, row)}
                  </Fragment>
                ))}
                {gi < shownBuckets.length - 1 && <div style={{ height: 1, background: dark ? 'rgba(255,255,255,.05)' : 'rgba(15,23,42,.045)', margin: '8px 10px 0' }} />}
              </div>
            ))}
          </div>
        )}
      </div>

      {renew && (
        <BpRenewModal
          b={renew.b}
          days={renew.days}
          sp={sp}
          surf={surf}
          dark={dark}
          onClose={() => setRenew(null)}
          onDone={onRefetch}
        />
      )}
    </div>
  )
}
