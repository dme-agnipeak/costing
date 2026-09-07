export default function Field({ label, suffix, value, onChange, type = 'number', step = 'any', min, disabled, placeholder }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</span>
      <div className="relative">
        <input
          type={type}
          step={step}
          min={min}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(type === 'number' ? e.target.value : e.target.value)}
          className="w-full rounded-lg bg-navy-800/70 border border-slate-700 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 text-slate-100 text-sm px-3 py-2.5 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{suffix}</span>
        )}
      </div>
    </label>
  )
}
