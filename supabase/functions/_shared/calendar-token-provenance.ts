/**
 * Provenance des jetons d'agenda reçus par `save_tokens`
 * (google-calendar-sync, outlook-calendar-sync).
 *
 * POURQUOI. `save_tokens` range avec le service_role les jetons que le
 * NAVIGATEUR lui envoie. Sans contrôle, quiconque tient la session d'un agent
 * (XSS, extension) y dépose les jetons de SON PROPRE compte Google : chaque
 * visite synchronisée pousse ensuite le nom, l'e-mail et le téléphone de
 * l'acheteur dans l'agenda de l'attaquant — et cela survit à la XSS. Fermer
 * l'écriture directe en base (migration 20260913160600) ne faisait que déplacer
 * cette injection vers l'edge.
 *
 * LE CONTRÔLE porte sur le jeton de RAFRAÎCHISSEMENT, pas sur le jeton d'accès :
 * c'est lui qui est gardé des mois et sert à chaque synchronisation. On l'échange
 * donc tout de suite avec les identifiants de MEGGA — un jeton émis pour une autre
 * application est refusé par le fournisseur — puis on vérifie que le jeton neuf
 * appartient au compte que l'agent a LIÉ à son utilisateur (auth.identities) :
 *   • Google : `tokeninfo` → `aud`/`azp` = GOOGLE_CLIENT_ID, `sub` = celui de
 *     l'identité `google`, portée agenda présente ;
 *   • Microsoft : Graph `/me` → adresse ou identifiant de l'identité `azure`
 *     (le `sub` d'un jeton d'identité Microsoft est propre à chaque application :
 *     il ne se compare pas à l'identifiant Graph, d'où l'adresse).
 * Effet de bord voulu : un couple identifiant/secret faux échoue À LA LIAISON,
 * bruyamment, au lieu de déconnecter l'agenda en silence une heure plus tard.
 *
 * Résiduel : un attaquant qui tient la session peut d'abord LIER son propre
 * compte Google (linkIdentity). Il doit alors laisser une identité visible dans
 * auth.identities, et `calendar_connected` au journal de sécurité.
 *
 * Module pur : `fetch` est injecté, rien ne lit l'environnement.
 */

/** Signature de `fetch` suffisante ici — injectable pour les tests. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/** Portées qui autorisent l'écriture d'événements : l'étroite (demandée), ou la complète. */
const PORTEES_AGENDA_GOOGLE = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar',
]

/** Portées redemandées à Microsoft à l'échange — les mêmes que la liaison et le rafraîchissement. */
const PORTEES_MICROSOFT = 'https://graph.microsoft.com/Calendars.ReadWrite offline_access User.Read'

/** Pourquoi une liaison est refusée — rendu tel quel à l'appelant, jamais un jeton. */
export type RefusLiaison =
  | 'non_configure' // identifiants du fournisseur absents du projet
  | 'fournisseur_injoignable' // réseau ou 5xx : réessayer plus tard
  | 'identite_absente' // aucun compte de ce fournisseur lié à l'utilisateur
  | 'rafraichissement_refuse' // jeton émis pour une autre application, révoqué, ou faux
  | 'mauvais_client' // jeton d'accès émis pour une autre application
  | 'mauvais_compte' // jeton d'un autre compte que celui lié
  | 'portee_insuffisante' // consentement donné sans l'agenda

/** Jetons vérifiés, prêts à ranger : le jeton d'accès est NEUF (issu de l'échange). */
export interface JetonsVerifies {
  accessToken: string
  refreshToken: string
  expiresIn: number
  email: string | null
}

export type VerdictLiaison = { ok: true; jetons: JetonsVerifies } | { ok: false; refus: RefusLiaison }

/** Identité liée telle que `auth.admin.getUserById` la rend (le sous-ensemble lu ici). */
export interface IdentiteLiee {
  provider: string
  id?: string | null
  identity_data?: Record<string, unknown> | null
}

/** Compte du fournisseur lié à l'utilisateur. */
export interface CompteLie {
  sub: string | null
  email: string | null
}

const texte = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

/**
 * Le compte `provider` lié à l'utilisateur, ou null s'il n'en a pas. Le `sub` se
 * lit dans `identity_data` (GoTrue récent) avec repli sur `id` (qui porte
 * l'identifiant du fournisseur sur les versions antérieures).
 */
export function compteLie(identities: readonly IdentiteLiee[] | null | undefined, provider: 'google' | 'azure'): CompteLie | null {
  const identite = identities?.find((i) => i.provider === provider)
  if (!identite) return null
  const d = identite.identity_data ?? {}
  return {
    sub: texte(d.sub) ?? texte(d.provider_id) ?? texte(identite.id),
    email: texte(d.email)?.toLowerCase() ?? null,
  }
}

type Reponse = { statut: number; corps: Record<string, unknown> | null } | null

/** Appel borné dans le temps ; null si le réseau a échoué. Le corps non JSON devient null. */
async function appeler(fetchImpl: FetchLike, url: string, init: RequestInit, timeoutMs: number): Promise<Reponse> {
  let r: Response
  try {
    r = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch {
    return null
  }
  let corps: Record<string, unknown> | null = null
  try {
    const lu: unknown = await r.json()
    if (lu && typeof lu === 'object' && !Array.isArray(lu)) corps = lu as Record<string, unknown>
  } catch {
    corps = null
  }
  return { statut: r.status, corps }
}

const formulaire = (champs: Record<string, string>): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(champs).toString(),
})

interface OptionsLiaison {
  clientId: string
  clientSecret: string
  compte: CompteLie | null
  fetchImpl?: FetchLike
  timeoutMs?: number
}

