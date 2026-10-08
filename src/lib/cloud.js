// Google Drive / Google Sheets connection through the Google Apps Script web app
// (see google-apps-script/Code.gs). PDFs go to the configured Drive folder and every
// saved report is logged in the configured Google Sheet.
import { getState, actions, cloudUrl, onDataChange, replaceData } from './store'
import { debounce } from './util'

export class CloudError extends Error {
  constructor(message, code) {
    super(message)
    this.code = code
  }
}

export function cloudConfigured() {
  return !!cloudUrl()
}

export async function callCloud(action, payload = {}, { auth = true, timeoutMs = 60000, url } = {}) {
  const target = url || cloudUrl()
  if (!target) throw new CloudError('Google Drive connection is not configured. Add the Apps Script URL in Settings.', 'NOCONFIG')
  const body = { action, ...payload }
  if (auth) body.token = getState().session?.token || ''
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  let res
  try {
    res = await fetch(target, {
      method: 'POST',
      // text/plain keeps this a "simple" request, so the browser skips the CORS pre-flight
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
      signal: ctrl.signal,
    })
  } catch (e) {
    if (e.name === 'AbortError') throw new CloudError('The server took too long to respond. Please try again.', 'TIMEOUT')
    throw new CloudError('Cannot reach Google server. Check your internet connection.', 'NETWORK')
  } finally {
    clearTimeout(timer)
  }
  let json
  try {
    json = await res.json()
  } catch {
    throw new CloudError('Unexpected server response. Check that the Apps Script is deployed with access "Anyone".', 'BADRESPONSE')
  }
  if (!json.ok) {
    if (json.code === 'AUTH' && auth) {
      actions.logout()
      actions.toast('Your session has expired. Please sign in again.', 'error')
    }
    throw new CloudError(json.error || 'Request failed', json.code)
  }
  return json
}

// ---------------- data sync (costing master data) ----------------
let suppressPush = false
let started = false

const pushState = debounce(async (data) => {
  if (!cloudConfigured() || getState().session?.mode !== 'cloud') return
  try {
    actions.setCloud({ status: 'syncing' })
    await callCloud('putState', { state: data })
    actions.setCloud({ status: 'ok', lastSync: Date.now(), message: '' })
  } catch (e) {
    actions.setCloud({ status: 'error', message: e.message })
  }
}, 2000)

export function startSync() {
  if (started) return
  started = true
  onDataChange((data) => {
    if (!suppressPush) pushState(data)
  })
}

export async function pullState() {
  if (!cloudConfigured() || getState().session?.mode !== 'cloud') return
  actions.setCloud({ status: 'syncing' })
  try {
    const res = await callCloud('getState')
    const local = getState().data
    if (res.state && (res.state.updatedAt || 0) > (local.updatedAt || 0)) {
      suppressPush = true
      replaceData(res.state, { fromCloud: true })
      suppressPush = false
    } else if (!res.state || (local.updatedAt || 0) > (res.state.updatedAt || 0)) {
      await callCloud('putState', { state: local })
    }
    actions.setCloud({ status: 'ok', lastSync: Date.now(), message: '' })
  } catch (e) {
    actions.setCloud({ status: 'error', message: e.message })
  }
}

export async function pullSettings() {
  if (!cloudConfigured() || getState().session?.mode !== 'cloud') return
  try {
    const res = await callCloud('getSettings')
    const s = res.settings
    if (s && s.ai) {
      const cur = getState().settings.ai
      actions.setSettings({
        ai: {
          ...cur,
          provider: s.ai.provider || cur.provider,
          keys: { ...cur.keys, ...Object.fromEntries(Object.entries(s.ai.keys || {}).filter(([, v]) => v)) },
          models: { ...cur.models, ...(s.ai.models || {}) },
          replyLanguage: s.ai.replyLanguage || cur.replyLanguage,
        },
      })
    }
  } catch {
    /* settings sync is best effort */
  }
}

export async function pushSettings() {
  const ai = getState().settings.ai
  return callCloud('putSettings', {
    settings: { ai: { provider: ai.provider, keys: ai.keys, models: ai.models, replyLanguage: ai.replyLanguage } },
  })
}
