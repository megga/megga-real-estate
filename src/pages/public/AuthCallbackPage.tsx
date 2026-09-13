/**
 * Page de callback d'authentification — route `/auth/callback`.
 * Aiguille après connexion : sauvegarde des tokens Google/Outlook Calendar
 * (params `gcal` / `outlook`), sinon redirection selon le rôle en corrigeant au
 * passage le rôle du profil si l'inscription visait un rôle différent.
 * PASSWORD_RECOVERY → écran de reset.
 *
 * ⚠ Les jetons d'agenda ne se lisent PLUS dans la session : le stockage d'auth
 * les en retire avant toute écriture et les confie à un dépôt en mémoire, lu
 * une seule fois (`takeCalendarProviderTokens`, cf. @/lib/authStorage). Les deux
 * déclencheurs d'aiguillage peuvent arriver tous les deux : ils partagent donc
 * UN seul enregistrement (`calendarSaveRef`), sinon le second lirait un dépôt
 * déjà vidé et signalerait à tort une liaison sans jeton.
 *
 * ⚠ Cette page n'affiche QUE l'écran d'arrivée : le seul moyen d'en sortir est
 * un `navigate()`. Elle doit donc en émettre un dans TOUS les cas, y compris
 * quand la lecture du profil traîne ou qu'aucun événement d'auth n'arrive —
 * sinon l'agent reste indéfiniment sur « Ouverture de votre espace », sans
 * message ni bouton. C'est la panne du 29 juil. 2026, et c'est pour ça que
 * l'aiguillage a ici TROIS déclencheurs indépendants et idempotents :
 *
 *   1. l'événement d'auth (`SIGNED_IN`, `TOKEN_REFRESHED`, `INITIAL_SESSION`) ;
 *   2. une sonde `getSession()` au montage, qui ne dépend d'aucun événement ;
 *   3. une échéance de dernier recours, qui route avec ce qu'on sait.
 *
 * `INITIAL_SESSION` est indispensable, pas décoratif : la page est en `lazy()`,
 * et auth-js émet `SIGNED_IN` dans un `setTimeout(…, 0)` juste après avoir
 * résolu le fragment (un aller-retour réseau vers `/auth/v1/user`). Si le chunk
 * est encore en vol à cet instant — cache froid, lien lent — l'abonnement se
 * pose APRÈS l'événement, et auth-js ne lui sert plus que `INITIAL_SESSION`
 * (GoTrueClient `_emitInitialSession`). N'écouter que `SIGNED_IN` faisait alors
 * reposer toute la connexion sur le minuteur de secours.
 */
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Session, User } from '@supabase/supabase-js'
import BootSplash from '@/components/layout/BootSplash'
import { supabase } from '@/lib/supabase'
import { calendarProviderFromParams, calendarReturnPath, type CalendarAuthProvider } from '@/lib/calendarOauth'
import { takeCalendarProviderTokens } from '@/lib/authStorage'
import { Sentry } from '@/lib/sentry'
import { getRedirectPath, getRedirectPathWithoutProfile } from '@/lib/authRedirect'
import type { UserRole } from '@/types/auth'

const VALID_ROLES: UserRole[] = ['buyer', 'seller', 'particulier', 'agent', 'manager', 'admin', 'assistant']

/**
 * Échéance de dernier recours. Au-delà on route avec ce qu'on sait plutôt que
 * de tenir l'écran d'arrivée : mieux vaut une destination approximative qu'un
 * écran sans issue.
 */
const DEADLINE_MS = 8000

/**
 * Lecture du rôle bornée. `supabase-js` ne pose aucun délai sur ses appels REST,
 * et `getSession()` (appelé sous le capot pour signer la requête) rejette au
 * bout de 5 s si le verrou `navigator.locks` de l'origine est tenu par un autre
 * onglet. Sans borne ici, l'un ou l'autre fige la page pour de bon.
 */
const PROFILE_READ_MS = 4000

/** Repli d'aiguillage quand le profil est illisible — règle testée dans `@/lib/authRedirect`. */
function destinationWithoutProfile(user: User): string {
  return getRedirectPathWithoutProfile(user.user_metadata?.role as string | undefined)
}

/** Edge qui garde les jetons d'un fournisseur d'agenda côté serveur. */
const CALENDAR_SYNC_FN: Record<CalendarAuthProvider, string> = {
  google: 'google-calendar-sync',
  azure: 'outlook-calendar-sync',
}

/** Paramètre d'URL qui dit à l'écran d'arrivée l'issue de la liaison. */
const CALENDAR_FLAG: Record<CalendarAuthProvider, string> = { google: 'gcal', azure: 'outlook' }

/**
 * Confie à l'edge les jetons que la liaison vient de déposer ; vrai si l'edge
 * les a acceptés. L'edge vérifie leur provenance (émis pour MEGGA, pour le
 * compte lié) : un refus est une vraie issue, pas une erreur à taire.
 */
async function saveCalendarTokens(provider: CalendarAuthProvider): Promise<boolean> {
  const jetons = takeCalendarProviderTokens(provider)
  if (!jetons?.providerToken || !jetons.providerRefreshToken) {
    // Un refus de consentement revient avec `error` : l'absence de jeton y est
    // normale. Sans erreur, c'est qu'auth-js a changé sa façon de ranger la
    // session — le seul signal serait alors un agenda qui ne se connecte jamais.
    const query = new URLSearchParams(window.location.search)
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const refus = ['error', 'error_code'].some((k) => query.has(k) || fragment.has(k))
    if (!refus) {
      Sentry.captureMessage('calendar_callback_without_provider_tokens', { level: 'warning', tags: { provider } })
    }
    return false
  }
  try {
    const { error } = await supabase.functions.invoke(CALENDAR_SYNC_FN[provider], {
      body: {
        action: 'save_tokens',
        access_token: jetons.providerToken,
        refresh_token: jetons.providerRefreshToken,
        expires_in: 3600,
      },
    })
    return !error
  } catch {
    return false
  }
}

