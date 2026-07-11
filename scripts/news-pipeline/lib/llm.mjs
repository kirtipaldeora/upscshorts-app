// LLM engine abstraction.
//  - api: Anthropic Messages API (needs ANTHROPIC_API_KEY) — used in CI.
//  - cli: `claude -p` headless mode (uses the local Claude Code login) — used
//    for local runs so no API key has to live on this machine.

import { spawn } from 'node:child_process'

const API_MODELS = { fast: 'claude-haiku-4-5-20251001', smart: 'claude-sonnet-5' }
const CLI_MODELS = { fast: 'haiku', smart: 'sonnet' }

export function resolveEngine(pref = 'auto') {
  if (pref === 'api' || (pref === 'auto' && process.env.ANTHROPIC_API_KEY)) return 'api'
  return 'cli'
}

function cliBinary() {
  return process.env.CLAUDE_CLI || process.env.CLAUDE_CODE_EXECPATH || 'claude'
}

async function callApi({ prompt, system, tier, maxTokens }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: API_MODELS[tier],
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  return data.content.map(c => c.text || '').join('')
}

function callCli({ prompt, system, tier }) {
  return new Promise((resolve, reject) => {
    // Plain text-in/text-out: no tools (the model must answer inline, never
    // "save to a file"), and a high output ceiling so long articles don't truncate.
    const args = ['-p', '--model', CLI_MODELS[tier], '--disallowedTools', 'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Task', 'TodoWrite', 'NotebookEdit']
    if (system) args.push('--append-system-prompt', system)
    const child = spawn(cliBinary(), args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, CLAUDE_CODE_MAX_OUTPUT_TOKENS: '32000' },
    })
    let out = ''
    let err = ''
    child.stdout.on('data', d => { out += d })
    child.stderr.on('data', d => { err += d })
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) resolve(out.trim())
      else reject(new Error(`claude CLI exited ${code}: ${err.slice(0, 300)}`))
    })
    child.stdin.write(prompt)
    child.stdin.end()
  })
}

export async function callLLM({ prompt, system = '', tier = 'fast', maxTokens = 8000, engine = 'auto', retries = 1 }) {
  const resolved = resolveEngine(engine)
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return resolved === 'api'
        ? await callApi({ prompt, system, tier, maxTokens })
        : await callCli({ prompt, system, tier })
    } catch (err) {
      lastErr = err
      console.warn(`  [llm] attempt ${attempt + 1} failed: ${err.message}`)
    }
  }
  throw lastErr
}

// Models sometimes wrap JSON in prose or fences; dig it out.
export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidates = [fenced?.[1], text]
  for (const c of candidates) {
    if (!c) continue
    const start = Math.min(...['[', '{'].map(ch => { const i = c.indexOf(ch); return i === -1 ? Infinity : i }))
    if (!Number.isFinite(start)) continue
    for (let end = c.length; end > start; end--) {
      const slice = c.slice(start, end).trim()
      if (!slice.endsWith(']') && !slice.endsWith('}')) continue
      try { return JSON.parse(slice) } catch { /* keep shrinking */ }
    }
  }
  throw new Error(`No parseable JSON in LLM output (first 200 chars: ${text.slice(0, 200)})`)
}
