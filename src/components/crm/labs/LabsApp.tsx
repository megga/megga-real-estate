/**
 * Orchestrateur du studio Labs (`/dashboard/labs`) : le chrome CRM (`CrmWorkspace`),
 * puis UNE carte plein cadre — la galerie, son en-tête (le menu des dossiers, la
 * recherche, les filtres, la densité) et, flottante en bas, la barre de prompt.
 *
 * ⚠ Plein cadre et non un bento `rail | galerie` (Julien, 20.09.2026 : « le pager
 * doit rester comme il est partout, pour profiter de la plus grande surface
 * disponible ») : les dossiers vivent dans le menu du titre, pas dans une colonne.
 *
 * Ce que l'écran fait : générer une image (Nano Banana 2) à partir d'un texte, d'une
 * photo ou d'un préréglage de home staging — jusqu'à quatre variations d'un coup —,
 * générer une vidéo (Seedance) à partir d'une image avec ou sans voix off, importer
 * une photo, et RANGER tout ça : cocher, ranger dans un dossier, étoiler, supprimer,
 * à l'unité ou par paquets. Ce qu'il ne fait pas encore : poser une production sur la
 * fiche d'un bien — le geste viendra de la fiche, pas d'ici.
 *
 * ── CE QUE CET ÉCRAN A APPRIS DU 20.09.2026 ──────────────────────────────────
 * Le studio savait PRODUIRE et ne savait pas RANGER, et ce déséquilibre se mesurait
 * en gestes : classer une production demandait de l'ouvrir, de descendre au bloc
 * « Informations » et d'y trouver une liste déroulante — soit trois gestes et un
 * aller-retour par image, trente-six pour la douzaine qu'une séance de staging
 * produit. Générer quatre variantes d'un salon en demandait quatre de plus, chacune
 * suivie de quinze secondes où RIEN ne bougeait à l'écran. Et retrouver un prompt
 * écrit la semaine d'avant n'était possible qu'en faisant défiler trois cents
 * vignettes. Un outil qui produit plus vite qu'il ne range finit en tas.
 *
 * ⚠ LE PRIX SE DIT EN CRÉDITS, JAMAIS EN FRANCS (Julien, 20.09.2026). Le solde vient de
 * `useCredits` (RPC `credits_balance`), chaque génération le repose depuis la réponse
 * de l'edge, et un refus `insufficient_credits` nomme le solde et mène à la
 * Consommation (`/dashboard/settings?tab=credits`), où l'on recharge.
 *
 * ⚠ L'état de l'écran vit dans l'ONGLET (`useTabScopedState`) : le dossier ouvert, la
 * recherche, la densité, le préréglage de staging et le brouillon de prompt survivent
 * à un aller-retour entre deux onglets. La SÉLECTION, elle, est éphémère — elle décrit
 * un geste en cours, pas un réglage.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CrmWorkspace from '@/components/crm/CrmWorkspace'
import { CRM_KEYFRAMES } from '@/components/crm/CrmShell'
import { crmPalette } from '@/components/crm/tokens'
import MEIcon from '@/components/propertyx/MEIcon'
import { useTabScopedState } from '@/hooks/useCrmTabs'
import { useEcranActif } from '@/hooks/useEcranActif'
import { useLabsAssets, useLabsVideoPolling } from '@/hooks/useLabsAssets'
import { useLabsFolders } from '@/hooks/useLabsFolders'
import { useLabsGenerate } from '@/hooks/useLabsGenerate'
import { useLabsUpload } from '@/hooks/useLabsUpload'
import {
  LABS_DEFAULT_VOICE, LABS_DEFAULT_VOICE_LANG, LABS_STAGING_DEFAULT_ROOM, LABS_STAGING_DEFAULT_STYLE,
  labsCountByFolder, labsDownloadName, labsEstimateCredits, labsFilter, labsOuvertAuPlan, labsPlage,
  labsSelectionEtat, labsStagingPrompt, labsTuileLocale, labsVariationsPossibles, labsVideoDurationS, labsVoiceoverSeconds,
  type LabsStagingRoom, type LabsStagingStyle, type LabsVariations, type LabsVoice, type LabsVoiceLang,
} from '@/lib/labs'
import { formatCredits } from '@/lib/credits'
import { useCredits } from '@/hooks/useCredits'
import { useNavigate } from 'react-router-dom'
import { useLabsVoice } from '@/hooks/useLabsVoice'
import type { LabsAsset, LabsFolder, LabsKindFilter, LabsMode, LabsRatio, LabsResolution, LabsView } from '@/types/labs'
import { LabsGallery, type LabsClicModif, type LabsEmptyKind } from './LabsGallery'
import { LabsLightbox } from './LabsLightbox'
import { LabsConfirmModal, LabsFolderModal } from './LabsModals'
import { LabsPromptBar } from './LabsPromptBar'
import { LabsFolderMenu } from './LabsFolderMenu'
import { LabsFolderPicker } from './LabsFolderPicker'
import { LabsSelectionBar } from './LabsSelectionBar'
import { LABS_PILL, LABS_TRANSITION, labsSurfaces } from './labsTokens'

interface Props { dark: boolean; setDark: (v: boolean) => void }

type FolderModal = null | { mode: 'create' } | { mode: 'rename'; folder: LabsFolder }
type Confirm =
  | null
  | { kind: 'folder'; folder: LabsFolder }
  | { kind: 'asset'; asset: LabsAsset }
  | { kind: 'lot'; ids: string[] }
/** Le menu « Ranger dans… » : sur QUOI il agit, et à quel rectangle il s'accroche. */
type Picker = null | { ancre: DOMRect; cible: { kind: 'asset'; asset: LabsAsset } | { kind: 'lot'; ids: string[] } }

