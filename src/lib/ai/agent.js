// AI agent loop + chat state (kept outside React so the conversation survives tab changes).
import { useSyncExternalStore } from 'react'
import { getState, aiModel, AI_PROVIDERS } from '../store'
import { PROVIDER_CALLS } from './providers'
import { TOOL_DEFS, runTool, TOOL_LABELS } from './tools'
import { guideText } from '../guide'
import { computeModule, round } from '../calculations'
import { uid, lsGet, lsSet } from '../util'

const CHAT_KEY = 'agnipeak_chat_v1'
const MAX_STEPS = 12

let chat = { items: lsGet(CHAT_KEY, []), busy: false, status: '' }
const ls = new Set()
function setChat(patch) {
  chat = { ...chat, ...patch }
  if (patch.items) lsSet(CHAT_KEY, chat.items.slice(-60))
  ls.forEach((l) => l())
}
export function useChat() {
  return useSyncExternalStore(
    (l) => {
      ls.add(l)
      return () => ls.delete(l)
    },
    () => chat
  )
}
export function clearChat() {
  setChat({ items: [], status: '' })
}

function systemPrompt({ voice }) {
  const st = getState()
  const lang = st.settings.ai.replyLanguage || 'English'
  const summary = ['moulding', 'welding']
    .map((t) => {
      const s = computeModule(st.data.modules[t])
      return `- ${t}: ${s.rows.length} products (${s.rows.map((r) => r.product.name || 'Unnamed').slice(0, 40).join(', ') || 'none'}); fixed cost per machine per day ₹${round(s.perMachinePerDay, 2)}`
    })
    .join('\n')
  return `You are the AI costing assistant inside "AgniPeak Costing", the product costing app of ${st.data.company.name}.
Signed-in user: ${st.session?.username || 'user'} (${st.session?.role || 'user'}). Today: ${new Date().toISOString().slice(0, 10)}.

Your job: help the user with moulding and welding product costing — add/update products, change fixed costs and machine setup, run what-if calculations, compare products, create PDF reports, search and re-check history, and explain how to use the app.

Rules:
1. NEVER calculate costing figures yourself. Always use the tools (calculate_costing, get_costing_data, save_product, …) — they use the app's verified costing engine. Quote numbers exactly as returned, rounded to 2 decimals, in Indian rupees (₹ with Indian digit grouping, e.g. ₹3,50,000.00).
2. When the user wants something done (add, update, PDF, save), do it with the tools and then confirm briefly what was done. Do not ask for permission for normal actions.
3. Ask a short clarifying question only if a required input is missing (e.g. weight, rate or production for a new product) or it is unclear whether they mean moulding or welding. If the module is not stated and the product exists in only one module, use that module.
4. Before deleting products or overwriting all fixed costs, confirm with the user unless they clearly asked for it.
5. For custom PDFs (comparisons, what-if scenarios, quotations, price lists), first compute every number with the tools, then call create_custom_pdf with complete, clearly labelled tables.
6. Reply in professional ${lang}. The user may write or speak in Hindi, Hinglish or English — understand all of them. Spoken numbers like "teen lakh pachas hazar" mean 350000.
7. Keep replies concise and well-structured. Use short markdown tables for multiple products.${voice ? '\n8. This message came by voice and your reply will be read aloud: answer in 1–3 short spoken-style sentences, no tables, no markdown.' : ''}
9. Google Drive links returned by tools may be shared with the user as-is.

Current data:
${summary}

App guide (use it to answer "how do I…" questions):
${guideText()}`
}

function resultSummary(name, r) {
  if (r?.error) return 'Failed: ' + r.error
  if (name === 'create_pdf_report' || name === 'create_product_pdf' || name === 'create_custom_pdf') return r.status
  if (name === 'save_product') return `${r.action === 'updated' ? 'Updated' : 'Created'} "${r.name}" — final cost ₹${r.results.final_cost_per_unit.toFixed(2)}`
  if (name === 'delete_product') return `Deleted "${r.deleted}"`
  return ''
}

export async function sendMessage(text, { voice = false } = {}) {
  const st = getState()
  const ai = st.settings.ai
  const provider = ai.provider
  const key = ai.keys[provider]
  const userItem = { id: uid(), kind: 'user', text, voice }
  if (!key) {
    setChat({
      items: [
        ...chat.items,
        userItem,
        {
          id: uid(),
          kind: 'assistant',
          text: `The AI assistant is not set up yet. Open **Settings → AI Assistant**, choose ${AI_PROVIDERS[provider].label} (or another provider) and paste your API key.`,
          error: true,
        },
      ],
    })
    return null
  }
  // Rebuild canonical conversation from the visible chat (last turns only)
  const convo = []
  for (const it of chat.items.slice(-30)) {
    const role = it.kind === 'user' ? 'user' : it.kind === 'assistant' && it.text && !it.error ? 'assistant' : null
    if (!role) continue
    const last = convo[convo.length - 1]
    if (last && last.role === role) last.text += '\n\n' + it.text
    else convo.push({ role, text: it.text })
  }
  // make sure the conversation starts with a user turn
  while (convo.length && convo[0].role !== 'user') convo.shift()
  if (convo.length && convo[convo.length - 1].role === 'user') convo[convo.length - 1].text += '\n\n' + text
  else convo.push({ role: 'user', text })

  setChat({ items: [...chat.items, userItem], busy: true, status: 'Thinking…' })
  const call = PROVIDER_CALLS[provider]
  const model = aiModel(provider)
  const system = systemPrompt({ voice })
  const actionsDone = []
  let finalText = ''
  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const r = await call({ key, model, system, messages: convo, tools: TOOL_DEFS })
      convo.push({ role: 'assistant', text: r.text, toolCalls: r.toolCalls, raw: r.raw })
      if (!r.toolCalls?.length) {
        finalText = r.text
        break
      }
      const results = []
      for (const c of r.toolCalls) {
        setChat({ status: (TOOL_LABELS[c.name] || c.name) + '…' })
        let result
        try {
          result = await runTool(c.name, c.args || {})
        } catch (e) {
          result = { error: e.message }
        }
        const summary = resultSummary(c.name, result)
        actionsDone.push({ name: c.name, label: TOOL_LABELS[c.name] || c.name, ok: !result?.error, summary, link: result?.google_drive_link || null })
        results.push({ id: c.id, gid: c.gid, name: c.name, result })
      }
      convo.push({ role: 'tool', results })
      setChat({ status: 'Thinking…' })
    }
    if (!finalText) finalText = actionsDone.length ? 'Done.' : 'I could not complete that request. Please rephrase it.'
    const item = { id: uid(), kind: 'assistant', text: finalText, actions: actionsDone, provider, model }
    setChat({ items: [...chat.items, item], busy: false, status: '' })
    return item
  } catch (e) {
    const item = { id: uid(), kind: 'assistant', text: 'Sorry — ' + e.message, error: true, actions: actionsDone }
    setChat({ items: [...chat.items, item], busy: false, status: '' })
    return item
  }
}
