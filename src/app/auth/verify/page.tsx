import { Mail } from 'lucide-react'
import Link from 'next/link'

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border p-8 text-center">
          <div className="w-14 h-14 bg-purple-100 flex items-center justify-center mx-auto mb-6">
            <Mail size={24} className="text-purple-600" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Check your inbox
          </h1>
          <p className="text-muted-foreground mb-6">
            We sent you a magic link. Click it to sign in to FlowLedger.
          </p>
          <p className="text-sm text-muted-foreground/70">
            Didn&apos;t get it?{' '}
            <Link
              href="/auth/signin"
              className="text-primary hover:underline"
            >
              Try again
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
