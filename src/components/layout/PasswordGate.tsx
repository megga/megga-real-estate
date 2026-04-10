import { useState, useCallback } from 'react'

const SITE_PASSWORD = 'gg'
const STORAGE_KEY = 'megga-site-access'

interface PasswordGateProps {
  children: React.ReactNode
}

export default function PasswordGate({ children }: PasswordGateProps) {
  const [authorized, setAuthorized] = useState(() =>
    sessionStorage.getItem(STORAGE_KEY) === 'true'
  )
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (password === SITE_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, 'true')
      setAuthorized(true)
      setError(false)
    } else {
      setError(true)
    }
  }, [password])

  if (authorized) return <>{children}</>

  return (
    <div className="min-h-screen flex items-center justify-center bg-theme-page" data-theme="light">
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-theme-primary">MEGGA</h1>
          <p className="text-sm text-theme-tertiary mt-2">
            Site en cours de développement
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false) }}
              placeholder="Mot de passe"
              autoFocus
              className="w-full h-11 px-4 text-sm bg-transparent border border-theme-border rounded-lg text-theme-primary placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center"
            />
            {error && (
              <p className="text-xs text-red-500 mt-2 text-center">
                Mot de passe incorrect
              </p>
            )}
          </div>
          <button
            type="submit"
            className="w-full h-11 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors"
          >
            Accéder au site
          </button>
        </form>
      </div>
    </div>
  )
}
