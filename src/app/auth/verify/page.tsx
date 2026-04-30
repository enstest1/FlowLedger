import { Mail } from 'lucide-react'
import Link from 'next/link'

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail size={28} className="text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">
            Check your inbox
          </h1>
          <p className="text-zinc-500 mb-6">
            We sent you a magic link. Click it to sign in to FlowLedger.
          </p>
          <p className="text-sm text-zinc-400">
            Didn&apos;t get it?{' '}
            <Link
              href="/auth/signin"
              className="text-indigo-600 hover:underline"
            >
              Try again
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
