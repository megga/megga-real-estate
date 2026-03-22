import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Plan = 'starter' | 'pro' | 'agency'

interface UseStripeReturn {
  checkout: (plan: Plan) => Promise<void>
  manageSubscription: () => Promise<void>
  isLoading: boolean
  error: string | null
}

export function useStripe(): UseStripeReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkout = async (plan: Plan) => {
    setIsLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Not authenticated')
        return
      }

      const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          plan,
          returnUrl: window.location.origin,
        },
      })

      if (fnError) {
        setError(fnError.message)
        return
      }

      if (data?.url) {
        window.location.href = data.url
      } else {
        setError('No checkout URL returned')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
    } finally {
      setIsLoading(false)
    }
  }

  const manageSubscription = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          plan: 'pro', // plan is ignored for portal sessions
          returnUrl: window.location.origin,
        },
      })

      if (fnError) {
        setError(fnError.message)
        return
      }

      if (data?.url) {
        window.location.href = data.url
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal')
    } finally {
      setIsLoading(false)
    }
  }

  return { checkout, manageSubscription, isLoading, error }
}
