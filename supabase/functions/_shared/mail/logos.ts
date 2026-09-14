// supabase/functions/_shared/mail/logos.ts
// Le logo d'un expéditeur de la Messagerie — résolu CHEZ NOUS, jamais chez un tiers.
//
// Demande : « un icône relié aux logos des entreprises, comme Spark » (Julien, 14.09.2026).
// Spark tirait les siens de Clearbit, fermé le 8 décembre 2025. Ses successeurs
// (Brandfetch, logo.dev) exigent qu'on charge chaque logo chez eux depuis le navigateur :
// ils verraient passer, domaine par domaine, avec qui chaque agence correspond. Un CRM
// qui se veut conforme à la nLPD ne donne pas son carnet de correspondants à un
// sous-traitant pour une pastille.
//
// L'ordre, du plus sûr au plus approximatif :
//  1. BIMI — le logo que le domaine publie LUI-MÊME pour son courrier
//     (`default._bimi.<domaine>` en TXT, `l=` vers un SVG). Rare hors des grandes marques.
//  2. Les icônes que sa page d'accueil déclare (`apple-touch-icon`, `icon`), la plus
//     grande d'abord ; puis les emplacements conventionnels `/apple-touch-icon.png` et
//     `/favicon.ico`.
// Le seul serveur qui apprend quelque chose est celui du correspondant lui-même.
//
// ⚠ PUR À L'EXCEPTION DU RÉSEAU, qui est INJECTÉ (`Reseau`) : en production c'est
// `safeFetchResponse` (https seul, IP publiques seules, redirections revalidées saut par
// saut, corps plafonné) et `Deno.resolveDns` ; en test, des faux. Aucune URL ne part d'ici
// sans passer par le premier.
//
// ⛔ Une messagerie grand public (gmail.com, bluewin.ch…) n'a PAS de logo à montrer :
// l'expéditeur est un particulier, et le logo de Gmail sous chaque client serait faux.
// Aucune requête ne part pour elles.

/** Plafond d'un logo, en octets : au-delà, ce n'est plus une pastille, c'est une photo. */
export const LOGO_OCTETS_MAX = 96 * 1024
/** Plafond de la page d'accueil lue pour y trouver les `<link>` : ils vivent dans le `<head>`. */
export const PAGE_OCTETS_MAX = 512 * 1024
/** Côté minimal d'une icône matricielle : un favicon de 16 px, agrandi, ne se reconnaît plus. */
export const COTE_MIN_PX = 32
/** Délai de chaque requête — le résolveur est appelé pendant que l'agent regarde sa liste. */
export const DELAI_REQUETE_MS = 4_000
/** Nombre d'icônes essayées par site, au plus. */
const ESSAIS_MAX = 5

export type LogoSource = 'bimi' | 'apple-touch-icon' | 'icon' | 'favicon'
export interface LogoTrouve { status: 'found'; source: LogoSource; mime: string; data: string }
export type LogoResolu = LogoTrouve | { status: 'none' }

export interface ReponseHttp { bytes: Uint8Array; contentType: string | null; finalUrl: string }
export interface Reseau {
  /** GET sûr — `safeFetchResponse` en production. Lève sur tout échec. */
  lire: (url: string, opts: { maxBytes: number; maxRedirects: number; timeoutMs: number }) => Promise<ReponseHttp>
  /** Enregistrements TXT d'un nom — `Deno.resolveDns(nom, 'TXT')` en production. */
  txt: (nom: string) => Promise<string[][]>
}

// ─── Domaines ────────────────────────────────────────────────────────────────

const FORME_DOMAINE = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

/** Un domaine (ou une adresse), en minuscules et validé ; `null` s'il n'en a pas la forme. */
export function normaliserDomaine(brut: string): string | null {
  const at = brut.lastIndexOf('@')
  const d = (at >= 0 ? brut.slice(at + 1) : brut).trim().toLowerCase().replace(/\.$/, '')
  return FORME_DOMAINE.test(d) ? d : null
}

/**
 * Les messageries des particuliers — Suisse d'abord, puis les marchés des quatre
 * langues. Une absence ne casse rien : le domaine est alors traité comme celui d'une
 * entreprise, et ne trouve au pire que le logo du fournisseur.
 */
