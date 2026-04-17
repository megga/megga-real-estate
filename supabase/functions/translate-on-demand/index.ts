// supabase/functions/translate-on-demand/index.ts
// Lazy translation of listing descriptions with sha256 content-hash cache.
//
// Flow:
//   1. sha256(content) → content_hash
//   2. SELECT translation_cache — if hit, return immediately (cached:true)
//   3. Otherwise call DeepSeek, INSERT into cache (ON CONFLICT DO NOTHING),
//      return (cached:false)
//
// Called by the marketplace detail page when i18n.language ≠ 'fr'.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callDeepSeek } from '../_shared/ai-provider.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TranslateRequest {
  content: string
  target_lang: 'de' | 'en' | 'it'
}

const LANG_NAMES = {
  de: 'German',
  en: 'English',
  it: 'Italian',
}

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body: TranslateRequest = await req.json()
    const content = (body.content || '').trim()
    const targetLang = body.target_lang

    if (!content) {
      return new Response(JSON.stringify({ error: 'Missing content' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!targetLang || !(targetLang in LANG_NAMES)) {
      return new Response(JSON.stringify({ error: 'Invalid target_lang (de|en|it)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    const contentHash = await sha256(content)

    // 1. Cache lookup
    const { data: cached } = await supabase
      .from('translation_cache')
      .select('translated_text')
      .eq('content_hash', contentHash)
      .eq('lang', targetLang)
      .maybeSingle()

    if (cached?.translated_text) {
      return new Response(
        JSON.stringify({ translated: cached.translated_text, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 2. Cache miss → DeepSeek
    const systemPrompt =
      `You are a professional translator specialised in Swiss real estate listings. ` +
      `Translate the user's Swiss French listing description to ${LANG_NAMES[targetLang]}. ` +
      `Keep technical terms intact: m², CHF, canton names (Genève, Vaud, ...), ` +
      `neighbourhood names, addresses. Preserve line breaks. ` +
      `Return ONLY the translated text — no preamble, no quotes, no commentary.`

    const result = await callDeepSeek(
      [{ role: 'user', content }],
      systemPrompt,
      { maxTokens: 1500, temperature: 0.2 },
    )

    const translated = result.text.trim()
    if (!translated) {
      return new Response(JSON.stringify({ error: 'Empty translation' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Cache insert (ignore conflict from concurrent requests)
    const { error: insertErr } = await supabase
      .from('translation_cache')
      .insert({ content_hash: contentHash, lang: targetLang, translated_text: translated })

    if (insertErr && !insertErr.message.includes('duplicate')) {
      console.error('[translate-on-demand] cache insert failed:', insertErr.message)
    }

    return new Response(
      JSON.stringify({ translated, cached: false, provider: result.provider }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[translate-on-demand]', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
