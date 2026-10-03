import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const env = { ...process.env }

function parseEnvFile(file) {
  if (!fs.existsSync(file)) return
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    env[match[1]] = value
  }
}

// Next-style precedence for local diagnostics.
parseEnvFile(path.join(ROOT, '.env'))
parseEnvFile(path.join(ROOT, '.env.local'))
parseEnvFile(path.join(ROOT, '.env.production.local'))

const PASS = 'PASS'
const WARN = 'WARN'
const FAIL = 'FAIL'
const SKIP = 'SKIP'
const results = []
function add(name, status, detail) {
  results.push({ name, status, detail })
  const icon = status === PASS ? '[+]' : status === FAIL ? '[x]' : status === WARN ? '[!]' : '[-]'
  console.log(`${icon} ${name}: ${status} — ${detail}`)
}

function present(key) {
  const value = env[key]
  return Boolean(value && value.trim() && !/^<.*>$/.test(value.trim()))
}

function safeHost(value) {
  if (!value) return '(not set)'
  try { return new URL(value).host || '(invalid URL)' } catch { return '(invalid URL)' }
}

async function fetchTimed(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function getBearerToken() {
  if (present('CANTON_AUTH_BEARER_TOKEN')) return env.CANTON_AUTH_BEARER_TOKEN
  if (env.CANTON_AUTH_MODE === 'self-signed') return null
  const required = ['CANTON_AUTH_TOKEN_URL', 'CANTON_AUTH_CLIENT_ID', 'CANTON_AUTH_CLIENT_SECRET']
  const missing = required.filter((key) => !present(key))
  if (missing.length) throw new Error(`missing ${missing.join(', ')}`)

  const params = new URLSearchParams({ grant_type: 'client_credentials' })
  const clientAuth = env.CANTON_AUTH_CLIENT_AUTH || 'body'
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }

  if (clientAuth === 'basic') {
    headers.Authorization = `Basic ${Buffer.from(`${env.CANTON_AUTH_CLIENT_ID}:${env.CANTON_AUTH_CLIENT_SECRET}`).toString('base64')}`
  } else {
    params.set('client_id', env.CANTON_AUTH_CLIENT_ID)
    params.set('client_secret', env.CANTON_AUTH_CLIENT_SECRET)
  }
  if (present('CANTON_AUTH_AUDIENCE')) params.set('audience', env.CANTON_AUTH_AUDIENCE)
  if (present('CANTON_AUTH_SCOPE')) params.set('scope', env.CANTON_AUTH_SCOPE)

  const res = await fetchTimed(env.CANTON_AUTH_TOKEN_URL, { method: 'POST', headers, body: params })
  if (!res.ok) throw new Error(`token endpoint returned HTTP ${res.status}: ${(await res.text()).slice(0, 180)}`)
  const data = await res.json()
  if (!data.access_token) throw new Error('token endpoint response has no access_token')
  return data.access_token
}

async function checkJson(name, url, token, pathName) {
  if (!url) return add(name, SKIP, 'base URL not configured')
  try {
    const base = url.replace(/\/$/, '')
    const headers = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetchTimed(`${base}${pathName}`, { headers })
    const text = await res.text()
    if (!res.ok) {
      const hint = res.status === 401 || res.status === 403 ? 'auth/subject/audience rejected' : text.slice(0, 140)
      return add(name, FAIL, `HTTP ${res.status}; ${hint}`)
    }
    add(name, PASS, `${safeHost(url)}${pathName} responded HTTP ${res.status}`)
  } catch (err) {
    add(name, FAIL, err instanceof Error ? err.message : String(err))
  }
}

console.log('\nFlowLedger Canton connection doctor (read-only)')
console.log('No transactions, party allocations, transfers, or faucet calls are performed.\n')

const network = env.CANTON_NETWORK_ENV || 'mock'
if (network === 'mock') add('Network mode', WARN, 'CANTON_NETWORK_ENV=mock; live Canton calls are disabled')
else add('Network mode', PASS, network)

const partyId = present('CANTON_PARTY_ID') ? env.CANTON_PARTY_ID : ''
if (partyId && partyId.includes('::')) add('Treasury Party ID', PASS, `${partyId.slice(0, 18)}…`)
else add('Treasury Party ID', FAIL, 'CANTON_PARTY_ID is missing; Featured App form also requires a real Party ID')
const ledgerUrl = present('CANTON_LEDGER_URL') ? env.CANTON_LEDGER_URL : ''
const validatorUrl = present('CANTON_VALIDATOR_URL') ? env.CANTON_VALIDATOR_URL : ''
const scanUrl = present('CANTON_SCAN_URL') ? env.CANTON_SCAN_URL : ''

if (ledgerUrl) add('Ledger URL config', PASS, safeHost(ledgerUrl))
else add('Ledger URL config', FAIL, 'CANTON_LEDGER_URL is missing')
if (validatorUrl) add('Validator URL config', PASS, safeHost(validatorUrl))
else add('Validator URL config', WARN, 'not configured; Ledger API is the primary app integration')
if (scanUrl) add('Scan URL config', PASS, safeHost(scanUrl))
else add('Scan URL config', WARN, 'not configured; optional for public/global network data')

let token = null
try {
  token = await getBearerToken()
  if (token) add('Authentication', PASS, 'obtained a bearer token (token value not printed)')
  else add('Authentication', WARN, 'self-signed mode is configured; doctor will not mint a local JWT')
} catch (err) {
  add('Authentication', FAIL, err instanceof Error ? err.message : String(err))
}

if (token) {
  await checkJson('Ledger API', ledgerUrl, token, '/v2/version')
  // Diagnostic only. The Validator wallet API is not an app integration contract.
  await checkJson('Validator API auth', validatorUrl, token, '/v0/wallet/user-status')
} else {
  add('Ledger API', SKIP, 'no bearer token available')
  add('Validator API auth', SKIP, 'no bearer token available')
}

await checkJson('Scan API', scanUrl, null, '/api/scan/version')
const failures = results.filter((r) => r.status === FAIL)
const warnings = results.filter((r) => r.status === WARN)

console.log('\nReadiness summary')
console.log(`  ${results.filter((r) => r.status === PASS).length} pass`)
console.log(`  ${warnings.length} warning(s)`)
console.log(`  ${failures.length} failure(s)`)

if (network === 'mock' || failures.length) {
  console.log('\nNOT READY for a real validator yet.')
  console.log('Next input must come from your validator host/operator: Ledger API URL, auth method/credentials, and your hosted Party ID.')
  console.log('Do not submit the Featured App form with a placeholder Party ID.')
  process.exitCode = 2
} else {
  console.log('\nConnection checks passed. Next: execute a DevNet Token Standard smoke transaction and capture its Update ID as evidence.')
}
