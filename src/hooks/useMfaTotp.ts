// MEGGA CRM — TOTP 2FA via Supabase Auth MFA.
//
// Câblage RÉEL (aucune migration) : les facteurs MFA vivent dans le système
// d'auth de Supabase (auth.mfa_factors), pas dans une table applicative.
//   - listFactors()  → un facteur TOTP « verified » existe ? → isEnabled
//   - enroll()       → renvoie le QR (SVG dataURI) + le secret à scanner
//   - challenge()    → ouvre un challenge sur le facteur enrôlé
//   - verify()       → valide le code à 6 chiffres → facteur « verified »
//   - unenroll()     → désactive la 2FA
//
// Si l'enrôlement échoue (MFA non activé au niveau projet, plan, etc.), on
// expose un message honnête au lieu de planter — la maquette doit rester
// fonctionnelle même quand le backend ne le permet pas encore.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface MfaTotpState {
  /** Un facteur TOTP « verified » existe → la 2FA est active. */
  isEnabled: boolean
  /** Chargement initial (listFactors) ou action en cours (enroll/verify/disable). */
  isLoading: boolean
  /** Id du facteur TOTP (verified s'il existe, sinon l'enrôlement en cours). */
  factorId: string | null
  /** QR code (SVG dataURI) renvoyé par enroll() — à afficher tel quel. */
  qr: string | null
  /** Secret texte (saisie manuelle) renvoyé par enroll(). */
  secret: string | null
  /** Démarre un enrôlement TOTP : peuple qr + secret + factorId. */
  enroll: () => Promise<boolean>
  /** Vérifie le code à 6 chiffres et active la 2FA. */
  verify: (code: string) => Promise<boolean>
  /** Désactive la 2FA (unenroll du facteur). */
  disable: () => Promise<boolean>
  /** Message d'erreur lisible (FR) pour la dernière action, sinon null. */
  error: string | null
}

/** Traduit un message d'erreur Supabase MFA (EN) en message FR affichable à l'agent. */
function friendlyError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('mfa') && (m.includes('disabled') || m.includes('not enabled'))) {
    return "La double authentification n'est pas activée sur ce projet. Contactez votre administrateur."
  }
  if (m.includes('invalid') && m.includes('code')) return 'Code incorrect. Vérifiez le code affiché dans votre application.'
  if (m.includes('expired')) return 'Le code a expiré. Saisissez le code affiché actuellement.'
  if (m.includes('factor') && m.includes('exists')) return 'Un facteur 2FA existe déjà sur ce compte.'
  return message
}

/**
 * Gère l'activation/désactivation de la 2FA TOTP via l'auth MFA Supabase.
 * Expose l'état (isEnabled/qr/secret) et les actions enroll/verify/disable ;
 * les erreurs backend remontent en FR via {@link friendlyError} sans crasher l'UI.
 */
export function useMfaTotp(): MfaTotpState {
  const [isEnabled, setIsEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // État initial : un facteur TOTP « verified » existe-t-il ?
  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data, error: listErr } = await supabase.auth.mfa.listFactors()
      if (listErr) throw listErr
      // `data.all` contient les facteurs vérifiés ET non vérifiés ; `data.totp`
      // n'expose que les vérifiés. On filtre `all` sur le type TOTP.
      const totp = (data?.all ?? []).filter(f => f.factor_type === 'totp')
      const verified = totp.find(f => f.status === 'verified')
      if (verified) {
        setIsEnabled(true)
        setFactorId(verified.id)
      } else {
        setIsEnabled(false)
        // Un facteur « unverified » résiduel : on le réutilise pour l'enrôlement.
        setFactorId(totp[0]?.id ?? null)
      }
    } catch {
      // Pas d'accès MFA : on reste en état « désactivé » sans bruit (l'UI
      // affichera l'erreur seulement si l'utilisateur tente d'activer).
      setIsEnabled(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const enroll = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      // Nettoie un éventuel facteur non-vérifié pour éviter l'erreur « already exists ».
      const { data: existing } = await supabase.auth.mfa.listFactors()
      const stale = (existing?.all ?? []).find(f => f.factor_type === 'totp' && f.status === 'unverified')
      if (stale) await supabase.auth.mfa.unenroll({ factorId: stale.id })

      const { data, error: enrollErr } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
      if (enrollErr) throw enrollErr
      setFactorId(data.id)
      setQr(data.totp.qr_code)
      setSecret(data.totp.secret)
      return true
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : 'Erreur inconnue'))
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const verify = useCallback(
    async (code: string) => {
      if (!factorId) {
        setError('Aucun facteur à vérifier. Relancez l’activation.')
        return false
      }
      setError(null)
      setIsLoading(true)
      try {
        // (Ré)ouvre un challenge à chaque tentative.
        let chId = challengeId
        const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId })
        if (chErr) throw chErr
        chId = ch.id
        setChallengeId(chId)

        const { error: verifyErr } = await supabase.auth.mfa.verify({
          factorId,
          challengeId: chId,
          code,
        })
        if (verifyErr) throw verifyErr
        setIsEnabled(true)
        setQr(null)
        setSecret(null)
        setChallengeId(null)
        return true
      } catch (err) {
        setError(friendlyError(err instanceof Error ? err.message : 'Erreur inconnue'))
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [factorId, challengeId],
  )

  const disable = useCallback(async () => {
    if (!factorId) return false
    setError(null)
    setIsLoading(true)
    try {
      const { error: unErr } = await supabase.auth.mfa.unenroll({ factorId })
      if (unErr) throw unErr
      setIsEnabled(false)
      setFactorId(null)
      setQr(null)
      setSecret(null)
      setChallengeId(null)
      return true
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : 'Erreur inconnue'))
      return false
    } finally {
      setIsLoading(false)
    }
  }, [factorId])

  return { isEnabled, isLoading, factorId, qr, secret, enroll, verify, disable, error }
}
