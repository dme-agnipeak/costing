// Small global store (no external dependency). Screens read it through useStore();
// the AI assistant and cloud sync call the same actions directly, so anything the
// UI can do, the assistant can do as well.
import { useSyncExternalStore } from 'react'
import { lsGet, lsSet, uid, today, clone } from './util'
import { TYPE_IDS } from './costingTypes'

const K = {
  data: 'agnipeak_data_v3',
  settings: 'agnipeak_settings_v3',
  session: 'agnipeak_session_v3',
  history: 'agnipeak_history_v3',
  ui: 'agnipeak_ui_v3',
  // legacy (v2) keys — migrated automatically into the Moulding module
  legacyFixed: 'agnipeak_fixed_costs_v1',
  legacyMachine: 'agnipeak_machine_capacity_v2',
  legacyProducts: 'agnipeak_products_v2',
  legacyCompany: 'agnipeak_company_info_v1',
}

export const DEFAULT_FIXED_COSTS = {
  moulding: { electricity: 350000, rent: 140000, operatorSalary: 204000, labour: 120000, misc: 100000, otherFixed: 0 },
  welding: { electricity: 0, rent: 0, operatorSalary: 0, labour: 0, misc: 0, otherFixed: 0 },
}
export const DEFAULT_MACHINE = {
  moulding: { numberOfMachines: 6, workingDays: 26 },
  welding: { numberOfMachines: 1, workingDays: 26 },
}
export const DEFAULT_COMPANY = {
  name: 'Vinayak AgniPeak LLP',
  subtitle: 'Product Costing System',
  address: '',
  gstin: '',
  phone: '',
  email: '',
  preparedBy: '',
}

export const AI_PROVIDERS = {
  anthropic: {
    label: 'Claude (Anthropic)',
    defaultModel: 'claude-sonnet-5-5',
    models: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5'],
    keyHint: 'Starts with sk-ant-… — create at console.anthropic.com',
  },
  openai: {
    label: 'ChatGPT (OpenAI)',
    defaultModel: 'gpt-5.4-mini',
    models: ['gpt-5.4-mini', 'gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.4-nano'],
    keyHint: 'Starts with sk-… — create at platform.openai.com',
  },
  gemini: {
    label: 'Gemini (Google)',
    defaultModel: 'gemini-3.5-flash',
    models: ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],
    keyHint: 'Starts with AIza… — create at aistudio.google.com',
  },
}

export const DEFAULT_SETTINGS = {
  cloudUrl: '',
  ai: {
    provider: 'anthropic',
    keys: { anthropic: '', openai: '', gemini: '' },
    models: { anthropic: '', openai: '', gemini: '' },
    replyLanguage: 'English',
    syncToCloud: true,
    autoSavePdfToDrive: true,
  },
  voice: {
    lang: 'en-IN',
    speakReplies: true,
    handsFree: false,
    rate: 1,
    voiceName: '',
    transcribeModel: 'gpt-4o-mini-transcribe',
  },
}

export function blankProduct() {
  return {
    id: uid('p-'),
    date: today(),
    name: '',
    bodyWeightGram: '',
    ratePerKg: '',
    rawQtyKg: '',
    gstPercent: 18,
    avgProduction: '',
    sellingPrice: '',
    additionalCost: '',
    finalCostOverride: '',
    notes: '',
  }
}

function defaultModule(type) {
  return { fixedCosts: { ...DEFAULT_FIXED_COSTS[type] }, machine: { ...DEFAULT_MACHINE[type] }, products: [] }
}

function loadData() {
  const saved = lsGet(K.data, null)
  if (saved && saved.modules) {
    for (const t of TYPE_IDS) {
      const m = saved.modules[t] || defaultModule(t)
      saved.modules[t] = {
        fixedCosts: { ...DEFAULT_FIXED_COSTS[t], ...(m.fixedCosts || {}) },
        machine: { ...DEFAULT_MACHINE[t], ...(m.machine || {}) },
        products: Array.isArray(m.products) ? m.products : [],
      }
    }
    saved.company = { ...DEFAULT_COMPANY, ...(saved.company || {}) }
    return saved
  }
  // First run on v3: migrate v2 data into the Moulding module
  const data = {
    company: { ...DEFAULT_COMPANY, ...lsGet(K.legacyCompany, {}) },
    modules: { moulding: defaultModule('moulding'), welding: defaultModule('welding') },
    updatedAt: 0,
  }
  const lf = lsGet(K.legacyFixed, null)
  const lm = lsGet(K.legacyMachine, null)
  const lp = lsGet(K.legacyProducts, null)
  if (lf) data.modules.moulding.fixedCosts = { ...data.modules.moulding.fixedCosts, ...lf }
  if (lm) data.modules.moulding.machine = { ...data.modules.moulding.machine, ...lm }
  if (Array.isArray(lp)) data.modules.moulding.products = lp.map((p) => ({ ...blankProduct(), ...p }))
  if (data.company.subtitle === 'Daily Product Body Costing') data.company.subtitle = DEFAULT_COMPANY.subtitle
  return data
}

function loadSettings() {
  const s = lsGet(K.settings, {})
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    ai: {
      ...DEFAULT_SETTINGS.ai,
      ...(s.ai || {}),
      keys: { ...DEFAULT_SETTINGS.ai.keys, ...(s.ai?.keys || {}) },
      models: { ...DEFAULT_SETTINGS.ai.models, ...(s.ai?.models || {}) },
    },
    voice: { ...DEFAULT_SETTINGS.voice, ...(s.voice || {}) },
  }
}

function loadSession() {
  const s = lsGet(K.session, null)
  if (!s) return null
  if (s.expiresAt && Date.now() > s.expiresAt) return null
  return s
}

