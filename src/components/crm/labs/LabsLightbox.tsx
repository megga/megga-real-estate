/**
 * La visionneuse du studio : la production en grand (image ou vidéo lisible) et,
 * à droite, son panneau — prompt copiable, voix off, informations, dossier, et les
 * gestes (animer, réutiliser, source, télécharger, favori, supprimer).
 *
 * Portée dans `<body>` (CLAUDE.md §3) ; son voile ASSOMBRIT quel que soit le thème
 * (`voile-modale.spec.ts`). Échap ferme, ← → naviguent — depuis l'écran actif seul.
 *
 * ⚠ L'IMAGE n'a pas de coins arrondis (Julien, 20.09.2026), le PANNEAU garde les siens :
 * une photo se montre entière, un cadre d'interface se pose.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { useEcranActif } from '@/hooks/useEcranActif'
import { labsChf } from '@/lib/labs'
import type { LabsVoiceState } from '@/hooks/useLabsVoice'
import type { LabsAsset, LabsFolder } from '@/types/labs'
import { LABS_PILL, LABS_TRANSITION, type LabsSurfaces } from './labsTokens'

interface Props {
  ls: LabsSurfaces
  asset: LabsAsset
  folders: LabsFolder[]
  index: number
  total: number
  lang: string
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  onFavorite: () => void
  onAnimate: () => void
  onUseSource: () => void
  onReuse: () => void
  onDownload: () => void
  onDelete: () => void
  onMove: (folderId: string | null) => void
  voixEtat: LabsVoiceState
  onEcouter: () => void
}

export function LabsLightbox(p: Props) {
  const { t } = useTranslation('labs')
  const { ls, asset: a } = p
  const [copie, setCopie] = useState(false)
  const actif = useEcranActif()

  useEffect(() => {
    if (!actif) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') p.onClose()
      else if (e.key === 'ArrowLeft') p.onPrev()
      else if (e.key === 'ArrowRight') p.onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actif, p])

  const copier = async () => {
    if (!a.prompt) return
    try { await navigator.clipboard.writeText(a.prompt); setCopie(true); setTimeout(() => setCopie(false), 1500) } catch { /* presse-papier refusé */ }
  }

  const enCours = a.status === 'generating' || a.status === 'pending'
  const echec = a.status === 'failed'
  const date = new Date(a.createdAt).toLocaleString(p.lang, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const poster = a.thumbnailUrl ?? undefined
  const enEcoute = p.voixEtat.statut === 'lecture' || p.voixEtat.statut === 'chargement'

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={a.prompt ?? t(`kind.${a.kind}`)}
      onClick={(e) => { if (e.target === e.currentTarget) p.onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 90, display: 'flex', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-6xl)',
        background: ls.photoVeil(0.72), backdropFilter: 'blur(14px)', fontFamily: 'var(--crm-font), sans-serif', color: ls.ink,
      }}
    >
      {/* Scène */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {a.kind === 'video' && a.url ? (
          <video
            key={a.id}
            src={a.url}
            poster={poster}
            controls
            autoPlay
            playsInline
            style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 0, background: ls.photoVeil(0.4), boxShadow: ls.solidShadow }}
          />
        ) : (a.url || a.thumbnailUrl) ? (
          <img
            key={a.id}
            src={a.kind === 'video' ? (a.thumbnailUrl ?? '') : (a.url ?? a.thumbnailUrl ?? '')}
            alt={a.prompt ?? ''}
            draggable={false}
            style={{
              maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 0, boxShadow: ls.solidShadow,
              filter: enCours ? 'blur(8px)' : echec ? 'grayscale(1) brightness(.6)' : 'none',
            }}
          />
        ) : (
          <div style={{ color: ls.accentInk, opacity: 0.7 }}><MEIcon name={echec ? 'alert' : 'gallery'} size={40} color={ls.onPhoto} /></div>
        )}
        {(enCours || echec) && (
          <div
            style={{
              position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
              display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-md) var(--crm-space-2xl)',
              background: ls.solid, color: ls.ink, border: `1px solid ${ls.solidBorder}`, borderRadius: LABS_PILL, fontSize: 'var(--crm-text-md)', fontWeight: 600,
            }}
          >
            {enCours && <span className="labs-spin" aria-hidden="true" />}
            {enCours ? t(`status.${a.status}`) : t('status.failed')}
          </div>
        )}
        {p.total > 1 && (
          <>
            <NavBtn ls={ls} side="left" label={t('lightbox.prev')} onClick={p.onPrev}>‹</NavBtn>
            <NavBtn ls={ls} side="right" label={t('lightbox.next')} onClick={p.onNext}>›</NavBtn>
          </>
        )}
      </div>

      {/* Panneau */}
      <aside
        style={{
          width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0,
          background: ls.solid, border: `1px solid ${ls.solidBorder}`, borderRadius: 'var(--crm-radius-4xl)', boxShadow: ls.solidShadow, overflow: 'hidden',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-lg) var(--crm-space-2xl)', borderBottom: `1px solid ${ls.bord}` }}>
          <span style={{ padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-sm)', background: ls.elev, border: `1px solid ${ls.bordDouce}`, fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: ls.sub }}>
            {t(`kind.${a.kind}`)}
          </span>
          <span style={{ flex: 1, fontSize: 'var(--crm-text-sm)', color: ls.soft, fontVariantNumeric: 'tabular-nums' }}>
            {p.index + 1} / {p.total}
          </span>
          <button
            type="button"
            onClick={p.onClose}
            title={t('lightbox.close')}
            aria-label={t('lightbox.close')}
            style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', border: 0, borderRadius: 'var(--crm-radius-md)', background: 'transparent', color: ls.sub, cursor: 'pointer' }}
          >
            <MEIcon name="close" size={14} color={ls.sub} />
          </button>
        </header>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} className="scrollbar-hide">
          <Section ls={ls} title={t('lightbox.prompt')} action={a.prompt ? { label: copie ? t('lightbox.copied') : t('lightbox.copy'), icon: copie ? 'check' : 'copy', onClick: copier } : undefined}>
            <p style={{ margin: 0, fontSize: 'var(--crm-text-md)', lineHeight: 1.55, color: a.prompt ? ls.ink : ls.soft, whiteSpace: 'pre-wrap' }}>
              {a.prompt ?? t('lightbox.noPrompt')}
            </p>
          </Section>

          {a.voiceoverText && (
            <Section
              ls={ls}
              title={t('lightbox.voiceover')}
              /* ⚠ La piste EXISTE (elle est sur R2) : on la joue, on ne la resynthétise
                 pas. Une production sans `voiceoverUrl` — une vidéo d'avant la piste,
                 ou dont la voix a échoué — n'offre simplement pas le bouton. */
              action={a.voiceoverUrl ? {
                label: enEcoute ? t('lightbox.listenStop') : t('lightbox.listen'),
                icon: enEcoute ? 'pause' : 'play',
                onClick: p.onEcouter,
              } : undefined}
            >
              <p style={{ margin: 0, fontSize: 'var(--crm-text-md)', lineHeight: 1.55, color: ls.ink, whiteSpace: 'pre-wrap' }}>{a.voiceoverText}</p>
              <div style={{ marginTop: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-xs)', color: p.voixEtat.statut === 'erreur' ? ls.dangerText : ls.soft }}>
                {p.voixEtat.statut === 'erreur'
                  ? t(`errors.${p.voixEtat.code}`, { defaultValue: t('errors.unknown') })
                  : [
                      a.voiceoverVoice ? t(`voices.${a.voiceoverVoice}`, { defaultValue: a.voiceoverVoice }) : null,
                      a.voiceoverLang ? t(`langs.${a.voiceoverLang}`, { defaultValue: a.voiceoverLang }) : null,
                    ].filter(Boolean).join(' · ')}
              </div>
            </Section>
          )}

          <Section ls={ls} title={t('lightbox.info')}>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '110px 1fr', gap: 'var(--crm-space-sm) var(--crm-space-lg)', fontSize: 'var(--crm-text-sm)' }}>
              <dt style={{ color: ls.soft }}>{t('lightbox.folder')}</dt>
              <dd style={{ margin: 0 }}>
                <select
                  value={a.folderId ?? ''}
                  onChange={(e) => p.onMove(e.target.value || null)}
                  aria-label={t('lightbox.folder')}
                  style={{
                    width: '100%', height: 30, border: `1px solid ${ls.bord}`, borderRadius: 'var(--crm-radius-md)', background: ls.elev, color: ls.ink,
                    fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', padding: '0 var(--crm-space-sm)',
                  }}
                >
                  <option value="">{t('lightbox.noFolder')}</option>
                  {p.folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </dd>
              {a.model && (<><dt style={{ color: ls.soft }}>{t('lightbox.model')}</dt><dd style={{ margin: 0, color: ls.ink, wordBreak: 'break-all' }}>{a.model}</dd></>)}
              {a.aspectRatio && (<><dt style={{ color: ls.soft }}>{t('lightbox.ratio')}</dt><dd style={{ margin: 0, color: ls.ink }}>{a.aspectRatio}</dd></>)}
              {a.width && a.height && (<><dt style={{ color: ls.soft }}>{t('lightbox.size')}</dt><dd style={{ margin: 0, color: ls.ink }}>{a.width} × {a.height}</dd></>)}
              {a.durationS != null && (<><dt style={{ color: ls.soft }}>{t('lightbox.duration')}</dt><dd style={{ margin: 0, color: ls.ink }}>{t('prompt.durationValue', { s: Math.round(a.durationS) })}</dd></>)}
              {a.costChf != null && (<><dt style={{ color: ls.soft }}>{t('lightbox.cost')}</dt><dd style={{ margin: 0, color: ls.ink }}>{t('prompt.estimate', { chf: labsChf(a.costChf) })}</dd></>)}
              <dt style={{ color: ls.soft }}>{t('lightbox.date')}</dt><dd style={{ margin: 0, color: ls.ink }}>{date}</dd>
              {echec && (<><dt style={{ color: ls.soft }}>{t('lightbox.status')}</dt><dd style={{ margin: 0, color: ls.dangerText }}>{t(`errors.${a.errorCode ?? 'unknown'}`, { defaultValue: t('errors.unknown') })}</dd></>)}
            </dl>
          </Section>
        </div>

        <footer style={{ padding: 'var(--crm-space-lg) var(--crm-space-2xl)', borderTop: `1px solid ${ls.bord}`, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
          {!enCours && !echec && a.kind !== 'video' && (
            <Primary ls={ls} icon="play" onClick={p.onAnimate}>{t('lightbox.animate')}</Primary>
          )}
          {a.prompt && (
            <Primary ls={ls} icon="refresh" onClick={p.onReuse} ghost={a.kind !== 'video' && !enCours && !echec}>{t('lightbox.reuse')}</Primary>
          )}
          <div style={{ display: 'flex', gap: 'var(--crm-space-sm)' }}>
            {!enCours && !echec && a.kind !== 'video' && <Ter ls={ls} icon="gallery" label={t('lightbox.useSource')} onClick={p.onUseSource} />}
            {a.url && <Ter ls={ls} icon="download" label={t('lightbox.download')} onClick={p.onDownload} />}
            {!enCours && !echec && <Ter ls={ls} icon="star" label={a.isFavorite ? t('thumb.unfavorite') : t('thumb.favorite')} onClick={p.onFavorite} on={a.isFavorite} />}
            <Ter ls={ls} icon="trash" label={t('lightbox.delete')} onClick={p.onDelete} danger />
          </div>
        </footer>
      </aside>
    </div>,
    document.body,
  )
}

/* ── Atomes ─────────────────────────────────────────────────────────────── */

function Section(p: { ls: LabsSurfaces; title: string; action?: { label: string; icon: MEIconName; onClick: () => void }; children: React.ReactNode }) {
  return (
    <section style={{ padding: 'var(--crm-space-lg) var(--crm-space-2xl)', borderBottom: `1px solid ${p.ls.bord}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--crm-space-md)' }}>
        <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: p.ls.soft }}>{p.title}</span>
        {p.action && (
          <button
            type="button"
            onClick={p.action.onClick}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', height: 26, padding: '0 var(--crm-space-md)',
              border: `1px solid ${p.ls.bord}`, borderRadius: LABS_PILL, background: p.ls.elev, color: p.ls.sub,
              fontFamily: 'inherit', fontSize: 'var(--crm-text-xs)', fontWeight: 500, cursor: 'pointer', transition: LABS_TRANSITION,
            }}
          >
            <MEIcon name={p.action.icon} size={11} color={p.ls.sub} />{p.action.label}
          </button>
        )}
      </div>
      {p.children}
    </section>
  )
}

function Primary(p: { ls: LabsSurfaces; icon: MEIconName; onClick: () => void; ghost?: boolean; children: React.ReactNode }) {
  const bg = p.ghost ? p.ls.elev : p.ls.accent
  const ink = p.ghost ? p.ls.ink : p.ls.accentInk
  return (
    <button
      type="button"
      onClick={p.onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-md)', height: 42,
        border: p.ghost ? `1px solid ${p.ls.bord}` : 0, borderRadius: 'var(--crm-radius-lg)', background: bg, color: ink,
        fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'pointer', transition: LABS_TRANSITION,
      }}
    >
      <MEIcon name={p.icon} size={14} color={ink} />{p.children}
    </button>
  )
}

function Ter(p: { ls: LabsSurfaces; icon: MEIconName; label: string; onClick: () => void; on?: boolean; danger?: boolean }) {
  const ink = p.on ? p.ls.accentInk : p.danger ? p.ls.dangerText : p.ls.sub
  return (
    <button
      type="button"
      onClick={p.onClick}
      title={p.label}
      aria-label={p.label}
      aria-pressed={p.on}
      style={{
        flex: 1, height: 36, display: 'grid', placeItems: 'center', border: `1px solid ${p.on ? p.ls.accent : p.ls.bord}`, borderRadius: 'var(--crm-radius-md)',
        background: p.on ? p.ls.accent : p.ls.elev, color: ink, cursor: 'pointer', transition: LABS_TRANSITION,
      }}
    >
      <MEIcon name={p.icon} size={14} color={ink} />
    </button>
  )
}

function NavBtn(p: { ls: LabsSurfaces; side: 'left' | 'right'; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); p.onClick() }}
      title={p.label}
      aria-label={p.label}
      style={{
        position: 'absolute', top: '50%', [p.side]: 0, transform: 'translateY(-50%)',
        width: 44, height: 44, display: 'grid', placeItems: 'center', border: `1px solid ${p.ls.solidBorder}`, borderRadius: LABS_PILL,
        background: p.ls.solid, color: p.ls.ink, fontSize: 'var(--crm-text-5xl)', lineHeight: 1, cursor: 'pointer', boxShadow: p.ls.solidShadow,
      }}
    >
      {p.children}
    </button>
  )
}
