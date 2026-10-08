import { useEffect, useMemo, useState } from 'react'
import { History as HistoryIcon, RefreshCw, Search, ExternalLink, FileDown, ShieldCheck, ShieldAlert, Trash2, RotateCcw, CloudOff, Cloud, Bot, CloudUpload } from 'lucide-react'
import { useStore, actions } from '../lib/store'
import { fetchCloudHistory, syncPending, loadRecordSnapshot, recheckRecord, pdfFromRecord, deleteRecord, restoreFromRecord } from '../lib/reports'
import { cloudConfigured } from '../lib/cloud'
import { downloadPdf } from '../lib/pdf'
import { currency, num2 } from '../lib/calculations'
import { fmtDateTime } from '../lib/util'
import { Button, Empty, Badge, Segmented, Modal, confirmDialog } from './ui'

const TYPES = [
  { id: 'all', label: 'All' },
  { id: 'moulding', label: 'Moulding' },
  { id: 'welding', label: 'Welding' },
  { id: 'custom', label: 'Custom' },
]

export default function History() {
  const history = useStore((s) => s.history)
  const session = useStore((s) => s.session)
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(null)
  const cloud = cloudConfigured() && session?.mode === 'cloud'
  const pending = history.filter((h) => h.status === 'pending').length

  const refresh = async () => {
    if (!cloud) return
    setLoading(true)
    try {
      await fetchCloudHistory({})
    } catch (e) {
      actions.toast(e.message, 'error')
    }
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sync = async () => {
    setLoading(true)
    const r = await syncPending()
    setLoading(false)
    actions.toast(`${r.ok} of ${r.total} pending report(s) uploaded to Google Drive.`, r.ok === r.total ? 'success' : 'info')
  }

  const list = useMemo(() => {
    const s = q.toLowerCase()
    return history.filter((h) => (type === 'all' || h.type === type) && (!s || `${h.reportId} ${h.title} ${h.productNames} ${h.savedBy}`.toLowerCase().includes(s)))
  }, [history, q, type])

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-slate-100 font-bold text-lg sm:text-xl">History</h1>
          <p className="text-slate-500 text-xs">{cloud ? 'Saved reports from Google Sheet and this device.' : 'Saved reports on this device.'}</p>
        </div>
        <div className="flex gap-2">
          {pending > 0 && cloud && (
            <Button size="sm" variant="secondary" icon={CloudUpload} onClick={sync} loading={loading}>
              Sync {pending} pending
            </Button>
          )}
          {cloud && (
            <Button size="sm" variant="secondary" icon={RefreshCw} onClick={refresh} loading={loading}>
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product, report no. or user" className="w-full rounded-lg bg-navy-800/70 border border-slate-700 focus:border-gold-500 text-slate-100 text-base sm:text-sm pl-9 pr-3 py-2.5 outline-none" />
      </div>
      <Segmented options={TYPES} value={type} onChange={setType} />

      {!list.length ? (
        <Empty icon={HistoryIcon} title={history.length ? 'No matching reports' : 'No reports saved yet'} text="Reports appear here after you save a PDF from a Report section, a product card or the AI Assistant." />
      ) : (
        <div className="space-y-2">
          {list.map((h) => (
            <button key={h.reportId} onClick={() => setOpen(h)} className="w-full text-left bg-navy-800/50 hover:bg-navy-800 border border-slate-800 rounded-xl p-3.5 transition">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-100 truncate">{h.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">{h.productNames || '—'}</div>
                </div>
                <StatusBadge status={h.status} />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-500">
                <span className="font-mono">{h.reportId}</span>
                <span>{fmtDateTime(h.savedAt)}</span>
                {h.savedBy && <span>by {h.savedBy}</span>}
                <Badge tone={h.type === 'welding' ? 'yellow' : h.type === 'moulding' ? 'blue' : 'default'}>{h.type}</Badge>
                {h.source === 'ai' && (
                  <Badge tone="green">
                    <Bot className="w-3 h-3" /> AI
                  </Badge>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      {open && <RecordModal record={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function StatusBadge({ status }) {
  if (status === 'synced')
    return (
      <Badge tone="green">
        <Cloud className="w-3 h-3" /> Drive
      </Badge>
    )
  if (status === 'pending')
    return (
      <Badge tone="yellow">
        <CloudOff className="w-3 h-3" /> Pending
      </Badge>
    )
  return <Badge>Local</Badge>
}

function RecordModal({ record: initial, onClose }) {
  const session = useStore((s) => s.session)
  const [record, setRecord] = useState(initial)
  const [loading, setLoading] = useState(!initial.snapshot)
  const [error, setError] = useState('')
  const [check, setCheck] = useState(null)

  useEffect(() => {
    let alive = true
    if (!initial.snapshot) {
      loadRecordSnapshot(initial)
        .then((r) => alive && setRecord(r))
        .catch((e) => alive && setError(e.message))
        .finally(() => alive && setLoading(false))
    }
    return () => {
      alive = false
    }
  }, [initial])

  const snap = record.snapshot
  const doCheck = () => {
    try {
      setCheck(recheckRecord(record))
    } catch (e) {
      setError(e.message)
    }
  }
  const pdf = () => {
    try {
      downloadPdf(pdfFromRecord(record))
    } catch (e) {
      actions.toast(e.message, 'error')
    }
  }
  const restore = async () => {
    const ok = await confirmDialog({
      title: 'Restore to calculator',
      message: `Copy ${snap.module.products.length} product(s) from this report back into the ${snap.type} tab? Existing products with the same ID will be overwritten with the saved values.`,
      confirmText: 'Restore',
    })
    if (!ok) return
    const n = restoreFromRecord(record)
    actions.toast(`${n} product(s) restored to the ${snap.type} tab.`, 'success')
    onClose()
    actions.setTab(snap.type)
    actions.setSub(snap.type, 'products')
  }
  const del = async () => {
    const ok = await confirmDialog({ title: 'Delete report', message: 'Delete this report from History' + (record.status === 'synced' ? ', the Google Sheet and Google Drive' : '') + '?', confirmText: 'Delete', danger: true })
    if (!ok) return
    try {
      await deleteRecord(record)
      actions.toast('Report deleted.', 'success')
      onClose()
    } catch (e) {
      actions.toast(e.message, 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title={record.title} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Info k="Report No." v={record.reportId} mono />
          <Info k="Saved" v={fmtDateTime(record.savedAt)} />
          <Info k="Saved by" v={record.savedBy || '—'} />
          <Info k="Source" v={record.source === 'ai' ? 'AI Assistant' : 'Manual'} />
        </div>
        <div className="flex flex-wrap gap-2">
          {record.pdfUrl && (
            <a href={record.pdfUrl} target="_blank" rel="noreferrer">
              <Button size="sm" icon={ExternalLink}>Open in Drive</Button>
            </a>
          )}
          <Button size="sm" variant="secondary" icon={FileDown} onClick={pdf} disabled={!snap}>Download PDF</Button>
          <Button size="sm" variant="secondary" icon={ShieldCheck} onClick={doCheck} disabled={!snap}>Re-check</Button>
          {snap?.module && <Button size="sm" variant="secondary" icon={RotateCcw} onClick={restore}>Restore to calculator</Button>}
          {(session?.role === 'admin' || record.status !== 'synced') && <Button size="sm" variant="ghost" icon={Trash2} onClick={del} className="hover:!text-red-400">Delete</Button>}
        </div>

        {loading && <p className="text-sm text-slate-400">Loading saved data…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {check && (
          <div className={`rounded-xl border p-3 ${check.verified ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-red-500/40 bg-red-500/5'}`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              {check.verified ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <ShieldAlert className="w-4 h-4 text-red-400" />}
              <span className={check.verified ? 'text-emerald-300' : 'text-red-300'}>
                {check.kind === 'custom' ? check.note : check.verified ? 'Verified — every saved figure matches a fresh recalculation.' : 'Mismatch found — see highlighted rows.'}
              </span>
            </div>
            {check.items?.length > 0 && (
              <>
                <p className="text-[11px] text-slate-400 mt-2">
                  Fixed cost / machine / day: saved {currency(check.fixedThen)} · today {currency(check.fixedNow)}
                </p>
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-xs min-w-[460px]">
                    <thead>
                      <tr className="text-slate-500 text-[10px] uppercase">
                        <th className="text-left py-1.5">Product</th>
                        <th className="text-right py-1.5">Saved Final</th>
                        <th className="text-right py-1.5">Recalculated</th>
                        <th className="text-right py-1.5">Today</th>
                        <th className="text-right py-1.5">Change</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {check.items.map((i) => (
                        <tr key={i.id} className={i.verified ? '' : 'bg-red-500/10'}>
                          <td className="py-1.5 text-slate-200">{i.name}</td>
                          <td className="py-1.5 text-right">{currency(i.saved.finalCost)}</td>
                          <td className="py-1.5 text-right">{currency(i.recomputed.finalCost)}</td>
                          <td className="py-1.5 text-right">{i.liveFinalCost === null ? 'Removed' : currency(i.liveFinalCost)}</td>
                          <td className={`py-1.5 text-right ${!i.liveChange ? 'text-slate-500' : i.liveChange > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {i.liveChange === null ? '—' : (i.liveChange > 0 ? '+' : '') + num2(i.liveChange, 2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {snap?.module && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Saved figures</div>
            <div className="space-y-2">
              {snap.module.products.map((p) => {
                const r = snap.results?.[p.id] || {}
                return (
                  <div key={p.id} className="bg-navy-950/60 border border-slate-800 rounded-lg p-2.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-200 font-medium truncate">{p.name}</span>
                      <span className="text-gold-400 font-bold">{currency(r.finalCost)}</span>
                    </div>
                    <div className="text-slate-500 mt-1">
                      {num2(p.bodyWeightGram, 2)} g · ₹{num2(p.ratePerKg)}/kg · GST {num2(p.gstPercent, 1)}% · {num2(p.avgProduction, 0)}/day · Material {currency(r.materialInclGst)} · Fixed {currency(r.fixedPerUnit)}
                      {p.sellingPrice ? ` · Selling ${currency(p.sellingPrice)} · Margin ${num2(r.margin, 1)}%` : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {snap?.kind === 'custom' && snap.spec?.summary && <p className="text-sm text-slate-300 whitespace-pre-line">{snap.spec.summary}</p>}
      </div>
    </Modal>
  )
}

function Info({ k, v, mono }) {
  return (
    <div className="bg-navy-950/60 border border-slate-800 rounded-lg px-2.5 py-2 min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{k}</div>
      <div className={`text-slate-200 truncate ${mono ? 'font-mono' : ''}`}>{v}</div>
    </div>
  )
}

