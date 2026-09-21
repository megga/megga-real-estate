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
import { CREDIT_PACKS, creditsPourImage, creditsPourVideo, type AutoTopupSeuil, type CreditBalance, type CreditLedgerEntry, type CreditPackId, type CreditRecu } from '@/lib/credits'
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
  model: null, errorCode: null, credits: null, isFavorite: false, completedAt: o.createdAt, ...o,
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
  base({ id: 'fx-a1', kind: 'image', createdAt: il_y_a(12), folderId: 'fx-f1', prompt: 'Salon scandinave lumineux, canapé lin, table basse chêne, plantes', url: IMG(1600, 1200, ...T.sable, 'Salon · staging'), thumbnailUrl: IMG(800, 600, ...T.sable, 'Salon · staging'), width: 1600, height: 1200, aspectRatio: '4:3', model: 'gemini-3.1-flash-image-preview', credits: 5, isFavorite: true, sourceAssetId: 'fx-a6' }),
  base({ id: 'fx-a2', kind: 'video', createdAt: il_y_a(5), folderId: 'fx-f2', status: 'generating', prompt: 'Travelling lent depuis l’entrée vers la baie vitrée', voiceoverText: 'Bienvenue dans cet appartement traversant, au cœur des Eaux-Vives.', voiceoverVoice: 'Kore', voiceoverLang: 'fr', voiceoverUrl: BIP, thumbnailUrl: IMG(1280, 720, ...T.ardoise, 'Vidéo · en cours'), durationS: 8, aspectRatio: '16:9', model: 'bytedance/seedance-2.5/image-to-video', credits: 154, sourceAssetId: 'fx-a3', completedAt: null }),
  base({ id: 'fx-a3', kind: 'image', createdAt: il_y_a(38), folderId: 'fx-f2', prompt: 'Cuisine ouverte, plan de travail marbre, lumière du soir', url: IMG(1600, 900, ...T.sable, 'Cuisine'), thumbnailUrl: IMG(800, 450, ...T.sable, 'Cuisine'), width: 1600, height: 900, aspectRatio: '16:9', model: 'gemini-3.1-flash-image-preview', credits: 5 }),
  base({ id: 'fx-a4', kind: 'video', createdAt: il_y_a(60 * 5), folderId: 'fx-f2', prompt: 'Panoramique de la terrasse au coucher du soleil', voiceoverText: null, url: '', thumbnailUrl: IMG(1280, 720, ...T.brique, 'Terrasse · vidéo'), durationS: 10, aspectRatio: '16:9', model: 'bytedance/seedance-2.5/image-to-video', credits: 180, isFavorite: true, sourceAssetId: null }),
  base({ id: 'fx-a5', kind: 'image', createdAt: il_y_a(60 * 26), folderId: 'fx-f1', prompt: 'Chambre parentale, lit en chêne, linge beige, rideaux lin', url: IMG(1200, 1600, ...T.ardoise, 'Chambre'), thumbnailUrl: IMG(600, 800, ...T.ardoise, 'Chambre'), width: 1200, height: 1600, aspectRatio: '3:4', model: 'gemini-3.1-flash-image-preview', credits: 5 }),
  base({ id: 'fx-a6', kind: 'upload', createdAt: il_y_a(60 * 27), folderId: 'fx-f1', url: IMG(1600, 1200, ...T.gris, 'Photo importée'), thumbnailUrl: IMG(800, 600, ...T.gris, 'Photo importée'), width: 1600, height: 1200 }),
  base({ id: 'fx-a7', kind: 'image', createdAt: il_y_a(60 * 50), folderId: null, status: 'failed', errorCode: 'no_image', prompt: 'Jardin d’hiver avec verrière', thumbnailUrl: null, aspectRatio: '1:1', model: 'gemini-3.1-flash-image-preview' }),
  base({ id: 'fx-a8', kind: 'image', createdAt: il_y_a(60 * 72), folderId: 'fx-f3', prompt: 'Bureau à domicile, style minimal, lumière du nord', url: IMG(1600, 1600, ...T.mousse, 'Bureau'), thumbnailUrl: IMG(800, 800, ...T.mousse, 'Bureau'), width: 1600, height: 1600, aspectRatio: '1:1', model: 'gemini-3.1-flash-image-preview', credits: 5 }),
  base({ id: 'fx-a9', kind: 'image', createdAt: il_y_a(60 * 80), folderId: 'fx-f1', prompt: 'Salle de bain en marbre veiné, double vasque, lumière zénithale', url: IMG(1600, 1200, ...T.gris, 'Salle de bain'), thumbnailUrl: IMG(800, 600, ...T.gris, 'Salle de bain'), width: 1600, height: 1200, aspectRatio: '4:3', model: 'gemini-3.1-flash-image-preview', credits: 5 }),
  base({ id: 'fx-a10', kind: 'image', createdAt: il_y_a(60 * 96), folderId: null, prompt: 'Entrée avec verrière, sol en pierre naturelle', url: IMG(1200, 1600, ...T.mousse, 'Entrée'), thumbnailUrl: IMG(600, 800, ...T.mousse, 'Entrée'), width: 1200, height: 1600, aspectRatio: '3:4', model: 'gemini-3.1-flash-image-preview', credits: 5 }),
  base({ id: 'fx-a11', kind: 'video', createdAt: il_y_a(60 * 100), folderId: 'fx-f2', prompt: 'Montée d’escalier vers la mezzanine', url: '', thumbnailUrl: IMG(1280, 720, ...T.ardoise, 'Escalier'), durationS: 6, aspectRatio: '16:9', model: 'bytedance/seedance-2.5/image-to-video', credits: 118, voiceoverText: 'Un escalier de chêne massif dessert la mezzanine.', voiceoverVoice: 'Charon', voiceoverLang: 'fr', voiceoverUrl: BIP }),
  base({ id: 'fx-a12', kind: 'image', createdAt: il_y_a(60 * 120), folderId: 'fx-f3', prompt: 'Cave à vin climatisée, casiers en chêne', url: IMG(1600, 1600, ...T.brique, 'Cave'), thumbnailUrl: IMG(800, 800, ...T.brique, 'Cave'), width: 1600, height: 1600, aspectRatio: '1:1', model: 'gemini-3.1-flash-image-preview', credits: 5 }),
  base({ id: 'fx-a13', kind: 'upload', createdAt: il_y_a(60 * 140), folderId: null, url: IMG(1600, 900, ...T.gris, 'Plan importé'), thumbnailUrl: IMG(800, 450, ...T.gris, 'Plan importé'), width: 1600, height: 900 }),
  base({ id: 'fx-a14', kind: 'image', createdAt: il_y_a(60 * 160), folderId: 'fx-f1', prompt: 'Terrasse plein sud, mobilier outdoor en teck', url: IMG(1600, 1000, ...T.sable, 'Terrasse'), thumbnailUrl: IMG(800, 500, ...T.sable, 'Terrasse'), width: 1600, height: 1000, aspectRatio: '16:9', model: 'gemini-3.1-flash-image-preview', credits: 5, isFavorite: true }),
  base({ id: 'fx-a15', kind: 'image', createdAt: il_y_a(60 * 180), folderId: null, prompt: 'Dressing sur mesure, portes miroir', url: IMG(1200, 1500, ...T.ardoise, 'Dressing'), thumbnailUrl: IMG(600, 750, ...T.ardoise, 'Dressing'), width: 1200, height: 1500, aspectRatio: '3:4', model: 'gemini-3.1-flash-image-preview', credits: 5 }),
  base({ id: 'fx-a16', kind: 'video', createdAt: il_y_a(60 * 200), folderId: 'fx-f2', prompt: 'Vue plongeante sur le jardin depuis le balcon', url: '', thumbnailUrl: IMG(1280, 960, ...T.mousse, 'Jardin'), durationS: 8, aspectRatio: '4:3', model: 'bytedance/seedance-2.5/text-to-video', credits: 144 }),
  base({ id: 'fx-a17', kind: 'image', createdAt: il_y_a(60 * 220), folderId: 'fx-f3', prompt: 'Buanderie fonctionnelle, rangements toute hauteur', url: IMG(1600, 1200, ...T.mousse, 'Buanderie'), thumbnailUrl: IMG(800, 600, ...T.mousse, 'Buanderie'), width: 1600, height: 1200, aspectRatio: '4:3', model: 'gemini-3.1-flash-image-preview', credits: 5 }),
  base({ id: 'fx-a18', kind: 'image', createdAt: il_y_a(60 * 240), folderId: null, prompt: 'Façade au crépuscule, éclairage d’ambiance', url: IMG(1600, 900, ...T.brique, 'Façade'), thumbnailUrl: IMG(800, 450, ...T.brique, 'Façade'), width: 1600, height: 900, aspectRatio: '16:9', model: 'gemini-3.1-flash-image-preview', credits: 5 }),
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

