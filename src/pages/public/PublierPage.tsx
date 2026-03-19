import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function PublierPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      navigate('/dashboard/listings/new', { replace: true })
    } else {
      navigate('/login', { replace: true, state: { redirectTo: '/dashboard/listings/new' } })
    }
  }, [user, navigate])

  return null
}
