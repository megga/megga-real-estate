/**
 * Les serveurs d'une adresse, reconnus AVANT que l'agent les tape.
 *
 * L'assistant « Ajouter une boîte » n'a plus de tuile par fournisseur suisse (Infomaniak et
 * Bluewin retirées le 14.09.2026, décision Julien : « juste mettre IMAP ») : il reconnaît le
 * fournisseur à l'ADRESSE, et pré-remplit des champs que l'agent garde modifiables.
 *
 * Deux sources, dans cet ordre :
 *  1. le DOMAINE de l'adresse, pour les messageries de particuliers (bluewin.ch, gmx.ch…) ;
 *  2. son enregistrement MX, pour un domaine d'agence hébergé (agence.ch → Infomaniak) —
 *     le cas courant, qu'aucune liste de domaines ne couvrira jamais.
 *
 * ⛔ CHAQUE SERVEUR DE CETTE TABLE A ÉTÉ MESURÉ le 14.09.2026, sans identifiants : bannière
 * IMAP sur 993, SMTP sur 465 (587 pour iCloud, qui n'offre que STARTTLS), certificat valide
 * pour le nom, et le MX de chaque domaine relevé. Un fournisseur qu'on n'a pas pu mesurer
 * n'y est PAS — Sunrise : son SMTP ne répond pas depuis l'extérieur. Un serveur deviné à
 * tort coûte plus qu'un champ vide : l'agent conclut que son mot de passe est faux.
 *
 * ⚠ Google et Microsoft sont reconnus mais RENVOYÉS vers leur connexion OAuth : Microsoft
 * n'accepte plus de mot de passe en IMAP (authentification « basique » retirée), et Google
 * ne l'accepte qu'en mot de passe d'application.
 *
 * PUR : la résolution MX est injectée (`Deno.resolveDns` dans l'edge, un faux en test).
 */

export interface ImapPreset {
  /** Le fournisseur, montré tel quel — une marque ne se traduit pas. */
  nom: string
  imapHost: string
  imapPort: 993 | 143
  smtpHost: string
  smtpPort: 465 | 587
  /** Le mot de passe du compte est refusé en IMAP : il faut un mot de passe d'application. */
  motDePasseApplication: boolean
}

export interface ImapDetection {
  /** La boîte se connecte mieux par OAuth : l'assistant le propose. */
  oauth: 'gmail' | 'outlook' | null
  preset: ImapPreset | null
}

const SWISSCOM: ImapPreset = { nom: 'Swisscom (Bluewin)', imapHost: 'imaps.bluewin.ch', imapPort: 993, smtpHost: 'smtpauths.bluewin.ch', smtpPort: 465, motDePasseApplication: false }
const INFOMANIAK: ImapPreset = { nom: 'Infomaniak', imapHost: 'mail.infomaniak.com', imapPort: 993, smtpHost: 'mail.infomaniak.com', smtpPort: 465, motDePasseApplication: false }
const HOSTPOINT: ImapPreset = { nom: 'Hostpoint', imapHost: 'imap.mail.hostpoint.ch', imapPort: 993, smtpHost: 'asmtp.mail.hostpoint.ch', smtpPort: 465, motDePasseApplication: false }
const UPC: ImapPreset = { nom: 'UPC / Sunrise (hispeed)', imapHost: 'imap.hispeed.ch', imapPort: 993, smtpHost: 'smtp.hispeed.ch', smtpPort: 465, motDePasseApplication: false }
const SPACEMAIL: ImapPreset = { nom: 'Spacemail', imapHost: 'mail.spacemail.com', imapPort: 993, smtpHost: 'mail.spacemail.com', smtpPort: 465, motDePasseApplication: false }
const GMX: ImapPreset = { nom: 'GMX', imapHost: 'imap.gmx.net', imapPort: 993, smtpHost: 'mail.gmx.net', smtpPort: 465, motDePasseApplication: false }
const ICLOUD: ImapPreset = { nom: 'iCloud', imapHost: 'imap.mail.me.com', imapPort: 993, smtpHost: 'smtp.mail.me.com', smtpPort: 587, motDePasseApplication: true }
const YAHOO: ImapPreset = { nom: 'Yahoo', imapHost: 'imap.mail.yahoo.com', imapPort: 993, smtpHost: 'smtp.mail.yahoo.com', smtpPort: 465, motDePasseApplication: true }
const GMAIL: ImapPreset = { nom: 'Google', imapHost: 'imap.gmail.com', imapPort: 993, smtpHost: 'smtp.gmail.com', smtpPort: 465, motDePasseApplication: true }

