import { useEffect, useState } from 'react'
import { Building2, Cloud, Bot, Mic, UserCog, Database, Eye, EyeOff, CheckCircle2, Plug, LogOut, KeyRound, UserPlus, Trash2, Download, Upload, RotateCcw, Volume2, CloudUpload } from 'lucide-react'
import { useStore, actions, AI_PROVIDERS, aiModel, getState, replaceData, DEFAULT_SETTINGS } from '../lib/store'
import { callCloud, cloudConfigured, pushSettings, pullState } from '../lib/cloud'
import { testProvider } from '../lib/ai/providers'
import { changePassword, logout, validatePassword } from '../lib/auth'
import { listVoices, speak, ttsSupported, nativeRecognitionSupported } from '../lib/voice'
import { Card, Field, Button, Select, Toggle, Modal, Badge, inputCls, confirmDialog } from './ui'
import { fmtDateTime } from '../lib/util'

export default function Settings() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-slate-100 font-bold text-lg sm:text-xl">Settings</h1>
        <p className="text-slate-500 text-xs">One-time setup for company details, Google Drive, AI and voice.</p>
      </div>
      <AccountSection />
      <AISection />
      <VoiceSection />
      <CloudSection />
      <CompanySection />
      <DataSection />
      <p className="text-center text-[11px] text-slate-600 pb-2">AgniPeak Costing v3.0.0</p>
    </div>
  )
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <span className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-gold-400" />
      {children}
    </span>
  )
}

