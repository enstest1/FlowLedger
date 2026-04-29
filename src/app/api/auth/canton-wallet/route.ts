import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/auth/canton-wallet
// Body: { partyId: string, signature?: string, nonce?: string }
//
// Creates or finds a user by Canton party ID, opens a session, sets cookie.
// In production, verify signature against nonce before trusting the party ID.

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body?.partyId) {
    return NextResponse.json({ error: 'partyId is required' }, { status: 400 })
  }

  const { partyId } = body as { partyId: string; signature?: string; nonce?: string }

  // Validate party ID format: hint::hexfingerprint
  if (!/^[a-zA-Z0-9_-]+::[a-f0-9]{64,}$/.test(partyId)) {
    return NextResponse.json(
      { error: 'Invalid Canton party ID format. Expected: hint::hexfingerprint' },
      { status: 400 }
    )
  }

  // TODO (production): verify body.signature against body.nonce using body.publicKey
  // const valid = verifyCantonSignature(partyId, nonce, signature)
  // if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })

  // Find existing user by party ID, or create a new one
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

  // Find org membership to redirect to dashboard
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id },
    include: { organization: true },
  })

  const redirectTo = membership
    ? `/${membership.organization.slug}/dashboard`
    : '/onboarding'

  const response = NextResponse.json({ redirectTo, partyId })
  response.cookies.set('authjs.session-token', sessionToken, {
    expires,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })
  return response
}

// GET /api/auth/canton-wallet/nonce — generate a fresh nonce for wallet signing
export async function GET() {
  const nonce = crypto.randomUUID()
  // In production: store nonce in DB/cache with short TTL before returning
  return NextResponse.json({ nonce })
}
