import { useEffect, useState, useSyncExternalStore } from 'react'
import { X, CheckCircle2, AlertTriangle, Info, Loader2 } from 'lucide-react'
import { useStore } from '../lib/store'

export const inputCls =
  'w-full rounded-lg bg-navy-800/70 border border-slate-700 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 text-slate-100 text-base sm:text-sm px-3 py-2.5 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed placeholder:text-slate-600'

export function Field({ label, suffix, prefix, value, onChange, type = 'number', disabled, placeholder, hint, error, className = '', min = 0, required, autoFocus }) {
  const isNum = type === 'number'
  return (
    <label className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </span>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 pointer-events-none">{prefix}</span>}
        <input
          type={isNum ? 'text' : type}
          inputMode={isNum ? 'decimal' : undefined}
          disabled={disabled}
          placeholder={placeholder}
          autoFocus={autoFocus}
          value={value ?? ''}
          onChange={(e) => {
            let v = e.target.value
            if (isNum) {
              v = v.replace(/[^0-9.-]/g, '')
              if (min >= 0) v = v.replace(/-/g, '')
              const parts = v.split('.')
              if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('')
            }
            onChange(v)
          }}
          className={`${inputCls} ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-14' : ''} ${error ? 'border-red-500/70' : ''}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">{suffix}</span>}
      </div>
      {error ? <span className="text-[11px] text-red-400">{error}</span> : hint ? <span className="text-[11px] text-slate-500">{hint}</span> : null}
    </label>
  )
}

export function Button({ children, variant = 'primary', size = 'md', className = '', loading, icon: Icon, ...rest }) {
  const v = {
    primary: 'bg-gold-500 hover:bg-gold-400 text-white',
    secondary: 'bg-navy-800 hover:bg-navy-700 text-slate-200 border border-slate-700',
    ghost: 'text-slate-300 hover:text-white hover:bg-white/5',
    danger: 'bg-red-600/90 hover:bg-red-500 text-white',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  }[variant]
  const s = { sm: 'text-xs px-2.5 py-1.5 gap-1.5', md: 'text-sm px-4 py-2.5 gap-2', lg: 'text-base px-5 py-3 gap-2' }[size]
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`inline-flex items-center justify-center font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed select-none ${v} ${s} ${className}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : Icon ? <Icon className="w-4 h-4 shrink-0" /> : null}
      {children}
    </button>
  )
}

export function Card({ children, className = '', title, subtitle, action }) {
  return (
    <section className={`bg-navy-800/40 border border-slate-800 rounded-2xl p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            {title && <h2 className="text-slate-100 font-semibold">{title}</h2>}
            {subtitle && <p className="text-slate-500 text-xs mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, tone = 'default', sub }) {
  const t = {
    default: 'bg-navy-900 border-slate-700 text-slate-100',
    highlight: 'bg-gold-500/10 border-gold-500/40 text-gold-400',
    good: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    bad: 'bg-red-500/10 border-red-500/30 text-red-400',
  }[tone]
  return (
    <div className={`rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 border min-w-0 ${t}`}>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 leading-tight">{label}</div>
      <div className="text-sm sm:text-base font-bold mt-1 truncate">{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}

export function Badge({ children, tone = 'default' }) {
  const t = {
    default: 'bg-slate-700/50 text-slate-300',
    blue: 'bg-gold-500/15 text-gold-400',
    green: 'bg-emerald-500/15 text-emerald-400',
    yellow: 'bg-yellow-500/15 text-yellow-400',
    red: 'bg-red-500/15 text-red-400',
  }[tone]
  return <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${t}`}>{children}</span>
}

export function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div className={`flex bg-navy-900 border border-slate-800 rounded-xl p-1 gap-1 overflow-x-auto no-scrollbar ${className}`}>
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`flex-1 min-w-0 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 text-[11px] sm:text-sm font-medium px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-lg whitespace-nowrap transition ${
            value === o.id ? 'bg-gold-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {o.icon && <o.icon className="w-4 h-4" />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="text-center py-10 px-4 border border-dashed border-slate-800 rounded-2xl">
      {Icon && <Icon className="w-8 h-8 mx-auto text-slate-600 mb-2" />}
      <div className="text-slate-300 text-sm font-medium">{title}</div>
      {text && <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} max-h-[92dvh] flex flex-col bg-navy-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl`}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-800">
          <h3 className="text-slate-100 font-semibold text-base truncate">{title}</h3>
          <button onClick={onClose} className="p-1.5 -m-1.5 text-slate-500 hover:text-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 sm:px-5 py-4 flex-1">{children}</div>
        {footer && <div className="px-4 sm:px-5 py-3 border-t border-slate-800 flex gap-2 justify-end pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  )
}

// ---- promise-based confirm dialog ----
let confirmState = null
const cl = new Set()
export function confirmDialog({ title = 'Please confirm', message, confirmText = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    confirmState = { title, message, confirmText, danger, resolve }
    cl.forEach((l) => l())
  })
}
export function ConfirmHost() {
  const s = useSyncExternalStore(
    (l) => {
      cl.add(l)
      return () => cl.delete(l)
    },
    () => confirmState
  )
  const close = (v) => {
    s?.resolve(v)
    confirmState = null
    cl.forEach((l) => l())
  }
  return (
    <Modal
      open={!!s}
      onClose={() => close(false)}
      title={s?.title}
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button variant={s?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
            {s?.confirmText}
          </Button>
        </>
      }
    >
      <p className="text-slate-300 text-sm whitespace-pre-line">{s?.message}</p>
    </Modal>
  )
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  return (
    <div className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-[calc(var(--bottom-nav-h)+5.5rem)] md:bottom-auto md:top-4 md:left-auto md:right-4 md:translate-x-0 w-[calc(100%-1.5rem)] max-w-sm space-y-2 pointer-events-none">
      {toasts.map((t) => {
        const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? AlertTriangle : Info
        const tone = t.kind === 'success' ? 'border-emerald-500/40 text-emerald-300' : t.kind === 'error' ? 'border-red-500/40 text-red-300' : 'border-gold-500/40 text-slate-200'
        return (
          <div key={t.id} className={`pointer-events-auto flex items-start gap-2.5 bg-navy-900/95 backdrop-blur border rounded-xl px-3.5 py-3 shadow-xl text-sm ${tone}`}>
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="text-slate-200">{t.message}</span>
          </div>
        )
      })}
    </div>
  )
}

export function useMediaQuery(q) {
  const [m, setM] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(q).matches : false))
  useEffect(() => {
    const mq = window.matchMedia(q)
    const h = () => setM(mq.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [q])
  return m
}

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-start justify-between gap-4 py-2 cursor-pointer">
      <span className="min-w-0">
        <span className="text-sm text-slate-200 block">{label}</span>
        {hint && <span className="text-xs text-slate-500 block mt-0.5">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition ${checked ? 'bg-gold-500' : 'bg-slate-700'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </label>
  )
}

export function Select({ label, value, onChange, options, hint }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      {label && <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{label}</span>}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
    </label>
  )
}
