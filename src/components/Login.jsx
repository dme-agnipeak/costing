import { useState } from 'react'
import { Flame, Eye, EyeOff, LogIn, Cloud, HardDrive, Settings2, ShieldCheck } from 'lucide-react'
import { login, needsLocalSetup, createLocalUser, validatePassword } from '../lib/auth'
import { callCloud, cloudConfigured } from '../lib/cloud'
import { useStore, actions } from '../lib/store'
import { Button, Modal, inputCls } from './ui'

export default function Login() {
  const company = useStore((s) => s.data.company)
  useStore((s) => s.settings.cloudUrl) // re-render when connection changes
  const [setup, setSetup] = useState(needsLocalSetup())
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [connOpen, setConnOpen] = useState(false)
  const cloud = cloudConfigured()

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (setup) {
        if (!/^[a-z0-9._-]{3,30}$/i.test(username.trim())) throw new Error('Username must be 3–30 characters (letters, numbers, dot, dash, underscore).')
        const v = validatePassword(password)
        if (v) throw new Error(v)
        if (password !== confirm) throw new Error('Passwords do not match.')
        await createLocalUser(username, password, 'admin')
        setSetup(false)
      }
      await login(username, password, remember)
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="w-16 h-16 rounded-2xl border-2 border-gold-500 flex items-center justify-center mx-auto bg-gold-500/10">
            <Flame className="w-8 h-8 text-gold-500" />
          </div>
          <h1 className="text-slate-100 font-bold text-xl mt-4">{company.name}</h1>
          <p className="text-slate-400 text-sm">AgniPeak Costing</p>
        </div>

        <form onSubmit={submit} className="bg-navy-800/50 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div>
            <h2 className="text-slate-100 font-semibold">{setup ? 'Create administrator account' : 'Sign in'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {setup ? 'First-time setup on this device. Keep these details safe.' : 'Enter your username and password to continue.'}
            </p>
          </div>
          <label className="block">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Username</span>
            <input autoFocus autoCapitalize="none" autoCorrect="off" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls + ' mt-1.5'} />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Password</span>
            <div className="relative mt-1.5">
              <input type={show ? 'text' : 'password'} autoComplete={setup ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls + ' pr-10'} />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500" aria-label="Show password">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>
          {setup && (
            <label className="block">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Confirm password</span>
              <input type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls + ' mt-1.5'} />
              <span className="text-[11px] text-slate-500">At least 8 characters with letters and numbers.</span>
            </label>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-300 select-none">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 accent-[#2f6fed]" />
            Keep me signed in for 30 days
          </label>
          {error && <p className="text-sm text-red-400 bg-red-500/5 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
          <Button type="submit" icon={setup ? ShieldCheck : LogIn} loading={busy} className="w-full" size="lg">
            {setup ? 'Create account & sign in' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            {cloud ? <Cloud className="w-3.5 h-3.5 text-emerald-400" /> : <HardDrive className="w-3.5 h-3.5" />}
            {cloud ? 'Google Drive account' : 'Device account'}
          </span>
          <button onClick={() => setConnOpen(true)} className="flex items-center gap-1 hover:text-slate-300">
            <Settings2 className="w-3.5 h-3.5" /> Connection
          </button>
        </div>
        {cloud && <p className="text-[11px] text-slate-600 mt-3 text-center">First sign-in after setup: admin / Admin@123 — you will be asked to change it.</p>}
      </div>
      {connOpen && (
        <ConnectionModal
          onClose={() => {
            setConnOpen(false)
            setSetup(needsLocalSetup())
          }}
        />
      )}
    </div>
  )
}

function ConnectionModal({ onClose }) {
  const current = useStore((s) => s.settings.cloudUrl) || import.meta.env.VITE_APPS_SCRIPT_URL || ''
  const [url, setUrl] = useState(current)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const save = async () => {
    const u = url.trim()
    setMsg('')
    if (u && !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(u)) return setMsg('Enter the Apps Script web-app URL ending in /exec.')
    if (u) {
      setBusy(true)
      try {
        await callCloud('ping', {}, { auth: false, url: u })
      } catch (e) {
        setBusy(false)
        return setMsg(e.message)
      }
      setBusy(false)
    }
    actions.setSettings({ cloudUrl: u })
    actions.toast(u ? 'Connected to Google Drive. Sign in with your Google Sheet account.' : 'Using device account.', 'success')
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Google Drive connection"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={busy}>Save</Button>
        </>
      }
    >
      <p className="text-sm text-slate-400 mb-3">Paste the Apps Script web-app URL to sign in with shared Google Sheet accounts and save PDFs to Google Drive. Leave blank to use a device-only account.</p>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" className={inputCls} />
      {msg && <p className="text-sm text-red-400 mt-2">{msg}</p>}
    </Modal>
  )
}
