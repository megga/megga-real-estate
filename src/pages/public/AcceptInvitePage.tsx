/**
 * Page publique d'acceptation d'invitation d'équipe — route `/accept-invite/:token`.
 * Aperçu puis réclamation via l'edge function `accept-team-invite` (actions preview / claim).
 * L'UI s'adapte à l'état de session : connecté + email concordant → bouton accepter,
 * mauvais compte → avertissement, non connecté → login/register avec redirect vers cette page.
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

interface InvitationDetails {
  email: string
  role: string
  agencyName: string
  inviterName: string
  expiresAt: string
}

/** Charge l'aperçu de l'invitation puis gère sa réclamation (claim) après contrôle d'email. */
export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation('settings')
  const { user } = useAuth()

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)

  useEffect(() => {
    if (!token) return
    const load = async () => {
      setLoading(true)
      const { data, error: err } = await supabase.functions.invoke('accept-team-invite', {
        body: { token, action: 'preview' },
      })

      if (err || data?.error) {
        const errCode = data?.error || 'unknown'
        if (errCode === 'invitation_not_found') setError(t('team.acceptInvite.notFound'))
        else if (errCode === 'invitation_expired') setError(t('team.acceptInvite.expired'))
        else if (errCode === 'invitation_accepted') setError(t('team.acceptInvite.alreadyAccepted'))
        else if (errCode === 'invitation_cancelled') setError(t('team.acceptInvite.cancelled'))
        else setError(t('team.acceptInvite.error'))
      } else {
        setInvitation(data)
      }
      setLoading(false)
    }
    load()
  }, [token, t])

  const handleClaim = async () => {
    if (!token) return
    setClaiming(true)

    const { data, error: err } = await supabase.functions.invoke('accept-team-invite', {
      body: { token, action: 'claim' },
    })

    if (err || data?.error) {
      if (data?.error === 'email_mismatch') {
        setError(t('team.acceptInvite.emailMismatch', { email: invitation?.email }))
      } else {
        setError(t('team.acceptInvite.error'))
      }
      setClaiming(false)
    } else {
      navigate('/dashboard')
    }
  }

  const emailMatch = user?.email?.toLowerCase() === invitation?.email?.toLowerCase()
  const redirectUrl = `/accept-invite/${token}`

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-gray-900 tracking-tight">MEGGA</span>
          <p className="text-xs text-gray-500 mt-1">Immobilier Suisse</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-8">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
              <p className="text-sm text-gray-500 mt-3">{t('team.acceptInvite.loading')}</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="text-center py-4">
              <p className="text-sm text-red-500 mb-4">{error}</p>
              <Link to="/" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                {t('team.acceptInvite.backHome')}
              </Link>
            </div>
          )}

          {/* Invitation details */}
          {!loading && !error && invitation && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-gray-900">{t('team.acceptInvite.title')}</h2>
                <p className="text-sm text-gray-500 mt-2">
                  <span className="font-semibold text-gray-700">{invitation.inviterName}</span>
                  {' '}{t('team.acceptInvite.invitesYou')}{' '}
                  <span className="font-semibold text-gray-700">{invitation.agencyName}</span>
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">{t('team.acceptInvite.yourRole')}</p>
                <p className="text-base font-semibold text-gray-900">{t(`team.roles.${invitation.role}`)}</p>
              </div>

              {/* Authenticated + email match */}
              {user && emailMatch && (
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  className="w-full h-11 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:text-gray-900 hover:border-gray-400 transition-colors disabled:opacity-50"
                >
                  {claiming ? t('team.acceptInvite.accepting') : t('team.acceptInvite.accept')}
                </button>
              )}

              {/* Authenticated but wrong email */}
              {user && !emailMatch && (
                <div className="text-center space-y-3">
                  <p className="text-xs text-amber-600">
                    {t('team.acceptInvite.wrongAccount', { email: invitation.email })}
                  </p>
                </div>
              )}

              {/* Not authenticated */}
              {!user && (
                <div className="space-y-3">
                  <Link
                    to={`/login?redirect=${encodeURIComponent(redirectUrl)}&email=${encodeURIComponent(invitation.email)}`}
                    className="block w-full h-11 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:text-gray-900 hover:border-gray-400 transition-colors text-center leading-[44px]"
                  >
                    {t('team.acceptInvite.login')}
                  </Link>
                  <Link
                    to={`/register?redirect=${encodeURIComponent(redirectUrl)}&email=${encodeURIComponent(invitation.email)}`}
                    className="block text-center text-sm text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    {t('team.acceptInvite.register')}
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
