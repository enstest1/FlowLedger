import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const isAuthPage = pathname.startsWith('/auth')
  const isPublic = pathname === '/'
  const isApiRoute = pathname.startsWith('/api')
  const isStatic =
    pathname.startsWith('/_next') || pathname === '/favicon.ico'

  if (isStatic || isApiRoute || isPublic || isAuthPage) {
    return NextResponse.next()
  }

  // Check for session cookie (NextAuth sets either of these)
  const sessionToken =
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value ||
    request.cookies.get('next-auth.session-token')?.value

  if (!sessionToken) {
    const signinUrl = new URL('/auth/signin', request.url)
    signinUrl.searchParams.set('callbackUrl', request.url)
    return NextResponse.redirect(signinUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
