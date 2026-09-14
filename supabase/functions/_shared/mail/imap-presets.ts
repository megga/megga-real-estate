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
 * pour le nom, et le MX de chaque domaine relevé ; pour un hébergeur, l'hôte MX que ses
 * CLIENTS reçoivent (`mx1.mail.ovh.net`, `mx00.ionos.de`…) a été résolu, pas seulement celui
 * de son propre domaine — ils diffèrent chez OVH, IONOS, Gandi et Hostinger. Un fournisseur
 * qu'on n'a pas pu mesurer n'y est PAS : Sunrise (aucun serveur d'envoi ne répond de
 * l'extérieur), VTX (hôtes absents ou certificat invalide). Proton n'a pas d'IMAP côté
 * serveur (son « Bridge » tourne sur l'ordinateur de l'agent), et Green.ch est chez
 * Microsoft 365 — son MX l'envoie donc vers la connexion Microsoft. Un serveur deviné à
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
  /** L'accès IMAP est COUPÉ par défaut chez ce fournisseur : l'agent doit l'activer dans ses réglages. */
  activerImap: boolean
}

export interface ImapDetection {
  /** La boîte se connecte mieux par OAuth : l'assistant le propose. */
  oauth: 'gmail' | 'outlook' | null
  preset: ImapPreset | null
}

type Options = Partial<Pick<ImapPreset, 'smtpPort' | 'motDePasseApplication' | 'activerImap'>>
/** Un fournisseur : IMAP sur 993 et SMTP sur 465, chiffrés d'emblée, sauf mention contraire. */
const fournisseur = (nom: string, imapHost: string, smtpHost: string, o: Options = {}): ImapPreset =>
  ({ nom, imapHost, imapPort: 993, smtpHost, smtpPort: 465, motDePasseApplication: false, activerImap: false, ...o })