// ---------------------------------------------------------------- company
function CompanySection() {
  const company = useStore((s) => s.data.company)
  const set = (k) => (v) => actions.setCompany({ [k]: v })
  return (
    <Card title={<SectionTitle icon={Building2}>Company Details</SectionTitle>} subtitle="Printed on every PDF report.">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field type="text" label="Company Name" value={company.name} onChange={set('name')} />
        <Field type="text" label="Tagline" value={company.subtitle} onChange={set('subtitle')} />
        <Field type="text" label="Address" value={company.address} onChange={set('address')} className="sm:col-span-2" />
        <Field type="text" label="GSTIN" value={company.gstin} onChange={set('gstin')} />
        <Field type="text" label="Phone" value={company.phone} onChange={set('phone')} />
        <Field type="text" label="Email" value={company.email} onChange={set('email')} className="sm:col-span-2" />
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------- cloud
function CloudSection() {
  const settings = useStore((s) => s.settings)
  const session = useStore((s) => s.session)
  const cloud = useStore((s) => s.cloud)
  const [url, setUrl] = useState(settings.cloudUrl || import.meta.env.VITE_APPS_SCRIPT_URL || '')
  const [testing, setTesting] = useState(false)
  const [info, setInfo] = useState(null)
  const envUrl = import.meta.env.VITE_APPS_SCRIPT_URL

  const test = async () => {
    const u = url.trim()
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(u)) {
      actions.toast('Enter the Apps Script web-app URL ending in /exec.', 'error')
      return
    }
    setTesting(true)
    try {
      const r = await callCloud('ping', {}, { auth: false, url: u })
      setInfo(r)
      actions.toast('Connected to Google Drive and Google Sheet.', 'success')
    } catch (e) {
      setInfo(null)
      actions.toast(e.message, 'error', 6000)
    }
    setTesting(false)
  }

  const save = async () => {
    const changed = url.trim() !== (settings.cloudUrl || '')
    actions.setSettings({ cloudUrl: url.trim() })
    if (changed) {
      const ok = await confirmDialog({ title: 'Sign in again', message: 'The Google Drive connection has changed. Please sign in again with your Google Sheet user account.', confirmText: 'Sign out now' })
      if (ok) logout()
    }
  }

  return (
    <Card title={<SectionTitle icon={Cloud}>Google Drive &amp; Google Sheet</SectionTitle>} subtitle="PDFs are saved to your Drive folder and every report is logged in your Google Sheet.">
      <div className="space-y-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Apps Script Web-App URL</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" className={inputCls} disabled={session?.role !== 'admin' && !!settings.cloudUrl} />
          <span className="text-[11px] text-slate-500">
            {envUrl ? 'Pre-configured in this build. ' : ''}See the "Google Drive setup" section in How to Use, or google-apps-script/SETUP.md in the project.
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={Plug} onClick={test} loading={testing}>Test connection</Button>
          <Button size="sm" onClick={save} disabled={url.trim() === (settings.cloudUrl || '')}>Save</Button>
          {cloudConfigured() && session?.mode === 'cloud' && <Button size="sm" variant="secondary" icon={CloudUpload} onClick={() => pullState().then(() => actions.toast('Data synced with Google Drive.', 'success'))}>Sync data now</Button>}
        </div>
        {info && (
          <div className="text-xs text-emerald-300 bg-emerald-500/5 border border-emerald-500/30 rounded-lg p-2.5 space-y-0.5">
            <div className="flex items-center gap-1.5 font-semibold"><CheckCircle2 className="w-4 h-4" /> Connected (API v{info.version})</div>
            <div className="text-slate-400 break-all">Drive folder: {info.folderId}</div>
            <div className="text-slate-400 break-all">Google Sheet: {info.spreadsheetId}</div>
          </div>
        )}
        <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
          <span>Status: <StatusText cloud={cloud} session={session} /></span>
          {cloud.lastSync > 0 && <span>Last sync: {fmtDateTime(cloud.lastSync)}</span>}
        </div>
      </div>
    </Card>
  )
}

function StatusText({ cloud, session }) {
  if (!cloudConfigured()) return <span className="text-yellow-400">Not connected</span>
  if (session?.mode === 'offline') return <span className="text-yellow-400">Offline sign-in</span>
  if (cloud.status === 'error') return <span className="text-red-400">{cloud.message}</span>
  if (cloud.status === 'syncing') return <span className="text-slate-300">Syncing…</span>
  return <span className="text-emerald-400">Connected</span>
}

// ---------------------------------------------------------------- AI
function AISection() {
  const ai = useStore((s) => s.settings.ai)
  const session = useStore((s) => s.session)
  const [show, setShow] = useState({})
  const [testing, setTesting] = useState('')
  const [pushing, setPushing] = useState(false)

  const test = async (p) => {
    if (!ai.keys[p]) return actions.toast('Paste the API key first.', 'error')
    setTesting(p)
    try {
      await testProvider(p, ai.keys[p].trim(), aiModel(p))
      actions.toast(`${AI_PROVIDERS[p].label} is working.`, 'success')
    } catch (e) {
      actions.toast(e.message, 'error', 8000)
    }
    setTesting('')
  }

  const push = async () => {
    setPushing(true)
    try {
      await pushSettings()
      actions.toast('AI setup saved to the cloud. Other devices will receive it at sign-in.', 'success', 5000)
    } catch (e) {
      actions.toast(e.message, 'error')
    }
    setPushing(false)
  }

  return (
    <Card title={<SectionTitle icon={Bot}>AI Assistant</SectionTitle>} subtitle="Choose Claude, ChatGPT or Gemini and paste the API key once.">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(AI_PROVIDERS).map(([id, p]) => (
            <button
              key={id}
              onClick={() => actions.setSettings({ ai: { provider: id } })}
              className={`rounded-xl border px-2 py-2.5 text-xs sm:text-sm font-medium text-center transition ${ai.provider === id ? 'border-gold-500 bg-gold-500/10 text-gold-400' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}
            >
              {p.label.split(' ')[0]}
              <span className="block text-[10px] text-slate-500 font-normal">{p.label.split(' ').slice(1).join(' ')}</span>
              {ai.keys[id] && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mx-auto mt-1" />}
            </button>
          ))}
        </div>

        {Object.entries(AI_PROVIDERS).map(([id, p]) => (
          <div key={id} className={`rounded-xl border p-3 space-y-2.5 ${ai.provider === id ? 'border-gold-500/40 bg-navy-950/40' : 'border-slate-800'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-200">{p.label}</span>
              {ai.provider === id && <Badge tone="blue">Active</Badge>}
            </div>
            <div className="relative">
              <input
                type={show[id] ? 'text' : 'password'}
                autoComplete="off"
                value={ai.keys[id]}
                onChange={(e) => actions.setSettings({ ai: { keys: { [id]: e.target.value.trim() } } })}
                placeholder="API key"
                className={`${inputCls} pr-10 font-mono`}
              />
              <button onClick={() => setShow((s) => ({ ...s, [id]: !s[id] }))} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500" aria-label="Show key">
                {show[id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">{p.keyHint}</p>
            <div className="flex gap-2 items-end">
              <div className="flex-1 min-w-0">
                <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Model</label>
                <input
                  list={'models-' + id}
                  value={ai.models[id] || ''}
                  placeholder={p.defaultModel}
                  onChange={(e) => actions.setSettings({ ai: { models: { [id]: e.target.value.trim() } } })}
                  className={inputCls + ' mt-1.5'}
                />
                <datalist id={'models-' + id}>
                  {p.models.map((m) => <option key={m} value={m} />)}
                </datalist>
              </div>
              <Button size="md" variant="secondary" onClick={() => test(id)} loading={testing === id}>Test</Button>
            </div>
          </div>
        ))}

        <Select
          label="AI reply language"
          value={ai.replyLanguage}
          onChange={(v) => actions.setSettings({ ai: { replyLanguage: v } })}
          options={[
            { value: 'English', label: 'English (professional)' },
            { value: 'Hindi', label: 'Hindi' },
            { value: 'Hinglish (Hindi in Roman script)', label: 'Hinglish' },
          ]}
          hint="You can always type or speak in English, Hindi or Hinglish."
        />

        {session?.mode === 'cloud' && session?.role === 'admin' && (
          <div className="rounded-xl border border-slate-800 p-3">
            <p className="text-xs text-slate-400 mb-2">Save this AI setup (provider, keys, models) to your private Apps Script settings so every signed-in device uses it automatically.</p>
            <Button size="sm" variant="secondary" icon={CloudUpload} onClick={push} loading={pushing}>Save AI setup for all devices</Button>
          </div>
        )}
        <p className="text-[11px] text-slate-500">Keys are stored on this device and sent only to the selected AI provider. Usage is billed to your own AI account.</p>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------- voice
function VoiceSection() {
  const voice = useStore((s) => s.settings.voice)
  const [voices, setVoices] = useState(() => listVoices())
  useEffect(() => {
    if (!ttsSupported()) return
    const h = () => setVoices(listVoices())
    window.speechSynthesis.addEventListener?.('voiceschanged', h)
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', h)
  }, [])
  const set = (patch) => actions.setSettings({ voice: patch })
  const langVoices = voices.filter((v) => v.lang?.slice(0, 2) === voice.lang.slice(0, 2))

  return (
    <Card title={<SectionTitle icon={Mic}>Voice</SectionTitle>} subtitle={nativeRecognitionSupported() ? 'Voice input is supported in this browser.' : 'This browser has no built-in voice recognition — an OpenAI or Gemini key is used to transcribe speech.'}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Select
          label="Recognition language"
          value={voice.lang}
          onChange={(v) => set({ lang: v, voiceName: '' })}
          options={[
            { value: 'en-IN', label: 'English (India) — best for Hinglish' },
            { value: 'hi-IN', label: 'Hindi (India)' },
            { value: 'en-US', label: 'English (US)' },
            { value: 'en-GB', label: 'English (UK)' },
          ]}
        />
        <Select
          label="Reply voice"
          value={voice.voiceName}
          onChange={(v) => set({ voiceName: v })}
          options={[{ value: '', label: 'Automatic' }, ...langVoices.map((v) => ({ value: v.name, label: v.name }))]}
        />
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Speaking speed: {Number(voice.rate).toFixed(1)}x</span>
          <input type="range" min="0.6" max="1.6" step="0.1" value={voice.rate} onChange={(e) => set({ rate: Number(e.target.value) })} className="accent-[#2f6fed]" />
        </label>
      </div>
      <div className="mt-2 divide-y divide-slate-800">
        <Toggle checked={voice.speakReplies} onChange={(v) => set({ speakReplies: v })} label="Read replies aloud" hint="When you speak to the assistant, it answers by voice." />
        <Toggle checked={voice.handsFree} onChange={(v) => set({ handsFree: v })} label="Hands-free conversation" hint="After each spoken reply, the microphone opens again automatically." />
      </div>
      <Button size="sm" variant="secondary" icon={Volume2} className="mt-3" onClick={() => speak('Hello. Your AgniPeak costing assistant is ready.')} disabled={!ttsSupported()}>
        Test voice
      </Button>
    </Card>
  )
}

// ---------------------------------------------------------------- account
function AccountSection() {
  const session = useStore((s) => s.session)
  const [pwOpen, setPwOpen] = useState(false)
  const [usersOpen, setUsersOpen] = useState(false)
  const modeLabel = { cloud: 'Google Sheet account', local: 'This device only', offline: 'Offline (Google Sheet account)' }[session?.mode] || ''
  return (
    <Card title={<SectionTitle icon={UserCog}>Account</SectionTitle>}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-slate-100 font-semibold truncate">{session?.username}</div>
          <div className="text-xs text-slate-500">
            {session?.role === 'admin' ? 'Administrator' : 'User'} · {modeLabel}
          </div>
        </div>
        <Button size="sm" variant="secondary" icon={LogOut} onClick={logout}>Sign out</Button>
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        <Button size="sm" variant="secondary" icon={KeyRound} onClick={() => setPwOpen(true)} disabled={session?.mode === 'offline'}>Change password</Button>
        {session?.role === 'admin' && session?.mode === 'cloud' && (
          <Button size="sm" variant="secondary" icon={UserPlus} onClick={() => setUsersOpen(true)}>Manage users</Button>
        )}
      </div>
      {pwOpen && <PasswordModal forced={session?.mustChange} onClose={() => setPwOpen(false)} />}
      {usersOpen && <UsersModal onClose={() => setUsersOpen(false)} />}
    </Card>
  )
}

export function PasswordModal({ onClose, forced }) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [c, setC] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const save = async () => {
    setErr('')
    if (b !== c) return setErr('New passwords do not match.')
    const v = validatePassword(b)
    if (v) return setErr(v)
    setBusy(true)
    try {
      await changePassword(a, b)
      actions.toast('Password changed successfully.', 'success')
      onClose()
    } catch (e) {
      setErr(e.message)
    }
    setBusy(false)
  }
  return (
    <Modal
      open
      onClose={forced ? () => {} : onClose}
      title={forced ? 'Please set a new password' : 'Change password'}
      footer={
        <>
          {!forced && <Button variant="secondary" onClick={onClose}>Cancel</Button>}
          <Button onClick={save} loading={busy}>Save password</Button>
        </>
      }
    >
      {forced && <p className="text-sm text-yellow-300 mb-3">You are using a temporary password. Choose a new password to continue.</p>}
      <div className="space-y-3">
        <Field type="password" label="Current password" value={a} onChange={setA} />
        <Field type="password" label="New password" value={b} onChange={setB} hint="At least 8 characters with letters and numbers." />
        <Field type="password" label="Confirm new password" value={c} onChange={setC} />
        {err && <p className="text-sm text-red-400">{err}</p>}
      </div>
    </Modal>
  )
}

function UsersModal({ onClose }) {
  const me = useStore((s) => s.session)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [role, setRole] = useState('user')
  const [busy, setBusy] = useState(false)
  const load = async () => {
    setLoading(true)
    try {
      setUsers((await callCloud('listUsers')).users)
    } catch (e) {
      actions.toast(e.message, 'error')
    }
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])
  const add = async () => {
    setBusy(true)
    try {
      await callCloud('addUser', { username: u, password: p, role })
      actions.toast(`User "${u}" added. They must change the password at first sign-in.`, 'success', 5000)
      setU('')
      setP('')
      load()
    } catch (e) {
      actions.toast(e.message, 'error')
    }
    setBusy(false)
  }
  const remove = async (name) => {
    if (!(await confirmDialog({ title: 'Remove user', message: `Remove "${name}"? They will be signed out on all devices.`, confirmText: 'Remove', danger: true }))) return
    try {
      await callCloud('removeUser', { username: name })
      load()
    } catch (e) {
      actions.toast(e.message, 'error')
    }
  }
  const reset = async (name) => {
    const pw = window.prompt(`New temporary password for "${name}" (min 8 characters, letters and numbers):`)
    if (!pw) return
    try {
      await callCloud('resetPassword', { username: name, password: pw })
      actions.toast('Temporary password set. The user must change it at next sign-in.', 'success', 5000)
    } catch (e) {
      actions.toast(e.message, 'error')
    }
  }
  return (
    <Modal open onClose={onClose} title="Manage users">
      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          users.map((x) => (
            <div key={x.username} className="flex items-center gap-2 bg-navy-950/60 border border-slate-800 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-200">{x.username} {x.role === 'admin' && <Badge tone="blue">Admin</Badge>}</div>
                <div className="text-[11px] text-slate-500">Last sign-in: {x.lastLogin ? fmtDateTime(x.lastLogin) : 'Never'}</div>
              </div>
              <Button size="sm" variant="ghost" icon={KeyRound} onClick={() => reset(x.username)} title="Reset password" />
              {x.username !== me?.username && <Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(x.username)} className="hover:!text-red-400" title="Remove" />}
            </div>
          ))
        )}
      </div>
      <div className="mt-5 border-t border-slate-800 pt-4 space-y-3">
        <div className="text-sm font-semibold text-slate-200">Add user</div>
        <div className="grid grid-cols-2 gap-3">
          <Field type="text" label="Username" value={u} onChange={(v) => setU(v.toLowerCase().replace(/\s/g, ''))} />
          <Field type="text" label="Temporary password" value={p} onChange={setP} />
        </div>
        <Select label="Role" value={role} onChange={setRole} options={[{ value: 'user', label: 'User — costing, reports, history' }, { value: 'admin', label: 'Administrator — also users & settings' }]} />
        <Button icon={UserPlus} onClick={add} loading={busy} disabled={!u || !p}>Add user</Button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- data
function DataSection() {
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ app: 'agnipeak-costing', version: 3, exportedAt: new Date().toISOString(), data: getState().data }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `AgniPeak_Costing_Backup_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }
  const importData = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const r = new FileReader()
    r.onload = async () => {
      try {
        const j = JSON.parse(r.result)
        const data = j.data || j
        if (!data.modules) throw new Error('This file is not an AgniPeak Costing backup.')
        if (!(await confirmDialog({ title: 'Import backup', message: 'Replace all current fixed costs, machines and products with this backup?', confirmText: 'Import', danger: true }))) return
        replaceData({ ...data, updatedAt: Date.now() })
        actions.toast('Backup imported.', 'success')
      } catch (err) {
        actions.toast(err.message, 'error')
      }
    }
    r.readAsText(f)
  }
  const resetSettings = async () => {
    if (!(await confirmDialog({ title: 'Reset device settings', message: 'Remove AI keys, voice preferences and the Google Drive URL from this device? Costing data is not affected.', confirmText: 'Reset', danger: true }))) return
    actions.setSettings({ ...DEFAULT_SETTINGS, cloudUrl: getState().settings.cloudUrl })
    actions.toast('Device settings reset.', 'success')
  }
  return (
    <Card title={<SectionTitle icon={Database}>Data &amp; Backup</SectionTitle>} subtitle="Costing data is saved automatically on this device and synced to Google Drive when connected.">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" icon={Download} onClick={exportData}>Export backup</Button>
        <label className="inline-flex">
          <input type="file" accept="application/json,.json" onChange={importData} className="hidden" />
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-200 border border-slate-700 cursor-pointer">
            <Upload className="w-4 h-4" /> Import backup
          </span>
        </label>
        <Button size="sm" variant="ghost" icon={RotateCcw} onClick={resetSettings}>Reset device settings</Button>
      </div>
    </Card>
  )
}
