/**
 * Écouter une voix off — l'aperçu AVANT de payer une vidéo, et la piste d'une
 * production déjà générée.
 *
 * Julien, 20.09.2026 : « il faudrait qu'on puisse les entendre, un petit bouton play ».
 *
 * ⛔ UN SEUL SON À LA FOIS, et c'est la raison d'être du hook : deux `<audio>` posés
 * dans deux composants joueraient ensemble, et rien ne les arrêterait l'un l'autre.
 * L'élément est unique, gardé dans une ref, et toute nouvelle lecture coupe la
 * précédente.
 *
 * ⚠ L'aperçu revient en base64 dans le corps de la réponse (`labs-voice-preview` ne
 * dépose RIEN) : on en fait un blob, dont l'URL est révoquée dès que la lecture
 * s'arrête ou que le composant part. Sans ça, chaque écoute fuirait un objet.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { invokeLabs } from '@/lib/labs'
import { fxApercuVoix, useLabsFixtures } from '@/components/crm/labs/fixtures'

export type LabsVoiceState =
  | { statut: 'repos' }
  | { statut: 'chargement'; cle: string }
  | { statut: 'lecture'; cle: string }
  | { statut: 'erreur'; cle: string; code: string }

interface PreviewOk { audio: string; mime: string; durationS: number; truncated?: boolean }

export function useLabsVoice() {
  // ⚠ Sous le banc, l'aperçu ne part PAS au réseau : il rend le bip des fixtures.
  // Sans ça, `/dev/labs` montrerait un bouton qui échoue en 401.
  const fx = useLabsFixtures()
  const [etat, setEtat] = useState<LabsVoiceState>({ statut: 'repos' })
  const audio = useRef<HTMLAudioElement | null>(null)
  const objet = useRef<string | null>(null)
  // ⚠ Une écoute lancée pendant qu'une autre charge doit annuler la première : sans
  // ce jeton, la réponse tardive de l'ancienne se mettrait à jouer par-dessus.
  const jeton = useRef(0)

  const liberer = useCallback(() => {
    if (objet.current) { URL.revokeObjectURL(objet.current); objet.current = null }
  }, [])

  const arreter = useCallback(() => {
    jeton.current += 1
    if (audio.current) { audio.current.pause(); audio.current.src = '' }
    liberer()
    setEtat({ statut: 'repos' })
  }, [liberer])

  // ⚠ L'élément naît au MONTAGE et pas à la première lecture : la forme paresseuse
  // `audio.current ?? (audio.current = new Audio())` est une affectation IMBRIQUÉE
  // dans une expression, que la règle `react-hooks/immutability` du dépôt refuse.
  useEffect(() => {
    audio.current = new Audio()
    return () => {
      jeton.current += 1
      const el = audio.current
      if (el) { el.pause(); el.src = '' }
      audio.current = null
      if (objet.current) URL.revokeObjectURL(objet.current)
    }
  }, [])

  /** Joue une source déjà déposée (la piste d'une production). */
  const jouerUrl = useCallback((cle: string, url: string) => {
    const mien = ++jeton.current
    liberer()
    const el = audio.current
    if (!el) return
    el.onended = () => { if (jeton.current === mien) setEtat({ statut: 'repos' }) }
    el.onerror = () => { if (jeton.current === mien) setEtat({ statut: 'erreur', cle, code: 'playback' }) }
    el.src = url
    setEtat({ statut: 'lecture', cle })
    void el.play().catch(() => { if (jeton.current === mien) setEtat({ statut: 'erreur', cle, code: 'playback' }) })
  }, [liberer])

  /** Synthétise puis joue — l'aperçu d'un texte qui n'a pas encore de piste. */
  const jouerApercu = useCallback(async (cle: string, texte: string, voiceName: string, voiceLang: string) => {
    const mien = ++jeton.current
    audio.current?.pause()
    liberer()
    const el = audio.current
    if (!el) return
    setEtat({ statut: 'chargement', cle })
    const r = fx
      ? await fxApercuVoix()
      : await invokeLabs<PreviewOk>('labs-voice-preview', { text: texte, voiceName, voiceLang })
    if (jeton.current !== mien) return
    if (r.error || !r.data?.audio) {
      setEtat({ statut: 'erreur', cle, code: r.error ?? 'unknown' })
      return
    }
    const octets = Uint8Array.from(atob(r.data.audio), (c) => c.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([octets], { type: r.data.mime || 'audio/wav' }))
    objet.current = url
    el.onended = () => { if (jeton.current === mien) { liberer(); setEtat({ statut: 'repos' }) } }
    el.onerror = () => { if (jeton.current === mien) setEtat({ statut: 'erreur', cle, code: 'playback' }) }
    el.src = url
    setEtat({ statut: 'lecture', cle })
    void el.play().catch(() => { if (jeton.current === mien) setEtat({ statut: 'erreur', cle, code: 'playback' }) })
  }, [fx, liberer])

  return { etat, jouerUrl, jouerApercu, arreter }
}
