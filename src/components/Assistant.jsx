import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Send, Square, Trash2, Volume2, VolumeX, Bot, User, CheckCircle2, XCircle, ExternalLink, Settings, Loader2, Headphones } from 'lucide-react'
import { useStore, actions, AI_PROVIDERS, aiModel } from '../lib/store'
import { useChat, sendMessage, clearChat } from '../lib/ai/agent'
import { startListening, speak, stopSpeaking, voiceInputAvailable, nativeRecognitionSupported, ttsSupported } from '../lib/voice'
import Markdown from './Markdown'
import { confirmDialog } from './ui'

const SUGGESTIONS = [
  'Show the final cost and margin of all moulding products',
  'Add a moulding product "63 mm Body", 42 g, rate ₹118/kg, 2400 per day, selling price ₹12',
  'What happens to all moulding costs if raw material rate goes up by ₹5 per kg? Make a PDF.',
  'Create the welding costing PDF report',
  'Show reports saved this week',
  'How do I add a new user?',
]

// Shared voice controller so the floating mic button and this screen use the same session
let voiceCtl = null

export default function Assistant() {
  const chat = useChat()
  const settings = useStore((s) => s.settings)
  const [text, setText] = useState('')
  const [mode, setMode] = useState('idle') // idle | listening | speaking
  const [interim, setInterim] = useState('')
  const [voiceErr, setVoiceErr] = useState('')
  const endRef = useRef(null)
  const inputRef = useRef(null)
  const handsFreeRef = useRef(settings.voice.handsFree)
  handsFreeRef.current = settings.voice.handsFree
  const provider = settings.ai.provider
  const configured = !!settings.ai.keys[provider]

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chat.items.length, chat.busy, interim])

  useEffect(() => () => {
    voiceCtl?.abort?.()
    stopSpeaking()
  }, [])

  // Auto-start listening when opened from the floating mic button
  useEffect(() => {
    if (sessionStorage.getItem('agnipeak_autolisten') === '1') {
      sessionStorage.removeItem('agnipeak_autolisten')
      setTimeout(listen, 250)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (value, { voice = false } = {}) => {
    const t = String(value ?? text).trim()
    if (!t || chat.busy) return
    setText('')
    setInterim('')
    setVoiceErr('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    stopSpeaking()
    const reply = await sendMessage(t, { voice })
    if (reply && voice && settings.voice.speakReplies && ttsSupported()) {
      setMode('speaking')
      speak(reply.text, {
        onEnd: () => {
          setMode('idle')
          if (handsFreeRef.current && !reply.error) setTimeout(listen, 300)
        },
      })
    } else if (reply && voice && handsFreeRef.current && !reply.error) {
      setTimeout(listen, 300)
    }
  }

  function listen() {
    setVoiceErr('')
    if (!voiceInputAvailable()) {
      setVoiceErr('Voice input needs Google Chrome / Edge / Safari, or an OpenAI or Gemini key in Settings for other browsers.')
      return
    }
    stopSpeaking()
    setMode('listening')
    setInterim('')
    voiceCtl = startListening({
      onInterim: (t) => setInterim(t),
      onFinal: (t) => {
        setInterim('')
        submit(t, { voice: true })
      },
      onError: (m) => setVoiceErr(m),
      onEnd: () => setMode((m) => (m === 'listening' ? 'idle' : m)),
    })
  }

  const micClick = () => {
    if (mode === 'listening') {
      voiceCtl?.stop()
      return
    }
    if (mode === 'speaking') {
      stopSpeaking()
      setMode('idle')
      return
    }
    listen()
  }

  const clear = async () => {
    if (await confirmDialog({ title: 'Clear conversation', message: 'Clear the assistant conversation on this device?', confirmText: 'Clear' })) clearChat()
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-var(--chrome-h))]">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h1 className="text-slate-100 font-bold text-lg sm:text-xl flex items-center gap-2">
            <Bot className="w-5 h-5 text-gold-400" /> AI Assistant
          </h1>
          <p className="text-slate-500 text-xs truncate">
            {configured ? `${AI_PROVIDERS[provider].label} · ${aiModel(provider)}` : 'Not set up — add an API key in Settings'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => actions.setSettings({ voice: { handsFree: !settings.voice.handsFree } })}
            title="Hands-free voice conversation"
            className={`p-2 rounded-lg ${settings.voice.handsFree ? 'text-gold-400 bg-gold-500/10' : 'text-slate-500 hover:text-slate-200'}`}
          >
            <Headphones className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              if (settings.voice.speakReplies) stopSpeaking()
              actions.setSettings({ voice: { speakReplies: !settings.voice.speakReplies } })
            }}
            title={settings.voice.speakReplies ? 'Voice replies on' : 'Voice replies off'}
            className={`p-2 rounded-lg ${settings.voice.speakReplies ? 'text-gold-400' : 'text-slate-500'} hover:bg-white/5`}
          >
            {settings.voice.speakReplies ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          {chat.items.length > 0 && (
            <button onClick={clear} title="Clear conversation" className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-white/5">
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-3 pb-4">
        {!chat.items.length && (
          <div className="text-center pt-6 pb-2">
            <div className="w-14 h-14 rounded-2xl bg-gold-500/15 border border-gold-500/30 flex items-center justify-center mx-auto">
              <Bot className="w-7 h-7 text-gold-400" />
            </div>
            <h2 className="text-slate-100 font-semibold mt-3">How can I help with costing today?</h2>
            <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">Type or tap the microphone and speak in English or Hindi. I can calculate, update products, create PDFs and search history.</p>
            {!configured && (
              <button onClick={() => actions.setTab('settings')} className="mt-4 inline-flex items-center gap-2 text-sm text-gold-400 border border-gold-500/40 rounded-lg px-3 py-2">
                <Settings className="w-4 h-4" /> Set up AI in Settings
              </button>
            )}
            <div className="grid sm:grid-cols-2 gap-2 mt-5 text-left">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => submit(s)} className="text-xs text-slate-300 bg-navy-800/60 hover:bg-navy-800 border border-slate-800 rounded-xl px-3 py-2.5 text-left">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {chat.items.map((m) =>
          m.kind === 'user' ? (
            <div key={m.id} className="flex justify-end gap-2">
              <div className="max-w-[85%] bg-gold-500 text-white rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words">
                {m.voice && <Mic className="w-3 h-3 inline mr-1 opacity-70" />}
                {m.text}
              </div>
              <div className="hidden sm:flex w-7 h-7 rounded-full bg-navy-800 items-center justify-center shrink-0">
                <User className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex gap-2">
              <div className="hidden sm:flex w-7 h-7 rounded-full bg-gold-500/15 items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-gold-400" />
              </div>
              <div className={`max-w-[92%] sm:max-w-[85%] min-w-0 rounded-2xl rounded-bl-md px-3.5 py-2.5 border ${m.error ? 'bg-red-500/5 border-red-500/30 text-red-200' : 'bg-navy-800/70 border-slate-800 text-slate-200'}`}>
                {m.actions?.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {m.actions.map((a, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                        {a.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-px" /> : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-px" />}
                        <span className="min-w-0">
                          {a.label}
                          {a.summary ? ` — ${a.summary}` : ''}
                          {a.link && (
                            <a href={a.link} target="_blank" rel="noreferrer" className="ml-1 text-gold-400 inline-flex items-center gap-0.5">
                              Drive <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <Markdown text={m.text} />
                {!m.error && ttsSupported() && (
                  <button
                    onClick={() => {
                      setMode('speaking')
                      speak(m.text, { onEnd: () => setMode('idle') })
                    }}
                    className="mt-1.5 text-[11px] text-slate-500 hover:text-gold-400 inline-flex items-center gap-1"
                  >
                    <Volume2 className="w-3 h-3" /> Read aloud
                  </button>
                )}
              </div>
            </div>
          )
        )}

        {chat.busy && (
          <div className="flex gap-2 items-center text-xs text-slate-400 pl-1 sm:pl-9">
            <Loader2 className="w-4 h-4 animate-spin text-gold-400" /> {chat.status || 'Thinking…'}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="sticky bottom-[var(--bottom-nav-h)] md:bottom-0 -mx-4 px-4 pt-2 pb-3 bg-gradient-to-t from-navy-950 via-navy-950/95 to-navy-950/0">
        {(mode === 'listening' || voiceErr) && (
          <div className={`mb-2 text-xs rounded-lg px-3 py-2 border ${voiceErr ? 'border-red-500/40 text-red-300 bg-red-500/5' : 'border-gold-500/40 text-slate-200 bg-gold-500/5'}`}>
            {voiceErr || (
              <span className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
                {interim || (nativeRecognitionSupported() ? 'Listening… speak now' : 'Recording…')}
              </span>
            )}
          </div>
        )}
        {mode === 'speaking' && (
          <div className="mb-2 text-xs rounded-lg px-3 py-2 border border-gold-500/40 text-slate-200 bg-gold-500/5 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-gold-400" /> Speaking…{settings.voice.handsFree ? ' (hands-free: I will listen again after this)' : ''}
            </span>
            <button onClick={() => { stopSpeaking(); setMode('idle') }} className="text-gold-400 font-semibold">Stop</button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            onClick={micClick}
            aria-label={mode === 'listening' ? 'Stop listening' : 'Speak'}
            className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition shadow-lg ${
              mode === 'listening' ? 'bg-red-600 text-white animate-pulse' : mode === 'speaking' ? 'bg-navy-700 text-gold-400' : 'bg-navy-800 text-gold-400 border border-gold-500/40 hover:bg-navy-700'
            }`}
          >
            {mode === 'listening' ? <MicOff className="w-5 h-5" /> : mode === 'speaking' ? <Square className="w-4 h-4" /> : <Mic className="w-5 h-5" />}
          </button>
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
                e.target.style.height = 'auto'
              }
            }}
            placeholder="Type or tap the mic…"
            className="flex-1 resize-none rounded-2xl bg-navy-800 border border-slate-700 focus:border-gold-500 text-slate-100 text-base sm:text-sm px-4 py-3 outline-none max-h-36"
          />
          <button
            onClick={() => submit()}
            disabled={!text.trim() || chat.busy}
            aria-label="Send"
            className="shrink-0 w-12 h-12 rounded-full bg-gold-500 hover:bg-gold-400 disabled:opacity-40 text-white flex items-center justify-center shadow-lg"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
