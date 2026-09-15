/**
 * Les logos des expéditeurs d'une boîte (14.09.2026, « comme Spark »).
 *
 * Deux temps : on LIT d'abord le cache `mail_sender_logos` (en direct, sous la RLS des
 * courriers — une boîte personnelle ne prête pas ses logos au bureau) ; seuls les domaines
 * absents ou périmés partent ensuite à l'edge `mail-logos`, qui les résout chez nous et
 * les range. La pastille montre les initiales en attendant, puis le logo arrive.
 *
 * ⚠ Un échec ne se montre PAS : un logo est un confort, et l'initiale est déjà la
 * réponse juste quand il manque. Mais il n'est pas non plus réessayé en boucle — la
 * requête de résolution ne rejoue pas (`retry: false`) et reste en cache le temps de la
 * page.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { domaineDe } from '@/lib/mail/format'
import { fxSenderLogos, useMailFixtures } from '@/components/crm/messagerie/fixtures'

/** Un logo prêt pour un `<img>` : son URL de données et la façon de le poser. */
export interface MailSenderLogo {
  src: string
  /**
   * Une icône d'application (`apple-touch-icon`) est un carré plein, fond compris : elle
   * REMPLIT la pastille. Un logo détouré (SVG, favicon) y respire sur un fond clair.
   */
  plein: boolean
}

interface Ligne { domain: string; status: string; source: string | null; mime: string | null; data: string | null; checked_at: string }
/** Une ligne du cache, et si elle couvre encore son domaine — jugé à la LECTURE, jamais au rendu. */
type LigneLue = Ligne & { frais: boolean }
type Resolu = { mime: string; data: string; source: string } | null

const JOUR = 86_400_000
/** Mêmes durées que l'edge : un logo se revérifie au bout d'un mois, un « rien » d'une semaine. */
const FRAICHEUR: Record<string, number> = { found: 30 * JOUR, none: 7 * JOUR }

const versLogo = (mime: string, data: string, source: string | null): MailSenderLogo =>
  ({ src: `data:${mime};base64,${data}`, plein: source === 'apple-touch-icon' })

/** Domaine → logo, pour les adresses données ; un domaine sans logo est simplement absent. */
export function useMailSenderLogos(accountId: string | null, adresses: (string | null | undefined)[]): Record<string, MailSenderLogo> {
  const fx = useMailFixtures()
  const cle = [...new Set(adresses.map(domaineDe).filter((d): d is string => !!d))].sort().join(',')
  const domaines = useMemo(() => (cle ? cle.split(',') : []), [cle])

  const cache = useQuery({
    queryKey: ['mail', 'sender-logos', accountId, cle, fx],
    enabled: !!accountId && domaines.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<LigneLue[]> => {
      if (fx) {
        return Object.entries(fxSenderLogos(fx, domaines)).map(([domain, l]) => ({
          domain, status: 'found', source: l.source, mime: l.mime, data: l.data, checked_at: new Date().toISOString(), frais: true,
        }))
      }
      const { data, error } = await supabase.from('mail_sender_logos')
        .select('domain, status, source, mime, data, checked_at')
        .eq('account_id', accountId ?? '').in('domain', domaines)
      if (error) throw error
      const maintenant = Date.now()
      return (data ?? []).map((l) => ({ ...l, frais: maintenant - Date.parse(l.checked_at) < (FRAICHEUR[l.status] ?? 0) }))
    },
  })

  // Les domaines que le cache ne couvre pas, ou plus. Au banc, jamais : ses logos sont écrits.
  const manquants = useMemo(() => {
    if (fx || !cache.data) return []
    const couverts = new Set(cache.data.filter((l) => l.frais).map((l) => l.domain))
    return domaines.filter((d) => !couverts.has(d))
  }, [fx, cache.data, domaines])

  const resolution = useQuery({
    queryKey: ['mail', 'sender-logos-resolve', accountId, manquants.join(',')],
    enabled: !!accountId && manquants.length > 0,
    staleTime: Infinity,
    retry: false,
    queryFn: async (): Promise<Record<string, Resolu>> => {
      const { data, error } = await supabase.functions.invoke('mail-logos', { body: { account_id: accountId, domains: manquants } })
      if (error) throw error
      return (data as { logos?: Record<string, Resolu> } | null)?.logos ?? {}
    },
  })

  return useMemo(() => {
    const out: Record<string, MailSenderLogo> = {}
    for (const l of cache.data ?? []) {
      if (l.status === 'found' && l.mime && l.data) out[l.domain] = versLogo(l.mime, l.data, l.source)
    }
    for (const [d, r] of Object.entries(resolution.data ?? {})) {
      if (r) out[d] = versLogo(r.mime, r.data, r.source)
    }
    return out
  }, [cache.data, resolution.data])
}
