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
import { type SugarPalette } from '@/components/crm-sugar/tokens'
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
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, letterSpacing: -0.1, whiteSpace: 'nowrap', flexShrink: 0, background: urgent ? orange : surf.cardSub, color: urgent ? '#fff' : sp.soft }}>
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
        style={{ height: 32, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, border: isMandat ? 0 : surf.hairline, background: isMandat ? sp.accent : surf.card, color: isMandat ? sp.accentInk : sp.ink, boxShadow: isMandat ? 'none' : surf.shadow }}
      >
        {actionLabel(bucketId)}
      </button>
    )
  }

  const renderRow = (bucketId: FollowBucketId, row: FollowRow): ReactNode => (
    <div className="bpf-row" style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-lg) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', minWidth: 0 }}>
      <button
        onClick={() => onOpenBien(row.b.id)}
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', flex: 1, minWidth: 0, border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
      >
        {renderThumb(row.b)}
        <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, letterSpacing: -0.2, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.b.title}</div>
      </button>
      {renderTag(rowTagLabel(bucketId, row), row.urgent)}
      {renderActBtn(bucketId, row.b, row.days)}
    </div>
  )

  const renderFilt = (icon: MEIconName, label: string, on: boolean, onClick: () => void): ReactNode => (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-lg) var(--crm-space-xl)', borderRadius: 'var(--crm-radius-xl)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%', border: 0, background: on ? surf.card : 'transparent', boxShadow: on ? `0 0 0 1.5px ${sp.ink} inset, ${surf.shadow}` : 'none' }}
    >
      <span style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <MEIcon name={icon} size={17} color={on ? sp.ink : sp.sub} />
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }}>{label}</span>
    </button>
  )

  const divider = (
    <div style={{ height: 1, background: dark ? 'rgba(255,255,255,.06)' : 'rgba(15,23,42,.05)', margin: '0 10px' }} />
  )

  return (
    <div style={{ position: 'absolute', inset: 0, background: sp.pageBg, display: 'grid', gridTemplateColumns: '324px 1fr', overflow: 'hidden' }}>
      <style>{`
        .bpf-row:hover { background: ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.035)'}; }
        .bpf-feed::-webkit-scrollbar { width: 9px; }
        .bpf-feed::-webkit-scrollbar-thumb { background: ${dark ? 'rgba(255,255,255,.12)' : 'rgba(15,23,42,.14)'}; border-radius: 99px; border: 3px solid transparent; background-clip: content-box; }
        .bpf-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: var(--crm-space-3xl); align-items: start; }
        @media (max-width: 1180px) { .bpf-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* Rail — titre + filtres par nature */}
      <aside style={{ padding: '30px 26px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <h1 style={{ margin: '0 0 22px', fontSize: 'var(--crm-text-6xl)', fontWeight: 500, letterSpacing: -1.1, color: sp.ink, lineHeight: 1 }}>{t('biens.followUp.title')}</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xs)' }}>
          {renderFilt('dashboard', t('biens.followUp.filter.all'), !filter, () => setFilter(null))}
          {buckets.map((g) => (
            <Fragment key={g.id}>
              {renderFilt(BUCKET_META[g.id].icon, t(`biens.followUp.filter.${g.id}`), filter === g.id, () => setFilter(filter === g.id ? null : g.id))}
            </Fragment>
          ))}
        </div>
      </aside>

      {/* Feed — adaptatif au volume */}
      <div style={{ padding: 'var(--crm-space-2xl) var(--crm-space-2xl) var(--crm-space-2xl) 0', minHeight: 0, display: 'flex' }}>
        {dense ? (
          <div className="bpf-feed" style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: 'var(--crm-space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3xl)' }}>
            {bandeau.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', margin: '2px 2px 10px' }}>
                  <MEIcon name="bolt" size={14} color={orangeText} />
                  <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: orangeText }}>{t('biens.followUp.priority')}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${bandeau.length}, 1fr)`, gap: 'var(--crm-space-2xl)' }}>
                  {bandeau.map((row) => (
                    <div key={row.b.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', background: surf.card, borderRadius: 'var(--crm-radius-2xl)', boxShadow: surf.shadow, border: surf.hairline, padding: 'var(--crm-space-xl)', minWidth: 0 }}>
                      {renderThumb(row.b, 64, 50, 11)}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: orangeText, marginBottom: 3 }}>{expiryText(row.days ?? 0)}</div>
                        <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, letterSpacing: -0.2, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.b.title}</div>
                      </div>
                      <button
                        onClick={() => setRenew({ b: row.b, days: row.days ?? 0 })}
                        style={{ height: 32, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, background: sp.accent, color: sp.accentInk }}
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
                  <section key={g.id} style={{ background: surf.card, borderRadius: 'var(--crm-radius-3xl)', boxShadow: surf.shadow, border: surf.hairline, padding: 'var(--crm-space-2xl) var(--crm-space-xl) var(--crm-space-md)', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, padding: 'var(--crm-space-2xs) var(--crm-space-sm) var(--crm-space-md)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 'var(--crm-radius-pill)', background: BUCKET_META[g.id].dot, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0 }}>{bucketTitle(g.id)}</span>
                      <span style={{ minWidth: 22, height: 22, padding: '0 var(--crm-space-sm)', borderRadius: 'var(--crm-radius-pill)', display: 'inline-grid', placeItems: 'center', background: sp.ink, color: sp.pageBg, fontSize: 'var(--crm-text-sm)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{g.rows.length}</span>
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
                        style={{ margin: '2px 8px 6px', padding: 'var(--crm-space-md)', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.sub }}
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
          <div className="bpf-feed" style={{ flex: 1, background: surf.card, borderRadius: 'var(--crm-radius-5xl)', boxShadow: surf.shadow, border: surf.hairline, padding: 'var(--crm-space-lg) var(--crm-space-lg)', overflowY: 'auto', minHeight: 0 }}>
            {total === 0 && isError && (
              <div style={{ padding: '56px 20px', textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: 'var(--crm-radius-pill)', margin: '0 auto 14px', background: surf.cardSub, display: 'grid', placeItems: 'center' }}>
                  <MEIcon name="alert" size={22} color="#E53935" />
                </div>
                <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink }}>{t('biens.error.title')}</div>
                <div style={{ fontSize: 'var(--crm-text-lg)', color: sp.sub, fontWeight: 500, marginTop: 4, lineHeight: 1.5 }}>{t('biens.error.message')}</div>
                {onRefetch && (
                  <button
                    onClick={() => onRefetch()}
                    style={{ marginTop: 14, height: 34, padding: '0 var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-pill)', background: surf.card, color: sp.ink, border: surf.hairline, boxShadow: surf.shadow, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)' }}
                  >
                    <MEIcon name="refresh" size={13} color={sp.soft} /> {t('biens.error.retry')}
                  </button>
                )}
              </div>
            )}
            {total === 0 && !isError && isLoading && (
              <div style={{ padding: '56px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--crm-text-lg)', color: sp.sub, fontWeight: 500 }}>{t('biens.loading')}</div>
              </div>
            )}
            {total === 0 && !isError && !isLoading && (
              <div style={{ padding: '56px 20px', textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: 'var(--crm-radius-pill)', margin: '0 auto 14px', background: surf.cardSub, display: 'grid', placeItems: 'center' }}>
                  <MEIcon name="check" size={22} color={sp.ink} />
                </div>
                <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink }}>{t('biens.followUp.empty.title')}</div>
                <div style={{ fontSize: 'var(--crm-text-lg)', color: sp.sub, fontWeight: 500, marginTop: 4 }}>{t('biens.followUp.empty.subtitle')}</div>
              </div>
            )}

            {hero && (
              <div style={{ padding: 'var(--crm-space-sm) var(--crm-space-sm) var(--crm-space-2xs)' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: orangeText, margin: '4px 6px 8px' }}>
                  <MEIcon name="bolt" size={13} color={orangeText} />
                  {t('biens.followUp.priorityFirst')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)', background: surf.cardSub, borderRadius: 'var(--crm-radius-2xl)', padding: 'var(--crm-space-xl) var(--crm-space-2xl)' }}>
                  {renderThumb(hero.b, 78, 58, 12)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub, marginBottom: 3 }}>{t('biens.followUp.mandateEcheance', { type: hero.b.mandat?.type ?? 'simple' })}</div>
                    <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, letterSpacing: -0.3, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hero.b.title}</div>
                  </div>
                  {renderTag(expiryText(hero.days ?? 0), hero.urgent)}
                  <button
                    onClick={() => setRenew({ b: hero.b, days: hero.days ?? 0 })}
                    style={{ height: 32, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, background: sp.accent, color: sp.accentInk }}
                  >
                    {t('biens.followUp.action.renew')}
                  </button>
                </div>
              </div>
            )}

            {shownBuckets.map((g, gi) => (
              <div key={g.id} style={{ padding: 'var(--crm-space-xs) var(--crm-space-md) 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', fontSize: 'var(--crm-text-md)', fontWeight: 600, letterSpacing: 0.2, color: sp.ink, padding: 'var(--crm-space-lg) var(--crm-space-sm) var(--crm-space-sm)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 'var(--crm-radius-pill)', background: BUCKET_META[g.id].dot, flexShrink: 0 }} />
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
