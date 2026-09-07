import Field from './Field'
import { currency, computeTotalFixedCost } from '../lib/calculations'
import { Lock, Unlock } from 'lucide-react'
import { useState } from 'react'

const FIELDS = [
  { key: 'electricity', label: 'Electricity Cost' },
  { key: 'rent', label: 'Factory Rent' },
  { key: 'operatorSalary', label: 'Operator Salary' },
  { key: 'labour', label: 'Labour Cost' },
  { key: 'misc', label: 'MSC (Misc.)' },
  { key: 'otherFixed', label: 'Other Fixed Cost' },
]

export default function FixedCostSetup({ fixedCosts, setFixedCosts }) {
  const [locked, setLocked] = useState(true)
  const total = computeTotalFixedCost(fixedCosts)

  const update = (key, val) => setFixedCosts({ ...fixedCosts, [key]: val })

  return (
    <div className="bg-navy-800/40 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-slate-100 font-semibold">Monthly Fixed Cost Setup</h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Ye data ek baar set karo — future me kabhi bhi edit kar sakte ho. Yellow-cell jaisa data entry.
          </p>
        </div>
        <button
          onClick={() => setLocked((l) => !l)}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition ${
            locked
              ? 'border-slate-700 text-slate-400 hover:text-slate-200'
              : 'border-gold-500 text-gold-400 bg-gold-500/10'
          }`}
        >
          {locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          {locked ? 'Locked' : 'Editing'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5">
        {FIELDS.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            suffix="₹"
            value={fixedCosts[f.key]}
            disabled={locked}
            onChange={(v) => update(f.key, v)}
          />
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between bg-navy-900 border border-gold-500/30 rounded-xl px-4 py-3.5">
        <span className="text-slate-300 text-sm font-medium">TOTAL MONTHLY FIXED COST</span>
        <span className="text-gold-400 font-bold text-lg">{currency(total)}</span>
      </div>
    </div>
  )
}
