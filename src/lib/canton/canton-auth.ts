// Canton token acquisition.
// - self-signed: LocalNet / cn-quickstart only
// - client-credentials: hosted DevNet/TestNet/MainNet OAuth2
// - CANTON_AUTH_BEARER_TOKEN: optional short-lived diagnostic/provider token

import { SignJWT } from 'jose'

type AuthMode = 'self-signed' | 'client-credentials'

interface TokenCache {
  token: string
  expiresAt: number
}

interface OAuthTokenResponse {
  access_token?: string
  expires_in?: number
}

let cache: TokenCache | null = null

export async function getCantonToken(): Promise<string> {
  const suppliedToken = process.env.CANTON_AUTH_BEARER_TOKEN?.trim()
  if (suppliedToken) return suppliedToken

  if (cache && Date.now() < cache.expiresAt - 60_000) {
    return cache.token
  }
  const mode = (process.env.CANTON_AUTH_MODE ?? 'self-signed') as AuthMode
  const response = mode === 'client-credentials'
    ? await fetchOAuth2Token()
    : { token: await makeSelfSignedToken(), ttlMs: 55 * 60 * 1000 }

  cache = {
    token: response.token,
    expiresAt: Date.now() + response.ttlMs,
  }
  return response.token
}

// LocalNet only. Do not use a shared HMAC secret for hosted production validators.
async function makeSelfSignedToken(): Promise<string> {
  const secret = new TextEncoder().encode(
    process.env.CANTON_AUTH_SECRET ?? 'localnet-dev-secret'
  )

  return new SignJWT({
    sub: process.env.CANTON_AUTH_SUBJECT ?? 'ledger-api-user',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(process.env.CANTON_AUTH_AUDIENCE ?? 'https://canton.network.global')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)
}
async function fetchOAuth2Token(): Promise<{ token: string; ttlMs: number }> {
  const tokenUrl = process.env.CANTON_AUTH_TOKEN_URL
  const clientId = process.env.CANTON_AUTH_CLIENT_ID
  const clientSecret = process.env.CANTON_AUTH_CLIENT_SECRET
  const audience = process.env.CANTON_AUTH_AUDIENCE
  const scope = process.env.CANTON_AUTH_SCOPE
  const clientAuth = process.env.CANTON_AUTH_CLIENT_AUTH ?? 'body'

  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error(
      'CANTON_AUTH_TOKEN_URL, CANTON_AUTH_CLIENT_ID and CANTON_AUTH_CLIENT_SECRET are required for client-credentials auth mode'
    )
  }

  if (clientAuth !== 'body' && clientAuth !== 'basic') {
    throw new Error('CANTON_AUTH_CLIENT_AUTH must be "body" or "basic"')
  }

  const body = new URLSearchParams({ grant_type: 'client_credentials' })
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  if (clientAuth === 'basic') {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
  } else {
    body.set('client_id', clientId)
    body.set('client_secret', clientSecret)
  }
  if (audience) body.set('audience', audience)
  if (scope) body.set('scope', scope)

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Canton OAuth2 token request failed ${res.status}: ${text}`)
  }

  const data = await res.json() as OAuthTokenResponse
  if (!data.access_token) {
    throw new Error('Canton OAuth2 token response did not include access_token')
  }

  const ttlSeconds = Number.isFinite(data.expires_in) && (data.expires_in ?? 0) > 120
    ? Number(data.expires_in)
    : 3600

  return {
    token: data.access_token,
    // Keep at least a 60-second safety margin via the cache check above.
    ttlMs: ttlSeconds * 1000,
  }
}
