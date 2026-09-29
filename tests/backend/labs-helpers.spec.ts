/**
 * Les helpers purs du studio Labs (`_shared/labs.ts`), éprouvés sans réseau.
 *
 * Ce qui compte ici : l'enveloppe WAV est lisible par ffmpeg (fal.ai la reçoit telle
 * quelle), une narration trop longue est refusée AVANT que la vidéo soit payée, et la
 * durée demandée à Seedance reste dans ses bornes quoi qu'on lui donne.
 */
import { describe, expect, it } from 'vitest'
import {
  LABS_COLONNES_SERVEUR, LABS_VIDEO_ABANDON_MS, LABS_VIDEO_DELAI_MS,
  LABS_VIDEO_MAX_S, LABS_VIDEO_MIN_S, LABS_VOICEOVER_MAX_CHARS, LABS_VOICE_LANGS,
  assetPourAgent, base64ToBytes, cleanPrompt, cleanVoice, cleanVoiceLang, cleanVoiceover, falCancelUrl, falRefusPassager,
  imageExtFor, labsImagePrompt, labsOuvertAuPlan, labsVideoCostUsd, labsVideoDuration, labsVideoPrompt, labsVideoSuite,
  labsVoiceoverPrompt, monthStartIso, pcmDurationSeconds, pcmToWav, sampleRateFromMime,
} from '../../supabase/functions/_shared/labs.ts'

describe('labs — voix off : enveloppe WAV', () => {
  it('écrit un en-tête RIFF de 44 octets cohérent avec la charge', () => {
    const pcm = new Uint8Array(48_000) // 1 s à 24 kHz / 16 bits / mono
    const wav = pcmToWav(pcm)
    const dv = new DataView(wav.buffer)
    const ascii = (o: number, n: number) => String.fromCharCode(...wav.slice(o, o + n))
    expect(wav.length).toBe(44 + pcm.length)
    expect(ascii(0, 4)).toBe('RIFF')
    expect(ascii(8, 4)).toBe('WAVE')
    expect(ascii(12, 4)).toBe('fmt ')
    expect(ascii(36, 4)).toBe('data')
    expect(dv.getUint32(4, true)).toBe(36 + pcm.length)
    expect(dv.getUint16(20, true)).toBe(1) // PCM
    expect(dv.getUint16(22, true)).toBe(1) // mono
    expect(dv.getUint32(24, true)).toBe(24_000)
    expect(dv.getUint32(28, true)).toBe(48_000) // byte rate
    expect(dv.getUint16(34, true)).toBe(16)
    expect(dv.getUint32(40, true)).toBe(pcm.length)
  })

  it('mesure la durée depuis la taille du flux, et lit le taux annoncé par Gemini', () => {
    expect(pcmDurationSeconds(48_000)).toBe(1)
    expect(pcmDurationSeconds(48_000 * 12.5)).toBe(12.5)
    expect(sampleRateFromMime('audio/L16;codec=pcm;rate=24000')).toBe(24_000)
    expect(sampleRateFromMime('audio/L16;rate=16000')).toBe(16_000)
    expect(sampleRateFromMime(null)).toBe(24_000)
  })

  it('décode le base64 octet par octet', () => {
    expect(Array.from(base64ToBytes('AAECAw=='))).toEqual([0, 1, 2, 3])
  })
})

describe('labs — durée demandée à Seedance', () => {
  it('suit la narration, plus une seconde, dans les bornes 4–30', () => {
    expect(labsVideoDuration(6.2, null)).toBe('8')
    expect(labsVideoDuration(1, null)).toBe(String(LABS_VIDEO_MIN_S))
    expect(labsVideoDuration(45, null)).toBe(String(LABS_VIDEO_MAX_S))
  })
  it('sans narration : la durée choisie bornée, sinon 8 s', () => {
    expect(labsVideoDuration(null, 12)).toBe('12')
    expect(labsVideoDuration(null, 2)).toBe('4')
    expect(labsVideoDuration(null, 99)).toBe('30')
    expect(labsVideoDuration(null, null)).toBe('8')
    expect(labsVideoDuration(0, null)).toBe('8')
  })
})

describe('labs — coût estimé', () => {
  it('720p ≈ 0,46 $/s et 1080p ≈ 1,04 $/s (barème au jeton de fal.ai)', () => {
    expect(labsVideoCostUsd('720p', 1)).toBeCloseTo(0.462, 2)
    expect(labsVideoCostUsd('1080p', 1)).toBeCloseTo(1.04, 2)
    expect(labsVideoCostUsd('720p', 10)).toBeCloseTo(4.62, 1)
  })
})

