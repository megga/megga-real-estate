import { useMutation } from '@tanstack/react-query'

interface PropertyEmailPayload {
  title: string
  price: number
  address: string
  city: string
  rooms: number | null
  surface_m2: number | null
  type: string
  photo_url: string | null
  source_url: string
  source_agency: string | null
  source_portal: string
}

export interface SendPropertyEmailParams {
  to: string
  contactFirstName: string
  agentName?: string
  agentPhone?: string
  property: PropertyEmailPayload
  message?: string
}

interface SendEmailResult {
  success: boolean
  emailId?: string
  to: string
  error?: string
}

async function sendPropertyEmail(params: SendPropertyEmailParams): Promise<SendEmailResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  const response = await fetch(`${supabaseUrl}/functions/v1/send-property-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      ...params,
      agentName: params.agentName || 'Gregory Lyonnet',
      agentPhone: params.agentPhone || '+41 22 000 00 00',
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || `Email sending failed (${response.status})`)
  }

  return data
}

export function useSendPropertyEmail() {
  return useMutation({
    mutationFn: sendPropertyEmail,
  })
}