type Verdict = ImapPreset | 'gmail' | 'outlook'

/**
 * Les domaines reconnus sans aucune requête. ⚠ Swisscom n'est reconnu QUE par l'adresse :
 * son MX (`*.p.bluenet.ch`) sert aussi des domaines d'entreprise dont on n'a pas mesuré les
 * serveurs.
 */
const PAR_DOMAINE: Record<string, Verdict> = {
  'bluewin.ch': SWISSCOM, 'bluemail.ch': SWISSCOM,
  'ik.me': INFOMANIAK, 'ikmail.com': INFOMANIAK,
  'hispeed.ch': UPC,
  'gmx.ch': GMX, 'gmx.net': GMX, 'gmx.de': GMX, 'gmx.at': GMX,
  'icloud.com': ICLOUD, 'me.com': ICLOUD, 'mac.com': ICLOUD,
  'yahoo.com': YAHOO, 'yahoo.fr': YAHOO, 'ymail.com': YAHOO,
  'gmail.com': 'gmail', 'googlemail.com': 'gmail',
  'outlook.com': 'outlook', 'outlook.fr': 'outlook', 'hotmail.com': 'outlook', 'hotmail.fr': 'outlook',
  'hotmail.ch': 'outlook', 'live.com': 'outlook', 'live.fr': 'outlook', 'msn.com': 'outlook',
}

/** Le serveur de courrier entrant (MX) désigne l'hébergeur. Premier motif apparié, dans l'ordre des préférences MX. */
const PAR_MX: [RegExp, Verdict][] = [
  [/(^|\.)(google|googlemail)\.com$/, 'gmail'],
  [/\.protection\.outlook\.com$/, 'outlook'],
  [/(^|\.)infomaniak\.ch$/, INFOMANIAK],
  [/(^|\.)hostpoint\.ch$/, HOSTPOINT],
  [/(^|\.)spacemail\.com$/, SPACEMAIL],
  [/-hispeed-ch\.edge\.unified\.services$/, UPC],
  [/\.emig\.gmx\.net$/, GMX],
  [/\.mail\.icloud\.com$/, ICLOUD],
  [/\.yahoodns\.net$/, YAHOO],
]

const RIEN: ImapDetection = { oauth: null, preset: null }
const DOMAINE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

const verdict = (v: Verdict): ImapDetection =>
  v === 'gmail' ? { oauth: 'gmail', preset: GMAIL } : v === 'outlook' ? { oauth: 'outlook', preset: null } : { oauth: null, preset: v }

/**
 * Reconnaît le fournisseur d'une adresse. `mx` rend les hôtes MX du domaine, par préférence
 * croissante ; une résolution qui échoue vaut « non reconnu », jamais une erreur — l'agent
 * saisit alors ses serveurs lui-même.
 */
export async function detecterServeurs(email: string, mx: (domaine: string) => Promise<string[]>): Promise<ImapDetection> {
  const domaine = (email.trim().toLowerCase().split('@')[1] ?? '').replace(/\.$/, '')
  if (!DOMAINE.test(domaine)) return RIEN
  const direct = PAR_DOMAINE[domaine]
  if (direct) return verdict(direct)
  let hotes: string[]
  try { hotes = await mx(domaine) } catch { return RIEN }
  for (const h of hotes) {
    const hote = h.toLowerCase().replace(/\.$/, '')
    const regle = PAR_MX.find(([motif]) => motif.test(hote))
    if (regle) return verdict(regle[1])
  }
  return RIEN
}