// ─── Le porte-monnaie du banc ────────────────────────────────────────────────
//
// ⚠ Un SOLDE QUI BOUGE, ou le banc n'éprouve rien : chaque génération le débite, et
// l'écran « Consommation » lit un grand livre qui s'allonge. Les chiffres sont ceux
// d'une agence Pro à mi-mois (dotation 1 500, 340 achetés), assez bas pour qu'une
// série de quatre vidéos fasse apparaître « solde insuffisant » sans tricher.
let fxSolde: CreditBalance = {
  included: 903, purchased: 340, total: 1243, month: new Date().toISOString().slice(0, 7), plan: 'pro', monthlyAllowance: 1500,
  autoTopupEnabled: false, autoTopupThreshold: 100, autoTopupPack: '500', autoTopupLastError: null, autoTopupLastErrorAt: null,
  hasCard: true, cardBrand: 'visa', cardLast4: '4242',
}
let fxLivre: CreditLedgerEntry[] = [
  { id: 'fx-l1', kind: 'debit', amount: -154, bucket: 'included', includedAfter: 903, purchasedAfter: 340, refType: 'labs_asset', refId: 'fx-a2', amountChf: null, metadata: { kind: 'video', resolution: '720p', duration_s: 8, voiceover: true }, createdAt: il_y_a(5) },
  { id: 'fx-l2', kind: 'debit', amount: -5, bucket: 'included', includedAfter: 1057, purchasedAfter: 340, refType: 'labs_asset', refId: 'fx-a1', amountChf: null, metadata: { kind: 'image', image_size: '2K' }, createdAt: il_y_a(12) },
  { id: 'fx-l3', kind: 'debit', amount: -5, bucket: 'included', includedAfter: 1062, purchasedAfter: 340, refType: 'labs_asset', refId: 'fx-a3', amountChf: null, metadata: { kind: 'image', image_size: '2K' }, createdAt: il_y_a(38) },
  { id: 'fx-l4', kind: 'refund', amount: 180, bucket: 'included', includedAfter: 1067, purchasedAfter: 340, refType: 'labs_asset', refId: 'fx-a7', amountChf: null, metadata: { reason: 'provider_failed' }, createdAt: il_y_a(60 * 3) },
  { id: 'fx-l5', kind: 'debit', amount: -180, bucket: 'included', includedAfter: 887, purchasedAfter: 340, refType: 'labs_asset', refId: 'fx-a7', amountChf: null, metadata: { kind: 'video', resolution: '720p', duration_s: 10, voiceover: false }, createdAt: il_y_a(60 * 3 + 2) },
  { id: 'fx-l6', kind: 'debit', amount: -180, bucket: 'included', includedAfter: 1067, purchasedAfter: 340, refType: 'labs_asset', refId: 'fx-a4', amountChf: null, metadata: { kind: 'video', resolution: '720p', duration_s: 10, voiceover: false }, createdAt: il_y_a(60 * 5) },
  { id: 'fx-l7', kind: 'purchase', amount: 500, bucket: 'purchased', includedAfter: 1247, purchasedAfter: 340, refType: 'stripe_payment_intent', refId: 'pi_fx_1', amountChf: 22, metadata: { pack: '500' }, createdAt: il_y_a(60 * 24 * 2) },
  { id: 'fx-l8', kind: 'grant_monthly', amount: 1500, bucket: 'included', includedAfter: 1500, purchasedAfter: 0, refType: 'month', refId: new Date().toISOString().slice(0, 7), amountChf: null, metadata: { plan: 'pro' }, createdAt: il_y_a(60 * 24 * 9) },
]

