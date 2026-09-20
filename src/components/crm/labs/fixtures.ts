/**
 * Données du banc `/dev/labs` : trois états — studio garni, studio vide, erreur de
 * lecture — servis SANS base de données, et des gestes qui s'appliquent en mémoire
 * (créer un dossier, générer une image, soumettre une vidéo qui aboutit six secondes
 * plus tard) pour qu'un humain voie l'écran bouger.
 *
 * ⛔ Aucune image réelle : des SVG en `data:` URI, dessinés ici. Le banc reste
 * lisible hors ligne, et rien de ce qu'il montre ne ressemble à un bien existant.
 */
import { createContext, useContext } from 'react'
import { MXC_COLOR, MXC_SYSTEM } from '@/components/megga-x-crm/tokens'
import { labsVideoDurationS, labsVoiceoverSeconds } from '@/lib/labs'
import type { LabsAsset, LabsFolder } from '@/types/labs'

export type LabsFixtureState = 'full' | 'empty' | 'error'
export const LabsFixturesContext = createContext<LabsFixtureState | null>(null)
export function useLabsFixtures(): LabsFixtureState | null {
  return useContext(LabsFixturesContext)
}

/** Une vignette : dégradé + libellé, en SVG. */
function vignette(w: number, h: number, a: string, b: string, label: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>
<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs>
<rect width='${w}' height='${h}' fill='url(#g)'/>
<text x='50%' y='52%' font-family='Inter Tight, sans-serif' font-size='${Math.round(w / 18)}' fill='${MXC_COLOR.n1000}' fill-opacity='.9' text-anchor='middle'>${label}</text>
</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const MAINTENANT = Date.now()
const il_y_a = (min: number) => new Date(MAINTENANT - min * 60_000).toISOString()

export const FX_FOLDERS: LabsFolder[] = [
  { id: 'fx-f1', name: 'Villa Exemple — visuels', sortOrder: 0, createdAt: il_y_a(60 * 24 * 3) },
  { id: 'fx-f2', name: 'Appartement Exemple — vidéos', sortOrder: 1, createdAt: il_y_a(60 * 24) },
  { id: 'fx-f3', name: 'Brouillons', sortOrder: 2, createdAt: il_y_a(90) },
]

/**
 * Une piste audible SANS réseau : 1,2 s de sinusoïde à 440 Hz, encodée en WAV dans
 * une `data:` URI. Le bouton ▶ du banc joue donc VRAIMENT quelque chose — sans elle
 * on éprouverait un bouton qui ne prouve rien.
 */
function bipWav(secondes = 1.2, hz = 440, rate = 8000): string {
  const n = Math.floor(secondes * rate)
  const o = new Uint8Array(44 + n * 2)
  const dv = new DataView(o.buffer)
  const asc = (at: number, t: string) => { for (let i = 0; i < t.length; i++) o[at + i] = t.charCodeAt(i) }
  asc(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); asc(8, 'WAVE'); asc(12, 'fmt ')
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true)
  dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true)
  asc(36, 'data'); dv.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) {
    // Fondu aux deux bouts : un carré net claque dans les enceintes.
    const fondu = Math.min(1, i / (rate * 0.08), (n - i) / (rate * 0.08))
    dv.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * 8000 * fondu), true)
  }
  let bin = ''
  for (let i = 0; i < o.length; i += 0x8000) bin += String.fromCharCode(...o.subarray(i, i + 0x8000))
  return `data:audio/wav;base64,${btoa(bin)}`
}

const BIP = bipWav()

const base = (o: Partial<LabsAsset> & Pick<LabsAsset, 'id' | 'kind' | 'createdAt'>): LabsAsset => ({
  folderId: null, createdBy: 'fx-user', status: 'ready', prompt: null, voiceoverText: null, voiceoverVoice: null,
  voiceoverLang: null, voiceoverUrl: null,
  sourceAssetId: null, url: null, thumbnailUrl: null, width: null, height: null, durationS: null, aspectRatio: null,
  model: null, errorCode: null, costChf: null, isFavorite: false, completedAt: o.createdAt, ...o,
})

