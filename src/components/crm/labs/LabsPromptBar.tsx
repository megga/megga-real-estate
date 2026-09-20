/**
 * La barre de prompt flottante du studio — reprise de la barre du Labs v2 de
 * référence (bouton d'attache, zone de texte auto-croissante, puces, bouton Générer
 * avec coût estimé), portée en jetons MEGGA X sur la surface OPAQUE du thème.
 *
 * Deux modes, deux jeux de puces :
 *   image → nombre de variations, ratio (seulement sans photo source : avec, la
 *           géométrie de la photo prime), home staging (ouvre la palette pièce × style)
 *   vidéo → résolution, durée (seulement sans voix off : avec, la narration décide),
 *           voix off (ouvre le texte lu et le choix de la voix)
 *
 * ⌘/Ctrl+Entrée génère. Le coût affiché est une estimation, jamais une facture — et
 * il compte les variations : quatre images annoncent quatre fois le prix d'une.
 *
 * ⚠ DEUX PANNEAUX, JAMAIS DEUX MENUS EMBOÏTÉS. La voix off (vidéo) et le staging
 * (image) s'ouvrent AU-DESSUS de la barre, en clair. Treize préréglages de staging
 * dans une liste déroulante demanderaient d'ouvrir, lire, choisir, refermer — pour un
 * geste que l'agent répète à chaque photo d'un appartement. En palette, c'est un clic.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { useEcranActif } from '@/hooks/useEcranActif'
import {
  LABS_IMAGE_RATIOS, LABS_PROMPT_MAX_CHARS, LABS_UPLOAD_MIMES, LABS_VIDEO_DURATIONS, LABS_VIDEO_RESOLUTIONS, LABS_VOICEOVER_MAX_CHARS,
  LABS_PREVIEW_MAX_CHARS, LABS_STAGING_ROOMS, LABS_STAGING_STYLES, LABS_VARIATIONS, LABS_VOICES, LABS_VOICE_LANGS, labsChf,
  type LabsStagingRoom, type LabsStagingStyle, type LabsVariations, type LabsVoice, type LabsVoiceLang,
} from '@/lib/labs'
import type { LabsVoiceState } from '@/hooks/useLabsVoice'
import type { LabsAsset, LabsMode, LabsRatio, LabsResolution } from '@/types/labs'
import { LABS_PILL, LABS_TRANSITION, type LabsSurfaces } from './labsTokens'

interface Props {
  ls: LabsSurfaces
  mode: LabsMode
  onMode: (m: LabsMode) => void
  prompt: string
  onPrompt: (v: string) => void
  source: LabsAsset | null
  onClearSource: () => void
  onAttachFile: (f: File) => void
  uploading: boolean
  ratio: LabsRatio
  onRatio: (r: LabsRatio) => void
  resolution: LabsResolution
  onResolution: (r: LabsResolution) => void
  durationS: number
  onDuration: (s: number) => void
  voOpen: boolean
  onVoOpen: (v: boolean) => void
  voText: string
  onVoText: (v: string) => void
  voice: LabsVoice
  onVoice: (v: LabsVoice) => void
  voiceLang: LabsVoiceLang
  onVoiceLang: (v: LabsVoiceLang) => void
  voixEtat: LabsVoiceState
  onEcouter: () => void
  variations: LabsVariations
  onVariations: (n: LabsVariations) => void
  stagingOn: boolean
  onStagingOn: (v: boolean) => void
  room: LabsStagingRoom
  onRoom: (r: LabsStagingRoom) => void
  stagingStyle: LabsStagingStyle
  onStagingStyle: (s: LabsStagingStyle) => void
  busy: boolean
  canGenerate: boolean
  estimateChf: number
  estimatedS: number
  onGenerate: () => void
}

type Pop = null | 'ratio' | 'resolution' | 'duration' | 'voice' | 'lang' | 'variations'

export function LabsPromptBar(p: Props) {
  const { t } = useTranslation('labs')
  const { ls } = p
  const [pop, setPop] = useState<Pop>(null)
  const wrap = useRef<HTMLDivElement | null>(null)
  const ta = useRef<HTMLTextAreaElement | null>(null)
  const file = useRef<HTMLInputElement | null>(null)
  // ⛔ Écran caché muet (keepalive des onglets) : la touche Échap d'un autre onglet ne ferme pas nos menus.
  const actif = useEcranActif()

  useEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(96, Math.max(24, el.scrollHeight))}px`
  }, [p.prompt])

  useEffect(() => {
    if (!pop || !actif) return
    const onDoc = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setPop(null) }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPop(null) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [pop, actif])

  const toggle = (id: Exclude<Pop, null>) => setPop((o) => (o === id ? null : id))
  const hasVo = p.mode === 'video' && p.voOpen && p.voText.trim().length > 0
  const enEcoute = p.voixEtat.statut === 'lecture' || p.voixEtat.statut === 'chargement'
  const ecouteVide = p.voText.trim().length === 0
  const placeholder = p.mode === 'video'
    ? t('prompt.placeholderVideo')
    : p.source ? t('prompt.placeholderImageSource') : t('prompt.placeholderImage')

  return (
    <div
      ref={wrap}
      style={{
        position: 'absolute', left: '50%', bottom: 'var(--crm-space-6xl)', transform: 'translateX(-50%)',
        width: 'min(780px, calc(100% - 2 * var(--crm-space-6xl)))', zIndex: 30,
        display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)',
      }}
    >
      {/* Photo source */}
      {p.source && (
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-md)',
              padding: 'var(--crm-space-2xs) var(--crm-space-md) var(--crm-space-2xs) var(--crm-space-2xs)',
              background: ls.solid, border: `1px solid ${ls.solidBorder}`, borderRadius: LABS_PILL, boxShadow: ls.solidShadow,
              fontSize: 'var(--crm-text-sm)', color: ls.ink,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 28, height: 28, borderRadius: LABS_PILL, backgroundImage: `url("${p.source.thumbnailUrl ?? p.source.url ?? ''}")`,
                backgroundSize: 'cover', backgroundPosition: 'center', background: p.source.thumbnailUrl ? undefined : ls.elev, flexShrink: 0,
              }}
            />
            <span>{p.mode === 'video' ? t('prompt.sourceVideo') : t('prompt.source')}</span>
            <button
              type="button"
              onClick={p.onClearSource}
              title={t('prompt.removeSource')}
              aria-label={t('prompt.removeSource')}
              style={{ border: 0, background: 'transparent', color: ls.sub, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}
            >
              <MEIcon name="close" size={12} color={ls.sub} />
            </button>
          </div>
        </div>
      )}

      {/* Voix off */}
      {p.mode === 'video' && p.voOpen && (
        <div
          style={{
            background: ls.solid, border: `1px solid ${ls.solidBorder}`, borderRadius: 'var(--crm-radius-3xl)', boxShadow: ls.solidShadow,
            padding: 'var(--crm-space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
            <MEIcon name="broadcast" size={14} color={ls.sub} />
            <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: ls.ink, flex: 1 }}>{t('prompt.voiceover')}</span>
            {/* ⚠ ÉCOUTER AVANT DE PAYER (Julien, 20.09.2026). Sans ce bouton, choisir
                entre six voix et quatre langues se fait à l'aveugle, et le seul moyen
                d'entendre le résultat était de lancer une vidéo à ~CHF 3,70. */}
            <button
              type="button"
              onClick={p.onEcouter}
              disabled={ecouteVide}
              /* ⚠ L'aperçu ne lit que le DÉBUT : `labs-voice-preview` tronque à 240
                 caractères. Le bouton le dit plutôt que de laisser croire à une
                 lecture complète qui s'arrête au milieu d'une phrase. */
              title={ecouteVide ? t('prompt.listenEmpty')
                : enEcoute ? t('prompt.listenStop')
                : p.voText.trim().length > LABS_PREVIEW_MAX_CHARS ? t('prompt.listenPartial', { n: LABS_PREVIEW_MAX_CHARS })
                : t('prompt.listen')}
              aria-label={enEcoute ? t('prompt.listenStop') : t('prompt.listen')}
              style={{
                width: 32, height: 32, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: LABS_PILL,
                background: enEcoute ? ls.accent : ls.elev, color: enEcoute ? ls.accentInk : ls.ink,
                border: enEcoute ? 0 : `1px solid ${ls.bordDouce}`,
                cursor: ecouteVide ? 'not-allowed' : 'pointer', opacity: ecouteVide ? 0.45 : 1, transition: LABS_TRANSITION,
              }}
            >
              {p.voixEtat.statut === 'chargement' ? <span className="labs-spin" aria-hidden="true" />
                : <MEIcon name={enEcoute ? 'pause' : 'play'} size={13} color={enEcoute ? ls.accentInk : ls.ink} />}
            </button>
            <div style={{ position: 'relative' }}>
              <Chip ls={ls} onClick={() => toggle('lang')} active={pop === 'lang'} title={t('prompt.voiceLang')}>
                {t(`langs.${p.voiceLang}`)}<Caret ls={ls} />
              </Chip>
              {pop === 'lang' && (
                <Popover ls={ls} title={t('prompt.voiceLang')} align="right">
                  {LABS_VOICE_LANGS.map((l) => (
                    <Opt key={l} ls={ls} on={p.voiceLang === l} onClick={() => { p.onVoiceLang(l); setPop(null) }}>{t(`langs.${l}`)}</Opt>
                  ))}
                </Popover>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <Chip ls={ls} onClick={() => toggle('voice')} active={pop === 'voice'}>
                {t(`voices.${p.voice}`)}<Caret ls={ls} />
              </Chip>
              {pop === 'voice' && (
                <Popover ls={ls} title={t('prompt.voice')} align="right">
                  {LABS_VOICES.map((v) => (
                    <Opt key={v} ls={ls} on={p.voice === v} onClick={() => { p.onVoice(v); setPop(null) }}>{t(`voices.${v}`)}</Opt>
                  ))}
                </Popover>
              )}
            </div>
            <button
              type="button"
              onClick={() => p.onVoOpen(false)}
              title={t('prompt.voiceoverClose')}
              aria-label={t('prompt.voiceoverClose')}
              style={{ border: 0, background: 'transparent', color: ls.sub, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}
            >
              <MEIcon name="close" size={12} color={ls.sub} />
            </button>
          </div>
          <textarea
            autoFocus
            value={p.voText}
            onChange={(e) => p.onVoText(e.target.value.slice(0, LABS_VOICEOVER_MAX_CHARS))}
            placeholder={t('prompt.voiceoverPlaceholder')}
            rows={2}
            style={{
              resize: 'none', border: `1px solid ${ls.bord}`, borderRadius: 'var(--crm-radius-md)', background: ls.elev,
              color: ls.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', lineHeight: 1.45,
              padding: 'var(--crm-space-md)', outline: 'none',
            }}
          />
          <div style={{ fontSize: 'var(--crm-text-xs)', color: ls.soft, display: 'flex', justifyContent: 'space-between' }}>
            <span style={p.voixEtat.statut === 'erreur' ? { color: ls.dangerText, fontWeight: 600 } : undefined}>
              {p.voixEtat.statut === 'erreur'
                ? t(`errors.${p.voixEtat.code}`, { defaultValue: t('errors.unknown') })
                : t('prompt.voiceoverHint')}
            </span>
            <span>{t('prompt.voiceoverChars', { n: p.voText.length, max: LABS_VOICEOVER_MAX_CHARS })}</span>
          </div>
        </div>
      )}

      {/* Home staging — la palette pièce × style */}
      {p.mode === 'image' && p.stagingOn && (
        <div
          style={{
            background: ls.solid, border: `1px solid ${ls.solidBorder}`, borderRadius: 'var(--crm-radius-3xl)', boxShadow: ls.solidShadow,
            padding: 'var(--crm-space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
            <MEIcon name="sofa" size={14} color={ls.sub} />
            <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: ls.ink, flex: 1 }}>{t('staging.title')}</span>
            <button
              type="button"
              onClick={() => p.onStagingOn(false)}
              title={t('staging.close')}
              aria-label={t('staging.close')}
              style={{ border: 0, background: 'transparent', color: ls.sub, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}
            >
              <MEIcon name="close" size={12} color={ls.sub} />
            </button>
          </div>

          <Palette ls={ls} titre={t('staging.room')}>
            {LABS_STAGING_ROOMS.map((r) => (
              <Pastille key={r} ls={ls} on={p.room === r} onClick={() => p.onRoom(r)}>{t(`staging.rooms.${r}`)}</Pastille>
            ))}
          </Palette>

          <Palette ls={ls} titre={t('staging.style')}>
            {LABS_STAGING_STYLES.map((st) => (
              <Pastille key={st} ls={ls} on={p.stagingStyle === st} onClick={() => p.onStagingStyle(st)} title={t(`staging.hints.${st}`)}>
                {t(`staging.styles.${st}`)}
              </Pastille>
            ))}
          </Palette>

          {/* ⚠ La phrase dit où la consigne ATTERRIT. Sans elle, l'agent qui voit le
              texte apparaître dans la zone du dessous croit à un bug, et le réécrit. */}
          <p style={{ margin: 0, fontSize: 'var(--crm-text-xs)', color: ls.soft, lineHeight: 1.45 }}>
            {p.source ? t('staging.hintSource') : t('staging.hintScratch')}
          </p>
        </div>
      )}

      {/* La barre */}
      <div
        style={{
          display: 'flex', alignItems: 'flex-end', gap: 'var(--crm-space-md)', minHeight: 56,
          padding: 'var(--crm-space-sm)', background: ls.solid, border: `1px solid ${ls.solidBorder}`,
          borderRadius: 'var(--crm-radius-6xl)', boxShadow: ls.solidShadow, color: ls.ink,
        }}
      >
        <input
          ref={file}
          type="file"
          accept={LABS_UPLOAD_MIMES.join(',')}
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onAttachFile(f); e.target.value = '' }}
        />
        <IconBtn ls={ls} icon={p.uploading ? 'refresh' : 'paperclip'} label={t('prompt.attach')} onClick={() => file.current?.click()} disabled={p.uploading} />

        <textarea
          ref={ta}
          value={p.prompt}
          onChange={(e) => p.onPrompt(e.target.value.slice(0, LABS_PROMPT_MAX_CHARS))}
          maxLength={LABS_PROMPT_MAX_CHARS}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); if (p.canGenerate && !p.busy) p.onGenerate() } }}
          placeholder={placeholder}
          rows={1}
          aria-label={t('prompt.aria')}
          style={{
            flex: 1, minWidth: 0, border: 0, background: 'transparent', outline: 'none', resize: 'none',
            fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', lineHeight: 1.4, color: ls.ink,
            padding: 'var(--crm-space-md) var(--crm-space-2xs)', maxHeight: 96,
          }}
        />

        <div style={{ width: 1, height: 32, background: ls.bord, flexShrink: 0, alignSelf: 'center' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', flexShrink: 0, alignSelf: 'center' }}>
          {/* Mode */}
          <div style={{ display: 'inline-flex', padding: 'var(--crm-space-2xs)', background: ls.elev, borderRadius: LABS_PILL, border: `1px solid ${ls.bord}` }}>
            {(['image', 'video'] as LabsMode[]).map((m) => {
              const on = p.mode === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => p.onMode(m)}
                  aria-pressed={on}
                  title={t(`prompt.${m}`)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', height: 30, padding: '0 var(--crm-space-md)',
                    border: 0, borderRadius: LABS_PILL, background: on ? ls.accent : 'transparent', color: on ? ls.accentInk : ls.sub,
                    fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, cursor: 'pointer', transition: LABS_TRANSITION,
                  }}
                >
                  <MEIcon name={m === 'image' ? 'gallery' : 'play'} size={12} color={on ? ls.accentInk : ls.sub} />
                  {t(`prompt.${m}`)}
                </button>
              )
            })}
          </div>

          {p.mode === 'image' && (
            <>
              {/* ⚠ Le NOMBRE avant le format : c'est le réglage qu'on rouvre à chaque
                  série, le ratio se pose une fois pour la séance. */}
              <div style={{ position: 'relative' }}>
                <Chip ls={ls} onClick={() => toggle('variations')} active={pop === 'variations'} title={t('prompt.variations')}>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>×{p.variations}</span><Caret ls={ls} />
                </Chip>
                {pop === 'variations' && (
                  <Popover ls={ls} title={t('prompt.variations')} align="right">
                    {LABS_VARIATIONS.map((n) => (
                      <Opt key={n} ls={ls} on={p.variations === n} onClick={() => { p.onVariations(n); setPop(null) }}>
                        {t('prompt.variationsValue', { count: n })}
                      </Opt>
                    ))}
                  </Popover>
                )}
              </div>

              {!p.source && (
                <div style={{ position: 'relative' }}>
                  <Chip ls={ls} onClick={() => toggle('ratio')} active={pop === 'ratio'} title={t('prompt.ratio')}>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{p.ratio}</span><Caret ls={ls} />
                  </Chip>
                  {pop === 'ratio' && (
                    <Popover ls={ls} title={t('prompt.ratio')} align="right">
                      {LABS_IMAGE_RATIOS.map((r) => (
                        <Opt key={r} ls={ls} on={p.ratio === r} onClick={() => { p.onRatio(r); setPop(null) }}>
                          <RatioBox ls={ls} ratio={r} on={p.ratio === r} />{r}
                        </Opt>
                      ))}
                    </Popover>
                  )}
                </div>
              )}

              <Chip ls={ls} onClick={() => p.onStagingOn(!p.stagingOn)} active={p.stagingOn} title={t('staging.title')}>
                <MEIcon name="sofa" size={12} color={p.stagingOn ? ls.accentInk : ls.ink} />
                {t('staging.chip')}
              </Chip>
            </>
          )}

          {p.mode === 'video' && (
            <>
              <div style={{ position: 'relative' }}>
                <Chip ls={ls} onClick={() => toggle('resolution')} active={pop === 'resolution'} title={t('prompt.resolution')}>
                  {p.resolution}<Caret ls={ls} />
                </Chip>
                {pop === 'resolution' && (
                  <Popover ls={ls} title={t('prompt.resolution')} align="right">
                    {LABS_VIDEO_RESOLUTIONS.map((r) => (
                      <Opt key={r} ls={ls} on={p.resolution === r} onClick={() => { p.onResolution(r); setPop(null) }}>{r}</Opt>
                    ))}
                  </Popover>
                )}
              </div>
              {!hasVo && (
                <div style={{ position: 'relative' }}>
                  <Chip ls={ls} onClick={() => toggle('duration')} active={pop === 'duration'} title={t('prompt.duration')}>
                    {t('prompt.durationValue', { s: p.durationS })}<Caret ls={ls} />
                  </Chip>
                  {pop === 'duration' && (
                    <Popover ls={ls} title={t('prompt.duration')} align="right">
                      {LABS_VIDEO_DURATIONS.map((s) => (
                        <Opt key={s} ls={ls} on={p.durationS === s} onClick={() => { p.onDuration(s); setPop(null) }}>{t('prompt.durationValue', { s })}</Opt>
                      ))}
                    </Popover>
                  )}
                </div>
              )}
              <Chip ls={ls} onClick={() => p.onVoOpen(!p.voOpen)} active={p.voOpen} title={t('prompt.voiceover')}>
                <MEIcon name="broadcast" size={12} color={p.voOpen ? ls.accentInk : ls.ink} />
                {t('prompt.voiceover')}
              </Chip>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={p.onGenerate}
          disabled={!p.canGenerate || p.busy}
          title={t('prompt.shortcut')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-md)', height: 44, padding: '0 var(--crm-space-4xl)',
            border: 0, borderRadius: LABS_PILL, background: ls.accent, color: ls.accentInk, alignSelf: 'center',
            fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: p.canGenerate && !p.busy ? 'pointer' : 'not-allowed',
            opacity: p.canGenerate || p.busy ? 1 : 0.5, transition: LABS_TRANSITION, flexShrink: 0,
          }}
        >
          {p.busy ? <span className="labs-spin" aria-hidden="true" /> : <MEIcon name="sparkle" size={14} color={ls.accentInk} />}
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
            <span>{p.busy ? t('prompt.generating') : t('prompt.generate')}</span>
            <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500, opacity: 0.8, fontVariantNumeric: 'tabular-nums' }}>
              {p.mode === 'video'
                ? t('prompt.estimateVideo', { chf: labsChf(p.estimateChf), s: p.estimatedS })
                : p.variations > 1
                  ? t('prompt.estimateMany', { chf: labsChf(p.estimateChf * p.variations), n: p.variations })
                  : t('prompt.estimate', { chf: labsChf(p.estimateChf) })}
            </span>
          </span>
        </button>
      </div>
    </div>
  )
}

