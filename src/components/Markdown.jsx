// Minimal, safe markdown renderer for assistant replies (no HTML injection).
function inline(text, keyBase = '') {
  const out = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\)|https?:\/\/[^\s)]+)/g
  let last = 0
  let m
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const t = m[0]
    const k = keyBase + '-' + i++
    if (t.startsWith('**')) out.push(<strong key={k} className="text-white font-semibold">{t.slice(2, -2)}</strong>)
    else if (t.startsWith('`')) out.push(<code key={k} className="px-1 py-0.5 rounded bg-navy-950 text-[0.85em]">{t.slice(1, -1)}</code>)
    else if (t.startsWith('[')) {
      const label = t.slice(1, t.indexOf(']'))
      out.push(<a key={k} href={m[2]} target="_blank" rel="noreferrer" className="text-gold-400 underline break-all">{label}</a>)
    } else out.push(<a key={k} href={t} target="_blank" rel="noreferrer" className="text-gold-400 underline break-all">{t.length > 48 ? 'Open link' : t}</a>)
    last = m.index + t.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export default function Markdown({ text }) {
  const lines = String(text || '').split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) rows.push(lines[i].trim().slice(1, -1).split('|').map((c) => c.trim()))
        i++
      }
      const [head, ...body] = rows
      blocks.push(
        <div key={'t' + i} className="overflow-x-auto my-2 -mx-1">
          <table className="text-xs min-w-full border-collapse">
            <thead>
              <tr>{head.map((h, j) => <th key={j} className="text-left font-semibold text-slate-300 px-2 py-1.5 border-b border-slate-700 whitespace-nowrap">{inline(h, 'h' + j)}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri} className="border-b border-slate-800">
                  {r.map((c, j) => <td key={j} className={`px-2 py-1.5 whitespace-nowrap ${j > 0 && /^[-₹\d.,%\s(Rs)]+$/.test(c) ? 'text-right' : ''}`}>{inline(c, 'c' + ri + j)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*•]\s+/, ''))
      blocks.push(<ul key={'u' + i} className="list-disc pl-5 space-y-0.5 my-1">{items.map((t, j) => <li key={j}>{inline(t, 'u' + i + j)}</li>)}</ul>)
      continue
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''))
      blocks.push(<ol key={'o' + i} className="list-decimal pl-5 space-y-0.5 my-1">{items.map((t, j) => <li key={j}>{inline(t, 'o' + i + j)}</li>)}</ol>)
      continue
    }
    const h = line.match(/^(#{1,4})\s+(.*)/)
    if (h) {
      blocks.push(<div key={'h' + i} className="font-semibold text-white mt-2 mb-1">{inline(h[2], 'hh' + i)}</div>)
      i++
      continue
    }
    if (line.trim()) blocks.push(<p key={'p' + i} className="my-1">{inline(line, 'p' + i)}</p>)
    i++
  }
  return <div className="text-sm leading-relaxed break-words">{blocks}</div>
}
