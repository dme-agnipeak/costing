import { useEffect, useState } from 'react'
import { Flame, Layers, Zap, Bot, History as HistoryIcon, Settings as SettingsIcon, BookOpen, MoreHorizontal, LogOut, Mic, Cloud, CloudOff, Loader2 } from 'lucide-react'
import { useStore, actions, getState } from './lib/store'
import { startSync, pullState, pullSettings, cloudConfigured } from './lib/cloud'
import { syncPending } from './lib/reports'
import { logout } from './lib/auth'
import Login from './components/Login'
import CostingModule from './components/CostingModule'
import History from './components/History'
import Assistant from './components/Assistant'
import Settings, { PasswordModal } from './components/Settings'
import Help from './components/Help'
import { Toasts, ConfirmHost, Modal } from './components/ui'

const TABS = [
  { id: 'moulding', label: 'Moulding', icon: Layers },
  { id: 'welding', label: 'Welding', icon: Zap },
  { id: 'assistant', label: 'AI Assistant', short: 'AI', icon: Bot },
  { id: 'history', label: 'History', icon: HistoryIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
  { id: 'help', label: 'How to Use', icon: BookOpen },
]

export default function App() {
  const session = useStore((s) => s.session)
  if (!session) {
    return (
      <>
        <Login />
        <Toasts />
        <ConfirmHost />
      </>
    )
  }
  return <Shell />
}

function Shell() {
  const session = useStore((s) => s.session)
  const tab = useStore((s) => s.ui.tab)
  const company = useStore((s) => s.data.company)
  const cloud = useStore((s) => s.cloud)
  const [more, setMore] = useState(false)

  // cloud bootstrap after sign-in
  useEffect(() => {
    if (session.mode !== 'cloud' || !cloudConfigured()) return
    startSync()
    ;(async () => {
      await pullSettings()
      await pullState()
      if (getState().history.some((h) => h.status === 'pending')) {
        const r = await syncPending()
        if (r.ok) actions.toast(`${r.ok} pending report(s) uploaded to Google Drive.`, 'success')
      }
    })()
  }, [session.mode, session.token])

  // session expiry
  useEffect(() => {
    const t = setInterval(() => {
      const s = getState().session
      if (s?.expiresAt && Date.now() > s.expiresAt) {
        logout()
        actions.toast('Your session has expired. Please sign in again.', 'info')
      }
    }, 60000)
    return () => clearInterval(t)
  }, [])

  const openVoice = () => {
    try {
      sessionStorage.setItem('agnipeak_autolisten', '1')
    } catch {
      /* ignore */
    }
    actions.setTab('assistant')
  }

  const current = TABS.find((t) => t.id === tab) ? tab : 'moulding'

  return (
    <div className="min-h-[100dvh]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-navy-950/90 backdrop-blur border-b border-slate-800 pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full border-2 border-gold-500 flex items-center justify-center shrink-0">
            <Flame className="w-4.5 h-4.5 text-gold-500" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-slate-100 font-semibold text-sm leading-tight truncate">{company.name}</div>
            <div className="text-slate-500 text-[11px] leading-tight truncate">{company.subtitle}</div>
          </div>
          <CloudBadge cloud={cloud} session={session} />
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
            <span className="truncate max-w-[120px]">{session.username}</span>
            <button onClick={logout} className="p-2 rounded-lg hover:bg-white/5 hover:text-white" title="Sign out" aria-label="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Desktop tabs */}
        <nav className="hidden md:block border-t border-slate-800/60">
          <div className="max-w-6xl mx-auto px-4 flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => actions.setTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${current === t.id ? 'border-gold-500 text-gold-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className={`max-w-6xl mx-auto px-4 pt-4 ${current === 'assistant' ? 'pb-[var(--bottom-nav-h)] md:pb-0' : 'pb-[calc(var(--bottom-nav-h)+5.5rem)] md:pb-24'}`}>
        {current === 'moulding' && <CostingModule key="moulding" type="moulding" />}
        {current === 'welding' && <CostingModule key="welding" type="welding" />}
        {current === 'assistant' && <Assistant />}
        {current === 'history' && <History />}
        {current === 'settings' && <Settings />}
        {current === 'help' && <Help />}
      </main>

      {/* Floating voice button (all screens except the assistant) */}
      {current !== 'assistant' && (
        <button
          onClick={openVoice}
          aria-label="Talk to the AI assistant"
          className="fixed z-30 right-4 bottom-[calc(var(--bottom-nav-h)+1rem)] md:bottom-6 w-14 h-14 rounded-full bg-gold-500 hover:bg-gold-400 text-white shadow-xl shadow-gold-500/30 flex items-center justify-center"
        >
          <Mic className="w-6 h-6" />
        </button>
      )}

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-navy-950/95 backdrop-blur border-t border-slate-800 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 h-16">
          {[TABS[0], TABS[1], TABS[2], TABS[3]].map((t) => (
            <NavBtn key={t.id} t={t} active={current === t.id} center={t.id === 'assistant'} onClick={() => actions.setTab(t.id)} />
          ))}
          <NavBtn t={{ id: 'more', short: 'More', icon: MoreHorizontal }} active={current === 'settings' || current === 'help'} onClick={() => setMore(true)} />
        </div>
      </nav>

      <Modal open={more} onClose={() => setMore(false)} title={`Signed in as ${session.username}`}>
        <div className="space-y-2">
          {[TABS[4], TABS[5]].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                actions.setTab(t.id)
                setMore(false)
              }}
              className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl bg-navy-800/60 border border-slate-800 text-slate-200 text-sm"
            >
              <t.icon className="w-5 h-5 text-gold-400" /> {t.label}
            </button>
          ))}
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl border border-slate-800 text-red-300 text-sm">
            <LogOut className="w-5 h-5" /> Sign out
          </button>
        </div>
      </Modal>

      {session.mustChange && <PasswordModal forced onClose={() => {}} />}
      <Toasts />
      <ConfirmHost />
    </div>
  )
}

function NavBtn({ t, active, onClick, center }) {
  if (center)
    return (
      <button onClick={onClick} className="flex flex-col items-center justify-center -mt-5" aria-label={t.label}>
        <span className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg border-4 border-navy-950 ${active ? 'bg-gold-400' : 'bg-gold-500'}`}>
          <t.icon className="w-6 h-6 text-white" />
        </span>
        <span className={`text-[10px] mt-0.5 font-medium ${active ? 'text-gold-400' : 'text-slate-400'}`}>{t.short}</span>
      </button>
    )
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 ${active ? 'text-gold-400' : 'text-slate-500'}`}>
      <t.icon className="w-5 h-5" />
      <span className="text-[10px] font-medium">{t.short || t.label}</span>
    </button>
  )
}

function CloudBadge({ cloud, session }) {
  if (!cloudConfigured()) return null
  if (session.mode !== 'cloud')
    return (
      <span title="Offline — will sync later" className="text-yellow-400">
        <CloudOff className="w-4 h-4" />
      </span>
    )
  if (cloud.status === 'syncing') return <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
  if (cloud.status === 'error')
    return (
      <span title={cloud.message} className="text-red-400">
        <CloudOff className="w-4 h-4" />
      </span>
    )
  return (
    <span title="Synced with Google Drive" className="text-emerald-400">
      <Cloud className="w-4 h-4" />
    </span>
  )
}