/** Échange le jeton de rafraîchissement : un 4xx est un refus du jeton, un 5xx une panne. */
async function echanger(
  fetchImpl: FetchLike,
  url: string,
  champs: Record<string, string>,
  timeoutMs: number,
): Promise<{ ok: true; corps: Record<string, unknown> } | { ok: false; refus: RefusLiaison }> {
  const r = await appeler(fetchImpl, url, formulaire(champs), timeoutMs)
  if (!r || r.statut >= 500) return { ok: false, refus: 'fournisseur_injoignable' }
  if (r.statut !== 200 || !r.corps || !texte(r.corps.access_token)) return { ok: false, refus: 'rafraichissement_refuse' }
  return { ok: true, corps: r.corps }
}

const dureeDe = (v: unknown): number => (typeof v === 'number' && v > 0 ? v : Number(v) > 0 ? Number(v) : 3600)

/**
 * Vérifie une liaison Google à partir de son jeton de rafraîchissement : échange
 * avec les identifiants de MEGGA, puis `tokeninfo` sur le jeton neuf.
 */
export async function verifierLiaisonGoogle(refreshToken: string, opts: OptionsLiaison): Promise<VerdictLiaison> {
  if (!opts.clientId || !opts.clientSecret) return { ok: false, refus: 'non_configure' }
  const compte = opts.compte
  if (!compte || (!compte.sub && !compte.email)) return { ok: false, refus: 'identite_absente' }
  const fetchImpl = opts.fetchImpl ?? fetch
  const timeoutMs = opts.timeoutMs ?? 5000

  const echange = await echanger(fetchImpl, 'https://oauth2.googleapis.com/token', {
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }, timeoutMs)
  if (!echange.ok) return echange
  const accessToken = texte(echange.corps.access_token) as string

  // POST et non GET : le jeton ne doit pas finir dans une URL (journaux, proxies).
  const info = await appeler(fetchImpl, 'https://oauth2.googleapis.com/tokeninfo', formulaire({ access_token: accessToken }), timeoutMs)
  if (!info || info.statut >= 500) return { ok: false, refus: 'fournisseur_injoignable' }
  if (info.statut !== 200 || !info.corps) return { ok: false, refus: 'rafraichissement_refuse' }
  const c = info.corps
  if (c.aud !== opts.clientId && c.azp !== opts.clientId) return { ok: false, refus: 'mauvais_client' }

  const sub = texte(c.sub)
  const email = texte(c.email)?.toLowerCase() ?? null
  const emailVerifie = c.email_verified === true || c.email_verified === 'true'
  // Le `sub` fait foi. L'adresse n'est un repli que si Google ne rend pas de `sub`
  // ET certifie l'adresse — jamais une adresse contre un `sub` qui diffère.
  const memeCompte = sub
    ? compte.sub !== null && sub === compte.sub
    : email !== null && emailVerifie && email === compte.email
  if (!memeCompte) return { ok: false, refus: 'mauvais_compte' }

  const portees = typeof c.scope === 'string' ? c.scope.split(/\s+/) : []
  if (!PORTEES_AGENDA_GOOGLE.some((p) => portees.includes(p))) return { ok: false, refus: 'portee_insuffisante' }

  return {
    ok: true,
    jetons: { accessToken, refreshToken, expiresIn: dureeDe(echange.corps.expires_in), email: email ?? compte.email },
  }
}

/**
 * Vérifie une liaison Microsoft à partir de son jeton de rafraîchissement :
 * échange avec les identifiants de MEGGA, puis Graph `/me` sur le jeton neuf.
 * Microsoft peut rendre un NOUVEAU jeton de rafraîchissement : c'est lui qu'on garde.
 */
export async function verifierLiaisonMicrosoft(refreshToken: string, opts: OptionsLiaison): Promise<VerdictLiaison> {
  if (!opts.clientId || !opts.clientSecret) return { ok: false, refus: 'non_configure' }
  const compte = opts.compte
  if (!compte || (!compte.sub && !compte.email)) return { ok: false, refus: 'identite_absente' }
  const fetchImpl = opts.fetchImpl ?? fetch
  const timeoutMs = opts.timeoutMs ?? 5000

  const echange = await echanger(fetchImpl, 'https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: PORTEES_MICROSOFT,
  }, timeoutMs)
  if (!echange.ok) return echange
  const accessToken = texte(echange.corps.access_token) as string

  const moi = await appeler(fetchImpl, 'https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${accessToken}` },
  }, timeoutMs)
  if (!moi || moi.statut >= 500) return { ok: false, refus: 'fournisseur_injoignable' }
  if (moi.statut !== 200 || !moi.corps) return { ok: false, refus: 'rafraichissement_refuse' }

  const adresses = [moi.corps.mail, moi.corps.userPrincipalName]
    .map((v) => texte(v)?.toLowerCase() ?? null)
    .filter((v): v is string => v !== null)
  const idGraph = texte(moi.corps.id)
  const memeCompte = (compte.email !== null && adresses.includes(compte.email))
    || (idGraph !== null && compte.sub !== null && idGraph === compte.sub)
  if (!memeCompte) return { ok: false, refus: 'mauvais_compte' }

  return {
    ok: true,
    jetons: {
      accessToken,
      refreshToken: texte(echange.corps.refresh_token) ?? refreshToken,
      expiresIn: dureeDe(echange.corps.expires_in),
      email: compte.email ?? adresses[0] ?? null,
    },
  }
}

/** Statut HTTP d'un refus : une panne ou un projet non configuré n'est pas la faute de l'appelant. */
export function statutDuRefus(refus: RefusLiaison): number {
  return refus === 'non_configure' || refus === 'fournisseur_injoignable' ? 503 : 403
}
