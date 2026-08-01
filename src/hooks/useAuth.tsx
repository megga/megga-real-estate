/**
 * Contexte d'authentification (Supabase Auth) — source unique session / user / profile.
 * Expose les gestes de connexion (mot de passe, OTP e-mail, OAuth Google/Microsoft/
 * Facebook), inscription, reset, updatePassword et signOut, plus les dérivés de rôle
 * (isAgent / isParticulier). DEV_BYPASS_AUTH (dev-only) injecte un mock sans réseau.
 *
 * ⚠ DEUX INVARIANTS NON NÉGOCIABLES, posés après l'incident « Agence non chargée »
 * (onboarding KYB, 01.08.2026). Les deux protègent la même chose : `profile.agency_id`,
 * dont dépendent useAgencySettings/useAgencyIdentity — un `agency_id` nul y devient le
 * message « Agence non chargée » au moment d'enregistrer, après toute la saisie.
 *
 * 1. Le callback `onAuthStateChange` ne fait QUE du synchrone — jamais un appel
 *    Supabase awaité. auth-js appelle ce callback DEPUIS l'intérieur de son verrou
 *    (`_onVisibilityChanged` → `_acquireLock` → `_recoverAndRefresh` →
 *    `_notifyAllSubscribers`, qui AWAITE chaque abonné). Toute lecture PostgREST
 *    résout son jeton par `getSession()`, qui reprend ce même verrou : on tombe alors
 *    dans la branche réentrante `if (this.lockAcquired) { await last; … }`, où AUCUN
 *    timeout n'est armé et où `last` attend le callback qui attend cette lecture.
 *    Attente circulaire : la requête HTTP ne part jamais. Le chargement du profil vit
 *    donc dans un effet séparé (« effet 2 » plus bas), déclenché par le changement de
 *    session — donc hors de la pile du callback, où reprendre le verrou est sans danger.
 *    ⛔ Ne PAS « corriger » ce genre de blocage en allongeant PROFILE_READ_MS : depuis
 *    auth-js 2.102 le verrou est VOLÉ à échéance (`steal: true`), mais uniquement dans
 *    la branche non réentrante — l'attente circulaire, elle, est infinie.
 *
 * 2. Un profil SYNTHÉTISÉ n'écrase jamais un profil LU en base (voir
 *    `reconcileProfile`). Le repli existe pour amorcer le routage au tout premier
 *    login, pas pour remplacer une vérité déjà connue par un `agency_id: null`.
 */
import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { UserProfile, UserRole } from '@/types/auth'
import { isAgentRole, isParticulierRole } from '@/types/auth'

export type { UserRole, UserProfile } from '@/types/auth'

// DEV_BYPASS: active uniquement en dev ET si VITE_DEV_BYPASS_AUTH=true dans .env.local
// Ne jamais activer en prod — même si la constante est forcée, ce check empêche l'app de démarrer.
const DEV_BYPASS_AUTH = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

if (DEV_BYPASS_AUTH && import.meta.env.PROD) {
  throw new Error('[SECURITY] DEV_BYPASS_AUTH ne peut pas être actif en production.')
}

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  isAgent: boolean
  isParticulier: boolean
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithEmail: (email: string) => Promise<{ error: string | null }>
  signInWithGoogle: (role?: UserRole) => Promise<{ error: string | null }>
  signInWithMicrosoft: (role?: UserRole) => Promise<{ error: string | null }>
  signInWithFacebook: (role?: UserRole) => Promise<{ error: string | null }>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName: string, role?: UserRole) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Device detection — fire-and-forget, called once per sign-in.