/* ── Atomes ─────────────────────────────────────────────────────────────── */

function IconBtn(p: { ls: LabsSurfaces; icon: MEIconName; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={p.onClick}
      disabled={p.disabled}
      title={p.label}
      aria-label={p.label}
      style={{
        width: 40, height: 40, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: LABS_PILL,
        // ⛔ Le FILET, pas le fond : en sombre `elev` vaut la carte (PR #1335), et ce
        // bouton était invisible — mesuré `rgb(22,24,28)` des deux côtés, bordure 0.
        border: `1px solid ${p.ls.bordDouce}`,
        background: p.ls.elev, color: p.ls.ink, cursor: p.disabled ? 'wait' : 'pointer', transition: LABS_TRANSITION, alignSelf: 'center',
      }}
    >
      <MEIcon name={p.icon} size={16} color={p.ls.ink} />
    </button>
  )
}

function Chip(p: { ls: LabsSurfaces; onClick: () => void; active?: boolean; title?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={p.onClick}
      title={p.title}
      aria-expanded={p.active}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', height: 34, padding: '0 var(--crm-space-md)',
        border: `1px solid ${p.active ? p.ls.accent : p.ls.bord}`, borderRadius: LABS_PILL,
        background: p.active ? p.ls.accent : p.ls.elev, color: p.active ? p.ls.accentInk : p.ls.ink,
        fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', transition: LABS_TRANSITION,
      }}
    >
      {p.children}
    </button>
  )
}