const IMG = (w: number, h: number, a: string, b: string, l: string) => vignette(w, h, a, b, l)
// Les teintes des vignettes sont des BARREAUX de la vitrine (aucun hex ici : le
// cliquet de couleur lit ce dossier), assombris par le texte blanc du SVG.
const T = {
  sable: [MXC_SYSTEM.yellow400, MXC_COLOR.n500] as const,
  ardoise: [MXC_SYSTEM.blue300, MXC_COLOR.n500] as const,
  mousse: [MXC_SYSTEM.green300, MXC_COLOR.n500] as const,
  brique: [MXC_SYSTEM.red400, MXC_COLOR.n500] as const,
  gris: [MXC_COLOR.n100, MXC_COLOR.n500] as const,
}

export const FX_ASSETS_INITIAL: LabsAsset[] = [
  base({ id: 'fx-a1', kind: 'image', createdAt: il_y_a(12), folderId: 'fx-f1', prompt: 'Salon scandinave lumineux, canapé lin, table basse chêne, plantes', url: IMG(1600, 1200, ...T.sable, 'Salon · staging'), thumbnailUrl: IMG(800, 600, ...T.sable, 'Salon · staging'), width: 1600, height: 1200, aspectRatio: '4:3', model: 'gemini-3.1-flash-image-preview', costChf: 0.091, isFavorite: true, sourceAssetId: 'fx-a6' }),
  base({ id: 'fx-a2', kind: 'video', createdAt: il_y_a(5), folderId: 'fx-f2', status: 'generating', prompt: 'Travelling lent depuis l’entrée vers la baie vitrée', voiceoverText: 'Bienvenue dans cet appartement traversant, au cœur des Eaux-Vives.', voiceoverVoice: 'Kore', voiceoverLang: 'fr', voiceoverUrl: BIP, thumbnailUrl: IMG(1280, 720, ...T.ardoise, 'Vidéo · en cours'), durationS: 8, aspectRatio: '16:9', model: 'bytedance/seedance-2.5/image-to-video', costChf: 3.34, sourceAssetId: 'fx-a3', completedAt: null }),
  base({ id: 'fx-a3', kind: 'image', createdAt: il_y_a(38), folderId: 'fx-f2', prompt: 'Cuisine ouverte, plan de travail marbre, lumière du soir', url: IMG(1600, 900, ...T.sable, 'Cuisine'), thumbnailUrl: IMG(800, 450, ...T.sable, 'Cuisine'), width: 1600, height: 900, aspectRatio: '16:9', model: 'gemini-3.1-flash-image-preview', costChf: 0.091 }),
  base({ id: 'fx-a4', kind: 'video', createdAt: il_y_a(60 * 5), folderId: 'fx-f2', prompt: 'Panoramique de la terrasse au coucher du soleil', voiceoverText: null, url: '', thumbnailUrl: IMG(1280, 720, ...T.brique, 'Terrasse · vidéo'), durationS: 10, aspectRatio: '16:9', model: 'bytedance/seedance-2.5/image-to-video', costChf: 4.16, isFavorite: true, sourceAssetId: null }),
  base({ id: 'fx-a5', kind: 'image', createdAt: il_y_a(60 * 26), folderId: 'fx-f1', prompt: 'Chambre parentale, lit en chêne, linge beige, rideaux lin', url: IMG(1200, 1600, ...T.ardoise, 'Chambre'), thumbnailUrl: IMG(600, 800, ...T.ardoise, 'Chambre'), width: 1200, height: 1600, aspectRatio: '3:4', model: 'gemini-3.1-flash-image-preview', costChf: 0.091 }),
  base({ id: 'fx-a6', kind: 'upload', createdAt: il_y_a(60 * 27), folderId: 'fx-f1', url: IMG(1600, 1200, ...T.gris, 'Photo importée'), thumbnailUrl: IMG(800, 600, ...T.gris, 'Photo importée'), width: 1600, height: 1200 }),
  base({ id: 'fx-a7', kind: 'image', createdAt: il_y_a(60 * 50), folderId: null, status: 'failed', errorCode: 'no_image', prompt: 'Jardin d’hiver avec verrière', thumbnailUrl: null, aspectRatio: '1:1', model: 'gemini-3.1-flash-image-preview' }),
  base({ id: 'fx-a8', kind: 'image', createdAt: il_y_a(60 * 72), folderId: 'fx-f3', prompt: 'Bureau à domicile, style minimal, lumière du nord', url: IMG(1600, 1600, ...T.mousse, 'Bureau'), thumbnailUrl: IMG(800, 800, ...T.mousse, 'Bureau'), width: 1600, height: 1600, aspectRatio: '1:1', model: 'gemini-3.1-flash-image-preview', costChf: 0.091 }),
  base({ id: 'fx-a9', kind: 'image', createdAt: il_y_a(60 * 80), folderId: 'fx-f1', prompt: 'Salle de bain en marbre veiné, double vasque, lumière zénithale', url: IMG(1600, 1200, ...T.gris, 'Salle de bain'), thumbnailUrl: IMG(800, 600, ...T.gris, 'Salle de bain'), width: 1600, height: 1200, aspectRatio: '4:3', model: 'gemini-3.1-flash-image-preview', costChf: 0.091 }),
  base({ id: 'fx-a10', kind: 'image', createdAt: il_y_a(60 * 96), folderId: null, prompt: 'Entrée avec verrière, sol en pierre naturelle', url: IMG(1200, 1600, ...T.mousse, 'Entrée'), thumbnailUrl: IMG(600, 800, ...T.mousse, 'Entrée'), width: 1200, height: 1600, aspectRatio: '3:4', model: 'gemini-3.1-flash-image-preview', costChf: 0.091 }),
  base({ id: 'fx-a11', kind: 'video', createdAt: il_y_a(60 * 100), folderId: 'fx-f2', prompt: 'Montée d’escalier vers la mezzanine', url: '', thumbnailUrl: IMG(1280, 720, ...T.ardoise, 'Escalier'), durationS: 6, aspectRatio: '16:9', model: 'bytedance/seedance-2.5/image-to-video', costChf: 2.5, voiceoverText: 'Un escalier de chêne massif dessert la mezzanine.', voiceoverVoice: 'Charon', voiceoverLang: 'fr', voiceoverUrl: BIP }),
  base({ id: 'fx-a12', kind: 'image', createdAt: il_y_a(60 * 120), folderId: 'fx-f3', prompt: 'Cave à vin climatisée, casiers en chêne', url: IMG(1600, 1600, ...T.brique, 'Cave'), thumbnailUrl: IMG(800, 800, ...T.brique, 'Cave'), width: 1600, height: 1600, aspectRatio: '1:1', model: 'gemini-3.1-flash-image-preview', costChf: 0.091 }),
  base({ id: 'fx-a13', kind: 'upload', createdAt: il_y_a(60 * 140), folderId: null, url: IMG(1600, 900, ...T.gris, 'Plan importé'), thumbnailUrl: IMG(800, 450, ...T.gris, 'Plan importé'), width: 1600, height: 900 }),
  base({ id: 'fx-a14', kind: 'image', createdAt: il_y_a(60 * 160), folderId: 'fx-f1', prompt: 'Terrasse plein sud, mobilier outdoor en teck', url: IMG(1600, 1000, ...T.sable, 'Terrasse'), thumbnailUrl: IMG(800, 500, ...T.sable, 'Terrasse'), width: 1600, height: 1000, aspectRatio: '16:9', model: 'gemini-3.1-flash-image-preview', costChf: 0.091, isFavorite: true }),
  base({ id: 'fx-a15', kind: 'image', createdAt: il_y_a(60 * 180), folderId: null, prompt: 'Dressing sur mesure, portes miroir', url: IMG(1200, 1500, ...T.ardoise, 'Dressing'), thumbnailUrl: IMG(600, 750, ...T.ardoise, 'Dressing'), width: 1200, height: 1500, aspectRatio: '3:4', model: 'gemini-3.1-flash-image-preview', costChf: 0.091 }),
  base({ id: 'fx-a16', kind: 'video', createdAt: il_y_a(60 * 200), folderId: 'fx-f2', prompt: 'Vue plongeante sur le jardin depuis le balcon', url: '', thumbnailUrl: IMG(1280, 960, ...T.mousse, 'Jardin'), durationS: 8, aspectRatio: '4:3', model: 'bytedance/seedance-2.5/text-to-video', costChf: 3.34 }),
  base({ id: 'fx-a17', kind: 'image', createdAt: il_y_a(60 * 220), folderId: 'fx-f3', prompt: 'Buanderie fonctionnelle, rangements toute hauteur', url: IMG(1600, 1200, ...T.mousse, 'Buanderie'), thumbnailUrl: IMG(800, 600, ...T.mousse, 'Buanderie'), width: 1600, height: 1200, aspectRatio: '4:3', model: 'gemini-3.1-flash-image-preview', costChf: 0.091 }),
  base({ id: 'fx-a18', kind: 'image', createdAt: il_y_a(60 * 240), folderId: null, prompt: 'Façade au crépuscule, éclairage d’ambiance', url: IMG(1600, 900, ...T.brique, 'Façade'), thumbnailUrl: IMG(800, 450, ...T.brique, 'Façade'), width: 1600, height: 900, aspectRatio: '16:9', model: 'gemini-3.1-flash-image-preview', costChf: 0.091 }),
]