export const MESSAGERIES_GRAND_PUBLIC: ReadonlySet<string> = new Set([
  'bluewin.ch', 'bluemail.ch', 'sunrise.ch', 'swissonline.ch', 'hispeed.ch', 'green.ch', 'vtxnet.ch',
  'netplus.ch', 'gmx.ch', 'hotmail.ch', 'yahoo.ch', 'protonmail.ch', 'ik.me',
  'gmail.com', 'googlemail.com', 'outlook.com', 'outlook.fr', 'outlook.de', 'hotmail.com', 'hotmail.fr',
  'hotmail.de', 'hotmail.it', 'live.com', 'live.fr', 'live.de', 'live.it', 'msn.com', 'yahoo.com', 'yahoo.fr',
  'yahoo.de', 'yahoo.it', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'pm.me',
  'gmx.net', 'gmx.com', 'gmx.de', 'gmx.fr', 'web.de', 'mail.com', 'tutanota.com', 'tuta.io', 'zoho.com',
  'yandex.com', 'orange.fr', 'wanadoo.fr', 'free.fr', 'laposte.net', 'sfr.fr', 'neuf.fr', 'bbox.fr',
  't-online.de', 'libero.it', 'virgilio.it', 'alice.it', 'tiscali.it',
])

/** Vrai pour une messagerie de particuliers, sous-domaines compris (`mail.yahoo.com`). */
export function estGrandPublic(domaine: string): boolean {
  return domainesCandidats(domaine, 9).some((d) => MESSAGERIES_GRAND_PUBLIC.has(d))
}

/** Les suffixes à deux étiquettes qui ne désignent personne (`co.uk`) : jamais essayés comme site. */
const SUFFIXE_GENERIQUE = /^(?:co|com|net|org|gov|gv|ac|edu|or|ne)\.[a-z]{2}$/

/**
 * Le domaine, puis ses parents jusqu'à deux étiquettes : `notifications.exemple.ch` n'a
 * souvent pas de site, `exemple.ch` en a un.
 */
export function domainesCandidats(domaine: string, max = 3): string[] {
  const parts = domaine.split('.')
  const out: string[] = []
  for (let i = 0; i <= parts.length - 2 && out.length < max; i++) {
    const d = parts.slice(i).join('.')
    if (i > 0 && SUFFIXE_GENERIQUE.test(d)) break
    out.push(d)
  }
  return out
}

// ─── BIMI ────────────────────────────────────────────────────────────────────

/** Le `l=` d'un enregistrement BIMI (`v=BIMI1; l=https://…/logo.svg`) — https seulement. */
export function urlBimi(enregistrements: string[][]): string | null {
  for (const morceaux of enregistrements) {
    const txt = morceaux.join('')
    if (!/^\s*v\s*=\s*BIMI1\s*(?:;|$)/i.test(txt)) continue
    const url = /(?:^|;)\s*l\s*=\s*([^;\s]*)/i.exec(txt)?.[1]?.trim() ?? ''
    // `l=` vide : le domaine a publié BIMI en DÉCLINANT l'affichage d'un logo.
    return /^https:\/\//i.test(url) ? url : null
  }
  return null
}

// ─── Icônes de la page d'accueil ─────────────────────────────────────────────

export interface IconeCandidate { url: string; source: LogoSource; cote: number }

