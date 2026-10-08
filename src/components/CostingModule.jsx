import { useMemo, useState } from 'react'
import { Package, Settings2, Gauge, FileBarChart, Plus, Pencil, Trash2, Copy, FileDown, Search, Lock, Unlock, CloudUpload, CheckSquare, Square, ExternalLink } from 'lucide-react'
import { useStore, actions } from '../lib/store'
import { computeModule, currency, num2, FIXED_COST_FIELDS } from '../lib/calculations'
import { COSTING_TYPES } from '../lib/costingTypes'
import { createReport } from '../lib/reports'
import { cloudConfigured } from '../lib/cloud'
import { Button, Card, Field, Stat, Segmented, Empty, Badge, confirmDialog } from './ui'
import ProductForm from './ProductForm'

const SECTIONS = [
  { id: 'products', label: 'Products', icon: Package },
  { id: 'fixed', label: 'Fixed Costs', icon: Settings2 },
  { id: 'machine', label: 'Machines', icon: Gauge },
  { id: 'report', label: 'Report', icon: FileBarChart },
]

export default function CostingModule({ type }) {
  const T = COSTING_TYPES[type]
  const mod = useStore((s) => s.data.modules[type])
  const sub = useStore((s) => s.ui.sub[type]) || 'products'
  const summary = useMemo(() => computeModule(mod), [mod])

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-slate-100 font-bold text-lg sm:text-xl">{T.label}</h1>
          <p className="text-slate-500 text-xs">
            Fixed cost / machine / day: <span className="text-gold-400 font-semibold">{currency(summary.perMachinePerDay)}</span>
          </p>
        </div>
      </div>
      <Segmented options={SECTIONS} value={sub} onChange={(v) => actions.setSub(type, v)} />
      {sub === 'products' && <ProductsSection type={type} mod={mod} summary={summary} />}
      {sub === 'fixed' && <FixedSection type={type} mod={mod} summary={summary} />}
      {sub === 'machine' && <MachineSection type={type} mod={mod} summary={summary} />}
      {sub === 'report' && <ReportSection type={type} summary={summary} />}
    </div>
  )
}