export function LabsApp({ dark, setDark }: Props) {
  const { t, i18n } = useTranslation('labs')
  const lang = i18n.language.slice(0, 2)
  const sp = useMemo(() => crmPalette(dark), [dark])
  const ls = useMemo(() => labsSurfaces(sp, dark), [sp, dark])

  const credits = useCredits()
  const navigate = useNavigate()
  const foldersApi = useLabsFolders()
  const assetsApi = useLabsAssets()
  useLabsVideoPolling(assetsApi.assets, assetsApi.poser)
  const gen = useLabsGenerate()
  const voix = useLabsVoice()
  const up = useLabsUpload()
  const actif = useEcranActif()

  // ─── L'état de l'onglet ────────────────────────────────────────────────────
  const [folderId, setFolderId] = useTabScopedState<string | null>('labs.folder', null)
  const [view, setView] = useTabScopedState<LabsView>('labs.view', 'all')
  const [kind, setKind] = useTabScopedState<LabsKindFilter>('labs.kind', 'all')
  const [q, setQ] = useTabScopedState<string>('labs.q', '')
  const [cols, setCols] = useTabScopedState<number>('labs.cols', 4)
  const [prompt, setPrompt] = useTabScopedState<string>('labs.prompt', '')
  const [mode, setMode] = useTabScopedState<LabsMode>('labs.mode', 'image')
  const [variations, setVariations] = useTabScopedState<LabsVariations>('labs.variations', 1)
  const [stagingOn, setStagingOn] = useTabScopedState<boolean>('labs.staging', false)
  const [room, setRoom] = useTabScopedState<LabsStagingRoom>('labs.room', LABS_STAGING_DEFAULT_ROOM)
  const [stagingStyle, setStagingStyle] = useTabScopedState<LabsStagingStyle>('labs.style', LABS_STAGING_DEFAULT_STYLE)

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

  // ─── Le geste en cours ─────────────────────────────────────────────────────
  const [selection, setSelection] = useState<Set<string>>(() => new Set())
  /** La dernière cochée : c'est d'elle que part la plage Maj+clic. */
  const [ancreId, setAncreId] = useState<string | null>(null)
  const [picker, setPicker] = useState<Picker>(null)
  /** Les tuiles d'attente des variations — état d'écran, jamais le cache (cf. `labsTuileLocale`). */
  const [enVol, setEnVol] = useState<LabsAsset[]>([])
  const rechercheRef = useRef<HTMLInputElement | null>(null)

  // Un dossier supprimé sous la sélection : on retombe sur « tout ».
  useEffect(() => {
    if (folderId && !foldersApi.isLoading && !foldersApi.folders.some((f) => f.id === folderId)) setFolderId(null)
  }, [folderId, foldersApi.folders, foldersApi.isLoading, setFolderId])

  const assets = assetsApi.assets
  const listeServeur = useMemo(() => labsFilter(assets, { folderId, view, kind, q }), [assets, folderId, view, kind, q])
  // ⚠ Les tuiles en vol passent DEVANT, et ne se filtrent pas : elles n'ont ni favori
  // ni genre encore décidé, et les cacher derrière un filtre reviendrait à ne rien
  // montrer pendant quinze secondes — exactement le défaut qu'elles réparent.
  const visibles = useMemo(() => (enVol.length ? [...enVol, ...listeServeur] : listeServeur), [enVol, listeServeur])
  const ordreVisible = useMemo(() => listeServeur.map((a) => a.id), [listeServeur])
  const counts = useMemo(() => labsCountByFolder(assets), [assets])
  const favCount = useMemo(() => assets.filter((a) => a.isFavorite).length, [assets])
  const source = sourceId ? assets.find((a) => a.id === sourceId) ?? null : null
  // Le solde : `null` tant que la RPC n'a pas répondu — l'écran laisse alors l'edge trancher.
  const solde = credits.balance?.total ?? null
  // ⛔ Le PLAN d'abord : un Starter n'a pas « trop peu de crédits », il n'a pas le studio.
  // Lu dans le solde (plan effectif, `agency_plan_effectif`) ; `false` tant qu'il n'est pas lu.
  const planFerme = credits.balance != null && !labsOuvertAuPlan(credits.balance.plan)

  const hasVo = mode === 'video' && voOpen && voText.trim().length > 0
  const voSeconds = hasVo ? labsVoiceoverSeconds(voText) : null
  const estimatedS = labsVideoDurationS(voSeconds, durationS)
  // Le prix d'UNE production, en crédits ; la barre le multiplie par les variations.
  const estimate = labsEstimateCredits({ mode, resolution, durationS: estimatedS, hasVoiceover: hasVo })
  const busy = mode === 'image' ? gen.imageBusy : gen.videoBusy
  const canGenerate = prompt.trim().length >= 3 && !(hasVo && voSeconds != null && voSeconds + 1 > 30)

  const selEtat = useMemo(() => labsSelectionEtat(listeServeur, selection), [listeServeur, selection])
  const selectionActive = selEtat.total > 0
  const lotBusy = assetsApi.moveMany.isPending || assetsApi.favoriteMany.isPending || assetsApi.removeMany.isPending

  const emptyKind: LabsEmptyKind = q.trim()
    ? 'search'
    : view === 'favorites' ? 'favorites' : folderId ? 'folder' : kind !== 'all' ? 'filter' : 'all'

  // ─── Home staging : le préréglage ÉCRIT dans la barre ──────────────────────
  //
  // ⚠ Il n'écrit qu'aux gestes EXPLICITES (ouvrir le panneau, choisir une pièce, un
  // style) et quand la photo source apparaît ou disparaît — jamais au montage. Un
  // effet qui recomposerait à chaque rendu écraserait la retouche de l'agent, et le
  // brouillon restauré de l'onglet avec lui.
  const composer = (r: LabsStagingRoom, st: LabsStagingStyle, avecSource: boolean) => {
    setPrompt(labsStagingPrompt((cle, params) => t(cle, params ?? {}), r, st, avecSource))
  }
  const avaitSource = useRef<boolean | null>(null)
  useEffect(() => {
    const avec = !!source
    const premier = avaitSource.current === null
    avaitSource.current = avec
    if (premier || !stagingOn || mode !== 'image') return
    composer(room, stagingStyle, avec)
    // `composer` lit `t`, stable par langue ; recomposer sur la seule bascule de source.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!source])

  // ─── Gestes ────────────────────────────────────────────────────────────────
  const direErreur = (code: string, extra?: Record<string, unknown>) => {
    if (code === 'insufficient_credits') {
      const b = typeof extra?.balance === 'number' ? extra.balance : solde ?? 0
      const n = typeof extra?.needed === 'number' ? extra.needed : estimate
      setAvis(t('errors.insufficient_credits', { balance: formatCredits(b), needed: formatCredits(n) }))
      credits.rafraichir()
      return
    }
    setAvis(t(`errors.${code}`, { ...extra, defaultValue: t('errors.unknown') }))
  }

  /** La Consommation, dans les Réglages : c'est là qu'on recharge. */
  const allerRecharger = () => navigate('/dashboard/settings?tab=credits')
  /** La Facturation : c'est là que le plan change. */
  const allerPlans = () => navigate('/dashboard/settings?tab=billing')

  const viderSelection = () => { setSelection(new Set()); setAncreId(null) }

  // ⛔ La sélection se vide dès que la liste CHANGE DE SENS (dossier, vue, genre,
  // recherche) — la règle de la Messagerie. Agir sur douze productions qu'on ne voit
  // plus est le genre de geste qu'on ne rattrape pas.
  useEffect(() => { viderSelection() }, [folderId, view, kind, q])

  const basculer = (id: string, mod: LabsClicModif) => {
    setSelection((prev) => {
      const suivant = new Set(prev)
      if (mod.shift && ancreId) {
        for (const x of labsPlage(ordreVisible, ancreId, id)) suivant.add(x)
        return suivant
      }
      if (suivant.has(id)) suivant.delete(id)
      else suivant.add(id)
      return suivant
    })
    setAncreId(id)
  }

  const toutCocher = () => {
    if (selEtat.total >= listeServeur.length && listeServeur.length > 0) return viderSelection()
    setSelection(new Set(ordreVisible))
    setAncreId(ordreVisible[ordreVisible.length - 1] ?? null)
  }

  const lancerImage = async (p: { prompt: string; folderId: string | null; sourceAssetId: string | null; ratio: LabsRatio | null; n: number }) => {
    // « Refaire » passe par ici sans la barre : même porte du plan qu'elle.
    if (planFerme) return direErreur('upgrade_required')
    // Ne lancer que ce que le solde PAIE : quatre appels pour un seul crédit disponible
    // feraient trois refus et trois messages — l'edge refuse de toute façon, un par un.
    const prixUnitaire = labsEstimateCredits({ mode: 'image', resolution, durationS: 0, hasVoiceover: false })
    const restant = labsVariationsPossibles(p.n, solde, prixUnitaire)
    if (restant === 0) return direErreur('insufficient_credits', { balance: solde ?? 0, needed: prixUnitaire })
    if (restant < p.n) setAvis(t('errors.credits_partial', { n: restant }))
    const tuiles = Array.from({ length: restant }, (_, i) => labsTuileLocale({ ratio: p.ratio, prompt: p.prompt, folderId: p.folderId, n: i }))
    setEnVol((prev) => [...tuiles, ...prev])
    const retirer = (id: string) => setEnVol((prev) => prev.filter((x) => x.id !== id))
    // ⚠ EN PARALLÈLE, pas en file : quatre images rendues l'une après l'autre feraient
    // une minute d'attente là où le fournisseur en rend quatre en quinze secondes.
    await Promise.all(tuiles.map(async (tuile) => {
      const r = await gen.generateImage({
        prompt: p.prompt, folderId: p.folderId, sourceAssetId: p.sourceAssetId,
        aspectRatio: p.sourceAssetId ? undefined : (p.ratio ?? undefined), imageSize: '2K',
      })
      retirer(tuile.id)
      if (r.balance != null) credits.poserSolde(r.balance)
      if (r.error || !r.asset) { direErreur(r.error ?? 'unknown', r.extra); return }
      assetsApi.inserer(r.asset)
    }))
  }

  const generer = async () => {
    if (!canGenerate || busy || planFerme) return
    setAvis(null)
    const dossier = view === 'favorites' ? null : folderId
    if (mode === 'image') {
      await lancerImage({ prompt: prompt.trim(), folderId: dossier, sourceAssetId: source?.id ?? null, ratio: source ? null : ratio, n: variations })
      setSourceId(null)
      return
    }
    const r = await gen.submitVideo({
      prompt: prompt.trim(), folderId: dossier, sourceAssetId: source?.id ?? null,
      voiceoverText: hasVo ? voText.trim() : null, voiceName: voice, voiceLang, durationS, resolution,
    })
    if (r.balance != null) credits.poserSolde(r.balance)
    if (r.error || !r.asset) return direErreur(r.error ?? 'unknown', r.extra)
    assetsApi.inserer(r.asset)
    setSourceId(null)
  }

  /**
   * « Refaire » : relancer une production À L'IDENTIQUE, sans passer par la barre.
   *
   * ⚠ Une image en rend UNE, quel que soit le réglage de variations : refaire est un
   * geste de retouche, pas une série. Pour une série on repasse par la barre, où le
   * nombre est visible et le coût annoncé.
   */
  const refaire = async (a: LabsAsset) => {
    if (!a.prompt || gen.imageBusy) return
    setAvis(null)
    await lancerImage({
      prompt: a.prompt,
      folderId: a.folderId,
      sourceAssetId: a.sourceAssetId && assets.some((x) => x.id === a.sourceAssetId) ? a.sourceAssetId : null,
      ratio: (a.aspectRatio as LabsRatio | null) ?? null,
      n: 1,
    })
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

  // ─── Les mêmes gestes, sur la sélection ────────────────────────────────────
  const idsSelection = () => [...selection]

  const rangerLot = (folderIdCible: string | null, ids: string[]) => {
    assetsApi.moveMany.mutate({ ids, folderId: folderIdCible })
    setPicker(null)
    viderSelection()
  }

  const favoriLot = () => {
    assetsApi.favoriteMany.mutate({ ids: idsSelection(), isFavorite: !selEtat.toutesFavorites })
  }

  // ⚠ SÉQUENTIEL : un navigateur qui reçoit douze téléchargements d'un coup en bloque
  // onze en silence. Chacun attend le précédent, et l'agent les voit arriver.
  const telechargerLot = async () => {
    const vise = new Set(selection)
    for (const a of listeServeur) {
      if (!vise.has(a.id) || !a.url) continue
      await telecharger(a)
    }
  }

  const lightboxIndex = lightboxId ? visibles.findIndex((a) => a.id === lightboxId) : -1
  const lightboxAsset = lightboxIndex >= 0 ? visibles[lightboxIndex] : null
  const lightboxSource = lightboxAsset?.sourceAssetId
    ? assets.find((x) => x.id === lightboxAsset.sourceAssetId) ?? null
    : null
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
    } else if (confirm.kind === 'lot') {
      await assetsApi.removeMany.mutateAsync(confirm.ids)
      viderSelection()
    } else {
      await assetsApi.remove.mutateAsync(confirm.asset.id)
      if (lightboxId === confirm.asset.id) setLightboxId(null)
      if (sourceId === confirm.asset.id) setSourceId(null)
    }
    setConfirm(null)
  }

  /**
   * Le clavier de la galerie.
   *
   * ⛔ ÉCRAN CACHÉ MUET (`useEcranActif`, CLAUDE.md §8) : jusqu'à six écrans d'onglet
   * restent montés, et une touche à une lettre posée ici partirait depuis n'importe
   * lequel — `Suppr` EFFACE, ce n'est pas un raccourci qu'on laisse fuir.
   *
   * ⛔ Et il se tait dès qu'une saisie a le focus, ou qu'une modale est ouverte : la
   * visionneuse et les modales sont portées dans `<body>`, hors du masquage de leur
   * écran, et portent leurs propres touches.
   */
  useEffect(() => {
    if (!actif) return
    const modaleOuverte = !!lightboxId || !!folderModal || !!confirm || !!picker
    const onKey = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null
      if (cible && (/^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName) || cible.isContentEditable)) {
        // `/` et Échap restent utiles DANS la recherche : l'une la quitte, l'autre la vide.
        if (e.key === 'Escape' && cible === rechercheRef.current) { setQ(''); cible.blur() }
        return
      }
      if (modaleOuverte) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); toutCocher(); return }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '/') { e.preventDefault(); rechercheRef.current?.focus(); return }
      if (e.key === 'Escape' && selectionActive) { e.preventDefault(); viderSelection(); return }
      if (!selectionActive) return
      if (e.key.toLowerCase() === 'f') { e.preventDefault(); favoriLot(); return }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); setConfirm({ kind: 'lot', ids: idsSelection() }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

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
            {/* ⚠ L'EN-TÊTE A DEUX VISAGES, jamais deux rangées : cocher une production
                remplace le titre et les filtres par les gestes du lot, et la croix les
                rend. Empiler une seconde barre ferait sauter la galerie de 44 px à
                chaque case cochée — sur une mosaïque, c'est tout l'écran qui bouge. */}
            <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--crm-space-md) var(--crm-space-lg)', padding: 'var(--crm-space-lg) var(--crm-space-2xl)', borderBottom: `1px solid ${ls.bord}`, minHeight: 60 }}>
              {selectionActive ? (
                <LabsSelectionBar
                  ls={ls}
                  count={selEtat.total}
                  telechargeables={selEtat.telechargeables}
                  toutesFavorites={selEtat.toutesFavorites}
                  toutCoche={selEtat.total >= listeServeur.length}
                  busy={lotBusy}
                  onToutCocher={toutCocher}
                  onRanger={(ancre) => setPicker({ ancre, cible: { kind: 'lot', ids: idsSelection() } })}
                  onFavori={favoriLot}
                  onTelecharger={() => { void telechargerLot() }}
                  onSupprimer={() => setConfirm({ kind: 'lot', ids: idsSelection() })}
                  onAnnuler={viderSelection}
                />
              ) : (
                <>
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
                    solde={solde}
                    onCredits={allerRecharger}
                  />
                  <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: ls.soft, whiteSpace: 'nowrap' }}>{t('count', { count: listeServeur.length })}</span>

                  {/* ⚠ La recherche lit le PROMPT et la voix off — le seul texte qu'une
                      production porte. Une photo importée n'en a pas : c'est son dossier
                      qui la retrouve, et l'état vide de la recherche le dit. */}
                  <label
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 32,
                      padding: '0 var(--crm-space-md)', borderRadius: LABS_PILL, background: ls.elev,
                      border: `1px solid ${q ? ls.accent : ls.bord}`, transition: LABS_TRANSITION, flex: '0 1 240px', minWidth: 140,
                    }}
                  >
                    <MEIcon name="search" size={13} color={ls.soft} />
                    <input
                      ref={rechercheRef}
                      type="search"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder={t('search.placeholder')}
                      aria-label={t('search.aria')}
                      style={{
                        flex: 1, minWidth: 0, border: 0, background: 'transparent', outline: 'none', color: ls.ink,
                        fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', padding: 0,
                      }}
                    />
                    {q && (
                      <button
                        type="button"
                        onClick={() => setQ('')}
                        title={t('search.clear')}
                        aria-label={t('search.clear')}
                        style={{ border: 0, background: 'transparent', color: ls.sub, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}
                      >
                        <MEIcon name="close" size={11} color={ls.sub} />
                      </button>
                    )}
                  </label>

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
                </>
              )}
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
                selection={selection}
                selectionActive={selectionActive}
                onRetry={() => { void assetsApi.refetch(); void foldersApi.refetch() }}
                onOpen={(i) => setLightboxId(visibles[i]?.id ?? null)}
                onToggle={basculer}
                onFavorite={basculerFavori}
                onAnimate={animer}
                onUseSource={commeSource}
                onDownload={(a) => { void telecharger(a) }}
                onRanger={(a, ancre) => setPicker({ ancre, cible: { kind: 'asset', asset: a } })}
                onRefaire={(a) => { void refaire(a) }}
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
              variations={variations}
              onVariations={setVariations}
              stagingOn={stagingOn}
              onStagingOn={(v) => { setStagingOn(v); if (v) composer(room, stagingStyle, !!source) }}
              room={room}
              onRoom={(r) => { setRoom(r); composer(r, stagingStyle, !!source) }}
              stagingStyle={stagingStyle}
              onStagingStyle={(st) => { setStagingStyle(st); composer(room, st, !!source) }}
              busy={busy}
              canGenerate={canGenerate}
              estimateCredits={estimate}
              estimatedS={estimatedS}
              solde={solde}
              onRecharger={allerRecharger}
              planFerme={planFerme}
              onVoirPlans={allerPlans}
              onGenerate={() => { void generer() }}
            />
          </section>
          </main>
        </CrmWorkspace>
      </div>

      {picker && (
        <LabsFolderPicker
          ls={ls}
          ancre={picker.ancre}
          folders={foldersApi.folders}
          folderId={picker.cible.kind === 'asset' ? picker.cible.asset.folderId : undefined}
          onChoose={(fid) => {
            if (picker.cible.kind === 'asset') {
              assetsApi.move.mutate({ id: picker.cible.asset.id, folderId: fid })
              setPicker(null)
            } else {
              rangerLot(fid, picker.cible.ids)
            }
          }}
          onNewFolder={() => { setPicker(null); setFolderModal({ mode: 'create' }) }}
          onClose={() => setPicker(null)}
        />
      )}

      {lightboxAsset && (
        <LabsLightbox
          ls={ls}
          asset={lightboxAsset}
          source={lightboxSource}
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
          onRedo={() => { void refaire(lightboxAsset) }}
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
          title={
            confirm.kind === 'folder' ? t('confirm.deleteFolderTitle')
              : confirm.kind === 'lot' ? t('confirm.deleteLotTitle', { count: confirm.ids.length })
              : t('confirm.deleteAssetTitle')
          }
          body={
            confirm.kind === 'folder' ? t('confirm.deleteFolderBody')
              : confirm.kind === 'lot' ? t('confirm.deleteLotBody')
              : t('confirm.deleteAssetBody')
          }
          confirmLabel={t('confirm.delete')}
          busy={foldersApi.remove.isPending || assetsApi.remove.isPending || assetsApi.removeMany.isPending}
          onClose={() => setConfirm(null)}
          onConfirm={() => { void confirmer() }}
        />
      )}
    </div>
  )
}
