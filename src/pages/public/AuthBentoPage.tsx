// MEGGA Auth — page wrappers utilisant AuthBentoApp
// Routes :
//   /auth/login                       → particulier · initial
//   /auth/login?pro                   → agent · signin
//   /auth/login/link-sent?email=…     → particulier · sent
//   /auth/login/error                 → particulier · error
//   /auth/signup                      → agent · signup
//   /auth/forgot-password             → agent · reset
//   /auth/forgot-password/sent?email=…  → agent · resetsent
import { useSearchParams } from 'react-router-dom'
import { AuthBentoApp } from '@/components/auth-bento/AuthBentoApp'

export function AuthLoginPage() {
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
