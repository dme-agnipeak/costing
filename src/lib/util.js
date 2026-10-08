export function uid(prefix = '') {
  try {
    if (globalThis.crypto?.randomUUID) return prefix + crypto.randomUUID()
  } catch {
    /* insecure context — fall through */
  }
  return prefix + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

export function reportId(type) {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const code = type === 'welding' ? 'WLD' : type === 'moulding' ? 'MLD' : 'CST'
  return `${code}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

export function today() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fmtDateTime(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d)) return String(v)
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function fmtDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d)) return String(v)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function safeFileName(s) {
  return String(s || 'Report').replace(/[^a-z0-9\-_. ]/gi, '').trim().replace(/\s+/g, '_').slice(0, 80) || 'Report'
}

export function debounce(fn, ms) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

export function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function lsDel(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export function clone(v) {
  return JSON.parse(JSON.stringify(v))
}
