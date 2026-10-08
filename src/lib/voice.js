// Voice input & output.
//  • Input: the browser's built-in speech recognition (Chrome / Edge / Android / Safari).
//    Where that is unavailable (e.g. Firefox), audio is recorded and transcribed with
//    OpenAI (Whisper) or Gemini using the API key from Settings.
//  • Output: the browser's speech synthesis reads replies aloud.
import { getState } from './store'

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

export function nativeRecognitionSupported() {
  return !!SR
}

export function recorderSupported() {
  return typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder !== 'undefined'
}

export function voiceInputAvailable() {
  const { keys } = getState().settings.ai
  return nativeRecognitionSupported() || (recorderSupported() && !!(keys.openai || keys.gemini))
}

/**
 * Start listening. Returns a controller { stop(), abort(), mode }.
 * callbacks: onInterim(text), onFinal(text), onError(message), onEnd()
 */
export function startListening({ onInterim, onFinal, onError, onEnd, lang }) {
  const language = lang || getState().settings.voice.lang || 'en-IN'
  if (SR) return startNative({ onInterim, onFinal, onError, onEnd, lang: language })
  if (recorderSupported()) return startRecorder({ onInterim, onFinal, onError, onEnd, lang: language })
  onError?.('Voice input is not supported in this browser. Please use Google Chrome.')
  onEnd?.()
  return { stop() {}, abort() {}, mode: 'none' }
}

function startNative({ onInterim, onFinal, onError, onEnd, lang }) {
  const rec = new SR()
  rec.lang = lang
  rec.interimResults = true
  rec.continuous = false
  rec.maxAlternatives = 1
  let finalText = ''
  let ended = false
  rec.onresult = (e) => {
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript
      if (e.results[i].isFinal) finalText += t
      else interim += t
    }
    onInterim?.((finalText + ' ' + interim).trim())
  }
  rec.onerror = (e) => {
    const map = {
      'not-allowed': 'Microphone permission was denied. Allow microphone access in your browser settings.',
      'service-not-allowed': 'Microphone permission was denied. Allow microphone access in your browser settings.',
      'no-speech': 'No speech was detected. Please try again.',
      'audio-capture': 'No microphone was found on this device.',
      network: 'Voice recognition needs an internet connection.',
      aborted: '',
    }
    const msg = map[e.error] ?? 'Voice recognition error: ' + e.error
    if (msg) onError?.(msg)
  }
  rec.onend = () => {
    if (ended) return
    ended = true
    if (finalText.trim()) onFinal?.(finalText.trim())
    onEnd?.()
  }
  try {
    rec.start()
  } catch (e) {
    onError?.('Could not start the microphone: ' + e.message)
    onEnd?.()
  }
  return { stop: () => rec.stop(), abort: () => { ended = true; rec.abort(); onEnd?.() }, mode: 'native' }
}

function startRecorder({ onInterim, onFinal, onError, onEnd, lang }) {
  let mediaRecorder
  let stream
  let aborted = false
  const chunks = []
  let autoStop
  const ctl = {
    mode: 'recorder',
    stop: () => mediaRecorder?.state === 'recording' && mediaRecorder.stop(),
    abort: () => {
      aborted = true
      if (mediaRecorder?.state === 'recording') mediaRecorder.stop()
      else onEnd?.()
    },
  }
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((s) => {
      stream = s
      mediaRecorder = new MediaRecorder(stream)
      mediaRecorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      mediaRecorder.onstop = async () => {
        clearTimeout(autoStop)
        stream.getTracks().forEach((t) => t.stop())
        if (aborted) return onEnd?.()
        onInterim?.('Transcribing…')
        try {
          const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' })
          const text = await transcribe(blob, lang)
          if (text) onFinal?.(text)
          else onError?.('No speech was detected. Please try again.')
        } catch (e) {
          onError?.(e.message)
        }
        onEnd?.()
      }
      mediaRecorder.start()
      onInterim?.('Listening… tap the microphone again to finish.')
      autoStop = setTimeout(() => ctl.stop(), 60000)
    })
    .catch(() => {
      onError?.('Microphone permission was denied. Allow microphone access in your browser settings.')
      onEnd?.()
    })
  return ctl
}

async function blobToBase64(blob) {
  const buf = await blob.arrayBuffer()
  let bin = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export async function transcribe(blob, lang) {
  const { keys } = getState().settings.ai
  const model = getState().settings.voice.transcribeModel || 'gpt-4o-mini-transcribe'
  if (keys.openai) {
    const ext = (blob.type.split('/')[1] || 'webm').split(';')[0]
    const tryModel = async (m) => {
      const fd = new FormData()
      fd.append('file', blob, 'speech.' + ext)
      fd.append('model', m)
      if (lang) fd.append('language', lang.slice(0, 2))
      const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + keys.openai },
        body: fd,
      })
      if (!r.ok) throw new Error('Transcription failed (' + r.status + ')')
      return (await r.json()).text || ''
    }
    try {
      return await tryModel(model)
    } catch {
      return await tryModel('whisper-1')
    }
  }
  if (keys.gemini) {
    const b64 = await blobToBase64(blob)
    const gm = getState().settings.ai.models.gemini || 'gemini-3.5-flash'
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${gm}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': keys.gemini },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ inline_data: { mime_type: blob.type.split(';')[0] || 'audio/webm', data: b64 } }, { text: 'Transcribe this audio exactly. Return only the transcript text.' }] }],
      }),
    })
    if (!r.ok) throw new Error('Transcription failed (' + r.status + ')')
    const j = await r.json()
    return (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim()
  }
  throw new Error('Voice input in this browser needs an OpenAI or Gemini API key (Settings → AI). Or use Google Chrome.')
}

// ---------------- speech output ----------------
export function ttsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function listVoices() {
  if (!ttsSupported()) return []
  return window.speechSynthesis.getVoices()
}

function plainForSpeech(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\|/g, ' ')
    .replace(/[#*_`>-]{1,3}/g, ' ')
    .replace(/₹\s?/g, 'rupees ')
    .replace(/\bRs\.?\s?/g, 'rupees ')
    .replace(/https?:\/\/\S+/g, 'link')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200)
}

export function speak(text, { onEnd } = {}) {
  if (!ttsSupported()) return onEnd?.()
  const v = getState().settings.voice
  const synth = window.speechSynthesis
  synth.cancel()
  const u = new SpeechSynthesisUtterance(plainForSpeech(text))
  u.lang = v.lang || 'en-IN'
  u.rate = Number(v.rate) || 1
  const voices = synth.getVoices()
  const chosen = voices.find((x) => x.name === v.voiceName) || voices.find((x) => x.lang === u.lang) || voices.find((x) => x.lang?.startsWith(u.lang.slice(0, 2)))
  if (chosen) u.voice = chosen
  u.onend = () => onEnd?.()
  u.onerror = () => onEnd?.()
  synth.speak(u)
}

export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel()
}