function attribut(balise: string, nom: string): string | null {
  const m = new RegExp(`\\s${nom}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(balise)
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null
}

const decoderEntites = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&#x2f;|&#47;/gi, '/').replace(/&quot;/g, '"').replace(/&#39;/g, "'")

/**
 * Les icônes que la page déclare, de la meilleure à la pire : la plus grande d'abord (un
 * SVG compte pour 512), `apple-touch-icon` avant `icon` à taille égale. `mask-icon` n'y
 * est pas : c'est une silhouette monochrome, pas un logo.
 */
export function iconesDeLaPage(html: string, base: string): IconeCandidate[] {
  const out: IconeCandidate[] = []
  const vus = new Set<string>()
  for (const [balise] of html.slice(0, 200_000).matchAll(/<link\b[^>]*>/gi)) {
    const rels = (attribut(balise, 'rel') ?? '').toLowerCase().split(/\s+/)
    const href = attribut(balise, 'href')
    if (!href) continue
    const source: LogoSource | null =
      rels.includes('apple-touch-icon') || rels.includes('apple-touch-icon-precomposed') ? 'apple-touch-icon'
        : rels.includes('icon') ? 'icon'
          : null
    if (!source) continue
    let url: string
    try { url = new URL(decoderEntites(href.trim()), base).toString() } catch { continue }
    if (!url.startsWith('https://') || vus.has(url)) continue
    vus.add(url)
    const type = (attribut(balise, 'type') ?? '').toLowerCase()
    const sizes = attribut(balise, 'sizes') ?? ''
    const vectoriel = type === 'image/svg+xml' || /\.svg(?:[?#]|$)/i.test(url) || /\bany\b/i.test(sizes)
    const declare = Math.max(0, ...sizes.split(/\s+/).map((s) => Number(/^(\d+)x\d+$/i.exec(s)?.[1] ?? 0)))
    out.push({ url, source, cote: vectoriel ? 512 : declare || (source === 'apple-touch-icon' ? 180 : 0) })
  }
  return out.sort((a, b) => b.cote - a.cote || rang(a.source) - rang(b.source))
}
const rang = (s: LogoSource) => (s === 'apple-touch-icon' ? 0 : 1)

// ─── Images ──────────────────────────────────────────────────────────────────

const commence = (b: Uint8Array, sig: number[], a = 0) => sig.every((x, i) => b[a + i] === x)

/** Le type réel d'une image, lu dans ses octets — jamais dans l'en-tête que le site déclare. */
export function reconnaitreImage(b: Uint8Array): string | null {
  if (commence(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (commence(b, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (commence(b, [0x47, 0x49, 0x46, 0x38])) return 'image/gif'
  if (commence(b, [0x52, 0x49, 0x46, 0x46]) && commence(b, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp'
  if (commence(b, [0x00, 0x00, 0x01, 0x00])) return 'image/x-icon'
  const tete = new TextDecoder().decode(b.subarray(0, 2048)).replace(/^\uFEFF/, '').trimStart()
  return /^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*>\s*)*<svg[\s>]/i.test(tete) ? 'image/svg+xml' : null
}

const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8)
const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1]
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3]

/** Le PLUS PETIT côté de l'image (le plus grand de ses tailles pour un `.ico`) ; `Infinity` pour un SVG. */
export function coteImage(b: Uint8Array, mime: string): number {
  switch (mime) {
    case 'image/svg+xml': return Infinity
    case 'image/png': return b.length >= 24 ? Math.min(u32be(b, 16), u32be(b, 20)) : 0
    case 'image/gif': return b.length >= 10 ? Math.min(u16le(b, 6), u16le(b, 8)) : 0
    case 'image/x-icon': {
      let meilleur = 0
      const n = b.length >= 6 ? u16le(b, 4) : 0
      for (let k = 0; k < n && 6 + 16 * k + 1 < b.length; k++) {
        const e = 6 + 16 * k
        meilleur = Math.max(meilleur, Math.min(b[e] || 256, b[e + 1] || 256))
      }
      return meilleur
    }
    case 'image/webp': {
      const bloc = String.fromCharCode(b[12], b[13], b[14], b[15])
      if (bloc === 'VP8X' && b.length >= 30) return Math.min(1 + (b[24] | (b[25] << 8) | (b[26] << 16)), 1 + (b[27] | (b[28] << 8) | (b[29] << 16)))
      if (bloc === 'VP8 ' && b.length >= 30) return Math.min(u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff)
      if (bloc === 'VP8L' && b.length >= 25) {
        const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)
        return Math.min((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1)
      }
      return 0
    }
    case 'image/jpeg': {
      for (let i = 2; i + 9 < b.length;) {
        if (b[i] !== 0xff) { i++; continue }
        const marqueur = b[i + 1]
        const sof = marqueur >= 0xc0 && marqueur <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marqueur)
        if (sof) return Math.min(u16be(b, i + 5), u16be(b, i + 7))
        i += 2 + u16be(b, i + 2)
      }
      return 0
    }
    default: return 0
  }
}

/**
 * Un SVG qui voudrait EXÉCUTER quelque chose n'est pas un logo. Il ne s'exécuterait pas
 * dans un `<img>` — c'est ainsi que les vues le montrent — mais une donnée rangée en base
 * se relit ailleurs, et rien ne justifie de garder un script.
 */
const SVG_ACTIF = /<script\b|<foreignObject\b|javascript:|\son[a-z]+\s*=/i

/** Une image que la pastille peut montrer : type connu, poids raisonnable, assez grande. */
export function imageAcceptable(b: Uint8Array, mime: string): boolean {
  if (b.length === 0 || b.length > LOGO_OCTETS_MAX) return false
  if (mime === 'image/svg+xml') return !SVG_ACTIF.test(new TextDecoder().decode(b))
  return coteImage(b, mime) >= COTE_MIN_PX
}

/** Base64 par tranches : un `String.fromCharCode(...octets)` de 96 Kio dépasse la pile des arguments. */
export function enBase64(b: Uint8Array): string {
  let s = ''
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return btoa(s)
}

// ─── Résolution ──────────────────────────────────────────────────────────────

/** L'échéance d'une résolution est passée : rien n'est conclu, l'appelant ne range rien. */
export class DelaiDepasse extends Error {
  constructor() { super('delai_depasse') }
}

function verifierEcheance(echeance: number | undefined) {
  if (echeance !== undefined && Date.now() > echeance) throw new DelaiDepasse()
}

async function essayer(url: string, source: LogoSource, reseau: Reseau, echeance?: number): Promise<LogoTrouve | null> {
  verifierEcheance(echeance)
  try {
    const r = await reseau.lire(url, { maxBytes: LOGO_OCTETS_MAX, maxRedirects: 3, timeoutMs: DELAI_REQUETE_MS })
    const mime = reconnaitreImage(r.bytes)
    if (!mime || !imageAcceptable(r.bytes, mime)) return null
    return { status: 'found', source, mime, data: enBase64(r.bytes) }
  } catch {
    return null
  }
}

/**
 * Le logo d'un domaine d'expéditeur, ou `none`.
 *
 * `none` est une RÉPONSE, que l'appelant peut ranger : aucune des sources n'a donné
 * d'image montrable (un site muet compte, lui aussi, comme « rien »). Une ÉCHÉANCE
 * dépassée n'en est pas une : elle lève `DelaiDepasse`, et l'appelant ne range rien —
 * la prochaine demande réessaiera.
 */
export async function resoudreLogo(domaineBrut: string, reseau: Reseau, echeance?: number): Promise<LogoResolu> {
  const domaine = normaliserDomaine(domaineBrut)
  if (!domaine || estGrandPublic(domaine)) return { status: 'none' }
  const candidats = domainesCandidats(domaine)

  // 1. BIMI : sur le domaine, puis sur son organisation — c'est là que la norme le cherche.
  for (const d of candidats.slice(0, 2)) {
    verifierEcheance(echeance)
    const url = urlBimi(await reseau.txt(`default._bimi.${d}`).catch(() => []))
    if (!url) continue
    const logo = await essayer(url, 'bimi', reseau, echeance)
    if (logo) return logo
    break
  }

  // 2. Le site. Un sous-domaine sans site cède la place à son parent ; un site qui a
  // RÉPONDU sans icône montrable clôt la recherche — son parent serait un autre visage.
  for (const hote of candidats) {
    verifierEcheance(echeance)
    let page: ReponseHttp | null = null
    try {
      page = await reseau.lire(`https://${hote}/`, { maxBytes: PAGE_OCTETS_MAX, maxRedirects: 3, timeoutMs: DELAI_REQUETE_MS })
    } catch {
      page = null
    }
    const base = page?.finalUrl ?? `https://${hote}/`
    const html = page && /html|^$/i.test(page.contentType ?? '') ? new TextDecoder().decode(page.bytes) : ''
    const essais: IconeCandidate[] = [
      ...iconesDeLaPage(html, base),
      { url: new URL('/apple-touch-icon.png', base).toString(), source: 'apple-touch-icon', cote: 180 },
      { url: new URL('/favicon.ico', base).toString(), source: 'favicon', cote: 0 },
    ]
    const faits = new Set<string>()
    for (const c of essais) {
      if (faits.has(c.url) || faits.size >= ESSAIS_MAX) continue
      faits.add(c.url)
      const logo = await essayer(c.url, c.source, reseau, echeance)
      if (logo) return logo
    }
    if (page) break
  }
  return { status: 'none' }
}
