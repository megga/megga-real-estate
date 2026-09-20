/**
 * Les helpers purs du studio Labs (`_shared/labs.ts`), éprouvés sans réseau.
 *
 * Ce qui compte ici : l'enveloppe WAV est lisible par ffmpeg (fal.ai la reçoit telle
 * quelle), une narration trop longue est refusée AVANT que la vidéo soit payée, et la
 * durée demandée à Seedance reste dans ses bornes quoi qu'on lui donne.
 */
import { describe, expect, it } from 'vitest'
import {
  LABS_VIDEO_MAX_S, LABS_VIDEO_MIN_S, LABS_VOICEOVER_MAX_CHARS, LABS_VOICE_LANGS,
  base64ToBytes, cleanPrompt, cleanVoice, cleanVoiceLang, cleanVoiceover, imageExtFor, labsImagePrompt,
  labsQuotaFor, labsVideoCostUsd, labsVideoDuration, labsVideoPrompt, labsVoiceoverPrompt, monthStartIso,
  pcmDurationSeconds, pcmToWav, sampleRateFromMime,
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

describe('labs — quotas et mois civil', () => {
  it('images : le quota du staging ; vidéos : le nouveau poste', () => {
    expect(labsQuotaFor('starter', 'image')).toBe(0)
    expect(labsQuotaFor('pro', 'image')).toBe(50)
    expect(labsQuotaFor('entreprise', 'video')).toBe(40)
    expect(labsQuotaFor('agency', 'video')).toBe(40)
    expect(labsQuotaFor(null, 'video')).toBe(0)
    expect(labsQuotaFor('inconnu', 'image')).toBe(0)
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
