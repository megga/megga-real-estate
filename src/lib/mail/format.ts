/**
 * Formats d'affichage de la Messagerie (README §2 « Date » : `08:29` | `Hier` |
 * `23.08`).
 *
 * ⚠ Tout se calcule dans le fuseau SUISSE, jamais dans celui de la machine :
 * « hier » est une frontière de journée civile, et un agent qui voyage verrait
 * sinon ses mails changer d'étiquette sans que rien n'ait bougé.
 */
/**
 * ⚠ ALIAS DE TYPE, PAS `interface`, et ce n'est pas un goût : une `interface` ne
 * reçoit PAS de signature d'index implicite, donc `MailAddress[]` n'est pas
 * assignable à `Json` — écrire les destinataires d'un brouillon dans la colonne
 * `jsonb` `mail_drafts.to` échouait en TS2345 (mesuré le 04.09.2026). L'alias,
 * lui, en reçoit une. La seule autre issue était un `as unknown as Json` à
 * chaque site d'écriture.
 */
export type MailAddress = { name: string | null; email: string }

const YESTERDAY: Record<string, string> = { fr: 'Hier', de: 'Gestern', en: 'Yesterday', it: 'Ieri' }
const TZ = 'Europe/Zurich'

function ymd(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** Libellé de date d'une ligne de liste, dans le fuseau suisse. */
export function mailDateLabel(iso: string, now: Date = new Date(), lang = 'fr'): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const today = ymd(now)
  const day = ymd(d)
  if (day === today) return new Intl.DateTimeFormat('fr-CH', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  const yesterday = ymd(new Date(now.getTime() - 86_400_000))
  if (day === yesterday) return YESTERDAY[lang] ?? YESTERDAY.fr
  const [y, m, dd] = day.split('-')
  return y === today.slice(0, 4) ? `${dd}.${m}` : `${dd}.${m}.${y.slice(2)}`
}

/** Deux lettres au plus : initiales du nom, sinon première lettre de l'adresse. */
export function initialsOf(name: string | null | undefined, email: string): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase()
  return email.slice(0, 1).toUpperCase()
}

/** Ce qu'on montre d'un correspondant : son nom, à défaut son adresse. */
export function displayAddress(a: MailAddress): string {
  return a.name?.trim() || a.email
}

/** Taille lisible d'une pièce jointe (README : « 11px var(--mut) »). */
export function fileSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`
}
