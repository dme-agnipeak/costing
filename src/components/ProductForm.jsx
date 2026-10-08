import { useState } from 'react'
import { Save } from 'lucide-react'
import { Field, Button, Modal, inputCls } from './ui'
import { computeProduct, currency, num2, num } from '../lib/calculations'
import { COSTING_TYPES } from '../lib/costingTypes'
import { blankProduct } from '../lib/store'

export default function ProductForm({ type, initial, perMachinePerDay, workingDays, onSave, onClose, existingNames = [] }) {
  const T = COSTING_TYPES[type]
  const L = T.labels
  const [p, setP] = useState(() => ({ ...blankProduct(), ...(initial || {}) }))
  const [errors, setErrors] = useState({})
  const up = (k, v) => setP((x) => ({ ...x, [k]: v }))
  const c = computeProduct(p, perMachinePerDay, workingDays)

  const validate = () => {
    const e = {}
    if (!String(p.name || '').trim()) e.name = 'Please enter a product name.'
    else if (existingNames.some((n) => n.toLowerCase() === p.name.trim().toLowerCase())) e.name = 'A product with this name already exists.'
    if (!(num(p.bodyWeightGram) > 0)) e.bodyWeightGram = 'Enter a weight greater than 0.'
    if (!(num(p.ratePerKg) > 0)) e.ratePerKg = 'Enter a rate greater than 0.'
    if (!(num(p.avgProduction) > 0)) e.avgProduction = 'Enter production greater than 0.'
    if (num(p.gstPercent) > 100) e.gstPercent = 'GST cannot exceed 100%.'
    setErrors(e)
    return !Object.keys(e).length
  }

  const save = () => {
    if (!validate()) return
    onSave({ ...p, name: p.name.trim() })
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={initial ? `Edit ${T.short} Product` : `Add ${T.short} Product`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={Save} onClick={save}>
            Save Product
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <label className="flex flex-col gap-1.5 col-span-2">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
            {L.name} <span className="text-red-400">*</span>
          </span>
          <input type="text" value={p.name} onChange={(e) => up('name', e.target.value)} placeholder={L.namePlaceholder} className={`${inputCls} ${errors.name ? 'border-red-500/70' : ''}`} />
          {errors.name && <span className="text-[11px] text-red-400">{errors.name}</span>}
        </label>
        <Field label="Costing Date" type="date" value={p.date} onChange={(v) => up('date', v)} className="col-span-2 sm:col-span-1" />
        <Field label={L.bodyWeightGram} suffix="gram" required value={p.bodyWeightGram} onChange={(v) => up('bodyWeightGram', v)} error={errors.bodyWeightGram} />
        <Field label={L.ratePerKg} prefix="₹" required value={p.ratePerKg} onChange={(v) => up('ratePerKg', v)} error={errors.ratePerKg} />
        <Field label={L.rawQtyKg} suffix="KG" value={p.rawQtyKg} onChange={(v) => up('rawQtyKg', v)} hint={c.unitsFromRawQty ? `Enough for ~${num2(c.unitsFromRawQty, 0)} ${T.units}` : 'Stock reference'} />
        <Field label={L.gstPercent} suffix="%" value={p.gstPercent} onChange={(v) => up('gstPercent', v)} error={errors.gstPercent} />
        <Field label={L.avgProduction} suffix={T.units} required value={p.avgProduction} onChange={(v) => up('avgProduction', v)} error={errors.avgProduction} />
        <Field label={L.sellingPrice} prefix="₹" value={p.sellingPrice} onChange={(v) => up('sellingPrice', v)} />
        <Field label={L.additionalCost} prefix="₹" value={p.additionalCost} onChange={(v) => up('additionalCost', v)} hint={L.additionalHint} className="col-span-2 sm:col-span-3" />
      </div>

      <div className="mt-4 bg-yellow-500/5 border border-yellow-500/30 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-yellow-400/90 uppercase tracking-wide">Manual Override — {L.finalCost} (optional)</div>
          <p className="text-slate-500 text-xs mt-1">Leave blank to use the automatic formula. A value here replaces the calculated final cost for this product.</p>
        </div>
        <div className="relative sm:w-44">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">₹</span>
          <input
            type="text"
            inputMode="decimal"
            value={p.finalCostOverride}
            onChange={(e) => up('finalCostOverride', e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder={num2(c.autoFinalCostPerBody)}
            className={`${inputCls} pl-7 border-yellow-500/40`}
          />
        </div>
      </div>

      <label className="flex flex-col gap-1.5 mt-4">
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Notes (optional)</span>
        <textarea rows={2} value={p.notes || ''} onChange={(e) => up('notes', e.target.value)} className={inputCls} placeholder="Mould no., colour, customer, remarks…" />
      </label>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Mini label="Material (ex GST)" value={currency(c.materialAmountPerBody)} />
        <Mini label="Material incl. GST" value={currency(c.materialTotalInclGst)} />
        <Mini label={`Fixed Cost / ${L.perUnit}`} value={currency(c.fixedCostPerBody)} />
        <Mini label={`${L.finalCost}${c.hasOverride ? ' (manual)' : ''}`} value={currency(c.finalCostPerBody)} hl />
        <Mini label="GST Price" value={currency(c.gstPriceDisplay)} />
        <Mini label="Without GST Price" value={currency(c.withoutGstPrice)} />
        <Mini label={`Profit / ${L.perUnit}`} value={c.hasSellingPrice ? currency(c.profitPerBody) : '—'} tone={c.hasSellingPrice ? (c.profitPerBody >= 0 ? 'good' : 'bad') : ''} />
        <Mini label="Margin" value={c.hasSellingPrice ? num2(c.marginPercent, 1) + '%' : '—'} tone={c.hasSellingPrice ? (c.marginPercent >= 0 ? 'good' : 'bad') : ''} />
      </div>
    </Modal>
  )
}

function Mini({ label, value, hl, tone }) {
  const cls = hl ? 'bg-gold-500/10 border-gold-500/40 text-gold-400' : tone === 'good' ? 'bg-navy-950 border-slate-700 text-emerald-400' : tone === 'bad' ? 'bg-navy-950 border-slate-700 text-red-400' : 'bg-navy-950 border-slate-700 text-slate-100'
  return (
    <div className={`rounded-xl px-3 py-2 border ${cls}`}>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 leading-tight">{label}</div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  )
}