/** Tient l'écran d'arrivée le temps de l'aiguillage. */
export default function AuthCallbackPage() {
  const navigate = useNavigate()
  // Hors état React : l'aiguillage ne doit se produire qu'une fois, et un
  // `setState` ici ne servirait qu'à re-rendre un écran qui ne change pas.
  const settledRef = useRef(false)
  // Un seul enregistrement des jetons d'agenda, partagé par les deux
  // déclencheurs ET par le double effet de StrictMode (cf. en-tête).
  const calendarSaveRef = useRef<Promise<boolean> | null>(null)

  useEffect(() => {
    /** Aiguillage effectif — idempotent, quel que soit le déclencheur gagnant. */
    const settle = (path: string) => {
      if (settledRef.current) return
      settledRef.current = true
      navigate(path, { replace: true })
    }

    // Dernière session vue, pour que l'échéance sache si elle route un connecté
    // ou renvoie au login.
    let seen: Session | null = null

    /** Rôle du profil, borné dans le temps ; `null` si illisible à temps. */
    async function readRole(userId: string): Promise<UserRole | null> {
      const read = supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()
        .then(({ data }) => (data?.role as UserRole | undefined) ?? null)
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), PROFILE_READ_MS))
      try {
        return await Promise.race([read, timeout])
      } catch {
        return null
      }
    }

    async function handleRedirect(session: Session) {
      const user = session.user

      // ── Retour d'une liaison d'agenda (Google ou Outlook) ──
      const params = new URLSearchParams(window.location.search)
      const provider = calendarProviderFromParams(params)
      if (provider) {
        // Créée de façon SYNCHRONE avant tout await : le second déclencheur
        // retrouve la même promesse au lieu de relire un dépôt déjà vidé.
        calendarSaveRef.current ??= saveCalendarTokens(provider)
        const ok = await calendarSaveRef.current
        const issue = ok ? 'success' : 'error'
        settle(calendarReturnPath(params, `/dashboard/settings?tab=integrations&${CALENDAR_FLAG[provider]}=${issue}`))
        return
      }

      // ── Normal OAuth redirect ──
      // Check if there's a pending OAuth role from Google sign-in
      const pendingRole = localStorage.getItem('megga_oauth_role')
      localStorage.removeItem('megga_oauth_role')

      const profileRole = await readRole(user.id)
      if (profileRole === null) {
        // Profil illisible à temps : on entre quand même, plutôt que de retenir
        // l'agent sur l'écran d'arrivée pour une lecture qui ne décidera de rien
        // (aucune surface du CRM n'est gatée par ce rôle-là).
        settle(destinationWithoutProfile(user))
        return
      }

      let role: UserRole = profileRole || 'particulier'

      // Determine the intended role from OAuth localStorage OR user_metadata (email signup)
      const intendedRole = pendingRole
        || (user.user_metadata?.role as string)
        || null

      // If profile has default role but user signed up with a different role, fix it
      if (intendedRole && VALID_ROLES.includes(intendedRole as UserRole)) {
        const selectedRole = intendedRole as UserRole

        if ((role === 'buyer' || role === 'particulier') && selectedRole !== role) {
          const { error } = await supabase
            .from('profiles')
            .update({ role: selectedRole })
            .eq('id', user.id)

          if (!error) {
            role = selectedRole
          }
        }
      }

      settle(getRedirectPath(role))
    }

    /** Enveloppe commune : une erreur d'aiguillage ne doit jamais figer la page. */
    const route = (session: Session) => {
      seen = session
      void handleRedirect(session).catch(() => settle(destinationWithoutProfile(session.user)))
    }

    // Un lien de réinitialisation revient ici avec `?type=recovery`. La
    // destination est alors décidée par l'URL et non par la session : une session
    // de récupération est une session parfaitement valide, donc la sonde
    // ci-dessous l'enverrait sur le dashboard en court-circuitant l'écran de
    // reset.
    const isRecovery = new URLSearchParams(window.location.search).get('type') === 'recovery'

    // ── Déclencheur 1 : événement d'auth ──
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || isRecovery) {
        settle('/auth/forgot-password/reset')
        return
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (session?.user) route(session)
      }
    })

    // ── Déclencheur 2 : sonde au montage, indépendante de tout événement ──
    // `getSession()` attend d'abord la fin de l'initialisation du client, donc le
    // fragment a déjà été consommé quand elle répond : une absence de session est
    // un verdict, pas une course — on renvoie au login sans attendre l'échéance.
    if (isRecovery) {
      settle('/auth/forgot-password/reset')
    } else {
      void supabase.auth.getSession()
        .then(({ data: { session } }) => {
          if (session?.user) route(session)
          else settle('/auth/login')
        })
        .catch(() => { /* le verrou peut rejeter : l'échéance prendra le relais */ })
    }

    // ── Déclencheur 3 : échéance de dernier recours ──
    const deadline = setTimeout(() => {
      settle(seen?.user ? destinationWithoutProfile(seen.user) : '/auth/login')
    }, DEADLINE_MS)

    return () => {
      clearTimeout(deadline)
      subscription.unsubscribe()
    }
  }, [navigate])

  return <BootSplash />
}
