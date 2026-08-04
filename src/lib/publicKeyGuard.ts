/**
 * Garde-fou : décide si une valeur a le droit de servir de clé PUBLIQUE au
 * client navigateur.
 *
 * POURQUOI CE FICHIER EXISTE. Une clé `service_role` contourne la RLS. Elle a
 * déjà atterri une fois dans le bundle public de ce projet, parce qu'une
 * variable d'environnement Cloudflare Pages portait la mauvaise valeur (cf. le
 * commentaire du repli codé en dur dans `supabase.ts`). Le contrôle écrit à
 * l'époque ne savait lire qu'un JWT — il décodait la revendication `role`. Or
 * Supabase a depuis introduit un second format, sans point ni payload :
 * `sb_secret_…` pour le secret, `sb_publishable_…` pour la clé publique. Ce
 * projet utilise DÉJÀ le nouveau format (constaté le 04.08.2026 :
 * `app_config.service_role_key` fait 41 caractères et commence par
 * `sb_secret_`). Un secret à ce format passait donc le contrôle sans un mot.
 * Constat détaillé : docs/audits/2026-08-04-blast-radius-service-role.md §4.2.
 *
 * ON REFUSE PAR DÉFAUT. Tout ce qui n'est pas reconnaissable comme publique est
 * rejeté, et l'appelant retombe sur l'anon key codée en dur. Ce choix est sûr
 * dans les deux sens : la valeur de repli est la vraie clé anon du projet, donc
 * un rejet ne casse rien, alors qu'un faux négatif publie un secret. Une chaîne
 * illisible n'aurait de toute façon pas laissé l'application fonctionner.
 *
 * ⚠ Ce module ne vérifie AUCUNE signature — il lit une forme, pas une preuve.
 * Il ne sert qu'à empêcher une valeur manifestement privée de partir dans le
 * navigateur ; la sécurité réelle du client public reste la RLS.
 */

/** Ce qu'on a reconnu, et la raison d'un refus. */
export type PublicKeyVerdict =
  | { safe: true; kind: 'anon-jwt' | 'publishable' }
  | { safe: false; reason: 'secret-key' | 'non-anon-jwt' | 'unrecognised'; role?: string }

/** Payload d'un JWT, signature NON vérifiée ; `null` si illisible. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1]
  if (!part) return null
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    // `atob` tolère l'absence de bourrage, mais pas partout de la même façon :
    // on le rétablit pour que la lecture ne dépende pas du moteur.
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=')
    const parsed: unknown = JSON.parse(atob(padded))
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * Classe une valeur candidate au rôle de clé publique.
 *
 * Ordre délibéré : les formes DANGEREUSES sont reconnues d'abord, pour qu'un
 * ajout futur dans la branche « publique » ne puisse pas les court-circuiter.
 */
export function classifyPublicKey(token: string | null | undefined): PublicKeyVerdict {
  const value = (token ?? '').trim()
  if (!value) return { safe: false, reason: 'unrecognised' }

  // 1) Secret au nouveau format. C'est le trou que ce module a été écrit pour
  //    fermer : aucun point, donc invisible pour un décodeur de JWT.
  if (value.startsWith('sb_secret_')) return { safe: false, reason: 'secret-key' }

  // 2) JWT : seul le rôle `anon` est publiable. `service_role` est le cas qui a
  //    fuité, mais tout autre rôle est refusé aussi — on ne publie que ce qu'on
  //    reconnaît, pas tout ce qu'on ne sait pas nommer.
  const payload = decodeJwtPayload(value)
  if (payload) {
    const role = typeof payload.role === 'string' ? payload.role : undefined
    if (role === 'anon') return { safe: true, kind: 'anon-jwt' }
    return { safe: false, reason: 'non-anon-jwt', role }
  }

  // 3) Clé publique au nouveau format.
  if (value.startsWith('sb_publishable_')) return { safe: true, kind: 'publishable' }

  return { safe: false, reason: 'unrecognised' }
}

/** Message d'alerte console, explicite sur ce qui a été refusé et sur la suite. */
export function publicKeyRefusalMessage(verdict: Extract<PublicKeyVerdict, { safe: false }>): string {
  const cause =
    verdict.reason === 'secret-key'
      ? 'une clé SECRÈTE (`sb_secret_…`)'
      : verdict.reason === 'non-anon-jwt'
        ? `un JWT de rôle « ${verdict.role ?? 'inconnu'} »`
        : 'une valeur non reconnue comme clé publique'
  return (
    `[supabase] VITE_SUPABASE_ANON_KEY contient ${cause}. ` +
    "Refus de l'utiliser — repli sur l'anon key codée en dur. " +
    (verdict.reason === 'unrecognised'
      ? 'Vérifier la configuration des variables de build.'
      : 'Corriger la variable IMMÉDIATEMENT et révoquer la clé exposée.')
  )
}
