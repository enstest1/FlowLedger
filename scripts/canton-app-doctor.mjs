import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()
const env = { ...process.env }
const jsonMode = process.argv.includes('--json')
const buildMode = process.argv.includes('--build')
const results = []
const PASS = 'PASS', WARN = 'WARN', FAIL = 'FAIL', SKIP = 'SKIP'

function parseEnvFile(file) {
  if (!fs.existsSync(file)) return
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = raw.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match || raw.trim().startsWith('#')) continue
    let value = match[2].trim()
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1)
    env[match[1]] = value
  }
}

for (const name of ['.env', '.env.local', '.env.production.local']) {
  parseEnvFile(path.join(ROOT, name))
}
function add(name, status, detail, data = {}) {
  results.push({ name, status, detail, ...data })
  if (!jsonMode) {
    const icon = status === PASS ? '[+]' : status === FAIL ? '[x]' : status === WARN ? '[!]' : '[-]'
    console.log(`${icon} ${name}: ${status} — ${detail}`)
  }
}

function present(key) {
  const value = env[key]
  return Boolean(value && value.trim() && !/^<.*>$/.test(value.trim()))
}

function safeHost(value) {
  if (!value) return '(not set)'
  try { return new URL(value).host || '(invalid URL)' }
  catch { return '(invalid URL)' }
}

function runVersion(candidates, args) {
  for (const candidate of candidates.filter(Boolean)) {
    const res = spawnSync(candidate, args, { encoding: 'utf8', windowsHide: true })
    if (!res.error && res.status === 0) return `${res.stdout || ''}${res.stderr || ''}`.trim()
  }
  return ''
}