// Suisse.
const SWISSCOM = fournisseur('Swisscom (Bluewin)', 'imaps.bluewin.ch', 'smtpauths.bluewin.ch')
const UPC = fournisseur('UPC / Sunrise (hispeed)', 'imap.hispeed.ch', 'smtp.hispeed.ch')
const INFOMANIAK = fournisseur('Infomaniak', 'mail.infomaniak.com', 'mail.infomaniak.com')
const HOSTPOINT = fournisseur('Hostpoint', 'imap.mail.hostpoint.ch', 'asmtp.mail.hostpoint.ch')
const CYON = fournisseur('cyon', 'mail.cyon.ch', 'mail.cyon.ch')
const QUICKLINE = fournisseur('Quickline', 'imap.quickline.ch', 'smtp.quickline.ch')
const NETPLUS = fournisseur('Netplus', 'imap.netplus.ch', 'smtp.netplus.ch')
const KOLAB = fournisseur('Kolab Now', 'imap.kolabnow.com', 'smtp.kolabnow.com')
// Hébergeurs de domaines d'agence.
const SPACEMAIL = fournisseur('Spacemail', 'mail.spacemail.com', 'mail.spacemail.com')
/** ⚠ Le MX d'OVH ne distingue pas ses offres : c'est le serveur de « MX Plan », le plus courant ; Email Pro a le sien (`pro1.mail.ovh.net`). */
const OVH = fournisseur('OVH (MX Plan)', 'ssl0.ovh.net', 'ssl0.ovh.net')
const ionos = (pays: string) => fournisseur('IONOS', `imap.ionos.${pays}`, `smtp.ionos.${pays}`)
const GANDI = fournisseur('Gandi', 'mail.gandi.net', 'mail.gandi.net')
const HOSTINGER = fournisseur('Hostinger', 'imap.hostinger.com', 'smtp.hostinger.com')
const zoho = (region: 'eu' | 'com') => fournisseur('Zoho', `imap.zoho.${region}`, `smtp.zoho.${region}`, { activerImap: true })
const FASTMAIL = fournisseur('Fastmail', 'imap.fastmail.com', 'smtp.fastmail.com', { motDePasseApplication: true })
const MAILBOX_ORG = fournisseur('mailbox.org', 'imap.mailbox.org', 'smtp.mailbox.org')
const POSTEO = fournisseur('Posteo', 'posteo.de', 'posteo.de')
// Messageries de particuliers.
const GMX = fournisseur('GMX', 'imap.gmx.net', 'mail.gmx.net', { activerImap: true })
const GMX_INTERNATIONAL = fournisseur('GMX', 'imap.gmx.com', 'mail.gmx.com', { activerImap: true })
const WEB_DE = fournisseur('WEB.DE', 'imap.web.de', 'smtp.web.de', { activerImap: true })
const MAIL_COM = fournisseur('mail.com', 'imap.mail.com', 'smtp.mail.com', { activerImap: true })
const TELEKOM = fournisseur('Telekom (t-online)', 'secureimap.t-online.de', 'securesmtp.t-online.de', { motDePasseApplication: true })
const ORANGE = fournisseur('Orange', 'imap.orange.fr', 'smtp.orange.fr')
const FREE = fournisseur('Free', 'imap.free.fr', 'smtp.free.fr')
const SFR = fournisseur('SFR', 'imap.sfr.fr', 'smtp.sfr.fr')
const LA_POSTE = fournisseur('La Poste', 'imap.laposte.net', 'smtp.laposte.net')
const LIBERO = fournisseur('Libero', 'imapmail.libero.it', 'smtp.libero.it')
const VIRGILIO = fournisseur('Virgilio', 'in.virgilio.it', 'out.virgilio.it')
const TISCALI = fournisseur('Tiscali', 'imap.tiscali.it', 'smtp.tiscali.it')
/** iCloud n'envoie que par STARTTLS sur 587 (mesuré) : pas de 465 chez Apple. */
const ICLOUD = fournisseur('iCloud', 'imap.mail.me.com', 'smtp.mail.me.com', { smtpPort: 587, motDePasseApplication: true })
const YAHOO = fournisseur('Yahoo', 'imap.mail.yahoo.com', 'smtp.mail.yahoo.com', { motDePasseApplication: true })
/** ⛔ AOL partage l'infrastructure de Yahoo (son MX est un `yahoodns.net`) mais PAS ses serveurs de boîte. */
const AOL = fournisseur('AOL', 'imap.aol.com', 'smtp.aol.com', { motDePasseApplication: true })
const GMAIL = fournisseur('Google', 'imap.gmail.com', 'smtp.gmail.com', { motDePasseApplication: true })

type Verdict = ImapPreset | 'gmail' | 'outlook'

const tous = (domaines: string[], v: Verdict): Record<string, Verdict> => Object.fromEntries(domaines.map((d) => [d, v]))

/**
 * Les domaines reconnus sans aucune requête. ⚠ Swisscom n'est reconnu QUE par l'adresse :
 * son MX (`*.p.bluenet.ch`) sert aussi des domaines d'entreprise dont on n'a pas mesuré les
 * serveurs.
 */