/** Une rangée de préréglages : son titre à gauche, ses pastilles qui débordent en dessous. */
function Palette(p: { ls: LabsSurfaces; titre: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-md)', flexWrap: 'wrap' }}>
      <span style={{ width: 52, flexShrink: 0, fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: p.ls.soft }}>{p.titre}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-2xs)', flex: 1, minWidth: 0 }}>{p.children}</div>
    </div>
  )
}

function Pastille(p: { ls: LabsSurfaces; on: boolean; onClick: () => void; title?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={p.onClick}
      title={p.title}
      aria-pressed={p.on}
      style={{
        height: 28, padding: '0 var(--crm-space-md)', borderRadius: LABS_PILL,
        border: `1px solid ${p.on ? p.ls.accent : p.ls.bord}`,
        background: p.on ? p.ls.accent : p.ls.elev, color: p.on ? p.ls.accentInk : p.ls.ink,
        fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: p.on ? 600 : 500,
        cursor: 'pointer', whiteSpace: 'nowrap', transition: LABS_TRANSITION,
      }}
    >
      {p.children}
    </button>
  )
}

function Caret({ ls }: { ls: LabsSurfaces }) {
  return <span aria-hidden="true" style={{ color: ls.soft, fontSize: 'var(--crm-text-xs)' }}>▾</span>
}