describe('labs — la porte du plan et le mois civil', () => {
  it('le studio s’ouvre à partir de Pro, et un plan inconnu reste dehors', () => {
    expect(labsOuvertAuPlan('starter')).toBe(false)
    expect(labsOuvertAuPlan('pro')).toBe(true)
    expect(labsOuvertAuPlan('Entreprise')).toBe(true)
    expect(labsOuvertAuPlan('agency')).toBe(true)
    expect(labsOuvertAuPlan(null)).toBe(false)
    expect(labsOuvertAuPlan('inconnu')).toBe(false)
  })
  it('le mois commence au 1er, en UTC', () => {
    expect(monthStartIso(new Date('2026-09-20T22:15:00Z'))).toBe('2026-09-01T00:00:00.000Z')
  })
})

describe('labs — entrées nettoyées', () => {
  it('refuse un prompt trop court ou trop long, aplatit les blancs', () => {
    expect(cleanPrompt('  ')).toBeNull()
    expect(cleanPrompt('ok')).toBeNull()
    expect(cleanPrompt('salon  scandinave\n lumineux')).toBe('salon scandinave lumineux')
    expect(cleanPrompt('x'.repeat(1001))).toBeNull()
  })
  it('refuse une narration au-delà du plafond, garde les retours à la ligne', () => {
    expect(cleanVoiceover('')).toBeNull()
    expect(cleanVoiceover('Bienvenue.\nUn bien rare.')).toBe('Bienvenue.\nUn bien rare.')
    expect(cleanVoiceover('a'.repeat(LABS_VOICEOVER_MAX_CHARS + 1))).toBeNull()
  })
  it('retombe sur la voix par défaut', () => {
    expect(cleanVoice('Charon')).toBe('Charon')
    expect(cleanVoice('Inconnue')).toBe('Kore')
  })
  it('déduit l’extension du MIME rendu par Gemini', () => {
    expect(imageExtFor('image/png')).toEqual({ ext: 'png', contentType: 'image/png' })
    expect(imageExtFor('image/jpeg')).toEqual({ ext: 'jpg', contentType: 'image/jpeg' })
    expect(imageExtFor(undefined).ext).toBe('jpg')
  })
})

describe('labs — la langue de la voix off', () => {
  it('la consigne précède le texte, et elle est ÉCRITE dans la langue cible', () => {
    // ⛔ Gemini TTS n'a AUCUN paramètre de langue : elle se déduit du texte. Doubler le
    // signal — consigne explicite + consigne écrite dans la langue — est le seul levier.
    const attendus: Record<string, RegExp> = {
      fr: /^Lis ce texte à voix haute en français/,
      de: /^Lies diesen Text auf Deutsch/,
      en: /^Read this text aloud in English/,
      it: /^Leggi questo testo ad alta voce in italiano/,
    }
    for (const lang of LABS_VOICE_LANGS) {
      const p = labsVoiceoverPrompt('Bienvenue.', lang)
      expect(p, lang).toMatch(attendus[lang])
      expect(p.endsWith('Bienvenue.'), `${lang} : le texte doit rester en FIN`).toBe(true)
    }
  })
  it('le texte n’est jamais réécrit — seulement précédé', () => {
    const texte = 'Trois pièces, 120 m², vue lac.'
    for (const lang of LABS_VOICE_LANGS) expect(labsVoiceoverPrompt(texte, lang)).toContain(texte)
  })
  it('une langue inconnue retombe sur le français', () => {
    expect(cleanVoiceLang('es')).toBe('fr')
    expect(cleanVoiceLang(undefined)).toBe('fr')
    expect(cleanVoiceLang('de')).toBe('de')
  })
})

describe('labs — prompts de garde', () => {
  it('avec une photo source, la retouche garde l’architecture et interdit les personnes', () => {
    const p = labsImagePrompt('un salon scandinave', true)
    expect(p).toContain('un salon scandinave')
    expect(p).toContain('Architecture inchangée')
    expect(p).toContain('Aucune personne')
  })
  it('sans source, le préambule est celui d’une image neuve', () => {
    expect(labsImagePrompt('villa au bord du Léman', false)).toMatch(/^Image photoréaliste/)
  })
  it('la vidéo dit si la piste sonore vient de la narration', () => {
    expect(labsVideoPrompt('travelling', true)).toContain('Aucune parole ni musique')
    expect(labsVideoPrompt('travelling', false)).toContain('Ambiance sonore discrète')
  })
})

