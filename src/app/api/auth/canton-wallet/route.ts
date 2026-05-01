import { NextRequest, NextResponse } from 'next/server'
import { createPublicKey, verify as cryptoVerify } from 'crypto'
import { prisma } from '@/lib/prisma'

// POST /api/auth/canton-wallet
// Body: { partyId: string, signature: string, nonce: string, publicKey: string }
//
// Flow:
//   1. Client calls GET /api/auth/canton-wallet/nonce to get a fresh nonce
//   2. Client signs `FlowLedger auth: <nonce>` with their Canton wallet (CIP-103 signMessage)
//   3. Client POSTs partyId + signature + nonce + publicKey
//   4. Server verifies signature before creating a session
//
// Signature verification is controlled by CANTON_VERIFY_SIGNATURES env var.
// Set to "true" in production. Leave unset for DevNet/LocalNet testing.

const VERIFY = process.env.CANTON_VERIFY_SIGNATURES === 'true'
const NONCE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function verifyCantonSignature(message: string, signatureHex: string, publicKeyHex: string): boolean {
  try {
    // Canton wallets use Ed25519. The public key is expected as a hex-encoded
    // DER SPKI blob. The signature is a hex-encoded raw Ed25519 signature.
    const pubKeyDer = Buffer.from(publicKeyHex, 'hex')
    const publicKey = createPublicKey({ key: pubKeyDer, format: 'der', type: 'spki' })
    const sig = Buffer.from(signatureHex, 'hex')
    return cryptoVerify(null, Buffer.from(message), publicKey, sig)
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body?.partyId) {
    return NextResponse.json({ error: 'partyId is required' }, { status: 400 })
  }

  const { partyId, signature, nonce, publicKey } = body as {
    partyId: string
    signature?: string
    nonce?: string
    publicKey?: string
  }

  // Validate party ID format: hint::hexfingerprint (64+ hex chars)
  if (!/^[a-zA-Z0-9_-]+::[a-f0-9]{64,}$/.test(partyId)) {
    return NextResponse.json(
      { error: 'Invalid Canton party ID format. Expected: hint::hexfingerprint' },
      { status: 400 }
    )
  }

  if (VERIFY) {
    // Require all three fields when verification is on
    if (!signature || !nonce || !publicKey) {
      return NextResponse.json(
        { error: 'signature, nonce, and publicKey are required when CANTON_VERIFY_SIGNATURES=true' },
        { status: 400 }
      )
    }

    // Validate nonce exists and has not expired (stored as VerificationToken)
    const storedNonce = await prisma.verificationToken.findUnique({
      where: { token: nonce },
    })
    if (!storedNonce || storedNonce.expires < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired nonce' }, { status: 401 })
    }

    // Consume nonce (one-time use)
    await prisma.verificationToken.delete({ where: { token: nonce } })

    // Verify the signature over the challenge message
    const message = `FlowLedger auth: ${nonce}`
    if (!verifyCantonSignature(message, signature, publicKey)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  // Find or create user by Canton party ID
  let user = await prisma.user.findFirst({ where: { cantonPartyId: partyId } })

  if (!user) {
    const hint = partyId.split('::')[0]
    user = await prisma.user.create({
      data: {
        email: `${hint}-${partyId.slice(-8)}@canton.wallet`,
        cantonPartyId: partyId,
        name: hint,
      },
    })
  }

  const sessionToken = crypto.randomUUID()
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires },
  })

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id },
    include: { organization: true },
  })

  const redirectTo = membership ? `/${membership.organization.slug}/dashboard` : '/onboarding'

  const response = NextResponse.json({ redirectTo, partyId })
  response.cookies.set('authjs.session-token', sessionToken, {
    expires,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  })
  return response
}

// GET /api/auth/canton-wallet/nonce
// Returns a fresh one-time nonce stored with a 5-minute TTL.
// The client passes this to wallet.signMessage(), then POSTs it back.
export async function GET() {
  const nonce = crypto.randomUUID()
  const expires = new Date(Date.now() + NONCE_TTL_MS)

  // Reuse VerificationToken model — identifier distinguishes nonces from email tokens
  await prisma.verificationToken.create({
    data: { identifier: 'canton-wallet-nonce', token: nonce, expires },
  })

  return NextResponse.json({ nonce })
}