function Popover(p: { ls: LabsSurfaces; title: string; align: 'left' | 'right'; children: ReactNode }) {
  return (
    <div
      role="menu"
      style={{
        position: 'absolute', bottom: 'calc(100% + var(--crm-space-sm))', [p.align]: 0, minWidth: 180, zIndex: 40,
        background: p.ls.solid, border: `1px solid ${p.ls.solidBorder}`, borderRadius: 'var(--crm-radius-2xl)', boxShadow: p.ls.solidShadow,
        padding: 'var(--crm-space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)',
      }}
    >
      <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: p.ls.soft, padding: 'var(--crm-space-2xs) var(--crm-space-sm)' }}>{p.title}</div>
      {p.children}
    </div>
  )
}

function Opt(p: { ls: LabsSurfaces; on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={p.on}
      onClick={p.onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', height: 32, padding: '0 var(--crm-space-md)',
        border: 0, borderRadius: 'var(--crm-radius-md)', background: p.on ? p.ls.accent : 'transparent', color: p.on ? p.ls.accentInk : p.ls.ink,
        fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: p.on ? 600 : 500, cursor: 'pointer', textAlign: 'left', transition: LABS_TRANSITION,
      }}
    >
      {p.children}
    </button>
  )
}

function RatioBox({ ls, ratio, on }: { ls: LabsSurfaces; ratio: string; on: boolean }) {
  const [w, h] = ratio.split(':').map(Number)
  const base = 16
  const bw = w >= h ? base : Math.round((base * w) / h)
  const bh = w >= h ? Math.round((base * h) / w) : base
  return <span aria-hidden="true" style={{ width: bw, height: bh, borderRadius: 'var(--crm-radius-2xs)', background: on ? ls.accentInk : ls.soft, opacity: 0.9, flexShrink: 0 }} />
}