let state = {
  data: loadData(),
  settings: loadSettings(),
  session: loadSession(),
  history: lsGet(K.history, []),
  ui: { tab: 'moulding', sub: { moulding: 'products', welding: 'products' }, ...lsGet(K.ui, {}) },
  cloud: { status: 'idle', message: '', lastSync: 0 },
  toasts: [],
}

const listeners = new Set()
export function getState() {
  return state
}
function emit() {
  listeners.forEach((l) => l())
}
export function subscribe(l) {
  listeners.add(l)
  return () => listeners.delete(l)
}
export function useStore(selector = (s) => s) {
  return useSyncExternalStore(subscribe, () => selector(state))
}

const dataListeners = new Set()
export function onDataChange(fn) {
  dataListeners.add(fn)
  return () => dataListeners.delete(fn)
}

function set(partial, { persistKeys = [], dataChanged = false } = {}) {
  state = { ...state, ...partial }
  for (const k of persistKeys) lsSet(K[k], state[k])
  emit()
  if (dataChanged) dataListeners.forEach((f) => f(state.data))
}

// ---------- data actions ----------
function updateData(mutator, { touch = true } = {}) {
  const data = clone(state.data)
  mutator(data)
  if (touch) data.updatedAt = Date.now()
  set({ data }, { persistKeys: ['data'], dataChanged: touch })
  return data
}

export function replaceData(data, { fromCloud = false } = {}) {
  const merged = { ...loadDataShape(data) }
  set({ data: merged }, { persistKeys: ['data'], dataChanged: !fromCloud })
}

function loadDataShape(d) {
  const out = { company: { ...DEFAULT_COMPANY, ...(d.company || {}) }, modules: {}, updatedAt: d.updatedAt || Date.now() }
  for (const t of TYPE_IDS) {
    const m = d.modules?.[t] || {}
    out.modules[t] = {
      fixedCosts: { ...DEFAULT_FIXED_COSTS[t], ...(m.fixedCosts || {}) },
      machine: { ...DEFAULT_MACHINE[t], ...(m.machine || {}) },
      products: Array.isArray(m.products) ? m.products.map((p) => ({ ...blankProduct(), ...p })) : [],
    }
  }
  return out
}

export const actions = {
  setFixedCosts(type, patch) {
    updateData((d) => {
      d.modules[type].fixedCosts = { ...d.modules[type].fixedCosts, ...patch }
    })
  },
  setMachine(type, patch) {
    updateData((d) => {
      d.modules[type].machine = { ...d.modules[type].machine, ...patch }
    })
  },
  upsertProduct(type, product) {
    let saved
    updateData((d) => {
      const list = d.modules[type].products
      const idx = list.findIndex((p) => p.id === product.id)
      saved = { ...blankProduct(), ...product, id: product.id || uid('p-') }
      if (idx >= 0) list[idx] = saved
      else list.push(saved)
    })
    return saved
  },
  deleteProduct(type, id) {
    updateData((d) => {
      d.modules[type].products = d.modules[type].products.filter((p) => p.id !== id)
    })
  },
  duplicateProduct(type, id) {
    const p = state.data.modules[type].products.find((x) => x.id === id)
    if (!p) return null
    return actions.upsertProduct(type, { ...p, id: uid('p-'), name: (p.name || 'Product') + ' (Copy)' })
  },
  setCompany(patch) {
    updateData((d) => {
      d.company = { ...d.company, ...patch }
    })
  },

  // ---------- settings / session ----------
  setSettings(patch) {
    const settings = {
      ...state.settings,
      ...patch,
      ai: { ...state.settings.ai, ...(patch.ai || {}) },
      voice: { ...state.settings.voice, ...(patch.voice || {}) },
    }
    if (patch.ai?.keys) settings.ai.keys = { ...state.settings.ai.keys, ...patch.ai.keys }
    if (patch.ai?.models) settings.ai.models = { ...state.settings.ai.models, ...patch.ai.models }
    set({ settings }, { persistKeys: ['settings'] })
  },
  setSession(session) {
    set({ session }, { persistKeys: ['session'] })
  },
  logout() {
    set({ session: null }, { persistKeys: ['session'] })
  },

  // ---------- history (local cache of saved reports) ----------
  setHistory(history) {
    set({ history: history.slice(0, 300) }, { persistKeys: ['history'] })
  },
  addHistory(record) {
    const history = [record, ...state.history.filter((h) => h.reportId !== record.reportId)]
    actions.setHistory(history)
  },
  updateHistory(reportId, patch) {
    actions.setHistory(state.history.map((h) => (h.reportId === reportId ? { ...h, ...patch } : h)))
  },
  removeHistory(reportId) {
    actions.setHistory(state.history.filter((h) => h.reportId !== reportId))
  },

  // ---------- ui ----------
  setTab(tab) {
    const ui = { ...state.ui, tab }
    set({ ui }, { persistKeys: ['ui'] })
    try {
      window.scrollTo({ top: 0 })
    } catch {
      /* ignore */
    }
  },
  setSub(type, sub) {
    const ui = { ...state.ui, sub: { ...state.ui.sub, [type]: sub } }
    set({ ui }, { persistKeys: ['ui'] })
  },
  setCloud(patch) {
    set({ cloud: { ...state.cloud, ...patch } })
  },
  toast(message, kind = 'info', ms = 3500) {
    const id = uid()
    set({ toasts: [...state.toasts, { id, message, kind }] })
    setTimeout(() => set({ toasts: state.toasts.filter((t) => t.id !== id) }), ms)
  },
}

export function cloudUrl() {
  return (state.settings.cloudUrl || import.meta.env.VITE_APPS_SCRIPT_URL || '').trim()
}

export function aiModel(provider) {
  return state.settings.ai.models?.[provider] || AI_PROVIDERS[provider].defaultModel
}
