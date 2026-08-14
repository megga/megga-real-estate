/**
 * La session du banc `/dev/crm`, semée AVANT que les providers montent.
 *
 * ⛔ POURQUOI CE MODULE EXISTE SÉPARÉMENT DES FIXTURES. Le semis vivait dans
 * `CrmShowcasePage`, une page LAZY. `AuthProvider` est au-dessus d'elle : quand
 * le chunk de la page tarde — premier chargement, cache froid —, l'effet de
 * `AuthProvider` appelle `getSession()` AVANT que le semis ait eu lieu, ne
 * trouve rien, pose `profile: null`, et n'y revient jamais (rien ne se connecte,
 * donc `onAuthStateChange` ne tire pas). `useIdentityGate` reste alors sur
 * `loading`, et `AgentSugarLayout` RETIENT l'écran sur `BootSplash` — pour
 * toujours.
 *
 * Le symptôme est traître : le jeton EST dans le stockage quand on regarde, donc
 * tout semble en ordre ; c'est l'ORDRE qui est faux, pas le contenu. Et il ne se
 * reproduit qu'au chargement froid, ce qui le fait passer pour un aléa.
 *
 * Le semis se fait donc dans le corps de `BancCrmAgent` (`App.tsx`), qui
 * s'exécute avant le rendu de ses enfants et donc avant leurs effets. Ce module
 * ne porte QUE ça : `App.tsx` l'importe, et les fixtures — lourdes — restent
 * derrière l'import lazy de la page.
 */

/** L'agence du banc : identité soumise et LAB validée, sinon la coquille retient l'écran. */
export const AGENCE_BANC = {
  id: '00000000-0000-4000-8000-000000000a11',
  name: 'Agence MEGGA · démonstration',
  verification_status: 'validated',
  identity_submitted_at: '2026-01-01T00:00:00Z',
  canton: 'GE',
  plan: 'pro',
} as const

/** Le compte du banc — la même personne que `MOCK_PROFILE`, pour ne pas inventer un second agent. */
export const AGENT_BANC = {
  id: '00000000-0000-4000-8000-000000000901',
  email: 'demo@megga.local',
  full_name: 'Gregory Lyonnet',
  role: 'agent',
  avatar_url: null,
  phone: null,
  canton: 'GE',
  agency_id: AGENCE_BANC.id,
  created_at: '2026-01-01T00:00:00Z',
} as const

/** Base64url sans rembourrage — l'alphabet des segments d'un JWT. */
function b64url(o: unknown): string {
  return btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Sème la session dans le stockage de `supabase-js` et la REND, pour que le banc
 * la serve aussi sur `/auth/v1/*`. Rend `null` si la clé n'a pas pu être dérivée
 * ou écrite.
 *
 * ⚠ La clé se DÉRIVE de l'URL du projet (`sb-<ref>-auth-token`) : l'écrire en
 * dur ferait taire le banc le jour où l'on pointe une autre instance — un banc
 * qui échoue en silence se lit « la page est cassée ».
 *
 * ⚠ Et il faut poser `megga_remember` : le stockage du dépôt bascule sur
 * `sessionStorage` quand il vaut `'false'`, et la session semée dans
 * `localStorage` serait alors lue au mauvais endroit.
 *
 * ⚠ LE JETON N'EST PAS SIGNÉ, et c'est sans conséquence ICI seulement : chaque
 * appel REST, edge et `/auth/v1` est intercepté par `bancSupabase`, donc aucun
 * `Authorization` ne sort. C'est aussi pourquoi la route du banc est
 * conditionnée à `import.meta.env.DEV`.
 */
export function semerSessionBanc(urlProjet: string): unknown {
  const ref = /https?:\/\/([^.]+)\./.exec(urlProjet)?.[1]
  if (!ref) return null
  const expire = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365
  const jeton = [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ sub: AGENT_BANC.id, aud: 'authenticated', role: 'authenticated', exp: expire }),
    'banc-non-signe',
  ].join('.')
  const session = {
    access_token: jeton,
    refresh_token: 'banc',
    token_type: 'bearer',
    expires_in: 60 * 60 * 24 * 365,
    expires_at: expire,
    user: {
      id: AGENT_BANC.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: AGENT_BANC.email,
      app_metadata: {},
      user_metadata: { full_name: AGENT_BANC.full_name, role: AGENT_BANC.role },
      created_at: AGENT_BANC.created_at,
    },
  }
  try {
    window.localStorage.setItem('megga_remember', 'true')
    window.localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session))
    return window.localStorage.getItem(`sb-${ref}-auth-token`) === null ? null : session
  } catch {
    return null
  }
}
