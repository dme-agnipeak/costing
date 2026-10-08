// Provider adapters: Claude (Anthropic), ChatGPT (OpenAI) and Gemini (Google).
// All three are called directly from the browser with the user's own API key.
// Canonical message format used by the agent:
//   { role: 'user', text }
//   { role: 'assistant', text, toolCalls: [{ id, name, args }], raw }
//   { role: 'tool', results: [{ id, name, result }] }

async function readError(res) {
  let msg = `HTTP ${res.status}`
  try {
    const j = await res.json()
    msg = j.error?.message || j.message || JSON.stringify(j).slice(0, 300)
  } catch {
    /* ignore */
  }
  if (res.status === 401 || res.status === 403) return 'The API key was rejected. Please check it in Settings → AI Assistant. (' + msg + ')'
  if (res.status === 404) return 'Model not found. Choose another model in Settings → AI Assistant. (' + msg + ')'
  if (res.status === 429) return 'Rate limit or quota reached on your API account. Please wait and try again. (' + msg + ')'
  return msg
}

// ---------------------------------------------------------------- Anthropic
async function callAnthropic({ key, model, system, messages, tools, signal }) {
  const msgs = []
  for (const m of messages) {
    if (m.role === 'user') msgs.push({ role: 'user', content: m.text })
    else if (m.role === 'assistant') {
      const content = []
      if (m.text) content.push({ type: 'text', text: m.text })
      for (const c of m.toolCalls || []) content.push({ type: 'tool_use', id: c.id, name: c.name, input: c.args || {} })
      if (content.length) msgs.push({ role: 'assistant', content })
    } else if (m.role === 'tool') {
      msgs.push({
        role: 'user',
        content: m.results.map((r) => ({ type: 'tool_result', tool_use_id: r.id, content: JSON.stringify(r.result), is_error: !!r.result?.error })),
      })
    }
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: msgs,
      tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
    }),
  })
  if (!res.ok) throw new Error(await readError(res))
  const j = await res.json()
  const text = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
  const toolCalls = (j.content || []).filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: b.name, args: b.input || {} }))
  return { text, toolCalls }
}

// ---------------------------------------------------------------- OpenAI
async function callOpenAI({ key, model, system, messages, tools, signal }) {
  const msgs = [{ role: 'system', content: system }]
  for (const m of messages) {
    if (m.role === 'user') msgs.push({ role: 'user', content: m.text })
    else if (m.role === 'assistant') {
      const out = { role: 'assistant', content: m.text || null }
      if (m.toolCalls?.length)
        out.tool_calls = m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args || {}) } }))
      msgs.push(out)
    } else if (m.role === 'tool') {
      for (const r of m.results) msgs.push({ role: 'tool', tool_call_id: r.id, content: JSON.stringify(r.result) })
    }
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model,
      messages: msgs,
      tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
      max_completion_tokens: 4096,
    }),
  })
  if (!res.ok) throw new Error(await readError(res))
  const j = await res.json()
  const msg = j.choices?.[0]?.message || {}
  const toolCalls = (msg.tool_calls || []).map((c) => {
    let args = {}
    try {
      args = JSON.parse(c.function.arguments || '{}')
    } catch {
      /* ignore */
    }
    return { id: c.id, name: c.function.name, args }
  })
  return { text: (msg.content || '').trim(), toolCalls }
}

// ---------------------------------------------------------------- Gemini
async function callGemini({ key, model, system, messages, tools, signal }) {
  const contents = []
  for (const m of messages) {
    if (m.role === 'user') contents.push({ role: 'user', parts: [{ text: m.text }] })
    else if (m.role === 'assistant') {
      // Re-send the original parts so Gemini's thought signatures are preserved
      if (m.raw?.length) contents.push({ role: 'model', parts: m.raw })
      else {
        const parts = []
        if (m.text) parts.push({ text: m.text })
        for (const c of m.toolCalls || []) parts.push({ functionCall: { name: c.name, args: c.args || {} } })
        if (parts.length) contents.push({ role: 'model', parts })
      }
    } else if (m.role === 'tool') {
      contents.push({
        role: 'user',
        parts: m.results.map((r) => ({ functionResponse: { name: r.name, ...(r.gid ? { id: r.gid } : {}), response: { result: r.result } } })),
      })
    }
  }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      tools: [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }],
      generationConfig: { maxOutputTokens: 4096 },
    }),
  })
  if (!res.ok) throw new Error(await readError(res))
  const j = await res.json()
  const cand = j.candidates?.[0]
  if (!cand) throw new Error(j.promptFeedback?.blockReason ? 'Request blocked: ' + j.promptFeedback.blockReason : 'Empty response from Gemini')
  const parts = cand.content?.parts || []
  const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('').trim()
  const toolCalls = parts
    .filter((p) => p.functionCall)
    .map((p, i) => ({ id: p.functionCall.id || `g${Date.now()}_${i}`, gid: p.functionCall.id, name: p.functionCall.name, args: p.functionCall.args || {} }))
  return { text, toolCalls, raw: parts }
}

export const PROVIDER_CALLS = { anthropic: callAnthropic, openai: callOpenAI, gemini: callGemini }

export async function testProvider(provider, key, model) {
  const r = await PROVIDER_CALLS[provider]({
    key,
    model,
    system: 'You are a connection test. Reply with the single word OK.',
    messages: [{ role: 'user', text: 'Test' }],
    tools: [{ name: 'noop', description: 'Does nothing', parameters: { type: 'object', properties: { x: { type: 'string' } } } }],
  })
  return r.text || 'OK'
}
