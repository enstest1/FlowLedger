// Canton token acquisition — two modes:
//   "self-signed"          LocalNet / cn-quickstart — sign a JWT locally, no auth server needed
//   "client-credentials"   DevNet / NaaS / MainNet  — fetch token from your OAuth2 provider

import { SignJWT } from 'jose'

type AuthMode = 'self-signed' | 'client-credentials'

interface TokenCache {
  token: string
  expiresAt: number
}

let cache: TokenCache | null = null

export async function getCantonToken(): Promise<string> {
  // Return cached token if still valid (with 60-second buffer)
  if (cache && Date.now() < cache.expiresAt - 60_000) {
    return cache.token
  }

  const mode = (process.env.CANTON_AUTH_MODE ?? 'self-signed') as AuthMode
  const token = mode === 'client-credentials'
    ? await fetchOAuth2Token()
    : await makeSelfSignedToken()

  // Cache for 55 minutes (tokens are typically 1-hour)
  cache = { token, expiresAt: Date.now() + 55 * 60 * 1000 }
  return token
}

// LocalNet only — signs a JWT with a shared HMAC secret, no auth server required
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

// DevNet / NaaS — OAuth2 client credentials grant
async function fetchOAuth2Token(): Promise<string> {
  const tokenUrl = process.env.CANTON_AUTH_TOKEN_URL
  const clientId = process.env.CANTON_AUTH_CLIENT_ID
  const clientSecret = process.env.CANTON_AUTH_CLIENT_SECRET
  const audience = process.env.CANTON_AUTH_AUDIENCE

  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error(
      'CANTON_AUTH_TOKEN_URL, CANTON_AUTH_CLIENT_ID and CANTON_AUTH_CLIENT_SECRET are required for client-credentials auth mode'
    )
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    ...(audience ? { audience } : {}),
  })

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Canton OAuth2 token request failed ${res.status}: ${text}`)
  }

  const data = await res.json() as { access_token: string }
  return data.access_token
}
