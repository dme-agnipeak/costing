import { useState } from 'react'
import { ChevronDown, BookOpen, Bot, Send } from 'lucide-react'
import { GUIDE } from '../lib/guide'
import { actions } from '../lib/store'
import { sendMessage } from '../lib/ai/agent'
import Markdown from './Markdown'
import { inputCls } from './ui'

const DRIVE_SETUP = {
  id: 'drive-setup',
  title: 'Google Drive setup (one time, admin)',
  body: `1. Open the Google Sheet (ID 1TygLnarJdA-aO2UtH7RCxpe-O0LLRXvjsc6glEdGdUU) with the Google account that owns the Drive folder.
2. Menu Extensions → Apps Script. Delete any code in Code.gs and paste the full contents of google-apps-script/Code.gs from the project.
3. Click Save, then select the function "setup" and click Run. Approve the permissions (Drive and Sheets).
4. Click Deploy → New deployment → type "Web app". Execute as: Me. Who has access: Anyone. Click Deploy and copy the Web-app URL (ends with /exec).
5. In this app: Settings → Google Drive & Google Sheet → paste the URL → Test connection → Save. (Or set it once for everybody as VITE_APPS_SCRIPT_URL in Vercel.)
6. Sign in with admin / Admin@123 and choose a new password. Add other users from Settings → Account → Manage users.
PDFs are stored in the Drive folder (ID 1P9Ee7Ltlxj8vWb4u06-W45VsDwyp7agO) in the sub-folders "Moulding Costing", "Welding Costing" and "Custom Reports". The Sheet gets the tabs Reports, History and Users.
When you change Code.gs later, use Deploy → Manage deployments → Edit → New version so the URL stays the same.`,
}

export default function Help() {
  const [open, setOpen] = useState('start')
  const [q, setQ] = useState('')
  const ask = () => {
    const t = q.trim()
    if (!t) return
    actions.setTab('assistant')
    sendMessage(t)
    setQ('')
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-slate-100 font-bold text-lg sm:text-xl flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-gold-400" /> How to Use
        </h1>
        <p className="text-slate-500 text-xs">Everything you need to work with AgniPeak Costing.</p>
      </div>

      <div className="bg-gold-500/5 border border-gold-500/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Bot className="w-4 h-4 text-gold-400" /> Ask the AI Assistant
        </div>
        <p className="text-xs text-slate-400 mt-1">Ask any question about features, for example "How do I make a PDF of only two products?"</p>
        <div className="flex gap-2 mt-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} placeholder="Type your question…" className={inputCls} />
          <button onClick={ask} className="shrink-0 w-11 rounded-lg bg-gold-500 text-white flex items-center justify-center" aria-label="Ask">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {[...GUIDE, DRIVE_SETUP].map((g) => (
          <div key={g.id} className="bg-navy-800/40 border border-slate-800 rounded-xl overflow-hidden">
            <button onClick={() => setOpen(open === g.id ? '' : g.id)} className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left">
              <span className="text-sm font-semibold text-slate-100">{g.title}</span>
              <ChevronDown className={`w-4 h-4 text-slate-500 transition ${open === g.id ? 'rotate-180' : ''}`} />
            </button>
            {open === g.id && (
              <div className="px-4 pb-4 text-slate-300">
                <Markdown text={g.body} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
