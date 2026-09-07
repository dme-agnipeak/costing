export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="sticky top-[65px] z-10 bg-navy-950/90 backdrop-blur border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${
              active === t.id
                ? 'border-gold-500 text-gold-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
