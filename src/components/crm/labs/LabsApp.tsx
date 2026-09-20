/**
 * Orchestrateur du studio Labs (`/dashboard/labs`) : le chrome CRM (`CrmWorkspace`),
 * puis UNE carte plein cadre — la galerie, son en-tête (le menu des dossiers, les
 * filtres, la densité) et, flottante en bas, la barre de prompt.
 *
 * ⚠ Plein cadre et non un bento `rail | galerie` (Julien, 20.09.2026 : « le pager
 * doit rester comme il est partout, pour profiter de la plus grande surface
 * disponible ») : les dossiers vivent dans le menu du titre, pas dans une colonne.
 *
 * Ce que l'écran fait : générer une image (Nano Banana 2) à partir d'un texte ou
 * d'une photo, générer une vidéo (Seedance) à partir d'une image avec ou sans voix off,
 * importer une photo, ranger tout ça dans des dossiers. Ce qu'il ne fait pas encore :
 * poser une production sur la fiche d'un bien — le geste viendra de la fiche, pas d'ici.
 *
 * ⚠ L'état de l'écran vit dans l'ONGLET (`useTabScopedState`) : le dossier ouvert, la
 * densité et le brouillon de prompt survivent à un aller-retour entre deux onglets.
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CrmWorkspace from '@/components/crm/CrmWorkspace'
import { CRM_KEYFRAMES } from '@/components/crm/CrmShell'
import { crmPalette } from '@/components/crm/tokens'
import MEIcon from '@/components/propertyx/MEIcon'
import { useAgencySettings } from '@/hooks/useAgencySettings'
import { useTabScopedState } from '@/hooks/useCrmTabs'
import { useLabsAssets, useLabsVideoPolling } from '@/hooks/useLabsAssets'
import { useLabsFolders } from '@/hooks/useLabsFolders'
import { useLabsGenerate } from '@/hooks/useLabsGenerate'
import { useLabsUpload } from '@/hooks/useLabsUpload'
import {
  LABS_DEFAULT_VOICE, LABS_DEFAULT_VOICE_LANG, labsCountByFolder, labsDownloadName, labsEstimateChf, labsFilter,
  labsMonthUsage, labsQuotaFor, labsVideoDurationS, labsVoiceoverSeconds, type LabsVoice, type LabsVoiceLang,
} from '@/lib/labs'
import { useLabsVoice } from '@/hooks/useLabsVoice'
import type { LabsAsset, LabsFolder, LabsKindFilter, LabsMode, LabsRatio, LabsResolution, LabsView } from '@/types/labs'
import { LabsGallery, type LabsEmptyKind } from './LabsGallery'
import { LabsLightbox } from './LabsLightbox'
import { LabsConfirmModal, LabsFolderModal } from './LabsModals'
import { LabsPromptBar } from './LabsPromptBar'
import { LabsFolderMenu } from './LabsFolderMenu'
import { LABS_PILL, LABS_TRANSITION, labsSurfaces } from './labsTokens'

interface Props { dark: boolean; setDark: (v: boolean) => void }

type FolderModal = null | { mode: 'create' } | { mode: 'rename'; folder: LabsFolder }
type Confirm = null | { kind: 'folder'; folder: LabsFolder } | { kind: 'asset'; asset: LabsAsset }

export function LabsApp({ dark, setDark }: Props) {
  const { t, i18n } = useTranslation('labs')
  const lang = i18n.language.slice(0, 2)
  const sp = useMemo(() => crmPalette(dark), [dark])
  const ls = useMemo(() => labsSurfaces(sp, dark), [sp, dark])

  const { plan } = useAgencySettings()
  const foldersApi = useLabsFolders()
  const assetsApi = useLabsAssets()
  useLabsVideoPolling(assetsApi.assets, assetsApi.poser)
  const gen = useLabsGenerate()
  const voix = useLabsVoice()
  const up = useLabsUpload()

  // ─── L'état de l'onglet ────────────────────────────────────────────────────
  const [folderId, setFolderId] = useTabScopedState<string | null>('labs.folder', null)
  const [view, setView] = useTabScopedState<LabsView>('labs.view', 'all')
  const [kind, setKind] = useTabScopedState<LabsKindFilter>('labs.kind', 'all')
  const [cols, setCols] = useTabScopedState<number>('labs.cols', 4)
  const [prompt, setPrompt] = useTabScopedState<string>('labs.prompt', '')
  const [mode, setMode] = useTabScopedState<LabsMode>('labs.mode', 'image')

  // ─── L'état de la barre ────────────────────────────────────────────────────
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [ratio, setRatio] = useState<LabsRatio>('4:3')
  const [resolution, setResolution] = useState<LabsResolution>('720p')
  const [durationS, setDurationS] = useState(8)
  const [voOpen, setVoOpen] = useState(false)
  const [voText, setVoText] = useState('')
  const [voice, setVoice] = useState<LabsVoice>(LABS_DEFAULT_VOICE)
  const [voiceLang, setVoiceLang] = useState<LabsVoiceLang>(LABS_DEFAULT_VOICE_LANG)
  const [lightboxId, setLightboxId] = useState<string | null>(null)
  const [folderModal, setFolderModal] = useState<FolderModal>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [avis, setAvis] = useState<string | null>(null)

  // Un dossier supprimé sous la sélection : on retombe sur « tout ».
  useEffect(() => {
    if (folderId && !foldersApi.isLoading && !foldersApi.folders.some((f) => f.id === folderId)) setFolderId(null)
  }, [folderId, foldersApi.folders, foldersApi.isLoading, setFolderId])

  const assets = assetsApi.assets
  const visibles = useMemo(() => labsFilter(assets, { folderId, view, kind }), [assets, folderId, view, kind])
  const counts = useMemo(() => labsCountByFolder(assets), [assets])
  const favCount = useMemo(() => assets.filter((a) => a.isFavorite).length, [assets])
  const usage = useMemo(() => labsMonthUsage(assets), [assets])
  const quota = { image: labsQuotaFor(plan, 'image'), video: labsQuotaFor(plan, 'video') }
  const source = sourceId ? assets.find((a) => a.id === sourceId) ?? null : null

  const hasVo = mode === 'video' && voOpen && voText.trim().length > 0
  const voSeconds = hasVo ? labsVoiceoverSeconds(voText) : null
  const estimatedS = labsVideoDurationS(voSeconds, durationS)
  const estimate = labsEstimateChf({ mode, resolution, durationS: estimatedS, hasVoiceover: hasVo })
  const busy = mode === 'image' ? gen.imageBusy : gen.videoBusy
  const canGenerate = prompt.trim().length >= 3 && !(hasVo && voSeconds != null && voSeconds + 1 > 30)

  const emptyKind: LabsEmptyKind = view === 'favorites' ? 'favorites' : folderId ? 'folder' : kind !== 'all' ? 'filter' : 'all'

  // ─── Gestes ────────────────────────────────────────────────────────────────
  const direErreur = (code: string, extra?: Record<string, unknown>) => {
    setAvis(t(`errors.${code}`, { ...extra, defaultValue: t('errors.unknown') }))
  }

  const generer = async () => {
    if (!canGenerate || busy) return
    setAvis(null)
    const dossier = view === 'favorites' ? null : folderId
    if (mode === 'image') {
      const r = await gen.generateImage({ prompt: prompt.trim(), folderId: dossier, sourceAssetId: source?.id ?? null, aspectRatio: source ? undefined : ratio, imageSize: '2K' })
      if (r.error || !r.asset) return direErreur(r.error ?? 'unknown', r.extra)
      assetsApi.inserer(r.asset)
      setSourceId(null)
      return
    }
    const r = await gen.submitVideo({
      prompt: prompt.trim(), folderId: dossier, sourceAssetId: source?.id ?? null,
      voiceoverText: hasVo ? voText.trim() : null, voiceName: voice, voiceLang, durationS, resolution,
    })
    if (r.error || !r.asset) return direErreur(r.error ?? 'unknown', r.extra)
    assetsApi.inserer(r.asset)
    setSourceId(null)
  }

  const importer = async (file: File) => {
    setAvis(null)
    const r = await up.upload(file, view === 'favorites' ? null : folderId)
    if (r.error || !r.asset) return direErreur(r.error ?? 'upload_failed')
    assetsApi.inserer(r.asset)
    setSourceId(r.asset.id)
  }

  const animer = (a: LabsAsset) => { setMode('video'); setSourceId(a.id); setLightboxId(null) }
  const commeSource = (a: LabsAsset) => { setMode('image'); setSourceId(a.id); setLightboxId(null) }
  const reutiliser = (a: LabsAsset) => {
    if (a.prompt) setPrompt(a.prompt)
    if (a.voiceoverText) {
      setVoOpen(true); setVoText(a.voiceoverText)
      // ⚠ La voix ET la langue suivent le texte : les rejouer d'après une détection
      // automatique donnerait une autre lecture que celle que l'agent a validée.
      if (a.voiceoverVoice) setVoice(a.voiceoverVoice as LabsVoice)
      if (a.voiceoverLang) setVoiceLang(a.voiceoverLang as LabsVoiceLang)
    }
    setMode(a.kind === 'video' ? 'video' : 'image')
    if (a.sourceAssetId && assets.some((x) => x.id === a.sourceAssetId)) setSourceId(a.sourceAssetId)
    setLightboxId(null)
  }
  const telecharger = async (a: LabsAsset) => {
    if (!a.url) return
    try {
      const res = await fetch(a.url)
      const blob = await res.blob()
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = labsDownloadName(a)
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(href), 2000)
    } catch {
      // CORS refusé par l'hôte : on ouvre le fichier dans un onglet, le navigateur propose l'enregistrement.
      const link = document.createElement('a')
      link.href = a.url
      link.target = '_blank'
      link.rel = 'noopener'
      link.click()
    }
  }
  const basculerFavori = (a: LabsAsset) => assetsApi.favorite.mutate({ id: a.id, isFavorite: !a.isFavorite })

  const lightboxIndex = lightboxId ? visibles.findIndex((a) => a.id === lightboxId) : -1
  const lightboxAsset = lightboxIndex >= 0 ? visibles[lightboxIndex] : null
  const aller = (delta: number) => {
    if (visibles.length === 0) return
    const i = (lightboxIndex + delta + visibles.length) % visibles.length
    setLightboxId(visibles[i].id)
  }

  const confirmer = async () => {
    if (!confirm) return
    if (confirm.kind === 'folder') {
      await foldersApi.remove.mutateAsync({ id: confirm.folder.id, name: confirm.folder.name })
      if (folderId === confirm.folder.id) setFolderId(null)
    } else {
      await assetsApi.remove.mutateAsync(confirm.asset.id)
      if (lightboxId === confirm.asset.id) setLightboxId(null)
      if (sourceId === confirm.asset.id) setSourceId(null)
    }
    setConfirm(null)
  }

  return (
    <div
      style={{
        position: 'relative', background: sp.pageBg, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--crm-font), sans-serif', color: sp.ink,
      }}
    >
      <style>{CRM_KEYFRAMES}</style>
      <style>{`.labs-spin{width:12px;height:12px;border-radius:999px;border:2px solid currentColor;border-top-color:transparent;animation:labs-spin .8s linear infinite;display:inline-block;flex-shrink:0}@keyframes labs-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <CrmWorkspace sp={sp} dark={dark} setDark={setDark} onCmd={() => setFolderModal({ mode: 'create' })}>
          {/* ⚠ LES QUATRE GOUTTIÈRES DES AUTRES ÉCRANS — `lg` en haut et à gauche, `7xl`
              à droite, `6xl` en bas (Aujourd'hui, Analytics, Messagerie, Réglages,
              Calendrier). Sans elles le cadre COLLE à la carte latérale et monte sous la
              bande d'onglets : c'est le défaut que la Messagerie a payé le 12.09.2026,
              et il se reproduit à l'identique sur toute surface qui pose sa carte
              directement dans la coquille. Le rayon est celui des bentos (`6xl`), pas
              celui des cartes intérieures. */}
          <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingTop: 'var(--crm-space-lg)', paddingLeft: 'var(--crm-space-lg)', paddingRight: 'var(--crm-space-7xl)', paddingBottom: 'var(--crm-space-6xl)' }}>
          <section
            style={{
              position: 'relative', height: '100%', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column',
              background: ls.card, border: `1px solid ${ls.bord}`, borderRadius: 'var(--crm-radius-6xl)', boxShadow: ls.shadow, overflow: 'hidden',
            }}
          >
            <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--crm-space-md) var(--crm-space-lg)', padding: 'var(--crm-space-lg) var(--crm-space-2xl)', borderBottom: `1px solid ${ls.bord}` }}>
              <LabsFolderMenu
                ls={ls}
                folders={foldersApi.folders}
                counts={counts}
                totalCount={assets.length}
                favCount={favCount}
                folderId={folderId}
                view={view}
                isLoading={foldersApi.isLoading}
                onSelectAll={() => { setView('all'); setFolderId(null) }}
                onSelectFavorites={() => setView('favorites')}
                onSelectFolder={(id) => { setView('all'); setFolderId(id) }}
                onNewFolder={() => setFolderModal({ mode: 'create' })}
                onRenameFolder={(f) => setFolderModal({ mode: 'rename', folder: f })}
                onDeleteFolder={(f) => setConfirm({ kind: 'folder', folder: f })}
                usage={usage}
                quota={quota}
              />
              <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: ls.soft, whiteSpace: 'nowrap' }}>{t('count', { count: visibles.length })}</span>
              <div style={{ display: 'inline-flex', padding: 'var(--crm-space-2xs)', background: ls.elev, borderRadius: LABS_PILL, border: `1px solid ${ls.bord}` }}>
                {(['all', 'image', 'video'] as LabsKindFilter[]).map((k) => {
                  const on = kind === k
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      aria-pressed={on}
                      style={{
                        height: 28, padding: '0 var(--crm-space-lg)', border: 0, borderRadius: LABS_PILL,
                        background: on ? ls.accent : 'transparent', color: on ? ls.accentInk : ls.sub,
                        fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, cursor: 'pointer', transition: LABS_TRANSITION,
                      }}
                    >
                      {t(`filter.${k}`)}
                    </button>
                  )
                })}
              </div>
              <label title={t('density')} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', color: ls.soft }}>
                <MEIcon name="layers" size={14} color={ls.soft} />
                <input
                  type="range"
                  min={3}
                  max={6}
                  value={cols}
                  onChange={(e) => setCols(Number(e.target.value))}
                  aria-label={t('density')}
                  style={{ width: 96, accentColor: ls.accent }}
                />
              </label>
            </header>

            {avis && (
              <div
                role="alert"
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-md) var(--crm-space-2xl)',
                  borderBottom: `1px solid ${ls.bord}`, color: ls.dangerText, fontSize: 'var(--crm-text-md)', fontWeight: 500,
                }}
              >
                <MEIcon name="alert" size={14} color={ls.dangerText} />
                <span style={{ flex: 1 }}>{avis}</span>
                <button type="button" onClick={() => setAvis(null)} aria-label={t('lightbox.close')} style={{ border: 0, background: 'transparent', color: ls.sub, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                  <MEIcon name="close" size={12} color={ls.sub} />
                </button>
              </div>
            )}

            {/* ⚠ BORD À BORD, sauf en bas. La mosaïque est collée (ni rayon ni écart) :
                lui laisser une gouttière latérale remettrait l'espace que le geste
                retire. Le cadre est en `overflow: hidden`, donc son rayon coupe les
                tuiles des coins proprement. Seule la réserve BASSE demeure — c'est la
                place de la barre de prompt, qui flotte au-dessus. */}
            <div className="scrollbar-hide" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 0 calc(var(--crm-space-7xl) * 7)' }}>
              <LabsGallery
                ls={ls}
                dark={dark}
                assets={visibles}
                cols={cols}
                isLoading={assetsApi.isLoading}
                isError={assetsApi.isError}
                emptyKind={emptyKind}
                lang={lang}
                onRetry={() => { void assetsApi.refetch(); void foldersApi.refetch() }}
                onOpen={(i) => setLightboxId(visibles[i]?.id ?? null)}
                onFavorite={basculerFavori}
                onAnimate={animer}
                onUseSource={commeSource}
                onDownload={(a) => { void telecharger(a) }}
              />
            </div>

            <LabsPromptBar
              ls={ls}
              mode={mode}
              onMode={(m) => { setMode(m); if (m === 'image') setVoOpen(false) }}
              prompt={prompt}
              onPrompt={setPrompt}
              source={source}
              onClearSource={() => setSourceId(null)}
              onAttachFile={(f) => { void importer(f) }}
              uploading={up.uploading}
              ratio={ratio}
              onRatio={setRatio}
              resolution={resolution}
              onResolution={setResolution}
              durationS={durationS}
              onDuration={setDurationS}
              voOpen={voOpen}
              onVoOpen={setVoOpen}
              voText={voText}
              onVoText={setVoText}
              voice={voice}
              onVoice={setVoice}
              voiceLang={voiceLang}
              onVoiceLang={setVoiceLang}
              voixEtat={voix.etat}
              onEcouter={() => {
                if (voix.etat.statut === 'lecture' || voix.etat.statut === 'chargement') voix.arreter()
                else void voix.jouerApercu('apercu', voText.trim(), voice, voiceLang)
              }}
              busy={busy}
              canGenerate={canGenerate}
              estimateChf={estimate}
              estimatedS={estimatedS}
              onGenerate={() => { void generer() }}
            />
          </section>
          </main>
        </CrmWorkspace>
      </div>

      {lightboxAsset && (
        <LabsLightbox
          ls={ls}
          asset={lightboxAsset}
          folders={foldersApi.folders}
          index={lightboxIndex}
          total={visibles.length}
          lang={lang}
          onClose={() => { voix.arreter(); setLightboxId(null) }}
          onPrev={() => { voix.arreter(); aller(-1) }}
          onNext={() => { voix.arreter(); aller(1) }}
          onFavorite={() => basculerFavori(lightboxAsset)}
          onAnimate={() => animer(lightboxAsset)}
          onUseSource={() => commeSource(lightboxAsset)}
          onReuse={() => reutiliser(lightboxAsset)}
          onDownload={() => { void telecharger(lightboxAsset) }}
          onDelete={() => setConfirm({ kind: 'asset', asset: lightboxAsset })}
          voixEtat={voix.etat}
          onEcouter={() => {
            if (voix.etat.statut === 'lecture' || voix.etat.statut === 'chargement') voix.arreter()
            else if (lightboxAsset.voiceoverUrl) voix.jouerUrl(lightboxAsset.id, lightboxAsset.voiceoverUrl)
          }}
          onMove={(fid) => assetsApi.move.mutate({ id: lightboxAsset.id, folderId: fid })}
        />
      )}

      {folderModal && (
        <LabsFolderModal
          ls={ls}
          mode={folderModal.mode}
          initialName={folderModal.mode === 'rename' ? folderModal.folder.name : ''}
          busy={foldersApi.create.isPending || foldersApi.rename.isPending}
          onClose={() => setFolderModal(null)}
          onSubmit={async (name) => {
            if (folderModal.mode === 'create') {
              const f = await foldersApi.create.mutateAsync(name)
              setView('all'); setFolderId(f.id)
            } else {
              await foldersApi.rename.mutateAsync({ id: folderModal.folder.id, name })
            }
            setFolderModal(null)
          }}
        />
      )}

      {confirm && (
        <LabsConfirmModal
          ls={ls}
          title={confirm.kind === 'folder' ? t('confirm.deleteFolderTitle') : t('confirm.deleteAssetTitle')}
          body={confirm.kind === 'folder' ? t('confirm.deleteFolderBody') : t('confirm.deleteAssetBody')}
          confirmLabel={t('confirm.delete')}
          busy={foldersApi.remove.isPending || assetsApi.remove.isPending}
          onClose={() => setConfirm(null)}
          onConfirm={() => { void confirmer() }}
        />
      )}
    </div>
  )
}
