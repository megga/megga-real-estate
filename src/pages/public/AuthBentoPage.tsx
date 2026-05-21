// MEGGA Auth — page wrappers utilisant AuthBentoApp
// Routes :
//   /auth/connexion                       → particulier · initial
//   /auth/connexion?pro                   → agent · signin
//   /auth/connexion/lien-envoye?email=…   → particulier · sent
//   /auth/connexion/erreur                → particulier · error
//   /auth/inscription                     → agent · signup
//   /auth/mot-de-passe-oublie             → agent · reset
//   /auth/mot-de-passe-oublie/envoye?email=…  → agent · resetsent
import { useSearchParams } from 'react-router-dom'
import { AuthBentoApp } from '@/components/auth-bento/AuthBentoApp'

export function AuthConnexionPage() {
  const [params] = useSearchParams()
  const isAgent = params.has('pro')
  return (
    <AuthBentoApp
      route={
        isAgent
          ? { portail: 'agent', etat: 'signin' }
          : { portail: 'particulier', etat: 'initial' }
      }
    />
  )
}

export function AuthMagicSentPage() {
  return <AuthBentoApp route={{ portail: 'particulier', etat: 'sent' }} />
}

export function AuthMagicErrorPage() {
  return <AuthBentoApp route={{ portail: 'particulier', etat: 'error' }} />
}

export function AuthSignupPage() {
  return <AuthBentoApp route={{ portail: 'agent', etat: 'signup' }} />
}

export function AuthVerifyEmailPage() {
  return <AuthBentoApp route={{ portail: 'agent', etat: 'verifyEmail' }} />
}

export function AuthResetPage() {
  return <AuthBentoApp route={{ portail: 'agent', etat: 'reset' }} />
}

export function AuthResetSentPage() {
  return <AuthBentoApp route={{ portail: 'agent', etat: 'resetsent' }} />
}

export function AuthSetNewPasswordPage() {
  return <AuthBentoApp route={{ portail: 'agent', etat: 'setNewPassword' }} />
}