const PAR_DOMAINE: Record<string, Verdict> = {
  ...tous(['bluewin.ch', 'bluemail.ch'], SWISSCOM),
  ...tous(['ik.me', 'ikmail.com'], INFOMANIAK),
  ...tous(['hispeed.ch'], UPC),
  ...tous(['quickline.ch'], QUICKLINE),
  ...tous(['netplus.ch'], NETPLUS),
  ...tous(['kolabnow.com', 'kolabnow.ch'], KOLAB),
  ...tous(['gmx.ch', 'gmx.net', 'gmx.de', 'gmx.at'], GMX),
  ...tous(['gmx.com', 'gmx.fr', 'gmx.co.uk'], GMX_INTERNATIONAL),
  ...tous(['web.de'], WEB_DE),
  ...tous(['mail.com', 'email.com'], MAIL_COM),
  ...tous(['t-online.de'], TELEKOM),
  ...tous(['orange.fr', 'wanadoo.fr'], ORANGE),
  ...tous(['free.fr'], FREE),
  ...tous(['sfr.fr', 'neuf.fr'], SFR),
  ...tous(['laposte.net'], LA_POSTE),
  ...tous(['libero.it'], LIBERO),
  ...tous(['virgilio.it'], VIRGILIO),
  ...tous(['tiscali.it'], TISCALI),
  ...tous(['posteo.de', 'posteo.net', 'posteo.ch'], POSTEO),
  ...tous(['mailbox.org'], MAILBOX_ORG),
  ...tous(['fastmail.com'], FASTMAIL),
  ...tous(['icloud.com', 'me.com', 'mac.com'], ICLOUD),
  ...tous(['yahoo.com', 'yahoo.fr', 'yahoo.de', 'yahoo.it', 'yahoo.es', 'yahoo.co.uk', 'yahoo.ca', 'ymail.com', 'rocketmail.com'], YAHOO),
  ...tous(['aol.com', 'aim.com', 'aol.fr', 'aol.de', 'verizon.net'], AOL),
  ...tous(['gmail.com', 'googlemail.com'], 'gmail'),
  ...tous(['outlook.com', 'outlook.fr', 'hotmail.com', 'hotmail.fr', 'hotmail.ch', 'live.com', 'live.fr', 'msn.com'], 'outlook'),
}

/**
 * Le serveur de courrier entrant (MX) désigne l'hébergeur — c'est ce qui reconnaît un domaine
 * d'AGENCE. Premier motif apparié, dans l'ordre des préférences MX ; ⚠ l'ordre des règles
 * compte : AOL avant Yahoo, dont il partage le suffixe.
 */
const PAR_MX: [RegExp, Verdict][] = [
  [/(^|\.)(google|googlemail)\.com$/, 'gmail'],
  [/\.protection\.outlook\.com$/, 'outlook'],
  [/(^|\.)infomaniak\.ch$/, INFOMANIAK],
  [/(^|\.)hostpoint\.ch$/, HOSTPOINT],
  [/(^|\.)cyon\.ch$/, CYON],
  [/\.qlmail\.ch$/, QUICKLINE],
  [/(^|\.)netplus\.ch$/, NETPLUS],
  [/(^|\.)kolabnow\.com$/, KOLAB],
  [/-hispeed-ch\.edge\.unified\.services$/, UPC],
  [/(^|\.)spacemail\.com$/, SPACEMAIL],
  [/\.mail\.ovh\.net$/, OVH],
  [/\.(ionos\.de|kundenserver\.de)$/, ionos('de')],
  [/\.ionos\.fr$/, ionos('fr')],
  [/\.ionos\.es$/, ionos('es')],
  [/\.ionos\.co\.uk$/, ionos('co.uk')],
  [/\.(ionos|1and1)\.com$/, ionos('com')],
  [/\.mail\.gandi\.net$/, GANDI],
  [/^mx\d*\.hostinger\.com$/, HOSTINGER],
  [/\.zoho\.eu$/, zoho('eu')],
  [/\.zoho\.com$/, zoho('com')],
  [/\.messagingengine\.com$/, FASTMAIL],
  [/(^|\.)mailbox\.org$/, MAILBOX_ORG],
  [/\.posteo\.de$/, POSTEO],
  [/\.emig\.gmx\.net$/, GMX],
  [/^mx\d+\.gmx\.net$/, GMX_INTERNATIONAL],
  [/\.web\.de$/, WEB_DE],
  [/(^|\.)mail\.com$/, MAIL_COM],
  [/\.t-online\.de$/, TELEKOM],
  [/\.orange\.fr$/, ORANGE],
  [/(^|\.)free\.fr$/, FREE],
  [/\.sfr\.fr$/, SFR],
  [/\.laposte\.net$/, LA_POSTE],
  [/\.libero\.it$/, LIBERO],
  [/\.virgilio\.it$/, VIRGILIO],
  [/\.tiscali\.it$/, TISCALI],
  [/\.mail\.icloud\.com$/, ICLOUD],
  [/^mx-aol\.mail\.[a-z0-9]+\.yahoodns\.net$/, AOL],
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
