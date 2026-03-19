import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Check, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess(true)
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="h-12 w-12 bg-accent/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Lock className="h-6 w-6 text-accent" />
          </div>
          <h1 className="text-2xl font-semibold text-primary-900">Nouveau mot de passe</h1>
          <p className="text-sm text-muted-foreground mt-1">Choisissez un nouveau mot de passe pour votre compte</p>
        </div>

        {success ? (
          <div className="text-center p-6 bg-success/5 border border-success/20 rounded-card">
            <Check className="h-8 w-8 text-success mx-auto mb-2" />
            <p className="text-sm font-medium text-success">Mot de passe mis à jour avec succès</p>
            <p className="text-xs text-muted-foreground mt-1">Redirection vers la connexion...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1.5">Nouveau mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6 caractères minimum"
                required
                className="w-full h-11 px-3 text-sm bg-white border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1.5">Confirmer le mot de passe</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Retapez le mot de passe"
                required
                className="w-full h-11 px-3 text-sm bg-white border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
              />
            </div>

            {error && (
              <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-accent hover:bg-accent/90 text-white text-sm font-medium rounded-button transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Mettre à jour le mot de passe
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
