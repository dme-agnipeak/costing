import { useState, useEffect } from 'react'
import Field from './Field'
import { computeProduct, currency, num2 } from '../lib/calculations'
import { Save, X } from 'lucide-react'

export function blankProduct() {
  return {
    id: crypto.randomUUID(),
    date: new Date().toISOString().slice(0, 10),
    name: '',
    ratePerKg: '',
    rawQtyKg: '',
    gstPercent: 18,
    bodyWeightGram: '',
    avgProduction: '',
    sellingPrice: '',
    finalCostOverride: '',
  }
}

export default function ProductForm({ initial, fixedCostPerMachinePerDay, onSave, onCancel }) {
  const [product, setProduct] = useState(initial || blankProduct())

  useEffect(() => {
    setProduct(initial || blankProduct())
  }, [initial])

  const update = (key, val) => setProduct((p) => ({ ...p, [key]: val }))
  const c = computeProduct(product, fixedCostPerMachinePerDay)

  return (
    <div className="bg-navy-800/60 border border-gold-500/30 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-slate-100 font-semibold">{initial ? 'Edit Product' : 'Add New Product / Body'}</h3>
        {onCancel && (
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <label className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Product / Body Name</span>
          <input
            type="text"
            value={product.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="e.g. 63mm Body"
            className="w-full rounded-lg bg-navy-800/70 border border-slate-700 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 text-slate-100 text-sm px-3 py-2.5 outline-none"
          />
        </label>
        <Field label="Date" type="date" value={product.date} onChange={(v) => update('date', v)} />
        <Field label="Body Weight" suffix="gram" value={product.bodyWeightGram} onChange={(v) => update('bodyWeightGram', v)} />
        <Field label="Rate per KG" suffix="₹" value={product.ratePerKg} onChange={(v) => update('ratePerKg', v)} />
        <Field label="Raw Qty" suffix="KG" value={product.rawQtyKg} onChange={(v) => update('rawQtyKg', v)} />
        <Field label="GST %" suffix="%" value={product.gstPercent} onChange={(v) => update('gstPercent', v)} />
        <Field
          label="Avg Production"
          suffix="bodies"
          value={product.avgProduction}
          onChange={(v) => update('avgProduction', v)}
        />
        <Field label="Selling Price / Body" suffix="₹" value={product.sellingPrice} onChange={(v) => update('sellingPrice', v)} />
      </div>

      {/* Manual override */}
      <div className="mt-4 bg-yellow-500/5 border border-yellow-500/30 rounded-xl p-3.5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-[220px] flex-1">
            <span className="text-xs font-medium text-yellow-400/90 uppercase tracking-wide">
              Manual Override — Final Cost / Body (optional)
            </span>
            <p className="text-slate-500 text-xs mt-1">
              Khali chhodo to automatic formula se calculate hoga (Fixed Cost/Body + Material Total incl. GST). Yahan value daaloge to woh use hogi, formula bypass ho jayega.
            </p>
          </div>
          <input
            type="number"
            step="any"
            value={product.finalCostOverride}
            onChange={(e) => update('finalCostOverride', e.target.value)}
            placeholder={num2(c.autoFinalCostPerBody)}
            className="w-40 rounded-lg bg-navy-800/70 border border-yellow-500/40 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 text-slate-100 text-sm px-3 py-2.5 outline-none"
          />
        </div>
      </div>

      {/* Live preview — mirrors the sheet's Final Calculations block */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Amount (Material, before GST)" value={currency(c.materialAmountPerBody)} />
        <MiniStat label="Material Total incl. GST" value={currency(c.materialTotalInclGst)} />
        <MiniStat label="Fixed Cost / Body" value={currency(c.fixedCostPerBody)} />
        <MiniStat
          label={c.hasOverride ? 'FINAL COST / BODY (manual)' : 'FINAL COST / BODY (auto)'}
          value={currency(c.finalCostPerBody)}
          highlight
        />
        <MiniStat label="GST Price" value={currency(c.gstPriceDisplay)} />
        <MiniStat label="Without GST Price" value={currency(c.withoutGstPrice)} />
        <MiniStat
          label="Final Profit / Body"
          value={product.sellingPrice ? currency(c.profitPerBody) : '—'}
          highlight={product.sellingPrice ? true : false}
        />
      </div>

      <div className="mt-5 flex gap-3">
        <button
          onClick={() => onSave(product)}
          className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition"
        >
          <Save className="w-4 h-4" />
          Save Product
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-sm px-4 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:text-slate-100 transition"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

function MiniStat({ label, value, highlight }) {
  return (
    <div className={`rounded-xl px-3 py-2.5 border ${highlight ? 'bg-gold-500/10 border-gold-500/40' : 'bg-navy-900 border-slate-700'}`}>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-sm font-semibold mt-0.5 ${highlight ? 'text-gold-400' : 'text-slate-100'}`}>{value}</div>
    </div>
  )
}