export function fxCreditBalance(state: LabsFixtureState): CreditBalance {
  if (state === 'error') throw new Error('fixture:error')
  if (state === 'empty') return { ...fxSolde, included: 0, purchased: 0, total: 0, hasCard: false, cardBrand: null, cardLast4: null }
  return { ...fxSolde }
}

export function fxCreditLedger(state: LabsFixtureState): CreditLedgerEntry[] {
  if (state === 'error') throw new Error('fixture:error')
  return state === 'empty' ? [] : [...fxLivre]
}

/**
 * Le REÇU d'un retour de Stripe, au banc. Le paramètre `?session_id=` choisit l'état,
 * faute de quoi la modale de confirmation n'aurait aucune façon d'être regardée : le
 * banc ne paie rien, et l'état d'un paiement ne s'invente pas depuis l'écran.
 *
 *   `cs_banc_paye` (ou n'importe quel autre) → payé · `cs_banc_attente` → en validation
 *   `cs_banc_refuse` → non abouti · `cs_banc_expire` → session expirée
 *   état « Échec » du banc → la lecture elle-même échoue
 */
export function fxCreditRecu(state: LabsFixtureState, sessionId: string): CreditRecu {
  if (state === 'error') throw new Error('fixture:error')
  const statut: CreditRecu['statut'] = sessionId.includes('attente') ? 'processing'
    : sessionId.includes('refuse') ? 'unpaid'
    : sessionId.includes('expire') ? 'expired'
    : 'paid'
  const pack = CREDIT_PACKS[1]
  return {
    statut,
    pack: pack.id,
    credits: pack.credits,
    chf: pack.chf,
    balance: statut === 'paid' ? fxSolde.total + pack.credits : null,
    invoiceUrl: statut === 'paid' ? 'https://invoice.stripe.com/i/banc' : null,
  }
}

