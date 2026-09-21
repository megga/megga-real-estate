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
 *
 * ── AVANT / APRÈS ───────────────────────────────────────────────────
 * Quand la production est née d'une photo SOURCE encore présente, la scène offre un
 * volet coulissant entre les deux. C'est la vue qui décide s'il faut refaire : un
 * meublement virtuel ne se juge pas seul, il se juge CONTRE la pièce vide. La fiche
 * bien montre déjà cette comparaison (`StagingSection`, deux images côte à côte) —
 * mais c'est ICI qu'on itère, et c'est ici qu'elle manquait.
 *
 * ⛔ Le volet se manie par un `<input type="range">` invisible, jamais par des
 * écouteurs de pointeur écrits à la main : il donne le glissement, le clavier (← →,
 * Origine, Fin) et l'annonce vocale sans une ligne. ⚠ Il oblige en revanche à ce que
 * l'écouteur GLOBAL de la visionneuse laisse passer les flèches quand la saisie a le
 * focus — sans quoi une flèche déplacerait le volet ET changerait de production.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { useEcranActif } from '@/hooks/useEcranActif'
import { formatCredits } from '@/lib/credits'
import type { LabsVoiceState } from '@/hooks/useLabsVoice'
import type { LabsAsset, LabsFolder } from '@/types/labs'
import { LABS_PILL, LABS_TRANSITION, type LabsSurfaces } from './labsTokens'

interface Props {
  ls: LabsSurfaces
  asset: LabsAsset
  /** La photo de départ, si elle est encore dans la liste : elle ouvre l'avant/après. */
  source: LabsAsset | null
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
  onRedo: () => void
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
  /**
   * ⚠ L'ÉTAT DU VOLET PORTE L'ID DE SA PRODUCTION. Changer d'image doit refermer la
   * comparaison — la suivante n'a pas la même source — mais le faire dans un effet
   * rendrait l'ancienne comparaison SUR la nouvelle image, le temps d'un rendu. L'id
   * comparé ici règle les deux d'un coup, sans rendu supplémentaire.
   */
  const [cmp, setCmp] = useState<{ id: string; ouvert: boolean; volet: number }>({ id: p.asset.id, ouvert: false, volet: 50 })
  const comparer = cmp.id === p.asset.id && cmp.ouvert
  const volet = cmp.id === p.asset.id ? cmp.volet : 50
  const actif = useEcranActif()