/** Le magasin en mémoire — un tableau de module, qu'un rechargement remet à neuf. */
let folders: LabsFolder[] = [...FX_FOLDERS]
let assets: LabsAsset[] = [...FX_ASSETS_INITIAL]
const ecouteurs = new Set<() => void>()
function notifier() { for (const f of ecouteurs) f() }
export function fxEcouter(f: () => void): () => void {
  ecouteurs.add(f)
  return () => { ecouteurs.delete(f) }
}

export function fxFolders(state: LabsFixtureState): LabsFolder[] {
  if (state === 'error') throw new Error('fixture: erreur de lecture')
  return state === 'empty' ? [] : [...folders]
}
export function fxAssets(state: LabsFixtureState): LabsAsset[] {
  if (state === 'error') throw new Error('fixture: erreur de lecture')
  return state === 'empty' ? [] : [...assets]
}

export function fxCreateFolder(name: string): LabsFolder {
  const f: LabsFolder = { id: `fx-f${Date.now()}`, name, sortOrder: folders.length, createdAt: new Date().toISOString() }
  folders = [...folders, f]
  notifier()
  return f
}
export function fxRenameFolder(id: string, name: string): void {
  folders = folders.map((f) => (f.id === id ? { ...f, name } : f))
  notifier()
}
export function fxDeleteFolder(id: string): void {
  folders = folders.filter((f) => f.id !== id)
  assets = assets.map((a) => (a.folderId === id ? { ...a, folderId: null } : a))
  notifier()
}
export function fxPatchAsset(id: string, patch: Partial<LabsAsset>): void {
  assets = assets.map((a) => (a.id === id ? { ...a, ...patch } : a))
  notifier()
}
export function fxRemoveAsset(id: string): void {
  assets = assets.filter((a) => a.id !== id)
  notifier()
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * L'aperçu de voix du banc : le même bip, rendu dans la FORME de la réponse de
 * `labs-voice-preview` (base64 + mime), après un délai crédible. Le bouton ▶ du banc
 * éprouve donc le vrai chemin — chargement, lecture, arrêt — sans edge ni clé.
 */
export async function fxApercuVoix(): Promise<{ data: { audio: string; mime: string; durationS: number } | null; error: string | null }> {
  await wait(700)
  return { data: { audio: BIP.slice(BIP.indexOf(',') + 1), mime: 'audio/wav', durationS: 1.2 }, error: null }
}

/**
 * ⛔ L'IDENTIFIANT PORTE UN COMPTEUR, PAS SEULEMENT L'HORLOGE. Quatre variations
 * partent EN PARALLÈLE et attendent la même durée : `Date.now()` leur rend la même
 * milliseconde, donc le même id — React n'en affiche alors qu'une, et le banc ferait
 * croire que les variations ne marchent pas.
 */
let fxSerie = 0

export async function fxGenerateImage(prompt: string, folderId: string | null, sourceAssetId: string | null): Promise<LabsAsset> {
  const rang = (fxSerie += 1)
  // Un peu de dispersion : les quatre tuiles ne se remplissent pas toutes d'un coup.
  await wait(1200 + (rang % 4) * 450)
  const teintes: [string, string][] = [[...T.sable], [...T.ardoise], [...T.mousse], [...T.brique]]
  const [a, b] = teintes[rang % teintes.length]
  const now = new Date().toISOString()
  const etiquette = `Image générée ${rang}`
  const asset = base({
    id: `fx-a${Date.now()}-${rang}`, kind: 'image', createdAt: now, folderId, sourceAssetId, prompt,
    url: IMG(1600, 1200, a, b, etiquette), thumbnailUrl: IMG(800, 600, a, b, etiquette),
    width: 1600, height: 1200, aspectRatio: '4:3', model: 'gemini-3.1-flash-image-preview', costChf: 0.091,
  })
  assets = [asset, ...assets]
  notifier()
  return asset
}

export async function fxSubmitVideo(prompt: string, folderId: string | null, sourceAssetId: string | null, voiceoverText: string | null, durationS: number): Promise<LabsAsset> {
  await wait(600)
  const source = assets.find((x) => x.id === sourceAssetId)
  const now = new Date().toISOString()
  // La même règle que l'edge : la narration + 1 s, sinon la durée choisie.
  const dureeS = labsVideoDurationS(voiceoverText ? labsVoiceoverSeconds(voiceoverText) : null, durationS)
  const asset = base({
    id: `fx-v${Date.now()}`, kind: 'video', createdAt: now, folderId, sourceAssetId, prompt, status: 'generating',
    voiceoverText, voiceoverVoice: voiceoverText ? 'Kore' : null,
    voiceoverLang: voiceoverText ? 'fr' : null, voiceoverUrl: voiceoverText ? BIP : null,
    thumbnailUrl: source?.thumbnailUrl ?? IMG(1280, 720, ...T.ardoise, 'Vidéo'),
    durationS: dureeS, aspectRatio: '16:9', model: 'bytedance/seedance-2.5/image-to-video', costChf: 3.34, completedAt: null,
  })
  assets = [asset, ...assets]
  notifier()
  // Le banc « aboutit » seul : c'est le geste qu'on veut voir sans fal.ai.
  setTimeout(() => fxPatchAsset(asset.id, { status: 'ready', url: '', completedAt: new Date().toISOString() }), 6000)
  return asset
}

export async function fxUpload(file: File, folderId: string | null): Promise<LabsAsset> {
  await wait(400)
  const url = URL.createObjectURL(file)
  const asset = base({ id: `fx-u${Date.now()}`, kind: 'upload', createdAt: new Date().toISOString(), folderId, url, thumbnailUrl: url })
  assets = [asset, ...assets]
  notifier()
  return asset
}