export function fxSetAutoTopup(p: { enabled: boolean; threshold: AutoTopupSeuil; pack: CreditPackId }): void {
  fxSolde = { ...fxSolde, autoTopupEnabled: p.enabled, autoTopupThreshold: p.threshold, autoTopupPack: p.pack, autoTopupLastError: null, autoTopupLastErrorAt: null }
  notifier()
}

/** Le solde après un débit du banc, tel que l'edge le rendrait. */
function fxDebiter(credits: number, refId: string, metadata: Record<string, unknown>): number {
  const deInc = Math.min(fxSolde.included, credits)
  const dePur = credits - deInc
  fxSolde = { ...fxSolde, included: fxSolde.included - deInc, purchased: fxSolde.purchased - dePur, total: fxSolde.total - credits }
  fxLivre = [
    { id: `fx-l${Date.now()}-${refId}`, kind: 'debit', amount: -credits, bucket: dePur === 0 ? 'included' : deInc === 0 ? 'purchased' : 'mixed', includedAfter: fxSolde.included, purchasedAfter: fxSolde.purchased, refType: 'labs_asset', refId, amountChf: null, metadata, createdAt: new Date().toISOString() },
    ...fxLivre,
  ]
  return fxSolde.total
}

/** Le solde courant du banc — ce que `useLabsGenerate` rend après une génération. */
export function fxSoldeCourant(): number {
  return fxSolde.total
}

/** Vrai quand le banc ne peut pas payer : il rend alors le même refus que l'edge. */
export function fxSoldeInsuffisant(credits: number): boolean {
  return fxSolde.total < credits
}

export async function fxGenerateImage(prompt: string, folderId: string | null, sourceAssetId: string | null): Promise<LabsAsset> {
  const rang = (fxSerie += 1)
  // Un peu de dispersion : les quatre tuiles ne se remplissent pas toutes d'un coup.
  await wait(1200 + (rang % 4) * 450)
  const teintes: [string, string][] = [[...T.sable], [...T.ardoise], [...T.mousse], [...T.brique]]
  const [a, b] = teintes[rang % teintes.length]
  const now = new Date().toISOString()
  const etiquette = `Image générée ${rang}`
  const idImage = `fx-a${Date.now()}-${rang}`
  fxDebiter(creditsPourImage('2K'), idImage, { kind: 'image', image_size: '2K' })
  const asset = base({
    id: idImage, kind: 'image', createdAt: now, folderId, sourceAssetId, prompt,
    url: IMG(1600, 1200, a, b, etiquette), thumbnailUrl: IMG(800, 600, a, b, etiquette),
    width: 1600, height: 1200, aspectRatio: '4:3', model: 'gemini-3.1-flash-image-preview', credits: 5,
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
  const idVideo = `fx-v${Date.now()}`
  fxDebiter(creditsPourVideo('720p', dureeS, !!voiceoverText), idVideo, { kind: 'video', resolution: '720p', duration_s: dureeS, voiceover: !!voiceoverText })
  const asset = base({
    id: idVideo, kind: 'video', createdAt: now, folderId, sourceAssetId, prompt, status: 'generating',
    voiceoverText, voiceoverVoice: voiceoverText ? 'Kore' : null,
    voiceoverLang: voiceoverText ? 'fr' : null, voiceoverUrl: voiceoverText ? BIP : null,
    thumbnailUrl: source?.thumbnailUrl ?? IMG(1280, 720, ...T.ardoise, 'Vidéo'),
    durationS: dureeS, aspectRatio: '16:9', model: 'bytedance/seedance-2.5/image-to-video', credits: creditsPourVideo('720p', dureeS, !!voiceoverText), completedAt: null,
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