function firstJavaFallback() {
  const root = path.join(os.homedir(), 'tools', 'jdk17')
  if (!fs.existsSync(root)) return ''
  for (const dir of fs.readdirSync(root)) {
    const exe = path.join(root, dir, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
    if (fs.existsSync(exe)) return exe
  }
  return ''
}
const dpmFallback = path.join(os.homedir(), 'tools', 'dpm', process.platform === 'win32' ? 'dpm.exe' : 'dpm')
const dpmVersion = runVersion([env.DPM_EXE, 'dpm', fs.existsSync(dpmFallback) ? dpmFallback : ''], ['--version'])
if (dpmVersion) add('DPM toolchain', PASS, dpmVersion.split(/\r?\n/)[0], { version: dpmVersion })
else add('DPM toolchain', FAIL, 'DPM not found; install it or set DPM_EXE')

const javaVersion = runVersion([
  env.JAVA_HOME && path.join(env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'),
  'java', firstJavaFallback(),
], ['-version'])
if (/version "17\./.test(javaVersion)) add('Java runtime', PASS, javaVersion.split(/\r?\n/)[0], { version: javaVersion })
else if (javaVersion) add('Java runtime', WARN, `JDK 17 recommended; found ${javaVersion.split(/\r?\n/)[0]}`)
else add('Java runtime', FAIL, 'Java not found; JDK 17+ is required for the Daml toolchain')

const damlYaml = path.join(ROOT, 'daml', 'daml.yaml')
if (fs.existsSync(damlYaml)) {
  const text = fs.readFileSync(damlYaml, 'utf8')
  const sdk = text.match(/^sdk-version:\s*(\S+)/m)?.[1] || 'unknown'
  add('Daml project', PASS, `daml/daml.yaml found; SDK ${sdk}`, { sdkVersion: sdk })
} else add('Daml project', WARN, 'daml/daml.yaml not found')

if (buildMode && dpmVersion && fs.existsSync(damlYaml)) {
  const dpm = fs.existsSync(dpmFallback) ? dpmFallback : 'dpm'
  const build = spawnSync(dpm, ['build'], { cwd: path.dirname(damlYaml), encoding: 'utf8', windowsHide: true })
  if (build.status === 0) add('Daml build', PASS, 'dpm build completed successfully')
  else add('Daml build', FAIL, (build.stderr || build.stdout || 'dpm build failed').trim().slice(0, 300))
} else if (!buildMode) add('Daml build', SKIP, 'use --build to run the local, non-ledger Daml compile')
async function fetchTimed(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try { return await fetch(url, { ...options, signal: controller.signal }) }
  finally { clearTimeout(timer) }
}

async function getBearerToken() {
  if (present('CANTON_AUTH_BEARER_TOKEN')) return env.CANTON_AUTH_BEARER_TOKEN
  if (env.CANTON_AUTH_MODE === 'self-signed') return null
  const required = ['CANTON_AUTH_TOKEN_URL', 'CANTON_AUTH_CLIENT_ID', 'CANTON_AUTH_CLIENT_SECRET']
  const missing = required.filter((key) => !present(key))
  if (missing.length) throw new Error(`missing ${missing.join(', ')}`)
  const body = new URLSearchParams({ grant_type: 'client_credentials' })
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
  const authMethod = env.CANTON_AUTH_CLIENT_AUTH || 'body'
  if (authMethod === 'basic') {
    headers.Authorization = `Basic ${Buffer.from(`${env.CANTON_AUTH_CLIENT_ID}:${env.CANTON_AUTH_CLIENT_SECRET}`).toString('base64')}`
  } else {
    body.set('client_id', env.CANTON_AUTH_CLIENT_ID)
    body.set('client_secret', env.CANTON_AUTH_CLIENT_SECRET)
  }
  if (present('CANTON_AUTH_AUDIENCE')) body.set('audience', env.CANTON_AUTH_AUDIENCE)
  if (present('CANTON_AUTH_SCOPE')) body.set('scope', env.CANTON_AUTH_SCOPE)
  const res = await fetchTimed(env.CANTON_AUTH_TOKEN_URL, { method: 'POST', headers, body })
  if (!res.ok) throw new Error(`token endpoint returned HTTP ${res.status}`)
  const data = await res.json()
  if (!data.access_token) throw new Error('token endpoint response has no access_token')
  return data.access_token
}
async function checkJson(name, baseUrl, token, pathname) {
  if (!baseUrl) return add(name, SKIP, 'base URL not configured')
  try {
    const headers = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    const url = `${baseUrl.replace(/\/$/, '')}${pathname}`
    const res = await fetchTimed(url, { headers })
    if (!res.ok) {
      const detail = res.status === 401 || res.status === 403
        ? `HTTP ${res.status}; auth/subject/audience rejected`
        : `HTTP ${res.status}`
      return add(name, FAIL, detail, { host: safeHost(baseUrl), httpStatus: res.status })
    }
    add(name, PASS, `${safeHost(baseUrl)}${pathname} responded HTTP ${res.status}`, { httpStatus: res.status })
  } catch (error) {
    add(name, FAIL, error instanceof Error ? error.message : String(error))
  }
}

if (!jsonMode) {
  console.log('\nCanton App Readiness Doctor (read-only by default)')
  console.log('No party allocation, faucet, transfer, DAR upload, or ledger mutation is performed.\n')
}

const network = env.CANTON_NETWORK_ENV || 'mock'
if (network === 'mock') add('Network mode', WARN, 'CANTON_NETWORK_ENV=mock; live Canton calls are disabled')
else add('Network mode', PASS, network)

const partyId = present('CANTON_PARTY_ID') ? env.CANTON_PARTY_ID : ''
if (partyId.includes('::')) add('Application Party ID', PASS, `${partyId.slice(0, 18)}…`)
else add('Application Party ID', FAIL, 'CANTON_PARTY_ID is missing or not a Canton Party ID')
const ledgerUrl = present('CANTON_LEDGER_URL') ? env.CANTON_LEDGER_URL : ''
const validatorUrl = present('CANTON_VALIDATOR_URL') ? env.CANTON_VALIDATOR_URL : ''
const scanUrl = present('CANTON_SCAN_URL') ? env.CANTON_SCAN_URL : ''
const registryUrl = present('CANTON_TOKEN_REGISTRY_URL') ? env.CANTON_TOKEN_REGISTRY_URL : ''

if (ledgerUrl) add('Ledger URL config', PASS, safeHost(ledgerUrl))
else add('Ledger URL config', FAIL, 'CANTON_LEDGER_URL is missing')
if (registryUrl) add('Token registry config', PASS, safeHost(registryUrl))
else add('Token registry config', FAIL, 'CANTON_TOKEN_REGISTRY_URL is missing')
if (validatorUrl) add('Validator URL config', PASS, safeHost(validatorUrl))
else add('Validator URL config', WARN, 'not configured; optional for the core app transaction path')
if (scanUrl) add('Scan URL config', PASS, safeHost(scanUrl))
else add('Scan URL config', WARN, 'not configured; useful for public evidence and troubleshooting')

let token = null
try {
  token = await getBearerToken()
  if (token) add('Authentication', PASS, 'bearer token obtained; secret/token value suppressed')
  else add('Authentication', WARN, 'self-signed mode configured; hosted-network checks need a bearer token')
} catch (error) {
  add('Authentication', FAIL, error instanceof Error ? error.message : String(error))
}

if (token) await checkJson('Ledger API', ledgerUrl, token, '/v2/version')
else add('Ledger API', SKIP, 'no bearer token available')
await checkJson('Token registry', registryUrl, token, '/registry/metadata/v1/instruments')
if (scanUrl) await checkJson('Scan API', scanUrl, null, '/api/scan/version')
else add('Scan API', SKIP, 'Scan URL not configured')
const failures = results.filter((result) => result.status === FAIL)
const warnings = results.filter((result) => result.status === WARN)
const summary = {
  ready: network !== 'mock' && failures.length === 0,
  network,
  counts: {
    pass: results.filter((result) => result.status === PASS).length,
    warn: warnings.length,
    fail: failures.length,
    skip: results.filter((result) => result.status === SKIP).length,
  },
}

if (jsonMode) {
  console.log(JSON.stringify({ tool: 'canton-app-doctor', summary, results }, null, 2))
} else {
  console.log('\nReadiness summary')
  console.log(`  ${summary.counts.pass} pass`)
  console.log(`  ${summary.counts.warn} warning(s)`)
  console.log(`  ${summary.counts.fail} failure(s)`)
  console.log(`  ${summary.counts.skip} skipped`)
  if (summary.ready) console.log('\nREADY for an explicit DevNet smoke transaction.')
  else console.log('\nNOT READY for a real Canton application transaction yet.')
}

if (!summary.ready) process.exitCode = 2