// ---------------------------------------------------------------- products
function ProductsSection({ type, mod, summary }) {
  const T = COSTING_TYPES[type]
  const [editing, setEditing] = useState(null) // null | 'new' | product
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(null)
  const rows = summary.rows.filter((r) => !q || (r.product.name || '').toLowerCase().includes(q.toLowerCase()))

  const del = async (p) => {
    if (await confirmDialog({ title: 'Delete product', message: `Delete "${p.name}" from ${T.label}? This cannot be undone.`, confirmText: 'Delete', danger: true })) {
      actions.deleteProduct(type, p.id)
      actions.toast('Product deleted.', 'success')
    }
  }

  const pdf = async (p) => {
    setBusy(p.id)
    try {
      const rec = await createReport({ kind: 'product', type, productId: p.id })
      actions.toast(rec.status === 'synced' ? 'PDF downloaded and saved to Google Drive.' : rec.status === 'pending' ? 'PDF downloaded. Drive upload pending — retry from History.' : 'PDF downloaded and saved in History.', rec.status === 'pending' ? 'info' : 'success', 5000)
    } catch (e) {
      actions.toast(e.message, 'error')
    }
    setBusy(null)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Stat label="Products" value={summary.rows.length} />
        <Stat label={`Avg ${T.labels.finalCost}`} value={currency(summary.avgFinalCost)} tone="highlight" />
        <Stat label="Average Margin" value={summary.pricedCount ? num2(summary.avgMargin, 1) + '%' : '—'} tone={summary.pricedCount ? (summary.avgMargin >= 0 ? 'good' : 'bad') : 'default'} />
        <Stat label="Below Cost" value={summary.lossMaking} tone={summary.lossMaking ? 'bad' : 'default'} />
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="w-full rounded-lg bg-navy-800/70 border border-slate-700 focus:border-gold-500 text-slate-100 text-base sm:text-sm pl-9 pr-3 py-2.5 outline-none" />
        </div>
        <Button icon={Plus} onClick={() => setEditing('new')}>
          <span className="hidden xs:inline sm:inline">Add</span>
        </Button>
      </div>

      {!summary.rows.length ? (
        <Empty icon={Package} title="No products yet" text={`Add your first ${T.short.toLowerCase()} product to see its full costing.`} action={<Button icon={Plus} onClick={() => setEditing('new')}>Add Product</Button>} />
      ) : !rows.length ? (
        <Empty icon={Search} title="No matching products" />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2.5">
            {rows.map(({ product: p, calc: c }) => (
              <div key={p.id} className="bg-navy-800/50 border border-slate-800 rounded-xl p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-slate-100 font-semibold truncate">{p.name || '—'}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {num2(p.bodyWeightGram, 2)} g · ₹{num2(p.ratePerKg)}/kg · {num2(p.avgProduction, 0)}/day
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-gold-400 font-bold">{currency(c.finalCostPerBody)}</div>
                    {c.hasOverride && <Badge tone="yellow">Manual</Badge>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
                  <KV k="Material" v={currency(c.materialTotalInclGst)} />
                  <KV k="Fixed" v={currency(c.fixedCostPerBody)} />
                  <KV k="Profit" v={c.hasSellingPrice ? `${currency(c.profitPerBody)} (${num2(c.marginPercent, 1)}%)` : '—'} tone={c.hasSellingPrice ? (c.profitPerBody >= 0 ? 'text-emerald-400' : 'text-red-400') : ''} />
                </div>
                <div className="flex gap-1.5 mt-3 pt-3 border-t border-slate-800">
                  <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(p)} className="flex-1">Edit</Button>
                  <Button size="sm" variant="secondary" icon={FileDown} onClick={() => pdf(p)} loading={busy === p.id} className="flex-1">PDF</Button>
                  <Button size="sm" variant="ghost" icon={Copy} onClick={() => actions.duplicateProduct(type, p.id)} aria-label="Duplicate" />
                  <Button size="sm" variant="ghost" icon={Trash2} onClick={() => del(p)} className="hover:!text-red-400" aria-label="Delete" />
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy-900 text-slate-400 text-[11px] uppercase tracking-wide">
                  <th className="text-left px-3 py-3">Product</th>
                  <th className="text-right px-3 py-3">Wt (g)</th>
                  <th className="text-right px-3 py-3">Rate/KG</th>
                  <th className="text-right px-3 py-3">Prod/Day</th>
                  <th className="text-right px-3 py-3">Material incl GST</th>
                  <th className="text-right px-3 py-3">Fixed/Unit</th>
                  <th className="text-right px-3 py-3 text-gold-400">Final Cost</th>
                  <th className="text-right px-3 py-3">Selling</th>
                  <th className="text-right px-3 py-3">Profit</th>
                  <th className="text-right px-3 py-3">Margin</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map(({ product: p, calc: c }) => (
                  <tr key={p.id} className="hover:bg-navy-800/40">
                    <td className="px-3 py-2.5 text-slate-200 font-medium max-w-[220px] truncate">{p.name || '—'}</td>
                    <td className="px-3 py-2.5 text-right text-slate-400">{num2(p.bodyWeightGram, 2)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-400">₹{num2(p.ratePerKg)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-400">{num2(p.avgProduction, 0)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-300">{currency(c.materialTotalInclGst)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-300">{currency(c.fixedCostPerBody)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-gold-400 whitespace-nowrap">
                      {currency(c.finalCostPerBody)} {c.hasOverride && <Badge tone="yellow">Manual</Badge>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-300">{c.hasSellingPrice ? currency(c.sellingPrice) : '—'}</td>
                    <td className={`px-3 py-2.5 text-right font-medium ${c.profitPerBody >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{c.hasSellingPrice ? currency(c.profitPerBody) : '—'}</td>
                    <td className={`px-3 py-2.5 text-right ${c.marginPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{c.hasSellingPrice ? num2(c.marginPercent, 1) + '%' : '—'}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex gap-0.5 justify-end">
                        <IconBtn title="Edit" icon={Pencil} onClick={() => setEditing(p)} />
                        <IconBtn title="Costing sheet PDF" icon={FileDown} onClick={() => pdf(p)} busy={busy === p.id} />
                        <IconBtn title="Duplicate" icon={Copy} onClick={() => actions.duplicateProduct(type, p.id)} />
                        <IconBtn title="Delete" icon={Trash2} onClick={() => del(p)} danger />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editing && (
        <ProductForm
          type={type}
          initial={editing === 'new' ? null : editing}
          perMachinePerDay={summary.perMachinePerDay}
          workingDays={summary.workingDays}
          existingNames={mod.products.filter((p) => editing === 'new' || p.id !== editing.id).map((p) => p.name || '')}
          onClose={() => setEditing(null)}
          onSave={(p) => {
            actions.upsertProduct(type, p)
            setEditing(null)
            actions.toast(`"${p.name}" saved.`, 'success')
          }}
        />
      )}
    </div>
  )
}

function KV({ k, v, tone = '' }) {
  return (
    <div className="bg-navy-950/60 rounded-lg px-2 py-1.5 min-w-0">
      <div className="text-slate-500 uppercase tracking-wide text-[9px]">{k}</div>
      <div className={`font-semibold truncate ${tone || 'text-slate-200'}`}>{v}</div>
    </div>
  )
}

function IconBtn({ icon: Icon, onClick, title, danger, busy }) {
  return (
    <button title={title} aria-label={title} onClick={onClick} disabled={busy} className={`p-2 rounded-lg text-slate-500 hover:bg-white/5 ${danger ? 'hover:text-red-400' : 'hover:text-gold-400'} disabled:opacity-40`}>
      <Icon className={`w-4 h-4 ${busy ? 'animate-pulse' : ''}`} />
    </button>
  )
}

// ---------------------------------------------------------------- fixed costs
function LockButton({ locked, setLocked }) {
  return (
    <button
      onClick={() => setLocked(!locked)}
      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition shrink-0 ${locked ? 'border-slate-700 text-slate-300 hover:text-white' : 'border-gold-500 text-gold-400 bg-gold-500/10'}`}
    >
      {locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
      {locked ? 'Edit' : 'Done'}
    </button>
  )
}

function FixedSection({ type, mod, summary }) {
  const [locked, setLocked] = useState(true)
  return (
    <Card title="Monthly Fixed Costs" subtitle="Set once — changes are saved automatically. Tap Edit to change." action={<LockButton locked={locked} setLocked={setLocked} />}>
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {FIXED_COST_FIELDS.map((f) => (
          <Field key={f.key} label={f.label} prefix="₹" value={mod.fixedCosts[f.key]} disabled={locked} onChange={(v) => actions.setFixedCosts(type, { [f.key]: v })} />
        ))}
      </div>
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <Stat label="Total Monthly Fixed Cost" value={currency(summary.totalFixed)} tone="highlight" />
        <Stat label="Fixed Cost / Machine / Month" value={currency(summary.perMachine)} />
        <Stat label="Fixed Cost / Machine / Day" value={currency(summary.perMachinePerDay)} />
      </div>
    </Card>
  )
}

function MachineSection({ type, mod, summary }) {
  const [locked, setLocked] = useState(true)
  const T = COSTING_TYPES[type]
  return (
    <Card title="Machine Setup" subtitle="The monthly fixed cost is divided by machines and working days." action={<LockButton locked={locked} setLocked={setLocked} />}>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Field label={`Number of ${T.short} Machines`} value={mod.machine.numberOfMachines} disabled={locked} onChange={(v) => actions.setMachine(type, { numberOfMachines: v })} />
        <Field label="Working Days / Month" suffix="days" value={mod.machine.workingDays} disabled={locked} onChange={(v) => actions.setMachine(type, { workingDays: v })} />
      </div>
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Stat label="Fixed Cost / Machine (Monthly)" value={currency(summary.perMachine)} />
        <Stat label="Fixed Cost / Machine / Day" value={currency(summary.perMachinePerDay)} tone="highlight" />
      </div>
      <p className="text-slate-500 text-xs mt-4">Each product's Avg Production per machine per day spreads this daily fixed cost over every unit produced.</p>
    </Card>
  )
}

// ---------------------------------------------------------------- report
function ReportSection({ type, summary }) {
  const T = COSTING_TYPES[type]
  const session = useStore((s) => s.session)
  const [selected, setSelected] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState(null)
  const all = selected.size === 0
  const toggle = (id) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const save = async () => {
    setBusy(true)
    try {
      const rec = await createReport({ kind: 'module', type, productIds: all ? undefined : [...selected] })
      setLast(rec)
      actions.toast(rec.status === 'synced' ? 'Report downloaded and saved to Google Drive.' : rec.status === 'pending' ? 'Report downloaded. Drive upload pending — retry from History.' : 'Report downloaded and saved in History.', rec.status === 'pending' ? 'info' : 'success', 5000)
    } catch (e) {
      actions.toast(e.message, 'error')
    }
    setBusy(false)
  }

  const driveReady = cloudConfigured() && session?.mode === 'cloud'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Stat label="Total Monthly Fixed" value={currency(summary.totalFixed)} />
        <Stat label="Fixed / Machine / Day" value={currency(summary.perMachinePerDay)} tone="highlight" />
        <Stat label="Products" value={summary.rows.length} />
        <Stat label="Average Margin" value={summary.pricedCount ? num2(summary.avgMargin, 1) + '%' : '—'} tone={summary.pricedCount ? (summary.avgMargin >= 0 ? 'good' : 'bad') : 'default'} />
      </div>

      <Card
        title={T.reportTitle}
        subtitle={all ? 'All products will be included. Tick products to include only those.' : `${selected.size} product(s) selected.`}
      >
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <Button icon={driveReady ? CloudUpload : FileDown} onClick={save} loading={busy} disabled={!summary.rows.length} className="sm:w-auto w-full">
            {driveReady ? 'Save PDF to Drive & Download' : 'Download PDF & Save to History'}
          </Button>
          {!all && (
            <Button variant="secondary" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          )}
        </div>
        {!driveReady && (
          <p className="text-xs text-yellow-400/80 mb-3">
            {cloudConfigured() ? 'You are signed in offline — the PDF will be uploaded to Google Drive when you are back online.' : 'Google Drive is not connected. Connect it in Settings → Google Drive to save PDFs and history to the cloud.'}
          </p>
        )}
        {last && (
          <div className="mb-3 text-xs text-slate-300 bg-navy-950/60 border border-slate-800 rounded-lg px-3 py-2 flex flex-wrap items-center gap-2">
            Last saved: <span className="font-mono text-slate-400">{last.reportId}</span>
            {last.pdfUrl && (
              <a href={last.pdfUrl} target="_blank" rel="noreferrer" className="text-gold-400 inline-flex items-center gap-1">
                Open in Drive <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {!summary.rows.length ? (
          <Empty icon={FileBarChart} title="Nothing to report yet" text="Add products first." />
        ) : (
          <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
            {summary.rows.map(({ product: p, calc: c }) => {
              const on = selected.has(p.id)
              return (
                <button key={p.id} onClick={() => toggle(p.id)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-navy-800/50">
                  {on ? <CheckSquare className="w-4 h-4 text-gold-400 shrink-0" /> : <Square className="w-4 h-4 text-slate-600 shrink-0" />}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-slate-200 truncate">{p.name}</span>
                    <span className="block text-[11px] text-slate-500">
                      Material {currency(c.materialTotalInclGst)} · Fixed {currency(c.fixedCostPerBody)}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-sm font-bold text-gold-400">{currency(c.finalCostPerBody)}</span>
                    <span className={`block text-[11px] ${c.profitPerBody >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {c.hasSellingPrice ? `${num2(c.marginPercent, 1)}% · ${currency(c.profitPerMachinePerMonth)}/mo` : 'No selling price'}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
        <p className="text-[11px] text-slate-500 mt-3">"/mo" = estimated profit per machine per month (profit per unit × production per day × working days).</p>
      </Card>
    </div>
  )
}