  useEffect(() => {
    if (!actif) return
    const onKey = (e: KeyboardEvent) => {
      // ⛔ Une saisie qui a le focus garde SES touches. Le volet avant/après se règle
      // aux flèches, et la liste des dossiers s'ouvre au clavier : sans cette garde,
      // chaque flèche ferait les deux à la fois — régler le volet changerait d'image.
      const cible = e.target as HTMLElement | null
      const saisie = !!cible && (/^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName) || cible.isContentEditable)
      if (e.key === 'Escape') p.onClose()
      else if (saisie) return
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
  // La comparaison n'a de sens que sur deux IMAGES prêtes : une vidéo se joue, elle ne
  // se superpose pas à sa photo de départ.
  const avant = p.source?.url ?? p.source?.thumbnailUrl ?? null
  const apres = a.url ?? a.thumbnailUrl ?? null
  const comparable = a.kind !== 'video' && !enCours && !echec && !!avant && !!apres

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
        ) : comparable && comparer ? (
          <Volet ls={ls} avant={avant!} apres={apres!} valeur={volet} onValeur={(v) => setCmp({ id: a.id, ouvert: true, volet: v })} alt={a.prompt ?? ''} />
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
        {comparable && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setCmp((c) => ({ id: a.id, ouvert: c.id === a.id ? !c.ouvert : true, volet: c.id === a.id ? c.volet : 50 })) }}
            aria-pressed={comparer}
            style={{
              position: 'absolute', left: '50%', top: 'var(--crm-space-lg)', transform: 'translateX(-50%)',
              display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 32, padding: '0 var(--crm-space-lg)',
              border: comparer ? 0 : `1px solid ${ls.solidBorder}`, borderRadius: LABS_PILL,
              background: comparer ? ls.accent : ls.solid, color: comparer ? ls.accentInk : ls.ink,
              fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, cursor: 'pointer',
              boxShadow: ls.solidShadow, transition: LABS_TRANSITION,
            }}
          >
            <MEIcon name="surface" size={13} color={comparer ? ls.accentInk : ls.ink} />
            {t('lightbox.compare')}
          </button>
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
              {/* ⛔ Le COÛT FOURNISSEUR (`cost_chf`) n'est plus montré : il disait à l'agent ce
                  que MEGGA paie. La production a un PRIX, en crédits — c'est lui qui s'affiche. */}
              {a.credits != null && (<><dt style={{ color: ls.soft }}>{t('lightbox.cost')}</dt><dd style={{ margin: 0, color: ls.ink, fontVariantNumeric: 'tabular-nums' }}>{t('credits.amount', { count: a.credits, n: formatCredits(a.credits, p.lang) })}</dd></>)}
              <dt style={{ color: ls.soft }}>{t('lightbox.date')}</dt><dd style={{ margin: 0, color: ls.ink }}>{date}</dd>
              {echec && (<><dt style={{ color: ls.soft }}>{t('lightbox.status')}</dt><dd style={{ margin: 0, color: ls.dangerText }}>{t(`errors.${a.errorCode ?? 'unknown'}`, { defaultValue: t('errors.unknown') })}</dd></>)}
            </dl>
          </Section>
        </div>

        <footer style={{ padding: 'var(--crm-space-lg) var(--crm-space-2xl)', borderTop: `1px solid ${ls.bord}`, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
          {/* ⛔ UN SEUL ACCENT DANS CE PIED, et c'est REFAIRE.
              « Animer » et « Refaire » y ont tous deux été peints en accent le temps d'un
              essai : deux aplats indigo l'un sur l'autre, de même taille et de même
              poids, ne hiérarchisent rien — l'œil choisit le premier, qui n'est pas le
              plus fréquent. Refaire coûte quelques crédits et se répète jusqu'à ce que
              l'image soit bonne ; animer en coûte trente fois plus et se fait une fois, à la fin. C'est
              l'acte RÉPÉTÉ qui prend l'accent, pas le plus spectaculaire.

              ⚠ REFAIRE et RÉUTILISER ne sont pas le même geste, et l'écran doit le dire :
              « Refaire » relance à l'identique, sans rien demander. « Réutiliser » ramène
              la consigne dans la barre pour la RETOUCHER, et referme la visionneuse. Un
              seul bouton pour les deux obligeait à repasser par la barre même quand on
              ne changeait rien. */}
          {a.prompt && a.kind !== 'video' && !enCours && (
            <Primary ls={ls} icon="refresh" onClick={p.onRedo}>{t('lightbox.redo')}</Primary>
          )}
          <div style={{ display: 'flex', gap: 'var(--crm-space-sm)' }}>
            {!enCours && !echec && a.kind !== 'video' && (
              <Primary ls={ls} icon="play" onClick={p.onAnimate} ghost>{t('lightbox.animate')}</Primary>
            )}
            {a.prompt && (
              <Primary ls={ls} icon="edit" onClick={p.onReuse} ghost>{t('lightbox.reuse')}</Primary>
            )}
          </div>
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
        flex: 1, minWidth: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-md)', height: 42,
        border: p.ghost ? `1px solid ${p.ls.bord}` : 0, borderRadius: 'var(--crm-radius-lg)', background: bg, color: ink,
        fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'pointer', transition: LABS_TRANSITION,
        whiteSpace: 'nowrap', overflow: 'hidden',
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

/**
 * Le volet avant/après : la photo de départ dessous, la production par-dessus, coupée
 * à la verticale du curseur.
 *
 * ⚠ C'est l'APRÈS qui est coupé, pas l'avant : on tire le volet de gauche à droite
 * pour DÉCOUVRIR le meublement, le sens que tout le monde attend d'un avant/après.
 *
 * ⚠ Les deux images partagent la même boîte, et l'après la remplit en `contain` :
 * une production dont la géométrie diffère de sa source se centrerait au lieu de se
 * déformer — une comparaison déformée ne vaut rien.
 */
function Volet(p: { ls: LabsSurfaces; avant: string; apres: string; valeur: number; onValeur: (v: number) => void; alt: string }) {
  const { t } = useTranslation('labs')
  const { ls } = p
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%', display: 'inline-block', lineHeight: 0, boxShadow: ls.solidShadow }}
    >
      <img src={p.avant} alt={t('lightbox.before')} draggable={false} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', borderRadius: 0 }} />
      <img
        src={p.apres}
        alt={p.alt}
        draggable={false}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'block', borderRadius: 0,
          clipPath: `inset(0 0 0 ${p.valeur}%)`,
        }}
      />
      <div aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, left: `${p.valeur}%`, width: 2, background: ls.onPhoto, opacity: 0.9 }} />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', top: '50%', left: `${p.valeur}%`, transform: 'translate(-50%,-50%)',
          width: 32, height: 32, borderRadius: LABS_PILL, display: 'grid', placeItems: 'center',
          background: ls.photoVeil(0.55), backdropFilter: 'blur(6px)', border: `1px solid ${ls.onPhoto}`,
        }}
      >
        <MEIcon name="chevron-up-down" size={14} color={ls.onPhoto} />
      </div>
      <Etiquette ls={ls} cote="left">{t('lightbox.before')}</Etiquette>
      <Etiquette ls={ls} cote="right">{t('lightbox.after')}</Etiquette>
      {/* ⛔ INVISIBLE mais bien là : c'est lui qui porte le glissement, le clavier et
          l'annonce vocale. Le dessiner à la main coûterait trois écouteurs de pointeur
          et n'aurait ni l'un ni l'autre. */}
      <input
        type="range"
        min={0}
        max={100}
        value={p.valeur}
        onChange={(e) => p.onValeur(Number(e.target.value))}
        aria-label={t('lightbox.compare')}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'ew-resize', margin: 0 }}
      />
    </div>
  )
}

function Etiquette(p: { ls: LabsSurfaces; cote: 'left' | 'right'; children: React.ReactNode }) {
  return (
    <span
      style={{
        position: 'absolute', bottom: 'var(--crm-space-lg)', [p.cote]: 'var(--crm-space-lg)',
        padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-sm)',
        background: p.ls.photoVeil(0.62), color: p.ls.onPhoto, fontSize: 'var(--crm-text-xs)', fontWeight: 600,
        backdropFilter: 'blur(6px)', pointerEvents: 'none', lineHeight: 1.4,
      }}
    >
      {p.children}
    </span>
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