// Sends the user's access_token + client-side fingerprint hints so the
// Edge Function can decide whether to alert the user by email.
async function reportDevice(accessToken: string) {
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detect-new-device`
    await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        screen: `${window.screen.width}x${window.screen.height}`,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
      // Don't block the login UX if the network is slow/offline
      signal: AbortSignal.timeout(8000),
    })
  } catch { /* silent — security telemetry must never break login */ }
}

// Rôle mock par défaut = 'agent' (le plus sûr). Pour tester super_admin en dev,
// set VITE_DEV_BYPASS_ROLE=super_admin dans .env.local
const MOCK_ROLE = (import.meta.env.VITE_DEV_BYPASS_ROLE as UserRole | undefined) ?? 'agent'

// Email en `.local` (TLD non routable) : échappatoire CI/dev de l'allowlist
// super-admin, côté SQL (super_admin_allowlist_match tolère le domaine de test).
// useSuperAdminGate court-circuite désormais la RPC sous DEV_BYPASS — ce mock
// n'a pas de session Supabase — mais l'échappatoire reste nécessaire aux tests
// backend qui, eux, parlent à la vraie DB. Sans effet en prod.
const MOCK_USER = {
  id: 'dev-mock-user',
  email: 'dev@megga.local',
  user_metadata: { full_name: 'Gregory Lyonnet', role: MOCK_ROLE },
  app_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
} as unknown as User

const MOCK_PROFILE: UserProfile = {
  id: 'dev-mock-user',
  email: 'dev@megga.local',
  full_name: 'Gregory Lyonnet',
  role: MOCK_ROLE,
  avatar_url: null,
  phone: null,
  canton: 'GE',
  agency_id: 'dev-mock-agency',
  created_at: '2026-01-01T00:00:00Z',
}

/**
 * Plafond de lecture du profil. supabase-js ne borne aucun appel REST : sans ce
 * plafond, une lecture qui ne revient jamais retient tout le démarrage (cf. le
 * commentaire du filet de sécurité plus bas).
 */
const PROFILE_READ_MS = 4000

/**
 * Résultat d'une lecture de profil. Discriminé — et non un simple
 * `UserProfile | null` — parce que l'appelant DOIT pouvoir distinguer un profil lu
 * en base d'un profil synthétisé depuis `user_metadata` : le second porte
 * `agency_id: null` par construction (la métadonnée du jeton ne connaît pas
 * l'agence), et le laisser passer pour l'autre est exactement ce qui produisait
 * « Agence non chargée » en pleine saisie. Voir `reconcileProfile`.
 */
type ProfileRead =
  | { kind: 'loaded'; profile: UserProfile }
  | { kind: 'fallback'; profile: UserProfile }
  | { kind: 'unavailable' }

/**
 * Applique une lecture de profil à l'état courant sans jamais RÉGRESSER : un profil
 * synthétisé ne remplace pas un profil déjà lu en base pour le même utilisateur.
 *
 * Le test `prev.id === userId` n'est pas une précaution de style — c'est la garde
 * anti-fuite : après un changement de compte, conserver `prev` sans le vérifier
 * ferait porter au nouvel arrivant l'`agency_id` de l'utilisateur sortant, donc son
 * tenant. On préfère alors le repli (ou rien) au profil de quelqu'un d'autre.
 *
 * Pure et exportée pour être testée sans monter le provider ni mocker Supabase —
 * même motif que resolveIdentityGateStatus (useIdentityGate.ts).
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée, même motif que useAuth() plus bas.
export function reconcileProfile(
  prev: UserProfile | null,
  read: ProfileRead,
  userId: string,
): UserProfile | null {
  if (read.kind === 'loaded') return read.profile
  if (prev && prev.id === userId) return prev
  return read.kind === 'fallback' ? read.profile : null
}

/** Charge le profil depuis `profiles` ; un retry à 500 ms couvre la race « trigger de création pas encore passé », sinon repli minimal construit depuis user_metadata. */
async function fetchProfile(userId: string, user?: User | null, retry = true): Promise<ProfileRead> {
  try {
    const read = supabase
      .from('profiles')
      .select('id, agency_id, email, full_name, avatar_url, role, phone, canton, created_at')
      .eq('id', userId)
      .single()
    // Une lecture hors délai est traitée comme une lecture vide : on retombe sur
    // le repli user_metadata au lieu d'attendre indéfiniment.
    const { data, error } = await Promise.race([
      read,
      new Promise<{ data: null; error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message: 'profile read timeout' } }), PROFILE_READ_MS),
      ),
    ])
    if (error || !data) {
      // Profile may not exist yet (first login, trigger pending)
      // Retry once after 500ms to handle race condition
      if (retry) {
        await new Promise((r) => setTimeout(r, 500))
        return fetchProfile(userId, user, false)
      }
      // Fallback: build a minimal profile from user_metadata so routing works
      if (user) {
        const meta = user.user_metadata ?? {}
        return {
          kind: 'fallback',
          profile: {
            id: userId,
            email: user.email ?? '',
            full_name: meta.full_name ?? meta.name ?? '',
            role: (meta.role as UserProfile['role']) ?? 'particulier',
            avatar_url: meta.avatar_url ?? null,
            phone: null,
            canton: null,
            agency_id: null,
            created_at: user.created_at ?? new Date().toISOString(),
          } as UserProfile,
        }
      }
      return { kind: 'unavailable' }
    }
    return { kind: 'loaded', profile: data as UserProfile }
  } catch {
    return { kind: 'unavailable' }
  }
}

/** Provider racine : hydrate session + profil au montage, suit onAuthStateChange, expose les gestes d'auth. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(DEV_BYPASS_AUTH ? MOCK_PROFILE : null)
  const [loading, setLoading] = useState(DEV_BYPASS_AUTH ? false : true)
  /** Dernier utilisateur pour lequel une lecture de profil a été lancée (cf. effet 2). */
  const loadedForUserId = useRef<string | null>(null)

  const loadProfile = useCallback(async (user: User | null) => {
    if (!user) {
      loadedForUserId.current = null
      setProfile(null)
      return
    }
    const read = await fetchProfile(user.id, user)
    setProfile((prev) => reconcileProfile(prev, read, user.id))
    loadedForUserId.current = user.id
  }, [])

  // ── Effet 1 — résolution de la SESSION. Aucun await d'appel Supabase ici. ──
  useEffect(() => {
    if (DEV_BYPASS_AUTH) return

    // Filet de sécurité : `loading` commande un écran d'attente SANS ISSUE
    // (ProtectedRoute rend BootSplash tant qu'il vaut true), donc il doit
    // retomber quoi qu'il arrive.
    //
    // ⚠ Le minuteur couvre la séquence ENTIÈRE (session PUIS profil), pas
    // seulement `getSession()` — c'est la lecture de profil qui peut traîner
    // (aucun délai sur les appels REST de supabase-js, et un `getSession()`
    // interne qui rejette au bout de 5 s si un autre onglet tient le verrou de
    // l'origine). Il n'est donc désarmé qu'au démontage, jamais dès que la
    // session arrive : sinon une lecture qui s'éternise laisse `loading` à true
    // pour toujours — écran « Ouverture de votre espace » figé sur /dashboard.
    const safetyTimeout = setTimeout(() => setLoading(false), 3000)

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      // Pas de session : rien à charger, l'effet 2 n'aura donc rien à conclure.
      if (!s?.user) {
        loadedForUserId.current = null
        setProfile(null)
        setLoading(false)
      }
    }).catch(() => {
      // Le verrou peut rejeter (conflit entre onglets) — on démarre déconnecté
      // plutôt que de retenir l'app.
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      // ⚠ SYNCHRONE UNIQUEMENT — invariant 1 en tête de fichier. auth-js awaite
      // ce callback depuis l'INTÉRIEUR de son verrou ; y attendre une lecture
      // PostgREST (qui redemande ce même verrou) est une attente circulaire.
      // Le chargement du profil est délégué à l'effet 2 via ce setSession.
      setSession(s)
      // Déconnexion : le profil tombe ICI et non dans l'effet 2 — un setState
      // synchrone dans un effet déclencherait un rendu en cascade (react-hooks).
      if (!s?.user) {
        loadedForUserId.current = null
        setProfile(null)
        setLoading(false)
      }
      // Fire-and-forget device detection on sign-in (not on every token refresh).
      // `fetch` direct vers l'edge function, jamais supabase-js : ne redemande
      // donc pas le verrou d'auth, et reste sûr ici.
      if (event === 'SIGNED_IN' && s?.access_token) {
        void reportDevice(s.access_token)
      }
    })

    return () => {
      clearTimeout(safetyTimeout)
      subscription.unsubscribe()
    }
  }, [])

  // ── Effet 2 — chargement du PROFIL, hors de la pile du callback d'auth. ──
  // Déclenché par le changement de session : à ce moment le callback a rendu la
  // main, donc reprendre le verrou d'auth est sans danger.
  useEffect(() => {
    if (DEV_BYPASS_AUTH) return
    const user = session?.user ?? null

    // Absence de session : déjà traitée de façon synchrone par l'effet 1 (profil
    // remis à null là-bas), rien à faire ici.
    if (!user) return
    // auth-js réémet SIGNED_IN à chaque retour d'onglet et TOKEN_REFRESHED environ
    // toutes les heures : sans cette garde, le profil serait relu à chaque fois,
    // pour un résultat identique. Un changement de COMPTE, lui, passe (id différent).
    if (loadedForUserId.current === user.id) return
    loadedForUserId.current = user.id

    let cancelled = false
    let settled = false
    void (async () => {
      const read = await fetchProfile(user.id, user)
      if (cancelled) return
      settled = true
      setProfile((prev) => reconcileProfile(prev, read, user.id))
      setLoading(false)
    })()

    return () => {
      cancelled = true
      // Démontage avant la fin de la lecture (StrictMode, navigation) : on relâche
      // la garde, sinon le remontage la croirait déjà faite et n'aurait jamais de profil.
      if (!settled) loadedForUserId.current = null
    }
  }, [session])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) return { error: error.message }

    // Self-claim a pending signup role (buyer/particulier → agent/manager/admin/
    // assistant). Goes through the claim_pending_role SECURITY DEFINER RPC — the
    // client can no longer write profiles.role directly (privilege-escalation
    // lockdown, migration 20260627120000). The RPC re-checks the current role
    // and the JWT metadata server-side; super_admin is never claimable.
    const metaRole = data.user?.user_metadata?.role as UserRole | undefined
    if (data.user && metaRole && ['agent', 'manager', 'admin', 'assistant'].includes(metaRole)) {
      await supabase.rpc('claim_pending_role')
    }

    return { error: null }
  }, [])

  const signInWithEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error: error?.message ?? null }
  }, [])

  const signInWithGoogle = useCallback(async (role?: UserRole) => {
    // Store selected role before OAuth redirect — will be read by AuthCallbackPage
    if (role) {
      localStorage.setItem('megga_oauth_role', role)
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error: error?.message ?? null }
  }, [])

  const signInWithFacebook = useCallback(async (role?: UserRole) => {
    if (role) {
      localStorage.setItem('megga_oauth_role', role)
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error: error?.message ?? null }
  }, [])

  const signInWithMicrosoft = useCallback(async (role?: UserRole) => {
    // Store selected role before OAuth redirect — same pattern as Google.
    // Supabase refers to Microsoft/Outlook as the 'azure' provider internally.
    if (role) {
      localStorage.setItem('megga_oauth_role', role)
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        // openid + email + profile are the standard login scopes; we explicitly
        // skip offline_access here because we're not asking for Calendar access
        // at login time (that's handled separately in Settings → Applications).
        scopes: 'openid email profile',
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error: error?.message ?? null }
  }, [])

  // ⚠ Supabase Auth impose un captcha sur /recover : cet appel, qui n'en fournit
  // pas, est rejeté en `captcha_failed`. Le seul appelant vivant est le bouton
  // « Recevoir un lien » de Réglages → Sécurité (SecuritySection), cassé de ce
  // fait — défaut ANTÉRIEUR au retrait du module captcha (celui-ci ne produisait
  // aucun token faute de VITE_TURNSTILE_SITE_KEY), à traiter séparément.
  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })
    return { error: error?.message ?? null }
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    return { error: error?.message ?? null }
  }, [])

  const signUp = useCallback(async (email: string, password: string, fullName: string, role: UserRole = 'particulier') => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) return { error: error.message }

    // Ensure the profile has the correct role (trigger may default to 'particulier')
    if (data.user) {
      await supabase
        .from('profiles')
        .update({ role })
        .eq('id', data.user.id)
    }

    return { error: null }
  }, [])

  const handleSignOut = useCallback(async () => {
    // Clear local state immediately so UI updates even if Supabase hangs
    setSession(null)
    setProfile(null)
    try {
      await supabase.auth.signOut()
    } catch {
      // Force clear Supabase auth storage if signOut fails (lock conflict)
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
      keys.forEach((k) => localStorage.removeItem(k))
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user ?? null)
  }, [session, loadProfile])

  const isAgent = profile ? isAgentRole(profile.role) : false
  const isParticulier = profile ? isParticulierRole(profile.role) : false

  return (
    <AuthContext.Provider
      value={{
        session,
        user: DEV_BYPASS_AUTH ? MOCK_USER : (session?.user ?? null),
        profile,
        loading,
        isAgent,
        isParticulier,
        signInWithPassword,
        signInWithEmail,
        signInWithGoogle,
        signInWithMicrosoft,
        signInWithFacebook,
        signUp,
        resetPassword,
        updatePassword,
        signOut: handleSignOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/** Accès au contexte d'auth ; lève si appelé hors d'un `AuthProvider`. */
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