// Revue post-fusion de #1338 (21.09.2026) : une vidéo que fal.ai a RENDUE se finalise,
// quel que soit le temps passé — l'âge ne tranche qu'après fal. Avant, le délai était
// testé d'abord : une vidéo finie pendant que l'agent travaillait sur un autre onglet
// était jetée et remboursée à son retour, alors que fal l'avait facturée.
describe('labs — le sondage d’une vidéo', () => {
  const vingtMinutes = 20 * 60 * 1000
  it('une vidéo que fal a terminée se finalise, même vieille de vingt minutes', () => {
    expect(labsVideoSuite({ ageMs: vingtMinutes, falStatus: 'COMPLETED', falErreur: false })).toEqual({ suite: 'finaliser' })
    expect(labsVideoSuite({ ageMs: 3 * 24 * 3600 * 1000, falStatus: 'COMPLETED', falErreur: false })).toEqual({ suite: 'finaliser' })
  })
  it('une vidéo terminée EN ERREUR chez fal échoue, et se rembourse', () => {
    expect(labsVideoSuite({ ageMs: 1000, falStatus: 'COMPLETED', falErreur: true })).toEqual({ suite: 'echouer', code: 'provider_failed' })
    expect(labsVideoSuite({ ageMs: 1000, falStatus: 'FAILED', falErreur: false })).toEqual({ suite: 'echouer', code: 'provider_failed' })
  })
  it('le délai ne jette que ce que fal dit encore en file ou en cours', () => {
    expect(labsVideoSuite({ ageMs: LABS_VIDEO_DELAI_MS - 1, falStatus: 'IN_PROGRESS', falErreur: false })).toEqual({ suite: 'attendre' })
    expect(labsVideoSuite({ ageMs: LABS_VIDEO_DELAI_MS + 1, falStatus: 'IN_QUEUE', falErreur: false })).toEqual({ suite: 'echouer', code: 'timeout' })
  })
  it('un fal injoignable ne fait rien jeter avant un jour', () => {
    expect(labsVideoSuite({ ageMs: vingtMinutes, falStatus: null, falErreur: false })).toEqual({ suite: 'attendre' })
    expect(labsVideoSuite({ ageMs: LABS_VIDEO_ABANDON_MS + 1, falStatus: null, falErreur: false })).toEqual({ suite: 'echouer', code: 'timeout' })
  })
  it('un refus passager de fal se retente ; un refus définitif, non', () => {
    for (const s of [408, 429, 500, 502, 503, 504]) expect(falRefusPassager(s), String(s)).toBe(true)
    for (const s of [400, 401, 404, 422]) expect(falRefusPassager(s), String(s)).toBe(false)
  })
  it('l’annulation se tire de l’URL d’état de la file', () => {
    expect(falCancelUrl('https://queue.fal.run/fal-ai/x/requests/abc/status')).toBe('https://queue.fal.run/fal-ai/x/requests/abc/cancel')
    expect(falCancelUrl('https://queue.fal.run/fal-ai/x/requests/abc')).toBeNull()
    expect(falCancelUrl(null)).toBeNull()
  })
})

// ⛔ Les edges lisent en `service_role`, que la RLS ne borne pas : toute production rendue
// à l'agent perd le coût fournisseur (la marge s'en déduirait) et le bail de finalisation.
describe('labs — ce qui ne sort pas vers l’agent', () => {
  it('assetPourAgent retire les colonnes serveur et garde le reste', () => {
    const ligne = { id: 'a', url: 'https://img/x.png', credits: 5, cost_chf: 0.5, finalizing_until: '2026-09-21T10:00:00Z' }
    const vue = assetPourAgent(ligne)
    for (const c of LABS_COLONNES_SERVEUR) expect(vue).not.toHaveProperty(c)
    expect(vue).toEqual({ id: 'a', url: 'https://img/x.png', credits: 5 })
    expect(ligne).toHaveProperty('cost_chf')
  })
  it('les colonnes serveur sont celles que la migration ferme', () => {
    expect([...LABS_COLONNES_SERVEUR]).toEqual(['cost_chf', 'finalizing_until'])
  })
})
